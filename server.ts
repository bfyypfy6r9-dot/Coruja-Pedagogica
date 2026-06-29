import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import WebSocket from 'ws';
global.WebSocket = WebSocket as any;
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config({ override: true });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Initialize Supabase Clients
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Aviso: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
}

// Ensure the server doesn't crash if credentials are empty by passing dummy values during preview if needed,
// but the auth will inherently fail when routes are hit.
const validSupabaseUrl = supabaseUrl || "https://dummy.supabase.co";
const dummyJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.valid-dummy-key-for-validation";
const validServiceKey = supabaseServiceKey || dummyJwt;

// Admin client (bypasses RLS)
const supabaseAdmin = createClient(validSupabaseUrl, validServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Initialize Gemini SDK with lazy loading helper
let cachedAi: GoogleGenAI | null = null;
let lastApiKey: string | undefined = undefined;

function getGeminiClient(): GoogleGenAI {
  const currentKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!currentKey) {
    throw new Error("A chave GEMINI_API_KEY não foi encontrada nas variáveis de ambiente. Revise suas configurações.");
  }
  if (!cachedAi || lastApiKey !== currentKey) {
    cachedAi = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    lastApiKey = currentKey;
  }
  return cachedAi;
}

// Robust fallback wrapper in case gemini-3.5-flash free-tier quota is exhausted (limit 20 requests/day per key)
async function generateContentWithFallback(ai: GoogleGenAI, parameters: { model: string; contents: any; config: any }) {
  try {
    return await ai.models.generateContent(parameters);
  } catch (error: any) {
    const errorMsg = error.message || "";
    if (
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      errorMsg.includes("Quota exceeded") ||
      errorMsg.includes("quota exceeded") ||
      errorMsg.includes("429")
    ) {
      console.warn(`[Gemini API] Quota limit reached for ${parameters.model}. Falling back to gemini-3.1-flash-lite...`);
      const fallbackParameters = {
        ...parameters,
        model: "gemini-3.1-flash-lite",
      };
      return await ai.models.generateContent(fallbackParameters);
    }
    throw error;
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", apiConfigured: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY) });
});

// Middleware to check session
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token = req.cookies.sb_token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return res.status(401).json({ error: "Não autorizado" });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Sessão inválida" });

  const { data: profile } = await supabaseAdmin.from("perfis").select("*").eq("id", user.id).single();
  if (!profile || !profile.ativo) return res.status(403).json({ error: "Conta inativa" });

  (req as any).user = { ...user, ...profile };
  next();
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).user.role !== 'admin') return res.status(403).json({ error: "Acesso negado" });
  next();
};

// Auth endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user is active in DB before actually issuing JWT for client? 
    // Best way: login with a temporary generic client, then check database.
    const validAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || supabaseServiceKey || dummyJwt;
    const tempClient = createClient(validSupabaseUrl, validAnonKey);
    const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
    
    if (error) return res.status(401).json({ error: "Credenciais inválidas" });
    
    // Check if active
    const { data: profile } = await supabaseAdmin.from("perfis").select("*").eq("id", data.user.id).single();
    if (!profile || !profile.ativo) {
      return res.status(403).json({ error: "Conta inativa. Contate o administrador." });
    }

    res.cookie("sb_token", data.session.access_token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: "none",
      path: "/"
    });
    res.json({ session: data.session, user: { ...data.user, ...profile } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("sb_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/"
  });
  res.json({ message: "Logout realizado" });
});

app.get("/api/auth/session", authenticate, (req, res) => {
  res.json({ session: { access_token: req.cookies.sb_token }, user: (req as any).user });
});

// Admin endpoints
app.get("/api/admin/usuarios", authenticate, requireAdmin, async (req, res) => {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Sua instância Supabase não está configurada corretamente nas propriedades do app." });
  }
  const { data, error } = await supabaseAdmin.from("perfis").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/admin/criar-usuario", authenticate, requireAdmin, async (req, res) => {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Sua instância Supabase não está configurada corretamente nas propriedades do app." });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    
    if (authError) {
      if (authError.message.includes("Not authorized") || authError.status === 401 || authError.status === 403) {
        return res.status(403).json({ error: "Não autorizado: Verifique a configuração da SUPABASE_SERVICE_ROLE_KEY no admin." });
      }
      return res.status(400).json({ error: authError.message });
    }

    if (!authData?.user) {
      return res.status(500).json({ error: "Erro desconhecido: Usuário não foi retornado pelo Supabase." });
    }

    const { error: dbError } = await supabaseAdmin.from("perfis").upsert({
      id: authData.user.id,
      email: authData.user.email,
      role: 'user',
      ativo: true
    }, { onConflict: "id" });
    
    if (dbError) {
      return res.status(500).json({ error: `Erro ao salvar perfil: ${dbError.message}` });
    }

    res.status(201).json({ message: "Usuário criado com sucesso", user: authData.user });
  } catch (error: any) {
    console.error("[criar-usuario] erro:", error);
    res.status(500).json({ error: error.message || "Erro desconhecido ao tentar criar usuário." });
  }
});

app.patch("/api/admin/usuario/:id/ativo", authenticate, requireAdmin, async (req, res) => {
  const { ativo } = req.body;
  const { error } = await supabaseAdmin.from("perfis").update({ ativo }).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.patch("/api/admin/usuario/:id/role", authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  const { error } = await supabaseAdmin.from("perfis").update({ role }).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Endpoint: Webhook da Hotmart
app.post("/webhook-hotmart", async (req, res) => {
  try {
    const hotmartToken = process.env.HOTMART_HOTTOK;
    
    // Na v1 pode vir direto no body.hottok ou headers, na v2 costuma vir nos headers
    const receivedToken = req.headers["x-hotmart-hottok"] || (req.body && req.body.hottok);

    if (!hotmartToken) {
      console.error("ERRO: HOTMART_HOTTOK não configurado nas variáveis de ambiente!");
      return res.status(500).send("Erro interno do servidor.");
    }

    // Camada de Segurança Requerida: Validar o Hottok
    if (receivedToken !== hotmartToken) {
      console.error("Tentativa de acesso não autorizada. Hottok inválido:", receivedToken);
      return res.status(403).send("Não autorizado");
    }

    // Identifica o evento (V1 envia 'status', V2 envia 'event')
    const event = req.body.event || req.body.status;

    // Queremos criar o usuário APENAS se a compra foi aprovada
    if (event === "PURCHASE_APPROVED" || event === "approved") {
      const email = req.body.data?.buyer?.email || req.body.email;
      const firstName = req.body.data?.buyer?.name?.split(' ')[0] || req.body.first_name || 'Usuário';

      if (!email) {
        throw new Error("E-mail do comprador não encontrado no payload da Hotmart.");
      }

      // 1. Gerar senha aleatória forte de 8 caracteres
      const geradorSenha = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&';
        let passwd = '';
        for (let i = 0; i < 8; i++) {
          passwd += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return passwd;
      };
      const novaSenha = geradorSenha();

      // 2. Criar ou atualizar usuário no Supabase
      const { data: usuarioExistente } = await supabaseAdmin.from("perfis").select("id").eq("email", email).single();
      
      let uId = "";

      if (usuarioExistente) {
        // Se a pessoa comprar de novo (ex renovação que deu erro e ela recomprou), 
        // ou já tem conta, podemos atualizar a senha e reativar.
        uId = usuarioExistente.id;
        await supabaseAdmin.auth.admin.updateUserById(uId, { password: novaSenha });
        await supabaseAdmin.from("perfis").update({ ativo: true, role: 'user' }).eq("id", uId);
      } else {
        // Criar conta totalmente nova no Auth do Supabase
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: novaSenha,
          email_confirm: true,
        });

        if (authError || !authData?.user) {
          throw new Error(`Erro Supabase ao criar usuário Auth: ${authError?.message}`);
        }
        uId = authData.user.id;

        // Inserir registro correspondente na tabela "perfis"
        await supabaseAdmin.from("perfis").upsert({
          id: uId,
          email: email,
          role: 'user', // Pode ser usado 'premium' ou afins caso o App.tsx limite funções por role
          ativo: true
        });
      }

      // 3. Disparar e-mail com os dados de acesso
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 465,
          secure: Number(process.env.SMTP_PORT) === 465, // porta 465 exige TLS (secure true)
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const appUrl = process.env.APP_URL || "https://meu-app.onrender.com";

        await transporter.sendMail({
          from: `"Suporte" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: email,
          subject: "Seu acesso chegou! O Gerador de Planos de Aula 🚀",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
              <h2 style="color: #2563eb;">Obrigado pela compra, ${firstName}!</h2>
              <p>O seu pagamento foi confirmado! A partir de agora, planejar as suas aulas vai ser muito mais fácil.</p>
              <br/>
              <p>Os seus dados de acesso exclusivos (guarde com segurança):</p>
              <ul style="background: #f8fafc; padding: 20px; border-radius: 8px;">
                <li><strong>Acessar plataforma:</strong> <a href="${appUrl}" style="color: #2563eb; text-decoration: none;">Clique aqui para entrar</a></li>
                <li><strong>E-mail:</strong> ${email}</li>
                <li><strong>Senha provisória:</strong> ${novaSenha}</li>
              </ul>
              <br/>
              <p>Qualquer dúvida, é só responder este e-mail.</p>
              <p>Um abraço,<br><strong>Equipe</strong></p>
            </div>
          `,
        });
        console.log(`[Webhook Hotmart] E-mail enviado com sucesso para ${email}`);
      } else {
        console.warn("[Webhook Hotmart] Conta de e-mail criada, mas SMTP não configurado. Nenhum e-mail enviado.");
      }

      return res.status(200).send("Usuário cadastrado com sucesso!");
    }

    // Caso o evento seja CART_ABANDONED, PURCHASE_REFUNDED, ignorar, mas com status 200
    return res.status(200).send("Evento Webhook recebido, mas não aplicável.");

  } catch (error: any) {
    console.error("[Webhook Hotmart] Erro Crítico:", error);
    return res.status(500).send(`Erro interno ao processar recebimento: ${error.message}`);
  }
});

// Endpoint to suggest BNCC skills and competency mapping
app.post("/api/gemini/suggest-bncc", async (req, res) => {
  try {
    const { disciplina, turma, tema } = req.body;

    if (!disciplina || !turma || !tema) {
      return res.status(400).json({ error: "Campos 'disciplina', 'turma' e 'tema' são obrigatórios." });
    }

    const systemInstruction = `Você é um assessor pedagógico sênior especialista na BNCC (Base Nacional Comum Curricular) do Brasil.
Sua tarefa é sugerir Competências Gerais, Competências Específicas, Habilidades oficiais (com códigos BNCC, ex: EF09MA02) e Objetos do Conhecimento para a aula solicitada.
Sempre envie as respostas em Português do Brasil de forma estruturada.`;

    const prompt = `Sugira itens da BNCC para um plano de aula de:
- Disciplina: ${disciplina}
- Turma/Ano: ${turma}
- Tema / Objeto do Conhecimento: ${tema}

Forneça os seguintes dados em formato JSON estruturado seguindo o esquema definido.`;

    const client = getGeminiClient();
    const response = await generateContentWithFallback(client, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objetosConhecimento: {
              type: Type.STRING,
              description: "Objetos do conhecimento do plano de aula, refinados a partir do tema.",
            },
            competencias: {
              type: Type.STRING,
              description: "Competências gerais e específicas da BNCC que serão desenvolvidas.",
            },
            habilidades: {
              type: Type.STRING,
              description: "Habilidades oficiais com seus códigos BNCC (ex: 'EF09MA09: Realizar ...'). Liste as principais.",
            },
            problematizacao: {
              type: Type.STRING,
              description: "Uma pergunta disparadora profissional que conecte o tema ao cotidiano dos alunos.",
            },
            objetivosAprendizagem: {
              type: Type.STRING,
              description: "Objetivos de aprendizagem claros (usando verbos de Bloom, ex: Compreender, Identificar).",
            },
          },
          required: ["objetosConhecimento", "competencias", "habilidades", "problematizacao", "objetivosAprendizagem"],
        },
      },
    });

    const jsonText = response.text ? response.text.trim() : "{}";
    const data = JSON.parse(jsonText);
    res.json(data);
  } catch (error: any) {
    console.error("Erro no suggest-bncc:", error);
    res.status(500).json({ error: "Erro ao gerar sugestões da BNCC.", details: error.message });
  }
});

// Endpoint to generate full 5-class pedagogical plan
app.post("/api/gemini/generate-lesson-plan", async (req, res) => {
  try {
    const {
      professor,
      disciplina,
      turma,
      bimestre,
      semanaData,
      tema,
      objetosConhecimento,
      competencias,
      habilidades,
      problematizacao,
      objetivosAprendizagem,
      selectedLessons,
    } = req.body;

    const lessonsToGen: number[] = Array.isArray(selectedLessons) && selectedLessons.length > 0 
      ? selectedLessons.map(Number).filter(n => n >= 1 && n <= 12)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const systemInstruction = `Você é um especialista em planejamento pedagógico e metodologias ativas de ensino.
Sua missão é desenvolver o detalhamento de aulas sequenciais específicas baseadas nas informações do professor.
Você deve planejar exatamente as seguintes aulas: ${lessonsToGen.map(n => `Aula ${n}`).join(", ")}.
Cada uma dessas aulas deve ter OBRIGATORIAMENTE três seções bem definidas:
1. Introdução: Atividade motivadora, contextualização e acolhimento (máx 500 caract.)
2. Desenvolvimento: Prática ativa, atividades, explicações e debates (máx 1000 caract.)
3. Conclusão: Feedback, autoavaliação ou fechamento (máx 500 caract.)

Garanta que as aulas façam sentido pedagógico progressivo para o tema abordado. Responda em Português do Brasil com excelente redação acadêmica de forma estruturada.`;

    const prompt = `Gere os planos de aula para as Aulas: ${lessonsToGen.map(n => `Aula ${n}`).join(", ")} baseado nas informações abaixo:
- Professor: ${professor || "Não informado"}
- Disciplina: ${disciplina}
- Turma/Ano: ${turma}
- Bimestre: ${bimestre}
- Tema: ${tema}
- Objetos de Conhecimento: ${objetosConhecimento}
- Competências: ${competencias}
- Habilidades BNCC: ${habilidades}
- Problematização: ${problematizacao}
- Objetivos de Aprendizagem: ${objetivosAprendizagem}

Forneça planos detalhados para cada uma das aulas solicitadas (${lessonsToGen.map(n => `Aula ${n}`).join(", ")}), contendo obrigatoriamente introducao, desenvolvimento e conclusao.`;

    const schemaProperties: any = {};
    const schemaRequired: string[] = [];

    lessonsToGen.forEach((num) => {
      const key = `aula${num}`;
      schemaProperties[key] = {
        type: Type.OBJECT,
        properties: {
          intro: { type: Type.STRING, description: `Introdução da Aula ${num}` },
          desenv: { type: Type.STRING, description: `Desenvolvimento da Aula ${num}` },
          concl: { type: Type.STRING, description: `Conclusão da Aula ${num}` },
        },
        required: ["intro", "desenv", "concl"],
      };
      schemaRequired.push(key);
    });

    const client = getGeminiClient();
    const response = await generateContentWithFallback(client, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: schemaRequired,
        },
      },
    });

    const jsonText = response.text ? response.text.trim() : "{}";
    const data = JSON.parse(jsonText);
    res.json(data);
  } catch (error: any) {
    console.error("Erro no generate-lesson-plan:", error);
    res.status(500).json({ error: "Erro ao gerar plano das aulas sequenciais com IA.", details: error.message });
  }
});

// Endpoint to save custom default template from school
app.post("/api/template/save", (req, res) => {
  try {
    const { name, base64, size } = req.body;
    if (!base64) {
      return res.status(400).json({ error: "Nenhum arquivo base64 foi fornecido." });
    }
    const buffer = Buffer.from(base64, "base64");
    const templatePath = path.join(process.cwd(), "school_default_template.docx");
    const metaPath = path.join(process.cwd(), "school_default_template.json");
    
    fs.writeFileSync(templatePath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify({ name, size }));
    
    res.json({ status: "success", message: "Modelo salvo com sucesso como padrão da escola." });
  } catch (err: any) {
    console.error("Error saving template:", err);
    res.status(500).json({ error: "Erro ao salvar o modelo da escola.", details: err.message });
  }
});

// Endpoint to retrieve custom default template
app.get("/api/template/get", (req, res) => {
  try {
    const templatePath = path.join(process.cwd(), "school_default_template.docx");
    const metaPath = path.join(process.cwd(), "school_default_template.json");
    
    if (fs.existsSync(templatePath) && fs.existsSync(metaPath)) {
      const buffer = fs.readFileSync(templatePath);
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      const base64 = buffer.toString("base64");
      res.json({ name: meta.name, size: meta.size, base64 });
    } else {
      res.json({ name: null });
    }
  } catch (err: any) {
    console.error("Error retrieving template:", err);
    res.status(500).json({ error: "Erro ao buscar modelo de escola salvo.", details: err.message });
  }
});

// Endpoint to delete custom default template
app.post("/api/template/delete", (req, res) => {
  try {
    const templatePath = path.join(process.cwd(), "school_default_template.docx");
    const metaPath = path.join(process.cwd(), "school_default_template.json");
    
    if (fs.existsSync(templatePath)) {
      fs.unlinkSync(templatePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    res.json({ status: "success", message: "Modelo customizado removido do servidor." });
  } catch (err: any) {
    console.error("Error deleting template:", err);
    res.status(500).json({ error: "Erro ao deletar modelo.", details: err.message });
  }
});

// Integrate Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

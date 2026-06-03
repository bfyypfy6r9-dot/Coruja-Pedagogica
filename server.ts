import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";

// NodeJS 20 on some platforms lacks native WebSocket for Supabase Realtime
global.WebSocket = require("ws");

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
  const currentKey = process.env.GEMINI_API_KEY;
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
  res.json({ status: "ok", apiConfigured: !!process.env.GEMINI_API_KEY });
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
      ? selectedLessons.map(Number).filter(n => n >= 1 && n <= 6)
      : [1, 2, 3, 4, 5, 6];

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

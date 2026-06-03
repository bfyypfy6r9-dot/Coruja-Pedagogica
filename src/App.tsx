import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  User, 
  Users, 
  BookOpen, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Download, 
  Printer, 
  CheckCircle2, 
  Info, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight,
  FolderOpen,
  LogIn,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LessonPlanData, BNCCSkill } from "./types";
import { SUBJECTS, GRADES, BIMESTRES, BNCC_OFFLINE_SKILLS, BNCC_GENERAL_COMPETENCES } from "./data";
import { generateDocxFile } from "./documentGenerator";
import Login from "./Login";
import PainelAdmin from "./PainelAdmin";

// Initialize empty lesson plan state
const initialPlanState: LessonPlanData = {
  professor: "",
  turma: GRADES[0],
  disciplina: SUBJECTS[0],
  bimestre: BIMESTRES[0],
  ano: "2026",
  semanaData: "",
  tema: "",
  objetosConhecimento: "",
  competencias: "",
  habilidades: "",
  problematizacao: "",
  objetivosAprendizagem: "",
  aula1: { intro: "", desenv: "", concl: "" },
  aula2: { intro: "", desenv: "", concl: "" },
  aula3: { intro: "", desenv: "", concl: "" },
  aula4: { intro: "", desenv: "", concl: "" },
  aula5: { intro: "", desenv: "", concl: "" },
  aula6: { intro: "", desenv: "", concl: "" },
};

/**
 * Advanced pedagogical preprocessor for school DOCX custom templates.
 * Replaces tags, placeholders (like [PROFESSOR]) and literal labels (like 'Professor:')
 * with filled data, preserving original style completely.
 */
function smartFillDocxXml(xmlStr: string, plan: LessonPlanData): string {
  // Regex to match a paragraph cleanly, capturing its opening tag with attributes and its body content
  const wPRegex = /(<w:p(?: [^>]*)?>)([\s\S]*?)<\/w:p>/g;
  
  return xmlStr.replace(wPRegex, (paragraphXml, pStartTag, paragraphBody) => {
    // 1. Parse all <w:t> nodes in the paragraph body sequentially.
    // We want to extract them in a way where each node is an object containing its exact start tag, attributes, and text content.
    const wTRegex = /<w:t([^>]*)?>([\s\S]*?)<\/w:t>/g;
    const tNodes: { fullNode: string; attrs: string; text: string }[] = [];
    let match;
    let plainText = "";
    
    while ((match = wTRegex.exec(paragraphBody)) !== null) {
      plainText += match[2];
      tNodes.push({
        fullNode: match[0],
        attrs: match[1] || "",
        text: match[2]
      });
    }

    if (tNodes.length === 0) return paragraphXml;

    // Define alignment/fields mapping
    const fieldMappings = [
      {
        key: "professor",
        value: plan.professor || "",
        tags: [/{professor}/i, /{{professor}}/i, /\[professor\]/i, /\[docente\]/i, /{docente}/i],
        labels: [/professora?\s*\(?a?\)?\s*:/i, /docente\s*:/i, /professor\s+\d+:/i]
      },
      {
        key: "disciplina",
        value: plan.disciplina || "",
        tags: [/{disciplina}/i, /{{disciplina}}/i, /\[disciplina\]/i, /\[matéria\]/i, /\[materia\]/i, /{materia}/i],
        labels: [/disciplina\s*:/i, /matéria\s*:/i, /materia\s*:/i, /componente\s+curricular\s*:/i]
      },
      {
        key: "turma",
        value: plan.turma || "",
        tags: [/{turma}/i, /{{turma}}/i, /\[turma\]/i, /\[série\]/i, /\[serie\]/i, /{serie}/i],
        labels: [/turma\s*:/i, /série\s*:/i, /serie\s*:/i, /ano\s+escolar\s*:/i]
      },
      {
        key: "bimestre",
        value: plan.bimestre || "",
        tags: [/{bimestre}/i, /{{bimestre}}/i, /\[bimestre\]/i, /\[período\]/i, /\[periodo\]/i],
        labels: [/bimestre\s*:/i, /período\s*:/i, /periodo\s*:/i]
      },
      {
        key: "ano",
        value: plan.ano || "2026",
        tags: [/{ano}/i, /{{ano}}/i, /\[ano\]/i, /\[ano\s+letivo\]/i],
        labels: [/ano\s+letivo\s*:/i, /ano\s*:/i]
      },
      {
        key: "semanaData",
        value: plan.semanaData || "",
        tags: [/{semana}/i, /{{semana}}/i, /\[semana\]/i, /{data}/i, /{{data}}/i, /\[data\]/i, /\[semana_data\]/i],
        labels: [/data\s*:/i, /semana\s*:/i, /período\s+semanal\s*:/i, /periodo\s+semanal\s*:/i]
      },
      {
        key: "tema",
        value: plan.tema || "",
        tags: [/{tema}/i, /{{tema}}/i, /\[tema\]/i, /{assunto}/i, /\[assunto\]/i, /{conteúdo}/i, /{conteudo}/i],
        labels: [/tema\s*\(?s?\)?\s*:/i, /assunto\s*:/i, /conteúdo\s*:/i, /conteudo\s*:/i]
      },
      {
        key: "objetosConhecimento",
        value: plan.objetosConhecimento || "",
        tags: [/{objetosConhecimento}/i, /{{objetosConhecimento}}/i, /\[objetos_de_conhecimento\]/i, /\[objetos\]/i],
        labels: [/objetos?\s+(?:de\s+)?conhecimento\s*:/i, /conteúdo\s+programático\s*:/i]
      },
      {
        key: "competencias",
        value: plan.competencias || "",
        tags: [/{competencias}/i, /{{competencias}}/i, /\[competencias\]/i, /{competências}/i],
        labels: [/competências\s*(?:gerais|específicas)?\s*:/i, /competencias\s*(?:gerais|especificas)?\s*:/i]
      },
      {
        key: "habilidades",
        value: plan.habilidades || "",
        tags: [/{habilidades}/i, /{{habilidades}}/i, /\[habilidades\]/i, /\[bncc\]/i, /{bncc}/i],
        labels: [/habilidades\s*\(?s?\)?\s*(?:\(?(?:bncc)\)?)?\s*:/i, /código\s+bncc\s*:/i]
      },
      {
        key: "problematizacao",
        value: plan.problematizacao || "",
        tags: [/{problematizacao}/i, /{{problematizacao}}/i, /\[problematizacao\]/i, /\[pergunta_disparadora\]/i],
        labels: [/problematização\s*:/i, /problematizacao\s*:/i, /pergunta\s+disparadora\s*:/i]
      },
      {
        key: "objetivosAprendizagem",
        value: plan.objetivosAprendizagem || "",
        tags: [/{objetivos}/i, /{{objetivos}}/i, /\[objetivos_de_aprendizagem\]/i, /\[objetivos\]/i],
        labels: [/objetivos?\s+(?:de\s+)?aprendizagem\s*:/i, /objetivos\s*:/i]
      }
    ];

    // Add Lesson 1 to 6 dynamically
    for (let i = 1; i <= 6; i++) {
      const key = `aula${i}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6";
      const aula = plan[key];
      
      fieldMappings.push(
        {
          key: `aula${i}_intro`,
          value: aula.intro || "",
          tags: [
            new RegExp(`{aula${i}_intro}`, 'i'), new RegExp(`{{aula${i}_intro}}`, 'i'), new RegExp(`\\[aula${i}_intro\\]`, 'i'),
            new RegExp(`{aula${i}_introducao}`, 'i'), new RegExp(`{{aula${i}_introducao}}`, 'i'), new RegExp(`\\[aula${i}_introducao\\]`, 'i'),
            new RegExp(`{aula_${i}_intro}`, 'i'), new RegExp(`{{aula_${i}_intro}}`, 'i'), new RegExp(`\\[aula_${i}_intro\\]`, 'i'),
            new RegExp(`{aula_${i}_introducao}`, 'i'), new RegExp(`{{aula_${i}_introducao}}`, 'i'), new RegExp(`\\[aula_${i}_introducao\\]`, 'i')
          ],
          labels: [
            new RegExp(`aula\\s*${i}\\s*-\\s*(?:introdução|introducao|acolhimento)\\s*:`, 'i'),
            new RegExp(`introdução\\s*(?:da\\s+)?aula\\s*${i}\\s*:`, 'i'),
            new RegExp(`introducao\\s*(?:da\\s+)?aula\\s*${i}\\s*:`, 'i')
          ]
        },
        {
          key: `aula${i}_desenv`,
          value: aula.desenv || "",
          tags: [
            new RegExp(`{aula${i}_desenv}`, 'i'), new RegExp(`{{aula${i}_desenv}}`, 'i'), new RegExp(`\\[aula${i}_desenv\\]`, 'i'),
            new RegExp(`{aula${i}_desenvolvimento}`, 'i'), new RegExp(`{{aula${i}_desenvolvimento}}`, 'i'), new RegExp(`\\[aula${i}_desenvolvimento\\]`, 'i'),
            new RegExp(`{aula_${i}_desenv}`, 'i'), new RegExp(`{{aula_${i}_desenv}}`, 'i'), new RegExp(`\\[aula_${i}_desenv\\]`, 'i'),
            new RegExp(`{aula_${i}_desenvolvimento}`, 'i'), new RegExp(`{{aula_${i}_desenvolvimento}}`, 'i'), new RegExp(`\\[aula_${i}_desenvolvimento\\]`, 'i')
          ],
          labels: [
            new RegExp(`aula\\s*${i}\\s*-\\s*(?:desenvolvimento|prática|atividade)\\s*:`, 'i'),
            new RegExp(`desenvolvimento\\s*(?:da\\s+)?aula\\s*${i}\\s*:`, 'i')
          ]
        },
        {
          key: `aula${i}_concl`,
          value: aula.concl || "",
          tags: [
            new RegExp(`{aula${i}_concl}`, 'i'), new RegExp(`{{aula${i}_concl}}`, 'i'), new RegExp(`\\[aula${i}_concl\\]`, 'i'),
            new RegExp(`{aula${i}_conclusao}`, 'i'), new RegExp(`{{aula${i}_conclusao}}`, 'i'), new RegExp(`\\[aula${i}_conclusao\\]`, 'i'),
            new RegExp(`{aula_${i}_concl}`, 'i'), new RegExp(`{{aula_${i}_concl}}`, 'i'), new RegExp(`\\[aula_${i}_concl\\]`, 'i'),
            new RegExp(`{aula_${i}_conclusao}`, 'i'), new RegExp(`{{aula_${i}_conclusao}}`, 'i'), new RegExp(`\\[aula_${i}_conclusao\\]`, 'i'),
            new RegExp(`{aula${i}_conc}`, 'i'), new RegExp(`{{aula${i}_conc}}`, 'i'), new RegExp(`\\[aula${i}_conc\\]`, 'i'),
            new RegExp(`{aula_${i}_conc}`, 'i'), new RegExp(`{{aula_${i}_conc}}`, 'i'), new RegExp(`\\[aula_${i}_conc\\]`, 'i')
          ],
          labels: [
            new RegExp(`aula\\s*${i}\\s*-\\s*(?:conclusão|conclusao|fechamento|avaliação)\\s*:`, 'i'),
            new RegExp(`conclusão\\s*(?:da\\s+)?aula\\s*${i}\\s*:`, 'i'),
            new RegExp(`conclusao\\s*(?:da\\s+)?aula\\s*${i}\\s*:`, 'i')
          ]
        }
      );
    }

    // Sequentially process the tNodes to replace tags or literal fields
    let paragraphFinished = false;
    
    for (const mapping of fieldMappings) {
      if (!mapping.value || paragraphFinished) continue;

      // Class A: Look for explicit tag match: like {professor} or [PROFESSOR] anywhere inside the plainText
      let matchedTag = null;
      for (const tagRegex of mapping.tags) {
        if (tagRegex.test(plainText)) {
          matchedTag = tagRegex;
          break;
        }
      }

      if (matchedTag) {
        let tagFoundInSingleNode = false;
        tNodes.forEach((node) => {
          if (matchedTag && matchedTag.test(node.text)) {
            node.text = node.text.replace(matchedTag, mapping.value);
            tagFoundInSingleNode = true;
          }
        });

        if (!tagFoundInSingleNode && matchedTag) {
          const newPlainText = plainText.replace(matchedTag, mapping.value);
          tNodes.forEach((node, nodeIdx) => {
            if (nodeIdx === 0) {
              node.text = newPlainText;
            } else {
              node.text = "";
            }
          });
          plainText = newPlainText;
        }
        paragraphFinished = true;
        continue;
      }

      // Class B: Look for literal labels with underlines or colons, e.g., "Professor: _______"
      let matchedLabel = null;
      for (const labelRegex of mapping.labels) {
        if (labelRegex.test(plainText)) {
          matchedLabel = labelRegex;
          break;
        }
      }

      if (matchedLabel) {
        const hasUnderlines = /_{2,}/.test(plainText);
        const hasDots = /\.{4,}/.test(plainText);

        if (hasUnderlines) {
          let underlineReplaced = false;
          tNodes.forEach((node) => {
            if (/_{2,}/.test(node.text)) {
              node.text = node.text.replace(/_{2,}/g, mapping.value);
              underlineReplaced = true;
            }
          });

          if (!underlineReplaced) {
            const newPlainText = plainText.replace(/_{2,}/g, mapping.value);
            tNodes.forEach((node, nodeIdx) => {
              if (nodeIdx === 0) {
                node.text = newPlainText;
              } else {
                node.text = "";
              }
            });
            plainText = newPlainText;
          }
          paragraphFinished = true;
        } else if (hasDots) {
          let dotsReplaced = false;
          tNodes.forEach((node) => {
            if (/\.{4,}/.test(node.text)) {
              node.text = node.text.replace(/\.{4,}/g, " " + mapping.value);
              dotsReplaced = true;
            }
          });

          if (!dotsReplaced) {
            const newPlainText = plainText.replace(/\.{4,}/g, " " + mapping.value);
            tNodes.forEach((node, nodeIdx) => {
              if (nodeIdx === 0) {
                node.text = newPlainText;
              } else {
                node.text = "";
              }
            });
            plainText = newPlainText;
          }
          paragraphFinished = true;
        } else {
          // If no underlines or dots, append after colon label if value is missing and current suffix is blank
          const labelIndex = plainText.search(matchedLabel);
          const afterLabelText = plainText.substring(labelIndex).replace(matchedLabel, "").trim();
          
          if (afterLabelText.length < 5 && !plainText.includes(mapping.value)) {
            let appended = false;
            tNodes.forEach((node) => {
              if (matchedLabel && matchedLabel.test(node.text)) {
                node.text = node.text + " " + mapping.value;
                appended = true;
              }
            });

            if (!appended) {
              const lastNode = tNodes[tNodes.length - 1];
              lastNode.text = lastNode.text + " " + mapping.value;
            }
            paragraphFinished = true;
          }
        }
      }
    }

    // Reconstruct the paragraph xml body sequentially to keep exactly the same XML tag properties/attributes
    let matchCount = 0;
    const rebuiltBody = paragraphBody.replace(/<w:t([^>]*)?>([\s\S]*?)<\/w:t>/g, (originalWTNode, attrs, oldText) => {
      const currentNode = tNodes[matchCount];
      matchCount++;
      if (currentNode) {
        return `<w:t${currentNode.attrs}>${currentNode.text}</w:t>`;
      }
      return originalWTNode;
    });

    return `${pStartTag}${rebuiltBody}</w:p>`;
  });
}

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [showLogin, setShowLogin] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<number>(0);
  const [plan, setPlan] = useState<LessonPlanData>(initialPlanState);
  
  const [supabaseSession, setSupabaseSession] = useState<any>(null);

  // Custom uploaded DOCX template state
  const [uploadedTemplate, setUploadedTemplate] = useState<{
    name: string;
    size: string;
    buffer: ArrayBuffer;
  } | null>(null);

  // Custom uploaded BNCC PDF state
  const [uploadedPDF, setUploadedPDF] = useState<{
    name: string;
    size: string;
  } | null>(null);

  // UI state variables
  const [isSuggestingBNCC, setIsSuggestingBNCC] = useState<boolean>(false);
  const [isGeneratingLessons, setIsGeneratingLessons] = useState<boolean>(false);
  const [isRefiningContent, setIsRefiningContent] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Active lesson editor sub-tab
  const [activeLessonNum, setActiveLessonNum] = useState<number>(1);
  const [selectedLessonsToGen, setSelectedLessonsToGen] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [unifyLessons, setUnifyLessons] = useState<boolean>(false);

  // Export mode: "a" = Opção A (Fidelidade - Mapeamento), "b" = Opção B (Criativa - Markdown), "c" = Visualização A4
  const [exportOutputMode, setExportOutputMode] = useState<"a" | "b" | "c">("a");

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert Base64 string to ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Helper to convert ArrayBuffer to Base64 string
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Check session on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.session && data.user) {
            setIsAuthenticated(true);
            setUserRole(data.user.role);
            setSupabaseSession(data.session);
          }
        }
      } catch (err) {
        console.error("Erro ao checar sessão:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  // Check backend on load for saved school template
  useEffect(() => {
    const fetchSavedTemplate = async () => {
      try {
        const res = await fetch("/api/template/get", { credentials: 'include' });
        const data = await res.json();
        if (data && data.name && data.base64) {
          const buffer = base64ToArrayBuffer(data.base64);
          setUploadedTemplate({
            name: data.name,
            size: data.size,
            buffer: buffer
          });
        }
      } catch (err) {
        console.error("Erro ao carregar o modelo de escola salvo do servidor:", err);
      }
    };
    fetchSavedTemplate();
  }, []);

  // Handler to clear custom template both on UI and on Server workspace
  const handleRemoveTemplate = async () => {
    setUploadedTemplate(null);
    try {
      const response = await fetch("/api/template/delete", { method: "POST", credentials: 'include' });
      if (response.ok) {
        setSuccessMessage("Modelo da escola removido do servidor com sucesso. Retornado ao modelo padrão.");
      } else {
        setSuccessMessage("Filtro retirado localmente.");
      }
    } catch (err) {
      console.error("Erro ao deletar modelo no servidor:", err);
      setSuccessMessage("Retornado para o modelo padrão.");
    }
  };

  // Handle uploading custom BNCC PDF
  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Por favor, envie apenas arquivos no formato PDF (.pdf)");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    setUploadedPDF({
      name: file.name,
      size: sizeFormatted
    });
    setSuccessMessage(`Documento de BNCC em PDF "${file.name}" carregado com sucesso como referência pedagógica!`);
  };

  // Handle simple input changes
  const handleInputChange = (field: keyof LessonPlanData, value: string) => {
    setPlan(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle lesson-specific changes
  const handleLessonChange = (
    aulaKey: "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", 
    subKey: "intro" | "desenv" | "concl", 
    value: string
  ) => {
    setPlan(prev => ({
      ...prev,
      [aulaKey]: {
        ...prev[aulaKey],
        [subKey]: value
      }
    }));
  };

  // Calculate completion percentage
  const calculateCompletion = () => {
    let filledFields = 0;
    let totalFields = 11; // identification and pedagogical general fields

    const fieldsToCheck: (keyof LessonPlanData)[] = [
      "professor", "turma", "disciplina", "bimestre", "ano", 
      "semanaData", "tema", "objetosConhecimento", 
      "competencias", "habilidades", "problematizacao", "objetivosAprendizagem"
    ];

    fieldsToCheck.forEach(f => {
      if (typeof plan[f] === "string" && plan[f].toString().trim() !== "") {
        filledFields++;
      }
    });

    // Check lessons (6 lessons * 3 fields each)
    const lessons: ("aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6")[] = ["aula1", "aula2", "aula3", "aula4", "aula5", "aula6"];
    lessons.forEach(l => {
      totalFields += 3;
      if (plan[l].intro.trim() !== "") filledFields++;
      if (plan[l].desenv.trim() !== "") filledFields++;
      if (plan[l].concl.trim() !== "") filledFields++;
    });

    return Math.round((filledFields / totalFields) * 100);
  };

  // AI Service call: Predict BNCC Components
  const callSuggestBNCC = async () => {
    if (!isAuthenticated) {
      setShowLogin(true);
      setErrorMessage("Você precisa fazer login para acessar a inteligência artificial do Coruja.");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!plan.tema.trim()) {
      setErrorMessage("Por favor, preencha o campo 'Tema da Aula' na aba '1. Identificação' para que a IA possa analisar e sugerir os componentes.");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    setIsSuggestingBNCC(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch("/api/gemini/suggest-bncc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplina: plan.disciplina,
          turma: plan.turma,
          tema: plan.tema
        }),
      });

      if (!response.ok) {
        let errorMsg = "Falha ao comunicar com o assistente pedagógico.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.details || errorData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      setPlan(prev => ({
        ...prev,
        objetosConhecimento: data.objetosConhecimento || prev.objetosConhecimento,
        competencias: data.competencias || prev.competencias,
        habilidades: data.habilidades || prev.habilidades,
        problematizacao: data.problematizacao || prev.problematizacao,
        objetivosAprendizagem: data.objetivosAprendizagem || prev.objetivosAprendizagem
      }));

      setSuccessMessage("BNCC e dados pedagógicos sugeridos com sucesso pelo assistente!");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded") || msg.includes("quota exceeded") || msg.includes("429")) {
        setErrorMessage(
          "Limite de cota de inteligência artificial excedido (Erro 429). Isso significa que a sua chave de API gratuita atingiu o limite diário padrão do Google (20 solicitações por dia para o modelo gemini-3.5-flash). Você pode voltar a utilizar gratuitamente assim que a cota for reiniciada após 24 horas do primeiro uso. Se precisar de uso ilimitado imediatamente, crie uma chave de API com cobrança (pay-as-you-go) ativada nas configurações do Google AI Studio."
        );
      } else {
        setErrorMessage(`Erro ao consultar inteligência artificial da BNCC: ${msg}. Por favor, revise a sua chave de API nas configurações.`);
      }
    } finally {
      setIsSuggestingBNCC(false);
    }
  };

  // AI Service call: Generate selected sequential lessons
  const callGenerateLessons = async () => {
    if (!isAuthenticated) {
      setShowLogin(true);
      setErrorMessage("Você precisa fazer login para acessar a geração por inteligência artificial.");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!plan.tema.trim()) {
      setErrorMessage("Por favor, insira o tema de sua aula na aba anterior '1. Identificação' para que a IA possa gerar as aulas sequenciais.");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (selectedLessonsToGen.length === 0) {
      setErrorMessage("Por favor, selecione pelo menos uma aula no painel para que a IA possa realizar a geração.");
      setSuccessMessage(null);
      return;
    }

    setIsGeneratingLessons(true);
    setErrorMessage(null);
    
    try {
      const response = await fetch("/api/gemini/generate-lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plan,
          selectedLessons: selectedLessonsToGen,
          unifyLessons: unifyLessons,
        }),
      });

      if (!response.ok) {
        let errorMsg = "Erro na geração sequencial.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.details || errorData.error || errorMsg;
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      setPlan(prev => ({
        ...prev,
        aula1: data.aula1 !== undefined ? data.aula1 : prev.aula1,
        aula2: data.aula2 !== undefined ? data.aula2 : prev.aula2,
        aula3: data.aula3 !== undefined ? data.aula3 : prev.aula3,
        aula4: data.aula4 !== undefined ? data.aula4 : prev.aula4,
        aula5: data.aula5 !== undefined ? data.aula5 : prev.aula5,
        aula6: data.aula6 !== undefined ? data.aula6 : prev.aula6,
      }));

      const generatedListStr = selectedLessonsToGen.sort((a,b) => a-b).map(n => `Aula ${n}`).join(", ");
      setSuccessMessage(`Aulas geradas com sucesso: ${generatedListStr} com Introdução, Desenvolvimento e Conclusão!`);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded") || msg.includes("quota exceeded") || msg.includes("429")) {
        setErrorMessage(
          "Limite de cota de inteligência artificial excedido (Erro 429). A sua chave de API gratuita do Gemini atingiu o limite padrão diário do Google (20 solicitações por dia para o modelo gemini-3.5-flash). Você poderá voltar a usar gratuitamente assim que a cota for reiniciada após 24 horas. Se precisar de uso imediato e contínuo, configure o faturamento (billing) no Google AI Studio e use uma chave de API paga."
        );
      } else {
        setErrorMessage(`Impossível criar aulas sequenciais agora: ${msg}. Verifique a sua chave de API nas configurações ou tente novamente.`);
      }
    } finally {
      setIsGeneratingLessons(false);
    }
  };

  // Handle uploading custom document template
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".docx")) {
      setErrorMessage("Por favor, envie apenas arquivos no formato Word (.docx)");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const sizeFormatted = (file.size / 1024).toFixed(1) + " KB";
      setUploadedTemplate({
        name: file.name,
        size: sizeFormatted,
        buffer: arrayBuffer
      });
      
      // Auto-save this template persistently to the server so it replaces the default template permanently
      try {
        const base64 = arrayBufferToBase64(arrayBuffer);
        const res = await fetch("/api/template/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: sizeFormatted,
            base64
          }),
        });
        if (res.ok) {
          setSuccessMessage(`Modelo da escola "${file.name}" carregado e salvo com sucesso como padrão permanente desta aplicação!`);
        } else {
          setSuccessMessage(`Modelo da escola "${file.name}" vinculado para esta sessão.`);
        }
      } catch (err) {
        console.error("Erro ao salvar modelo permanentemente:", err);
        setSuccessMessage(`Modelo da escola "${file.name}" vinculado para esta sessão.`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Triggers downloading the standard empty template
  const downloadBaseTemplate = async () => {
    try {
      // Create empty payload representation
      const blob = await generateDocxFile(initialPlanState, true);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_plano_de_aula_bncc_tags.docx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      setErrorMessage("Houve um erro ao gerar o modelo padrão.");
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Triggers downloading filled docx
  const downloadFilledDocx = async (forceStandard: boolean = false) => {
    try {
      let finalBlob: Blob;

      const planActive = plan;

      await (async (plan) => {
        if (uploadedTemplate && !forceStandard) {
        // Dynamic substitution using docxtemplater & pizzip
        // We import docxtemplater and pizzip inside the function dynamically or statically
        const Docxtemplater = (await import("docxtemplater")).default;
        const PizZip = (await import("pizzip")).default;

         const zip = new PizZip(uploadedTemplate.buffer.slice(0));
 
         // Preprocess XML files in the zip to normalize double-curly braces {{TAG}} to single-curly {TAG}
         Object.keys(zip.files).forEach((filename) => {
           if (filename.endsWith(".xml")) {
             const file = zip.file(filename);
             if (file) {
               let fileContent = file.asText();
               
               // Clean split double brackets such as: {</w:t>...<w:t>{ -> {
               fileContent = fileContent.replace(/\{(\s*<\/w:t>(?:<[^>]+>)*?<w:t[^>]*>\s*)*\{/g, '{');
               fileContent = fileContent.replace(/\}(\s*<\/w:t>(?:<[^>]+>)*?<w:t[^>]*>\s*)*\}/g, '}');
               
               // Normalize spaces/formatting split immediately in front of or behind brackets
               fileContent = fileContent.replace(/\{(\s*<\/w:t>(?:<[^>]+>)*?<w:t[^>]*>\s*)+/g, '{');
               fileContent = fileContent.replace(/(\s*<\/w:t>(?:<[^>]+>)*?<w:t[^>]*>\s*)+\}/g, '}');
               
               // Standardize double brackets {{TAG}} into single brackets {TAG}
               fileContent = fileContent.replace(/\{\s*/g, '{').replace(/\s*\}/g, '}');
               fileContent = fileContent.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
               
               // Apply our smart preprocessor to replace underlines, dots, colons, or labels directly
               fileContent = smartFillDocxXml(fileContent, plan);
               
               zip.file(filename, fileContent);
             }
           }
         });
        
        // Define exhaustive values map with accents, lowercase, uppercase, and common school synonym fields
        const values: Record<string, string> = {
          // professor
          professor: plan.professor || "",
          PROFESSOR: plan.professor || "",
          Professor: plan.professor || "",
          docente: plan.professor || "",
          DOCENTE: plan.professor || "",
          Docente: plan.professor || "",

          // turma
          turma: plan.turma || "",
          TURMA: plan.turma || "",
          Turma: plan.turma || "",
          serie: plan.turma || "",
          SERIE: plan.turma || "",
          Serie: plan.turma || "",
          série: plan.turma || "",
          SÉRIE: plan.turma || "",
          Série: plan.turma || "",

          // disciplina
          disciplina: plan.disciplina || "",
          DISCIPLINA: plan.disciplina || "",
          Disciplina: plan.disciplina || "",
          materia: plan.disciplina || "",
          MATERIA: plan.disciplina || "",
          Materia: plan.disciplina || "",
          matéria: plan.disciplina || "",
          MATÉRIA: plan.disciplina || "",
          Matéria: plan.disciplina || "",
          componente_curricular: plan.disciplina || "",
          COMPONENTE_CURRICULAR: plan.disciplina || "",
          ComponenteCurricular: plan.disciplina || "",
          componenteCurricular: plan.disciplina || "",

          // bimestre
          bimestre: plan.bimestre || "",
          BIMESTRE: plan.bimestre || "",
          Bimestre: plan.bimestre || "",
          periodo: plan.bimestre || "",
          PERIODO: plan.bimestre || "",
          Periodo: plan.bimestre || "",
          período: plan.bimestre || "",
          PERÍODO: plan.bimestre || "",
          Período: plan.bimestre || "",

          // ano
          ano: plan.ano || "2026",
          ANO: plan.ano || "2026",
          Ano: plan.ano || "2026",
          anoLetivo: plan.ano || "2026",
          ANO_LETIVO: plan.ano || "2026",
          AnoLetivo: plan.ano || "2026",

          // semanaData / data
          semanaData: plan.semanaData || "",
          SEMANADATA: plan.semanaData || "",
          SemanaData: plan.semanaData || "",
          semana_data: plan.semanaData || "",
          SEMANA_DATA: plan.semanaData || "",
          data: plan.semanaData || "",
          DATA: plan.semanaData || "",
          Data: plan.semanaData || "",
          semana: plan.semanaData || "",
          SEMANA: plan.semanaData || "",
          Semana: plan.semanaData || "",
          periodo_semanal: plan.semanaData || "",
          PERIODO_SEMANAL: plan.semanaData || "",
          período_semanal: plan.semanaData || "",
          PERÍODO_SEMANAL: plan.semanaData || "",

          // tema
          tema: plan.tema || "",
          TEMA: plan.tema || "",
          Tema: plan.tema || "",
          assunto: plan.tema || "",
          ASSUNTO: plan.tema || "",
          Assunto: plan.tema || "",
          conteudo: plan.tema || "",
          CONTEUDO: plan.tema || "",
          Conteudo: plan.tema || "",
          conteúdo: plan.tema || "",
          CONTEÚDO: plan.tema || "",
          Conteúdo: plan.tema || "",

          // objetosConhecimento
          objetosConhecimento: plan.objetosConhecimento || "",
          OBJETOSCONHECIMENTO: plan.objetosConhecimento || "",
          ObjetosConhecimento: plan.objetosConhecimento || "",
          objetos_de_conhecimento: plan.objetosConhecimento || "",
          OBJETOS_DE_CONHECIMENTO: plan.objetosConhecimento || "",
          ObjetosDeConhecimento: plan.objetosConhecimento || "",
          conteudo_programatico: plan.objetosConhecimento || "",
          CONTEUDO_PROGRAMATICO: plan.objetosConhecimento || "",
          conteudoProgramatico: plan.objetosConhecimento || "",

          // competencias
          competencias: plan.competencias || "",
          COMPETENCIAS: plan.competencias || "",
          Competencias: plan.competencias || "",
          competências: plan.competencias || "",
          COMPETÊNCIAS: plan.competencias || "",
          Competências: plan.competencias || "",

          // habilidades
          habilidades: plan.habilidades || "",
          HABILIDADES: plan.habilidades || "",
          Habilidades: plan.habilidades || "",
          habilidades_bncc: plan.habilidades || "",
          HABILIDADES_BNCC: plan.habilidades || "",
          HabilidadesBNCC: plan.habilidades || "",

          // problematizacao
          problematizacao: plan.problematizacao || "",
          PROBLEMATIZACAO: plan.problematizacao || "",
          Problematizacao: plan.problematizacao || "",
          problematização: plan.problematizacao || "",
          PROBLEMATIZAÇÃO: plan.problematizacao || "",
          Problematização: plan.problematizacao || "",
          pergunta_disparadora: plan.problematizacao || "",
          PERGUNTA_DISPARADORA: plan.problematizacao || "",

          // objetivosAprendizagem
          objetivosAprendizagem: plan.objetivosAprendizagem || "",
          OBJETIVOSAPRENDIZAGEM: plan.objetivosAprendizagem || "",
          ObjetivosAprendizagem: plan.objetivosAprendizagem || "",
          objetivos_de_aprendizagem: plan.objetivosAprendizagem || "",
          OBJETIVOS_DE_APRENDIZAGEM: plan.objetivosAprendizagem || "",
          ObjetivosDeAprendizagem: plan.objetivosAprendizagem || "",
          objetivos: plan.objetivosAprendizagem || "",
          OBJETIVOS: plan.objetivosAprendizagem || "",
          Objetivos: plan.objetivosAprendizagem || "",

          // Direct contract key-value support
          "{{PROFESSOR}}": plan.professor || "",
          "{{DISCIPLINA}}": plan.disciplina || "",
          "{{TURMA}}": plan.turma || "",
          "{{BIMESTRE}}": plan.bimestre || "",
          "{{DATA}}": plan.semanaData || "",
          "{{OBJETOS_DO_CONHECIMENTO}}": plan.objetosConhecimento || "",
          "{{COMPETENCIAS}}": plan.competencias || "",
          "{{HABILIDADES}}": plan.habilidades || "",
          "{{PROBLEMATIZACAO}}": plan.problematizacao || "",
          "{{OBJETIVO_DE_APRENDIZAGEM}}": plan.objetivosAprendizagem || "",
          "{{AULA}}": "Aula 1",
          "{{TEMA_GERAL}}": plan.tema || "",
          "{{INTRODUCAO}}": plan.aula1.intro || "",
          "{{DESENVOLVIMENTO}}": plan.aula1.desenv || "",
          "{{CONCLUSAO}}": plan.aula1.concl || "",

          // Normalized clean keys (without double curly braces) to support {TAG} matching after normalization
          OBJETOS_DO_CONHECIMENTO: plan.objetosConhecimento || "",
          OBJETIVO_DE_APRENDIZAGEM: plan.objetivosAprendizagem || "",
          AULA: "Aula 1",
          TEMA_GERAL: plan.tema || "",
          INTRODUCAO: plan.aula1.intro || "",
          INTRODUÇÃO: plan.aula1.intro || "",
          DESENVOLVIMENTO: plan.aula1.desenv || "",
          CONCLUSAO: plan.aula1.concl || "",
          CONCLUSÃO: plan.aula1.concl || "",
        };

        // Complete the lesson loop mapping dynamically so we cover all conceivable combinations
        for (let i = 1; i <= 6; i++) {
          const key = `aula${i}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6";
          const aula = plan[key];

          // Intro variants
          values[`aula${i}_intro`] = aula.intro || "";
          values[`AULA${i}_INTRO`] = aula.intro || "";
          values[`Aula${i}_Intro`] = aula.intro || "";
          values[`aula${i}_introducao`] = aula.intro || "";
          values[`AULA${i}_INTRODUCAO`] = aula.intro || "";
          values[`Aula${i}_Introducao`] = aula.intro || "";
          values[`aula${i}_introdução`] = aula.intro || "";
          values[`AULA${i}_INTRODUÇÃO`] = aula.intro || "";
          values[`Aula${i}_Introdução`] = aula.intro || "";
          
          values[`aula_${i}_intro`] = aula.intro || "";
          values[`AULA_${i}_INTRO`] = aula.intro || "";
          values[`Aula_${i}_Intro`] = aula.intro || "";
          values[`aula_${i}_introducao`] = aula.intro || "";
          values[`AULA_${i}_INTRODUCAO`] = aula.intro || "";
          values[`Aula_${i}_Introducao`] = aula.intro || "";
          values[`aula_${i}_introdução`] = aula.intro || "";
          values[`AULA_${i}_INTRODUÇÃO`] = aula.intro || "";
          values[`Aula_${i}_Introdução`] = aula.intro || "";

          values[`aula ${i} intro`] = aula.intro || "";
          values[`AULA ${i} INTRO`] = aula.intro || "";
          values[`Aula ${i} Intro`] = aula.intro || "";
          values[`aula ${i} introducao`] = aula.intro || "";
          values[`AULA ${i} INTRODUCAO`] = aula.intro || "";
          values[`Aula ${i} Introducao`] = aula.intro || "";
          values[`aula ${i} introdução`] = aula.intro || "";
          values[`AULA ${i} INTRODUCÃO`] = aula.intro || "";
          values[`Aula ${i} Introdução`] = aula.intro || "";

          // Desenv variants
          values[`aula${i}_desenv`] = aula.desenv || "";
          values[`AULA${i}_DESENV`] = aula.desenv || "";
          values[`Aula${i}_Desenv`] = aula.desenv || "";
          values[`aula${i}_desenvolvimento`] = aula.desenv || "";
          values[`AULA${i}_DESENVOLVIMENTO`] = aula.desenv || "";
          values[`Aula${i}_Desenvolvimento`] = aula.desenv || "";

          values[`aula_${i}_desenv`] = aula.desenv || "";
          values[`AULA_${i}_DESENV`] = aula.desenv || "";
          values[`Aula_${i}_Desenv`] = aula.desenv || "";
          values[`aula_${i}_desenvolvimento`] = aula.desenv || "";
          values[`AULA_${i}_DESENVOLVIMENTO`] = aula.desenv || "";
          values[`Aula_${i}_Desenvolvimento`] = aula.desenv || "";

          values[`aula ${i} desenv`] = aula.desenv || "";
          values[`AULA ${i} DESENV`] = aula.desenv || "";
          values[`Aula ${i} Desenv`] = aula.desenv || "";
          values[`aula ${i} desenvolvimento`] = aula.desenv || "";
          values[`AULA ${i} DESENVOLVIMENTO`] = aula.desenv || "";
          values[`Aula ${i} Desenvolvimento`] = aula.desenv || "";

          // Concl variants
          values[`aula${i}_concl`] = aula.concl || "";
          values[`AULA${i}_CONCL`] = aula.concl || "";
          values[`Aula${i}_Concl`] = aula.concl || "";
          values[`aula${i}_conclusao`] = aula.concl || "";
          values[`AULA${i}_CONCLUSAO`] = aula.concl || "";
          values[`Aula${i}_Conclusao`] = aula.concl || "";
          values[`aula${i}_conclusão`] = aula.concl || "";
          values[`AULA${i}_CONCLUSÃO`] = aula.concl || "";
          values[`Aula${i}_Conclusão`] = aula.concl || "";

          values[`aula_${i}_concl`] = aula.concl || "";
          values[`AULA_${i}_CONCL`] = aula.concl || "";
          values[`Aula_${i}_Concl`] = aula.concl || "";
          values[`aula_${i}_conclusao`] = aula.concl || "";
          values[`AULA_${i}_CONCLUSAO`] = aula.concl || "";
          values[`Aula_${i}_Conclusao`] = aula.concl || "";
          values[`aula_${i}_conclusão`] = aula.concl || "";
          values[`AULA_${i}_CONCLUSÃO`] = aula.concl || "";
          values[`Aula_${i}_Conclusão`] = aula.concl || "";

          values[`aula ${i} concl`] = aula.concl || "";
          values[`AULA ${i} CONCL`] = aula.concl || "";
          values[`Aula ${i} Concl`] = aula.concl || "";
          values[`aula ${i} conclusao`] = aula.concl || "";
          values[`AULA ${i} CONCLUSAO`] = aula.concl || "";
          values[`Aula ${i} Conclusao`] = aula.concl || "";
          values[`aula ${i} conclusão`] = aula.concl || "";
          values[`AULA ${i} CONCLUSÃO`] = aula.concl || "";
          values[`Aula ${i} Conclusão`] = aula.concl || "";

          // Custom Conc variants (support for AULA1_CONC, etc.)
          values[`aula${i}_conc`] = aula.concl || "";
          values[`AULA${i}_CONC`] = aula.concl || "";
          values[`Aula${i}_Conc`] = aula.concl || "";
          values[`aula_${i}_conc`] = aula.concl || "";
          values[`AULA_${i}_CONC`] = aula.concl || "";
          values[`Aula_${i}_Conc`] = aula.concl || "";
          values[`aula ${i} conc`] = aula.concl || "";
          values[`AULA ${i} CONC`] = aula.concl || "";
          values[`Aula ${i} Conc`] = aula.concl || "";

          // Class general headers
          values[`aula_${i}`] = `Aula ${i}`;
          values[`AULA_${i}`] = `Aula ${i}`;
          values[`Aula_${i}`] = `Aula ${i}`;
          values[`aula${i}`] = `Aula ${i}`;
          values[`AULA${i}`] = `Aula ${i}`;
          values[`Aula${i}`] = `Aula ${i}`;
          values[`aula ${i}`] = `Aula ${i}`;
          values[`AULA ${i}`] = `Aula ${i}`;
          values[`Aula ${i}`] = `Aula ${i}`;
        }

        // Custom parser to handle any spaces in curly brackets (e.g. "{ professor }") and empty/missing cases beautifully
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          parser: function(tag) {
            return {
              get: function(scope) {
                const cleanTag = tag.trim();
                if (cleanTag === ".") {
                  return scope;
                }
                return scope[cleanTag] !== undefined ? scope[cleanTag] : "";
              }
            };
          }
        });

        doc.setData(values);
        doc.render();
        
        finalBlob = doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      } else {
        // Option B: Render standard polished DOCX from scratch
        finalBlob = await generateDocxFile(plan, false, unifyLessons);
      }

      const url = window.URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      const isCustom = uploadedTemplate && !forceStandard;
      const prefix = isCustom ? "Plano_Escolar" : "Plano_Academico_Novo";
      const cleanDisciplina = (plan.disciplina || "Sem_Disciplina").replace(/\s+/g, "_");
      const cleanTema = (plan.tema || "Sem_Titulo").replace(/\s+/g, "_");
      a.download = `${prefix}_${cleanDisciplina}_${cleanTema}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })(planActive);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Houve um erro ao processar seu documento Word: " + err.message);
      setSuccessMessage(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Triggers window print
  const handlePrint = () => {
    window.print();
  };

  // Check if each of the 6 lessons has the 3 required fields populated
  const isLessonStructureValid = (aula: "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6") => {
    return plan[aula].intro.trim() !== "" && 
           plan[aula].desenv.trim() !== "" && 
           plan[aula].concl.trim() !== "";
  };

  // List of tags mapped dynamically to values for Opção A (Fidelidade)
  const tagsToDisplay = {
    PROFESSOR: plan.professor,
    TURMA: plan.turma,
    DISCIPLINA: plan.disciplina,
    BIMESTRE: plan.bimestre,
    ANO: plan.ano,
    DATA: plan.semanaData,
    TEMA: plan.tema,
    OBJETOSCONHECIMENTO: plan.objetosConhecimento,
    COMPETENCIAS: plan.competencias,
    HABILIDADES: plan.habilidades,
    PROBLEMATIZACAO: plan.problematizacao,
    OBJETIVOSAPRENDIZAGEM: plan.objetivosAprendizagem,
    AULA1_INTRO: plan.aula1.intro,
    AULA1_DESENV: plan.aula1.desenv,
    AULA1_CONCL: plan.aula1.concl,
    AULA2_INTRO: plan.aula2.intro,
    AULA2_DESENV: plan.aula2.desenv,
    AULA2_CONCL: plan.aula2.concl,
    AULA3_INTRO: plan.aula3.intro,
    AULA3_DESENV: plan.aula3.desenv,
    AULA3_CONCL: plan.aula3.concl,
    AULA4_INTRO: plan.aula4.intro,
    AULA4_DESENV: plan.aula4.desenv,
    AULA4_CONCL: plan.aula4.concl,
    AULA5_INTRO: plan.aula5.intro,
    AULA5_DESENV: plan.aula5.desenv,
    AULA5_CONCL: plan.aula5.concl,
    AULA6_INTRO: plan.aula6.intro,
    AULA6_DESENV: plan.aula6.desenv,
    AULA6_CONCL: plan.aula6.concl,
  };

  // Plaintext Markdown representation generator for Opção B (Criativa)
  const generateMarkdownPlan = () => {
    return `# Plano de Aula Sequencial: ${plan.tema || "Sem Tema"}
  
**Professor:** ${plan.professor || "Não informado"}
**Disciplina:** ${plan.disciplina || "Não informada"}
**Turma:** ${plan.turma || "Não informada"}
**Bimestre:** ${plan.bimestre || "Não informado"}
**Ano Letivo:** ${plan.ano || "2026"}
**Período:** ${plan.semanaData || "Não informado"}

---

## 2. Componentes Gerais da BNCC

### Objetos de Conhecimento:
${plan.objetosConhecimento || "Não informado"}

### Competências Desenvolvidas:
${plan.competencias || "Não informado"}

### Habilidades Técnicas:
${plan.habilidades || "Não informado"}

### Problematização / Pergunta Disparadora:
> ${plan.problematizacao || "Não informada"}

### Objetivos de Aprendizagem:
${plan.objetivosAprendizagem || "Não informado"}

---

## 3. Planejamento das Aulas Sequenciais

### Aula 1
* **Introdução / Acolhida:**
${plan.aula1.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula1.desenv || "Não informado"}

* **Conclusão:**
${plan.aula1.concl || "Não informado"}

### Aula 2
* **Introdução / Acolhida:**
${plan.aula2.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula2.desenv || "Não informado"}

* **Conclusão:**
${plan.aula2.concl || "Não informado"}

### Aula 3
* **Introdução / Acolhida:**
${plan.aula3.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula3.desenv || "Não informado"}

* **Conclusão:**
${plan.aula3.concl || "Não informado"}

### Aula 4
* **Introdução / Acolhida:**
${plan.aula4.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula4.desenv || "Não informado"}

* **Conclusão:**
${plan.aula4.concl || "Não informado"}

### Aula 5
* **Introdução / Acolhida:**
${plan.aula5.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula5.desenv || "Não informado"}

* **Conclusão:**
${plan.aula5.concl || "Não informado"}

### Aula 6
* **Introdução / Acolhida:**
${plan.aula6.intro || "Não informado"}

* **Desenvolvimento:**
${plan.aula6.desenv || "Não informado"}

* **Conclusão:**
${plan.aula6.concl || "Não informado"}`;
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const handleLogin = (session: any, user: any) => {
    setIsAuthenticated(true);
    setUserRole(user.role);
    setSupabaseSession(session);
    setShowLogin(false);
    setActiveTab(0);
  };

  if (userRole === 'admin' && activeTab === -1) {
    return <PainelAdmin onLogout={handleLogout} onClose={() => setActiveTab(0)} session={supabaseSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white print:text-black">
      {showLogin && (
        <Login 
          onLogin={handleLogin} 
          onCancel={() => setShowLogin(false)} 
        />
      )}
      {/* Hidden Global Inputs to ensure they are always mounted and clickable from any Tab */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleTemplateUpload}
        accept=".docx"
        className="hidden" 
      />
      <input 
        type="file" 
        ref={pdfInputRef}
        onChange={handlePDFUpload}
        accept=".pdf"
        className="hidden" 
      />
      
      {/* Header (Hidden when printing preview) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100 flex items-center justify-center">
              <FileText className="h-6 w-6" id="logo-icon" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                CORUJA PEDAGÓGICA
              </h1>
              <p className="text-xs text-slate-500">Construa e Edite Planos de Aula</p>
            </div>
          </div>

          {/* Progress bar and UI buttons */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3 sm:border-l sm:border-slate-200 sm:pl-4 sm:ml-2">
                <div className="hidden sm:flex items-center justify-center bg-emerald-50 rounded-full h-8 w-8 text-emerald-700 font-bold text-xs ring-1 ring-emerald-100 shadow-sm" title={userRole === 'admin' ? "Administrador" : "Usuário"}>
                  {userRole === 'admin' ? 'AD' : 'US'}
                </div>
                {userRole === 'admin' && (
                  <button 
                    onClick={() => setActiveTab(-1)}
                    className="hidden sm:flex items-center justify-center text-xs font-semibold px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    Admin
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center text-xs font-semibold px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors border border-rose-100"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLogin(true)}
                className="flex items-center space-x-1.5 ml-4 sm:px-3 sm:py-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all border border-transparent hover:border-emerald-100 group font-medium text-sm"
                id="login-btn"
              >
                <span className="hidden sm:inline">Entrar</span>
                <LogIn className="w-5 h-5 sm:w-4 sm:h-4 transition-transform group-hover:scale-110" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 relative">
        
        {/* Navigation Tabs (Hidden when printing) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3 mb-8 print:hidden">
          <nav className="grid grid-cols-2 md:flex md:space-x-1 w-full md:w-auto bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50 gap-1 md:gap-0" aria-label="Abas">
            {[
              { label: "1. Identificação", icon: User },
              { label: "2. Modelo e BNCC", icon: FolderOpen },
              { label: "3. Planejar aulas", icon: BookOpen },
              { label: "4. Exportar plano", icon: Download },
            ].map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === idx;
              return (
                <button
                  key={idx}
                  id={`tab-btn-${idx}`}
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center justify-center md:justify-start space-x-1.5 px-2 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? "bg-white text-emerald-700 shadow-sm font-semibold" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden md:flex flex-col items-end min-w-[200px] mt-2 md:mt-0 gap-1.5">
            <div className="flex justify-between w-full px-1">
              <span className="text-xs text-slate-500 font-medium tracking-wide">Preenchimento</span>
              <span className="text-xs font-bold text-emerald-600">{calculateCompletion()}%</span>
            </div>
            <div className="w-full bg-slate-100/80 h-2.5 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
              <div 
                className={`h-full transition-all duration-700 ease-out rounded-full ${
                  calculateCompletion() === 100 ? "bg-emerald-500" : "bg-emerald-400"
                }`}
                style={{ width: `${calculateCompletion()}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Alerts / Error handlers */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl mb-6 flex items-start gap-3 animate-fade-in print:hidden">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{errorMessage}</div>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl mb-6 flex items-start gap-3 animate-fade-in print:hidden">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{successMessage}</div>
          </div>
        )}

        {/* Tab contents with smooth sliding animations */}
        <div className="relative min-h-[500px]">
          {!isAuthenticated && (
            <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
              <button 
                onClick={() => {
                  setShowLogin(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <Lock className="w-5 h-5" />
                Faça Login para Desbloquear o Gerador
              </button>
            </div>
          )}
          <div className="border-none p-0 m-0 w-full min-w-0">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: IDENTIFICAÇÃO */}
            {activeTab === 0 && (
              <motion.div
                key="tab-identificacao"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden"
              >
                {/* Form fields */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                      <span className="p-1 bg-emerald-50 rounded-lg text-emerald-700 font-mono text-sm">ABA 1</span>
                      Identificação do Docente e da Turma
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Professor(a)</label>
                        <div className="relative">
                          <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input 
                            type="text" 
                            id="input-professor"
                            value={plan.professor}
                            onChange={(e) => handleInputChange("professor", e.target.value)}
                            placeholder="Nome Completo do Colega Professor" 
                            className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 font-sans">Ano Letivo</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input 
                            type="text" 
                            id="input-ano"
                            value={plan.ano}
                            onChange={(e) => handleInputChange("ano", e.target.value)}
                            placeholder="Ex: 2026" 
                            className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Componente Curricular (Disciplina)</label>
                        <select 
                          id="select-disciplina"
                          value={plan.disciplina}
                          onChange={(e) => handleInputChange("disciplina", e.target.value)}
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        >
                          {SUBJECTS.map((sub, idx) => (
                            <option key={idx} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Ano / Turma</label>
                        <select 
                          id="select-turma"
                          value={plan.turma}
                          onChange={(e) => handleInputChange("turma", e.target.value)}
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        >
                          {GRADES.map((g, idx) => (
                            <option key={idx} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Bimestre de Referência</label>
                        <select 
                          id="select-bimestre"
                          value={plan.bimestre}
                          onChange={(e) => handleInputChange("bimestre", e.target.value)}
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        >
                          {BIMESTRES.map((b, idx) => (
                            <option key={idx} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Período / Semana / Data</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                          <input 
                            type="text" 
                            id="input-semanaData"
                            value={plan.semanaData}
                            onChange={(e) => handleInputChange("semanaData", e.target.value)}
                            placeholder="Ex: 27/05 a 31/05" 
                            className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      Tema Geral do Planejamento
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">Escreva o tema ou tópico central. Isso servirá de combustível para o assistente automático nas próximas abas.</p>
                    <input 
                      type="text" 
                      id="input-tema"
                      value={plan.tema}
                      onChange={(e) => handleInputChange("tema", e.target.value)}
                      placeholder="Ex: Equação de 2º Grau / Figuras de linguagem no cordel" 
                      className="px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl w-full text-sm font-semibold text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Info Card / Sandbox help */}
                <div className="space-y-6">
                  <div className="bg-emerald-950 text-emerald-100 p-6 rounded-2xl border border-emerald-900 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center space-x-2 text-emerald-400 mb-3">
                        <Sparkles className="h-5 w-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Como funciona?</span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">Preencha &amp; Imprima</h3>
                      <p className="text-xs leading-relaxed text-emerald-200/90 mb-4">
                        Nossa plataforma combina a estrutura padrão das escolas brasileiras com recursos de inteligência artificial de ponta.
                      </p>
                      <ul className="text-xs space-y-2.5 text-emerald-200/90 mb-6">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>Identifique as informações básicas nesta aba.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>Envie o modelo `.docx` da sua própria escola na próxima aba!</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>Gere as 5 aulas pedagógicas obrigatórias (com Introdução, Desenvolvimento e Conclusão) instantaneamente.</span>
                        </li>
                      </ul>
                    </div>
                    <button 
                      id="btn-goto-tab2-bottom"
                      onClick={() => setActiveTab(1)}
                      className="bg-emerald-500 hover:bg-emerald-600 transition-colors text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Ir para Modelo &amp; BNCC</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Requisitos Pedagógicos</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold text-xs mt-0.5">✔</span>
                        <p className="text-xs text-slate-600 leading-normal">Sequência didática contendo estritamente <strong>5 aulas completas</strong>.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold text-xs mt-0.5">✔</span>
                        <p className="text-xs text-slate-600 leading-normal">Toda aula estruturada obrigatoriamente em: <strong>Introdução</strong>, <strong>Desenvolvimento</strong> e <strong>Conclusão</strong>.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold text-xs mt-0.5">✔</span>
                        <p className="text-xs text-slate-600 leading-normal">Preservação integral do layout padrão da escola.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: MODELO E BNCC */}
            {activeTab === 1 && (
              <motion.div
                key="tab-modelo-bncc"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden"
              >
                
                {/* School Document Uploader */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Uploader section */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="p-1 bg-emerald-50 rounded-lg text-emerald-700 font-mono text-sm">ABA 2</span>
                      Modelo de Documento da Escola (.docx)
                    </h2>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                      De acordo com a <strong>Regra de Ouro nº 1</strong>, você pode enviar o arquivo Word (`.docx`) oficial da sua escola. O assistente irá preencher os campos mapeados mantendo <strong>100% da formatação e design originais</strong> (cabeçalhos, imagens, bordas e fontes intactas).
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Active File status / Drop zone */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors duration-200 ${
                          uploadedTemplate 
                            ? "bg-slate-50 border-emerald-400 hover:bg-emerald-50/20" 
                            : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <Upload className={`h-8 w-8 mx-auto mb-3 ${uploadedTemplate ? "text-emerald-600" : "text-slate-400"}`} />
                        <h4 className="text-sm font-semibold text-slate-700 mb-1">
                          {uploadedTemplate ? "Modelo Oficial Vinculado!" : "Enviar Modelo da Escola (.docx)"}
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                          {uploadedTemplate ? `${uploadedTemplate.name} (~${uploadedTemplate.size})` : "Arraste o arquivo ou clique para selecionar"}
                        </p>
                        {uploadedTemplate ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] uppercase font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md">Ativo</span>
                            <button 
                              id="btn-remove-template"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTemplate();
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remover
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Suporta apenas documentos .docx padrão</span>
                        )}
                      </div>

                      {/* Default Template Downloader */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Não possui um modelo?</h4>
                          <p className="text-xs text-slate-500 leading-relaxed mb-4">
                            Faça o download do nosso modelo padrão otimizado com todas as tags de preenchimento. Você pode alterá-lo no Word e subir de volta!
                          </p>
                        </div>
                        <button 
                          id="btn-download-base-template"
                          onClick={downloadBaseTemplate}
                          className="w-full py-3 px-4 bg-white hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Download className="h-4 w-4 text-slate-500" />
                          <span>Baixar Modelo Padrão (.docx)</span>
                        </button>
                      </div>

                    </div>

                    {/* Mappings Guide */}
                    <div className="mt-6 bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                        <h4 className="text-xs font-bold text-amber-800">Guia Geral de Mapeamento de Tags</h4>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-normal mb-3">
                        Para personalizar seu arquivo Word, basta escrever as tags abaixo em qualquer parte do documento (ex: tabelas, cabeçalhos, corpo de texto). O assistente as substituirá de forma mágica!
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[10px] font-mono font-medium text-slate-600 bg-white p-2.5 rounded-lg border border-slate-150">
                        <div>{"{professor}"}</div>
                        <div>{"{turma}"}</div>
                        <div>{"{disciplina}"}</div>
                        <div>{"{bimestre}"}</div>
                        <div>{"{semanaData}"}</div>
                        <div>{"{tema}"}</div>
                        <div>{"{objetosConhecimento}"}</div>
                        <div>{"{competencias}"}</div>
                        <div>{"{habilidades}"}</div>
                        <div>{"{problematizacao}"}</div>
                        <div>{"{objetivosAprendizagem}"}</div>
                        <div>{"{aula1_intro}"}</div>
                        <div>{"{aula1_desenv}"}</div>
                        <div>{"{aula1_concl}"}</div>
                      </div>
                    </div>

                  </div>

                  {/* BNCC PDF Reference Uploader Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="p-1 bg-indigo-50 rounded-lg text-indigo-700 font-mono text-sm">REFERÊNCIA PDF</span>
                      Referência Curricular da BNCC (.pdf)
                    </h2>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      Se você possui o documento ou anexo oficial de habilidades da BNCC em formato PDF, faça o upload dele abaixo para fins de consulta e referenciamento pedagógico local.
                    </p>

                    <div 
                      onClick={() => pdfInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors duration-200 ${
                        uploadedPDF 
                          ? "bg-slate-50 border-indigo-400 hover:bg-indigo-50/20" 
                          : "bg-slate-50/50 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                      }`}
                    >
                      <FileText className={`h-8 w-8 mx-auto mb-3 ${uploadedPDF ? "text-indigo-600" : "text-slate-400"}`} />
                      <h4 className="text-sm font-semibold text-slate-700 mb-1">
                        {uploadedPDF ? "Anexo BNCC em PDF Conectado!" : "Enviar Referência Curricular da BNCC (.pdf)"}
                      </h4>
                      <p className="text-xs text-slate-500 mb-3">
                        {uploadedPDF ? `${uploadedPDF.name} (${uploadedPDF.size})` : "Arraste o arquivo ou clique para selecionar"}
                      </p>
                      {uploadedPDF ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md">Ativo</span>
                          <button 
                            id="btn-remove-pdf-doc"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedPDF(null);
                              setSuccessMessage("Documento BNCC em PDF removido.");
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remover
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Suporta arquivos PDF de até 20MB</span>
                      )}
                    </div>
                  </div>


                </div>

                {/* Offline BNCC Library Selection */}
                <div className="space-y-6">
                  
                  {/* Offline helper sidebar */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      Painel Rápido BNCC (Offline)
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal mb-4">
                      Selecione uma habilidade modelo para carregar instantaneamente abaixo como ponto de partida:
                    </p>

                    <div className="space-y-4">
                      {Object.keys(BNCC_OFFLINE_SKILLS).map((subjKey) => (
                        <div key={subjKey}>
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{subjKey}</h4>
                          <div className="space-y-1.5">
                            {BNCC_OFFLINE_SKILLS[subjKey].map((skill, sIdx) => (
                              <button
                                key={sIdx}
                                id={`offline-skill-btn-${skill.code}`}
                                onClick={() => {
                                  setPlan(prev => ({
                                    ...prev,
                                    disciplina: subjKey,
                                    habilidades: `${skill.code}: ${skill.description}`
                                  }));
                                  setSuccessMessage(`Habilidade BNCC Código ${skill.code} vinculada!`);
                                }}
                                className="w-full text-left text-xs bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-150 p-2.5 rounded-xl transition-all"
                              >
                                <div className="font-bold text-emerald-800 font-mono text-[10px] mb-0.5">{skill.code}</div>
                                <div className="text-[11px] text-slate-600 line-clamp-2 leading-snug">{skill.description}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* General educational competences guide */}
                  <div className="bg-slate-800 text-slate-150 p-5 rounded-2xl border border-slate-750">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-3">10 Competências Gerais da BNCC</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {BNCC_GENERAL_COMPETENCES.map((comp) => (
                        <div key={comp.id} className="text-xs border-b border-slate-700/60 pb-2 last:border-0 last:pb-0">
                          <strong className="text-white block font-semibold mb-0.5">{comp.title}</strong>
                          <span className="text-slate-400 block level-down text-[11px] leading-snug">{comp.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

            {/* TAB 3: PLANEJAR CONTEÚDO E AULAS */}
            {activeTab === 2 && (
              <motion.div
                key="tab-conteudo-planejar"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden"
              >
                
                {/* Form Elements for general syllabus content */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center justify-between">
                      <span>Componentes Gerais do Plano</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono font-bold font-sans">Alinea 2 &bull; BNCC</span>
                    </h2>

                    <div className="space-y-4">
                      {/* Button for AI to fill/respond general plan components */}
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col gap-2">
                        <p className="text-[10px] text-emerald-800 leading-snug font-medium">
                          Gere ou complete automaticamente os objetos de conhecimento, competências, habilidades, problematização e objetivos usando Inteligência Artificial baseada no seu Tema e Turma:
                        </p>
                        <button 
                          id="btn-tab3-fill-general-ai"
                          onClick={callSuggestBNCC}
                          disabled={isSuggestingBNCC}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                        >
                          {isSuggestingBNCC ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Sugerindo componentes curriculares...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                              <span>Preencher Componentes com IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Objetos do Conhecimento / Conteúdo</label>
                        <textarea 
                          id="textarea-obj"
                          rows={3}
                          value={plan.objetosConhecimento}
                          onChange={(e) => handleInputChange("objetosConhecimento", e.target.value)}
                          placeholder="Os conceitos fundamentais que serão estudados..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Competências Desenvolvidas</label>
                        <textarea 
                          id="textarea-competencias"
                          rows={3}
                          value={plan.competencias}
                          onChange={(e) => handleInputChange("competencias", e.target.value)}
                          placeholder="As competências gerais e específicas mobilizadas nesta sequencia..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Habilidades BNCC Especificadas</label>
                        <textarea 
                          id="textarea-habilidades"
                          rows={3}
                          value={plan.habilidades}
                          onChange={(e) => handleInputChange("habilidades", e.target.value)}
                          placeholder="Códigos e descrições das habilidades oficiais BNCC..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Problematização / Pergunta Disparadora</label>
                        <textarea 
                          id="textarea-problematizacao"
                          rows={2}
                          value={plan.problematizacao}
                          onChange={(e) => handleInputChange("problematizacao", e.target.value)}
                          placeholder="Como o tema conecta com problemas reais do cotidiano?" 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Objetivos de Aprendizagem</label>
                        <textarea 
                          id="textarea-objetivos"
                          rows={3}
                          value={plan.objetivosAprendizagem}
                          onChange={(e) => handleInputChange("objetivosAprendizagem", e.target.value)}
                          placeholder="Metas comportamentais e cognitivas a serem alcançadas..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Highly structured sequential sequence editor (Classes 1 - 5) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Sequence header */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex flex-col gap-4 mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Sequência Pedagógica (Aulas de 1 a 5)
                          </h2>
                          <p className="text-xs text-slate-500 mt-1">Conforme a <strong>Regra de Ouro nº 3</strong>, cada aula obrigatoriamente contém Introdução, Desenvolvimento e Conclusão.</p>
                        </div>

                        {/* Sparkles Generate sequentials */}
                        <button 
                          id="btn-generate-sequence-ai"
                          onClick={callGenerateLessons}
                          disabled={isGeneratingLessons}
                          className="py-3 px-4.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all self-start shadow-xs shrink-0"
                        >
                          {isGeneratingLessons ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              <span>Construindo Sequência...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 text-indigo-200" />
                              <span>Gerar no Painel com IA</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Lesson checklist select to generate */}
                      <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-slate-700">Selecione quais aulas deseja gerar por vez:</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">As aulas marcadas serão geradas/sobrescritas pela IA</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {[1, 2, 3, 4, 5, 6].map((num) => {
                            const isChecked = selectedLessonsToGen.includes(num);
                            return (
                              <label 
                                key={num}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                  isChecked 
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-800 font-bold" 
                                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedLessonsToGen(prev => prev.filter(n => n !== num));
                                    } else {
                                      setSelectedLessonsToGen(prev => [...prev, num]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                                />
                                <span>Aula {num}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="md:ml-auto flex items-center gap-2 text-[11px] font-bold">
                          <button 
                            type="button" 
                            onClick={() => setSelectedLessonsToGen([1, 2, 3, 4, 5, 6])} 
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            Todas
                          </button>
                          <span className="text-slate-300">|</span>
                          <button 
                            type="button" 
                            onClick={() => setSelectedLessonsToGen([])} 
                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {/* Unified lesson formatting toggle */}
                      <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-2 shadow-xs">
                        <div className="flex items-start gap-2.5">
                          <span className="text-base shrink-0 mt-0.5">💡</span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">Unificação de Plano de Aulas</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                              Deseja combinar as aulas? Ative esta opção para unificar o conteúdo de todas as aulas (introdução, desenvolvimento e conclusão) em um <strong>único plano unificado compacto</strong> ao baixar o Word (.docx) ou imprimir.
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center justify-end">
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={unifyLessons}
                              onChange={(e) => setUnifyLessons(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                            <span className="ml-2.5 text-xs font-semibold text-slate-700">Unificar Aulas</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Sequential class switch tabs */}
                    <div className="flex border-b border-slate-100 mb-6 flex-wrap">
                      {[1, 2, 3, 4, 5, 6].map((num) => {
                        const aulaKey = `aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6";
                        const isValid = isLessonStructureValid(aulaKey);
                        return (
                          <button
                            key={num}
                            id={`lesson-selector-btn-${num}`}
                            onClick={() => setActiveLessonNum(num)}
                            className={`flex-1 min-w-[70px] py-3 text-center border-b-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              activeLessonNum === num 
                                ? "border-emerald-600 text-emerald-800 bg-emerald-50/10" 
                                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
                            }`}
                          >
                            <span>Aula {num}</span>
                            {isValid ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Estrutura Pedagógica Pronta"></span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="Estrutura Incompleta"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected lesson Editor */}
                    <div className="space-y-5">
                      <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 flex items-start gap-2.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-emerald-950">Aula {activeLessonNum} - Foco Estrutural</h4>
                          <p className="text-[11px] text-emerald-800 leading-normal mt-0.5">
                            Use os campos abaixo para definir o desenvolvimento progressivo da classe. Toda aula deve guiar o aluno do acolhimento inicial até a reflexão e acompanhamento avaliativo final.
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            1. Introdução / Acolhida (Motivação e Mobilização)
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">Recomendado: máx 500 caract.</span>
                        </div>
                        <textarea 
                          id={`lesson-intro-textarea-${activeLessonNum}`}
                          rows={3}
                          value={plan[`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"].intro}
                          onChange={(e) => handleLessonChange(`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", "intro", e.target.value)}
                          placeholder="Descrição da dinâmica inicial, acolhimento, problematização..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            2. Desenvolvimento (Ação das Metodologias Ativas)
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">Recomendado: máx 1000 caract.</span>
                        </div>
                        <textarea 
                          id={`lesson-desenv-textarea-${activeLessonNum}`}
                          rows={5}
                          value={plan[`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"].desenv}
                          onChange={(e) => handleLessonChange(`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", "desenv", e.target.value)}
                          placeholder="Explicação prática, divisão de grupos, simulações, seminários..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-250 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            3. Conclusão / Avaliação (Verificação e Feedback)
                          </label>
                          <span className="text-[10px] text-slate-400 font-medium">Recomendado: máx 500 caract.</span>
                        </div>
                        <textarea 
                          id={`lesson-concl-textarea-${activeLessonNum}`}
                          rows={3}
                          value={plan[`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"].concl}
                          onChange={(e) => handleLessonChange(`aula${activeLessonNum}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", "concl", e.target.value)}
                          placeholder="Atividade de fechamento, autoavaliação rápida, checklist pedagógico..." 
                          className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* TAB 4: EXPORTAÇÃO */}
            {activeTab === 3 && (
              <motion.div
                key="tab-exportacao"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                
                {/* Download and printable operations panel */}
                <div className="lg:col-span-4 space-y-6 print:hidden">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <h2 className="text-base font-bold text-slate-800 mb-4">Exportar Plano Preenchido</h2>
                    <p className="text-xs text-slate-500 mb-5 leading-normal">
                      Configure a melhor versão de exportação abaixo. Caso tenha subido o modelo da sua instituição na <strong>Aba 2</strong> ou queira enviar um agora, o arquivo Word conterá toda a sua tipografia padrão.
                    </p>

                    {/* Unified lesson formatting toggle inside Export Tab */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 mb-5 text-xs shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="unify-lessons-checkbox-export"
                          checked={unifyLessons}
                          onChange={(e) => setUnifyLessons(e.target.checked)}
                          className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <label htmlFor="unify-lessons-checkbox-export" className="font-bold text-slate-800 cursor-pointer block select-none">
                            Unificar aulas em plano único
                          </label>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            Combina os tópicos (introdução, desenvolvimento e conclusão) de todas as aulas em uma seção unificada e compacta no Word (.docx) ou no PDF impresso.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Preserved template indicator & uploader directly in Aba 4 */}
                    <div className={`p-4 rounded-xl border mb-5 transition-all text-xs ${
                      uploadedTemplate 
                        ? "bg-emerald-50 border-emerald-200" 
                        : "bg-indigo-50/30 border-indigo-150/50"
                    }`}>
                      <div className="flex items-start gap-2.5">
                        <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${uploadedTemplate ? "text-emerald-600" : "text-indigo-550"}`} />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800">Arquivo de Modelo Escolar (.docx)</h4>
                          {uploadedTemplate ? (
                            <>
                              <p className="text-[11px] text-slate-700 mt-1 font-semibold truncate bg-white border border-emerald-100 rounded px-2 py-1 flex items-center gap-1">
                                <span className="inline-block w-2-2 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                                {uploadedTemplate.name}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                Status: <span className="text-emerald-700 font-bold">Ativo &amp; Vinculado</span> ({uploadedTemplate.size})
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                                Suas informações de todas as abas serão substituídas automaticamente mantendo intacto o design escolar original!
                              </p>
                              <div className="flex gap-3 mt-3 pt-2.5 border-t border-emerald-100/50">
                                <button
                                  id="btn-tab4-change-template"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="text-[10px] text-indigo-700 hover:text-indigo-800 font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  Substituir Arquivo
                                </button>
                                <span className="text-slate-350">|</span>
                                <button
                                  id="btn-tab4-remove-template"
                                  onClick={handleRemoveTemplate}
                                  className="text-[10px] text-rose-600 hover:text-rose-700 font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  Usar Padrão
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Nenhum arquivo de modelo da escola foi vinculado ainda. O sistema usará o leiaute padrão.
                              </p>
                              <button
                                id="btn-tab4-upload-template"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                <Upload className="h-3 w-3" />
                                Enviar arquivo da escola
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      
                      {uploadedTemplate ? (
                        <>
                          {/* OPTION 1: DOWNLOAD FILLED SCHOOL PLAN */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 block">Opção 1: Modelo Institucional Enviado</span>
                            <button 
                              id="btn-download-docx-school"
                              onClick={() => downloadFilledDocx(false)}
                              className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-2 cursor-pointer shadow-sm transition-all"
                            >
                              <span className="flex items-center gap-2">
                                <FileText className="h-4.5 w-4.5 text-emerald-200" />
                                <div className="text-left">
                                  <span className="block text-xs font-bold">Baixar Plano Editado</span>
                                  <span className="block text-[10px] font-normal text-emerald-100 mt-0.5">Preencher no seu modelo original (.docx)</span>
                                </div>
                              </span>
                              <Download className="h-4 w-4" />
                            </button>
                          </div>

                          {/* OPTION 2: GENERATE NEW PLAN IN STANDARD ACADEMIC LAYOUT */}
                          <div className="space-y-2 pt-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-800 block">Opção 2: Layout Acadêmico Puro</span>
                            <button 
                              id="btn-download-docx-standard"
                              onClick={() => downloadFilledDocx(true)}
                              className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 border border-slate-350 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between gap-2 cursor-pointer shadow-xs transition-all"
                            >
                              <span className="flex items-center gap-2">
                                <FileText className="h-4.5 w-4.5 text-indigo-600" />
                                <div className="text-left">
                                  <span className="block text-xs font-bold">Gerar Novo Arquivo Padrão</span>
                                  <span className="block text-[10px] font-normal text-slate-500 mt-0.5">Criar um novo arquivo Word Acadêmico</span>
                                </div>
                              </span>
                              <Download className="h-4 w-4 text-slate-400" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-800 block mb-2">Padrão da Plataforma</span>
                          <button 
                            id="btn-download-docx-filled-standard"
                            onClick={() => downloadFilledDocx(true)}
                            className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-2 cursor-pointer shadow-sm transition-all"
                          >
                            <span className="flex items-center gap-2">
                              <FileText className="h-4.5 w-4.5 text-emerald-200" />
                              <span>Gerar e Baixar .docx Final</span>
                            </span>
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* PDF PRINTER */}
                      <div className="pt-2">
                        <button 
                          id="btn-print-pdf-filled"
                          onClick={handlePrint}
                          className="w-full py-4 px-5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-2 cursor-pointer shadow-sm transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <Printer className="h-4.5 w-4.5 text-slate-300" />
                            <span>Imprimir / Salvar como PDF</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </button>
                      </div>

                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3">Status do Modelo</h4>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <span className="text-[11px] text-slate-600 font-medium">Modelo da Escola Ativo</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          uploadedTemplate ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"
                        }`}>
                          {uploadedTemplate ? "Sim (.docx)" : "Padrão"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
                    <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2">
                       <Info className="h-4 w-4 shrink-0" />
                       Aviso sobre Impressão PDF
                     </h4>
                     <p className="text-[11px] text-amber-700 leading-normal">
                       Ao selecionar "Imprimir / Salvar como PDF", a janela de impressão nativa ocultará todo o visual ao redor, focando apenas na folha A4 ao lado. Recomendamos marcar a opção de incluir background em seu navegador para melhor qualidade.
                     </p>
                   </div>
                 </div>                {/* Printable Leaf & Output Modes Selector */}
                <div className="lg:col-span-8 print:col-span-12 print:block flex flex-col gap-5">
                  
                  {/* Option Tabs Selectors */}
                  <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:flex sm:items-center gap-1.5 print:hidden">
                    <button
                      id="export-mode-opt-a"
                      onClick={() => setExportOutputMode("a")}
                      className={`flex-1 py-3 px-4 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        exportOutputMode === "a"
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-805 hover:bg-slate-200/50"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      Opção A (Fidelidade/Tags)
                    </button>
                    <button
                      id="export-mode-opt-b"
                      onClick={() => setExportOutputMode("b")}
                      className={`flex-1 py-3 px-4 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        exportOutputMode === "b"
                          ? "bg-indigo-650 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-805 hover:bg-slate-200/50"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      Opção B (Sugestão Criativa)
                    </button>
                    <button
                      id="export-mode-opt-c"
                      onClick={() => setExportOutputMode("c")}
                      className={`flex-1 py-3 px-4 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        exportOutputMode === "c"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-855 hover:bg-slate-200/50"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Layout Impressão A4
                    </button>
                  </div>

                  {/* Dynamic renders based on selection */}
                  {exportOutputMode === "a" && (
                    <motion.div
                      key="mode-opt-a-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs print:hidden space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                            Mapeador de Dados de Alta Fidelidade (Opção A)
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Estes são os conteúdos exatos que serão colados nas tags correspondentes do arquivo de sua escola (como <code>{"{{PROFESSOR}}"}</code> e <code>{"{{AULA1_INTRO}}"}</code>).
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const formattedEntries = Object.entries(tagsToDisplay)
                              .map(([tag, val]) => `[${tag}]:\n${val || "(Não especificado)"}`)
                              .join("\n\n");
                            navigator.clipboard.writeText(formattedEntries);
                            setSuccessMessage("Todas as tags copiadas com sucesso no formato estruturado para o App!");
                          }}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-xs"
                        >
                          Copiar Todos os Dados
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(tagsToDisplay).map(([tag, value]) => (
                          <div key={tag} className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10.5px] font-extrabold text-[#00695C] bg-[#E0F2F1] border border-[#B2DFDB] rounded-md px-2 py-0.5 select-all">
                                {"{"}{"{"}{tag}{"}"}{"}"}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(value || "");
                                  setSuccessMessage(`Valor da tag {{${tag}}} copiado!`);
                                }}
                                className="text-[10px] text-slate-500 hover:text-emerald-700 font-extrabold uppercase transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                              >
                                Copiar
                              </button>
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line pl-2.5 border-l-2 border-slate-300 font-medium">
                              {value ? value : <span className="text-slate-400 italic font-normal">Sem conteúdo registrado</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {exportOutputMode === "b" && (
                    <motion.div
                      key="mode-opt-b-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs print:hidden space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <h3 className="text-sm font-extrabold text-indigo-900 flex items-center gap-2">
                            Plano Integral Criativo &bull; Formato Acadêmico (Opção B)
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Gere um plano de aula completo em formato de guia didático, ideal para compartilhar por e-mail ou salvar em sua máquina.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const markdown = generateMarkdownPlan();
                            navigator.clipboard.writeText(markdown);
                            setSuccessMessage("Plano completo copiado em formato de texto Markdown!");
                          }}
                          className="shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-xs"
                        >
                          Copiar Texto Markdown
                        </button>
                      </div>

                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 text-xs text-slate-800 space-y-5 max-h-[750px] overflow-y-auto">
                        <div>
                          <span className="text-[10px] uppercase font-mono font-extrabold tracking-widest text-[#283593]">I. IDENTIFICAÇÃO DO CURSO</span>
                          <h3 className="text-base font-extrabold text-slate-900 mt-1">{plan.tema || "Tema não definido"}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-slate-650 font-medium">
                            <p>&bull; <strong>Professor/Docente:</strong> {plan.professor || "Não preenchido"}</p>
                            <p>&bull; <strong>Componente Curricular:</strong> {plan.disciplina || "Não preenchido"}</p>
                            <p>&bull; <strong>Turma e Ano:</strong> {plan.turma || "Não preenchido"}</p>
                            <p>&bull; <strong>Bimestre e Semana:</strong> {plan.bimestre || "Não preenchido"} ({plan.semanaData || "Não preenchido"})</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-250 pt-5 space-y-4">
                          <div>
                            <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Objetos do Conhecimento</h4>
                            <p className="text-slate-650 leading-relaxed pl-3 border-l-2 border-indigo-500 whitespace-pre-line bg-indigo-50/10 py-1">{plan.objetosConhecimento || "Não preenchido"}</p>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Competências Gerais &amp; Específicas</h4>
                            <p className="text-slate-650 leading-relaxed pl-3 border-l-2 border-indigo-500 whitespace-pre-line bg-indigo-50/10 py-1">{plan.competencias || "Não preenchido"}</p>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Habilidades Técnicas BNCC</h4>
                            <p className="text-slate-650 leading-relaxed pl-3 border-l-2 border-indigo-500 whitespace-pre-line bg-indigo-50/10 py-1 font-mono text-[11px]">{plan.habilidades || "Não preenchido"}</p>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Problematização / Pergunta Disparadora</h4>
                            <p className="text-slate-650 leading-relaxed pl-3 border-l-2 border-amber-500 whitespace-pre-line bg-amber-50/10 py-1 italic">"{plan.problematizacao || "Não preenchido"}"</p>
                          </div>

                          <div>
                            <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-1">Objetivos de Aprendizagem</h4>
                            <p className="text-slate-650 leading-relaxed pl-3 border-l-2 border-indigo-500 whitespace-pre-line bg-indigo-50/10 py-1">{plan.objetivosAprendizagem || "Não preenchido"}</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-250 pt-5">
                          <h4 className="font-extrabold text-indigo-950 uppercase text-[10.5px] tracking-widest mb-3">II. ATIVIDADES SEQUENCIAIS DE CLASSE (AULAS 1 A 6)</h4>
                          <div className="space-y-5">
                            {[1, 2, 3, 4, 5, 6].map((num) => {
                              const lesson = plan[`aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"];
                              return (
                                <div key={num} className="bg-white border border-slate-200 rounded-2xl p-4.5 space-y-3 shadow-xs">
                                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                    <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Desenvolvimento de Aula {num}</h5>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">ESTRUTURA COMPLETA</span>
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <span className="text-[9.5px] uppercase font-bold text-slate-400 block mb-0.5">Introdução &amp; Acolhimento (Engajamento)</span>
                                      <p className="bg-slate-50 p-2.5 rounded-lg border-l-2 border-emerald-500 text-slate-650 whitespace-pre-line leading-relaxed">{lesson.intro || "Não preenchido"}</p>
                                    </div>
                                    <div>
                                      <span className="text-[9.5px] uppercase font-bold text-slate-400 block mb-0.5">Desenvolvimento (Atividades Científicas e Práticas)</span>
                                      <p className="bg-slate-50 p-2.5 rounded-lg border-l-2 border-indigo-500 text-slate-650 whitespace-pre-line leading-relaxed">{lesson.desenv || "Não preenchido"}</p>
                                    </div>
                                    <div>
                                      <span className="text-[9.5px] uppercase font-bold text-slate-400 block mb-0.5">Conclusão &amp; Sistematização (Feedback)</span>
                                      <p className="bg-slate-50 p-2.5 rounded-lg border-l-2 border-rose-500 text-slate-650 whitespace-pre-line leading-relaxed">{lesson.concl || "Não preenchido"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Standard printable Letter/A4 preview container. ALWAYS rendered when media print is active */}
                  <div className={`bg-slate-100/60 p-4 sm:p-8 rounded-3xl border border-slate-200 overflow-x-auto print:border-none print:bg-white print:p-0 ${
                    exportOutputMode === "c" ? "block" : "hidden print:block"
                  }`}>
                    
                    {/* Visual boundaries for a standard Letter / A4 sheet */}
                    <div className="bg-white min-h-[1100px] w-full max-w-[800px] mx-auto p-8 sm:p-12 shadow-md border border-slate-350 print:shadow-none print:border-none print:p-0">
                      
                      {/* Leaf Header Block */}
                      <div className="border-b-2 border-slate-800 pb-5 mb-6 text-center">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-[#004D40] mb-1">Ministério da Educação / Secretaria Escolar</p>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">PLANO DE ENSINO E SEQUÊNCIA DIDÁTICA DE AULA</h2>
                        <span className="text-[10px] bg-slate-150 text-slate-500 uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded">Alinhamento BNCC Oficial</span>
                      </div>

                      {/* Section 1: Identificação */}
                      <div className="mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-3">1. Identificação</h3>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                          <div>
                            <span className="font-semibold text-slate-500">Docente:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.professor || "Não informado"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Ano Letivo:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.ano || "2026"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Componente:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.disciplina || "Não informado"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Turma:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.turma || "Não informado"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Bimestre:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.bimestre || "Não informado"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">Período / Semana de Ref:</span>
                            <span className="ml-1 text-slate-900 font-medium">{plan.semanaData || "Não informado"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tema principal block */}
                      <div className="mb-6 bg-slate-50 border border-slate-150 rounded-lg p-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest mb-0.5">Tema / Tópico Geral da Aula</span>
                        <div className="md:text-sm font-semibold text-slate-900 leading-snug">{plan.tema || "Não especificado"}</div>
                      </div>

                      {/* Section 2: Planejamento Alinhado */}
                      <div className="mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-3">2. Componentes Pedagógicos (BNCC)</h3>
                        
                        <div className="space-y-3.5 text-xs">
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">&bull; Objetos do Conhecimento:</span>
                            <p className="text-slate-650 leading-relaxed whitespace-pre-line pl-3">{plan.objetosConhecimento || "Nenhum objeto preenchido."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">&bull; Competências Desenvolvidas:</span>
                            <p className="text-slate-650 leading-relaxed whitespace-pre-line pl-3">{plan.competencias || "Nenhuma competência especificada."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">&bull; Habilidades Técnicas:</span>
                            <p className="text-slate-650 leading-relaxed whitespace-pre-line pl-3 font-mono text-[11px]">{plan.habilidades || "Nenhuma habilidade adicionada."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">&bull; Problematização e Questão Disparadora:</span>
                            <p className="text-slate-650 leading-relaxed whitespace-pre-line pl-3 italic">{plan.problematizacao || "Nenhuma problematização escrita."}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">&bull; Objetivos de Aprendizagem:</span>
                            <p className="text-slate-650 leading-relaxed whitespace-pre-line pl-3">{plan.objetivosAprendizagem || "Nenhum objetivo detalhado."}</p>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Sequência didática detalhada de 6 aulas */}
                      <div className="page-break">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 mb-4">
                          {unifyLessons ? "3. Plano de Aula Unificado (Aulas Combinadas)" : "3. Planejamento das Aulas (Aulas 1 a 6)"}
                        </h3>
                        
                        <div className="space-y-6 font-sans">
                          {unifyLessons ? (
                            <div className="border border-indigo-200 bg-indigo-50/5 rounded-lg overflow-hidden text-xs">
                              <div className="bg-slate-850 bg-indigo-900 text-white font-bold p-3 text-xs flex justify-between items-center print:bg-slate-800 print:text-white">
                                <span>Plano de Aula Unificado (Aulas Combinadas)</span>
                                <span className="text-[9px] bg-emerald-600 text-white uppercase px-1.5 py-0.5 rounded font-mono font-bold">Unificado</span>
                              </div>
                              <div className="divide-y divide-slate-200">
                                {[1, 2, 3, 4, 5, 6].map((num) => {
                                  const lesson = plan[`aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"];
                                  const hasContent = lesson.intro?.trim() || lesson.desenv?.trim() || lesson.concl?.trim();
                                  if (!hasContent) return null;

                                  return (
                                    <div key={num} className="p-4 space-y-3">
                                      <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider border-b border-indigo-100 pb-1 mb-2">
                                        Aula {num}
                                      </div>
                                      <div>
                                        <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Introdução (Motivação e Acolhida):</strong>
                                        <p className="text-slate-650 leading-relaxed pl-2.5 whitespace-pre-line border-l-2 border-emerald-500 text-slate-700">{lesson.intro || "Nenhuma introdução especificada."}</p>
                                      </div>
                                      <div>
                                        <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Desenvolvimento (Metodologias Ativas):</strong>
                                        <p className="text-slate-650 leading-relaxed pl-2.5 whitespace-pre-line border-l-2 border-indigo-500 text-slate-700">{lesson.desenv || "Nenhum desenvolvimento especificado."}</p>
                                      </div>
                                      <div>
                                        <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Conclusão (Fechamento e Avaliação):</strong>
                                        <p className="text-slate-655 leading-relaxed pl-2.5 whitespace-pre-line border-l-2 border-rose-500 text-slate-700">{lesson.concl || "Nenhuma conclusão especificada."}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            [1, 2, 3, 4, 5, 6].map((num) => {
                              const lesson = plan[`aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6"];
                              return (
                                <div key={num} className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                                  <div className="bg-slate-800 text-white font-bold p-2 text-xs flex justify-between items-center">
                                    <span>Plano Sequencial da Aula {num}</span>
                                    {isLessonStructureValid(`aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6") ? (
                                      <span className="text-[9px] bg-emerald-600 text-white uppercase px-1.5 py-0.5 rounded font-mono">Conforme Regras</span>
                                    ) : (
                                      <span className="text-[9px] bg-amber-500 text-slate-950 uppercase px-1.5 py-0.5 rounded font-mono">Estrutura Parcial</span>
                                    )}
                                  </div>
                                  <div className="p-3.5 space-y-3">
                                    <div>
                                      <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Introdução (Motivação e Acolhida):</strong>
                                      <p className="text-slate-600 leading-relaxed pl-2 whitespace-pre-line border-l-2 border-emerald-500">{lesson.intro || "Nenhuma introdução especificada."}</p>
                                    </div>
                                    <div>
                                      <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Desenvolvimento (Metodologias Ativas):</strong>
                                      <p className="text-slate-655 leading-relaxed pl-2 whitespace-pre-line border-l-2 border-indigo-500">{lesson.desenv || "Nenhum desenvolvimento especificado."}</p>
                                    </div>
                                    <div>
                                      <strong className="text-slate-800 block text-[11px] uppercase tracking-wider mb-0.5">Conclusão (Fechamento e Avaliação):</strong>
                                      <p className="text-slate-655 leading-relaxed pl-2 whitespace-pre-line border-l-2 border-rose-500">{lesson.concl || "Nenhuma conclusão especificada."}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
          </div>

          {/* Wizard Footer (Hidden when printing preview) */}
          <div className="flex justify-between items-center mt-12 bg-white rounded-2xl border border-slate-200 p-5 print:hidden border-t-0">
            <button
              id="btn-nav-prev"
              disabled={activeTab === 0}
              onClick={() => setActiveTab(prev => prev - 1)}
              className="px-5 py-3 border border-slate-200 bg-white hover:bg-slate-50 disabled:text-slate-300 disabled:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar aba</span>
            </button>
  
            {activeTab < 3 ? (
              <button
                id="btn-nav-next"
                onClick={() => setActiveTab(prev => prev + 1)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 transition-colors text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Avançar aba</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                id="btn-nav-generate-word"
                onClick={downloadFilledDocx}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 transition-colors text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileText className="h-4 w-4" />
                <span>Gerar e Baixar .docx Final</span>
              </button>
            )}
          </div>
        </div>
        
        
      </main>

      {/* Dynamic Printing Style overrides (Included as inline style block) */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          main {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>

    </div>
  );
}

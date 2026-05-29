import { BNCCSkill } from "./types";

export const SUBJECTS = [
  "Matemática",
  "Língua Portuguesa",
  "Ciências",
  "História",
  "Geografia",
  "Arte",
  "Educação Física",
  "Língua Inglesa"
];

export const GRADES = [
  "1º Ano (Ensino Fundamental)",
  "2º Ano (Ensino Fundamental)",
  "3º Ano (Ensino Fundamental)",
  "4º Ano (Ensino Fundamental)",
  "5º Ano (Ensino Fundamental)",
  "6º Ano (Ensino Fundamental)",
  "7º Ano (Ensino Fundamental)",
  "8º Ano (Ensino Fundamental)",
  "9º Ano (Ensino Fundamental)",
  "1º Ano (Ensino Médio)",
  "2º Ano (Ensino Médio)",
  "3º Ano (Ensino Médio)"
];

export const BIMESTRES = [
  "1º Bimestre",
  "2º Bimestre",
  "3º Bimestre",
  "4º Bimestre",
  "Semestre 1",
  "Semestre 2"
];

// Baseline real/realistic BNCC Habilidades per standard subjects
export const BNCC_OFFLINE_SKILLS: Record<string, BNCCSkill[]> = {
  "Matemática": [
    { code: "EF09MA01", description: "Resolver e elaborar problemas com números reais, inclusive em notação científica, envolvendo expoentes inteiros e fracionários." },
    { code: "EF09MA09", description: "Compreender os processos de faturação de expressões algébricas, com base em suas relações com as áreas de retângulos, para resolver e elaborar problemas de equações de 2º grau e outras situações." },
    { code: "EF08MA06", description: "Resolver e elaborar problemas que envolvam cálculo de porcentagens, incluindo juros simples e compostos, com o uso de tecnologias." },
    { code: "EF07MA18", description: "Resolver e elaborar problemas que envolvam frações, percentuais, acréscimos e decréscimos simples, com ou sem o uso de calculadoras." },
    { code: "EF06MA24", description: "Determinar a probabilidade de ocorrência de um resultado em experimentos aleatórios representados em frações, decimais e porcentagem." }
  ],
  "Língua Portuguesa": [
    { code: "EF09LP02", description: "Analisar a mediação jornalística e publicitária de pontos de vista e conflitos de interesse na cobertura de temas polêmicos no rádio, TV e internet." },
    { code: "EF89LP12", description: "Planejar e produzir textos argumentativos, considerando as especificidades do gênero editorial, artigo de opinião ou carta de leitor." },
    { code: "EF07LP05", description: "Identificar, em textos líricos ou narrativos, o uso de metáforas, comparações, personificações e outras figuras de linguagem." },
    { code: "EF06LP11", description: "Utilizar, ao produzir texto, conhecimentos linguísticos e gramaticais sobre concordância nominal e verbal em situações reais do cotidiano." }
  ],
  "Ciências": [
    { code: "EF09CI01", description: "Investigar as mudanças de estado físico da matéria e a conservação da massa em transformações químicas a partir de experimentos simples." },
    { code: "EF08CI02", description: "Construir circuitos elétricos simples, identificar seus componentes e discutir os riscos do uso incorreto da eletricidade em residências." },
    { code: "EF07CI05", description: "Discutir o uso racional e sustentável da água e da energia elétrica, propondo ações cotidianas que evitem o desperdício." }
  ],
  "História": [
    { code: "EF09HI01", description: "Analisar as causas da Proclamação da República e destacar a transição do Império para a República de forma crítica e analítica." },
    { code: "EF08HI09", description: "Caracterizar o processo de independência do Brasil e comparar as tensões sociais regionais do início do século XIX." },
    { code: "EF07HI02", description: "Identificar as conexões e interações entre diferentes civilizações da América e da Europa no período colonial moderno." }
  ]
};

// Standard general competences of BNCC
export const BNCC_GENERAL_COMPETENCES = [
  { id: "comp1", title: "Conhecimento", text: "Valorizar e utilizar os conhecimentos historicamente construídos sobre o mundo físico, social, cultural e digital." },
  { id: "comp2", title: "Pensamento Científico, Crítico e Criativo", text: "Exercitar a curiosidade intelectual e recorrer à abordagem própria das ciências, incluindo a investigação e reflexão crítica." },
  { id: "comp3", title: "Repertório Cultural", text: "Valorizar e fruir as diversas manifestações artísticas e culturais, das locais às mundiais." },
  { id: "comp4", title: "Comunicação", text: "Utilizar diferentes linguagens — verbal, corporal, visual, sonora e digital — para expressar-se." },
  { id: "comp5", title: "Cultura Digital", text: "Compreender, utilizar e criar tecnologias digitais de informação e comunicação de forma crítica, significativa e ética." },
  { id: "comp6", title: "Trabalho e Projeto de Vida", text: "Valorizar a diversidade de saberes e vivências culturais e apropriar-se de conhecimentos e experiências." },
  { id: "comp7", title: "Argumentação", text: "Argumentar com base em fatos, dados e informações confiáveis para formular, negociar e defender ideias." }
];

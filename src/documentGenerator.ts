import { 
  Document, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  HeadingLevel, 
  AlignmentType, 
  Packer 
} from "docx";
import { LessonPlanData } from "./types";

/**
 * Generates a DOCX file from scratch that is either:
 * - A filled document containing the teacher's actual data.
 * - A blank template document containing placeholders in `{curly_braces}` of standard names.
 */
export async function generateDocxFile(data: LessonPlanData, isTemplate: boolean = false, unifyLessons: boolean = false): Promise<Blob> {
  const currentData = data;

  const getText = (field: keyof LessonPlanData | string, defaultVal: string) => {
    if (isTemplate) {
      return `{${String(field)}}`;
    }
    // Deep check or simple check
    if (field.toString().includes(".")) {
      const parts = field.toString().split(".");
      const obj = (currentData as any)[parts[0]];
      return obj ? obj[parts[1]] || defaultVal : defaultVal;
    }
    return (currentData as any)[field] || defaultVal;
  };

  const getLessonText = (aulaKey: "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", subKey: "intro" | "desenv" | "concl", defaultVal: string) => {
    if (isTemplate) {
      return `{${aulaKey}_${subKey}}`;
    }
    return currentData[aulaKey]?.[subKey] || defaultVal;
  };

  // Helper inside cell styling
  const cellStyle = {
    margins: {
      top: 100,
      bottom: 100,
      left: 151,
      right: 151,
    }
  };

  const headerShading = {
    fill: "F3F4F6", // tailwind gray 100
  };

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "D1D5DB", // tealwind gray 300
  };

  const createCell = (text: string, isBold: boolean = false, isHeader: boolean = false, percentageWidth: number = 100) => {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: isBold,
              size: 22, // 11pt
              font: "Arial",
            })
          ],
          alignment: AlignmentType.LEFT,
          spacing: {
            line: 276, // 1.15 line spacing
          }
        })
      ],
      shading: isHeader ? headerShading : undefined,
      width: {
        size: percentageWidth,
        type: WidthType.PERCENTAGE,
      },
      ...cellStyle,
      borders: {
        top: borderStyle,
        bottom: borderStyle,
        left: borderStyle,
        right: borderStyle,
      }
    });
  };

  // Document contents builder
  const documentChildren = [
    // Escola title/header
    new Paragraph({
      children: [
        new TextRun({
          text: isTemplate ? "MODELO DE PLANO DE AULA BNCC - MODELO" : "PLANO DE AULA SEMANAL - BNCC",
          bold: true,
          size: 32, // 16pt
          font: "Arial",
          color: "1F2937",
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 200,
      }
    }),

    // Seção 1: Identificação
    new Paragraph({
      children: [
        new TextRun({
          text: "1. IDENTIFICAÇÃO",
          bold: true,
          size: 24, // 12pt
          font: "Arial",
          color: "1F2937",
        })
      ],
      spacing: {
        before: 200,
        after: 100,
      }
    }),

    new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            createCell(`Professor: ${getText("professor", "Não informado")}`, false, false, 50),
            createCell(`Turma: ${getText("turma", "Não informado")}`, false, false, 50),
          ]
        }),
        new TableRow({
          children: [
            createCell(`Disciplina: ${getText("disciplina", "Não informado")}`, false, false, 40),
            createCell(`Bimestre: ${getText("bimestre", "Não informado")}`, false, false, 30),
            createCell(`Ano Letivo: ${getText("ano", "2026")}`, false, false, 30),
          ]
        }),
      ]
    }),

    // Seção 2: Planejamento Pedagógico (BNCC)
    new Paragraph({
      children: [
        new TextRun({
          text: "2. PLANEJAMENTO PEDAGÓGICO (ALINHAMENTO BNCC)",
          bold: true,
          size: 24,
          font: "Arial",
          color: "1F2937",
        })
      ],
      spacing: {
        before: 300,
        after: 100,
      }
    }),

    new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            createCell("Período / Semana / Data", true, true, 30),
            createCell(getText("semanaData", "Não informado"), false, false, 70),
          ]
        }),
        new TableRow({
          children: [
            createCell("Tema / Objetos do Conhecimento", true, true, 30),
            createCell(getText("objetosConhecimento", "Não informado"), false, false, 70),
          ]
        }),
        new TableRow({
          children: [
            createCell("Competências Desenvolvidas", true, true, 30),
            createCell(getText("competencias", "Não informado"), false, false, 70),
          ]
        }),
        new TableRow({
          children: [
            createCell("Habilidades BNCC", true, true, 30),
            createCell(getText("habilidades", "Não informado"), false, false, 70),
          ]
        }),
        new TableRow({
          children: [
            createCell("Problematização (Questão disparadora)", true, true, 30),
            createCell(getText("problematizacao", "Não informado"), false, false, 70),
          ]
        }),
        new TableRow({
          children: [
            createCell("Objetivos de Aprendizagem", true, true, 30),
            createCell(getText("objetivosAprendizagem", "Não informado"), false, false, 70),
          ]
        }),
      ]
    }),

    // Seção 3: Sequência Didática (Aulas 1 a 6)
    new Paragraph({
      children: [
        new TextRun({
          text: unifyLessons ? "3. PLANO DE AULA UNIFICADO" : "3. SEQUÊNCIA DIDÁTICA DETALHADA (AULAS 1 A 6)",
          bold: true,
          size: 24,
          font: "Arial",
          color: "1F2937",
        })
      ],
      spacing: {
        before: 300,
        after: 100,
      }
    }),
  ];

  // For each class 1 to 6, build a beautifully formatted sub-section table
  const buildLessonTable = (num: number, key: "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6", customTitle?: string) => {
    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: customTitle || `AULA ${num}`,
                      bold: true,
                      size: 20,
                      font: "Arial",
                      color: "FFFFFF",
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                })
              ],
              shading: { fill: "374151" }, // slate 700 header
              columnSpan: 2,
              ...cellStyle,
              borders: {
                top: borderStyle,
                bottom: borderStyle,
                left: borderStyle,
                right: borderStyle,
              }
            })
          ]
        }),
        new TableRow({
          children: [
            createCell("Introdução", true, true, 25),
            createCell(getLessonText(key, "intro", "Não preenchido"), false, false, 75),
          ]
        }),
        new TableRow({
          children: [
            createCell("Desenvolvimento", true, true, 25),
            createCell(getLessonText(key, "desenv", "Não preenchido"), false, false, 75),
          ]
        }),
        new TableRow({
          children: [
            createCell("Conclusão", true, true, 25),
            createCell(getLessonText(key, "concl", "Não preenchido"), false, false, 75),
          ]
        }),
      ]
    });
  };

  const buildUnifiedLessonTable = () => {
    const rows: TableRow[] = [];
    
    // Header for the entire unified plan
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "PLANO DE AULA UNIFICADO (TODAS AS AULAS COMBINADAS)",
                    bold: true,
                    size: 20,
                    font: "Arial",
                    color: "FFFFFF",
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            shading: { fill: "374151" }, // slate 700 header
            columnSpan: 2,
            ...cellStyle,
            borders: {
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle,
            }
          })
        ]
      })
    );

    let hasAnyClass = false;

    for (let num = 1; num <= 6; num++) {
      const key = `aula${num}` as "aula1" | "aula2" | "aula3" | "aula4" | "aula5" | "aula6";
      const intro = getLessonText(key, "intro", "").trim();
      const desenv = getLessonText(key, "desenv", "").trim();
      const concl = getLessonText(key, "concl", "").trim();

      // Only include this class if it has some content
      if (intro || desenv || concl) {
        hasAnyClass = true;

        // Add a sub-header row for this Aula
        rows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `AULA ${num}`,
                        bold: true,
                        size: 20,
                        font: "Arial",
                        color: "1F2937",
                      })
                    ],
                    alignment: AlignmentType.LEFT,
                  })
                ],
                shading: { fill: "F3F4F6" }, // light gray background for the class name
                columnSpan: 2,
                ...cellStyle,
                borders: {
                  top: borderStyle,
                  bottom: borderStyle,
                  left: borderStyle,
                  right: borderStyle,
                }
              })
            ]
          })
        );

        // Add Intro row
        rows.push(
          new TableRow({
            children: [
              createCell("Introdução", true, true, 25),
              createCell(intro || "Nenhuma introdução especificada.", false, false, 75),
            ]
          })
        );

        // Add Dev row
        rows.push(
          new TableRow({
            children: [
              createCell("Desenvolvimento", true, true, 25),
              createCell(desenv || "Nenhum desenvolvimento especificado.", false, false, 75),
            ]
          })
        );

        // Add Conclusion row
        rows.push(
          new TableRow({
            children: [
              createCell("Conclusão", true, true, 25),
              createCell(concl || "Nenhuma conclusão especificada.", false, false, 75),
            ]
          })
        );
      }
    }

    if (!hasAnyClass) {
      rows.push(
        new TableRow({
          children: [
            createCell("Nenhuma Aula", true, true, 25),
            createCell("Nenhuma aula foi gerada ou preenchida ainda.", false, false, 75),
          ]
        })
      );
    }

    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: rows,
    });
  };

  // Add individual tables and layout spacing
  if (unifyLessons) {
    documentChildren.push(
      new Paragraph({ text: "", spacing: { after: 100 } }),
      buildUnifiedLessonTable()
    );
  } else {
    documentChildren.push(
      new Paragraph({ text: "", spacing: { after: 100 } }),
      buildLessonTable(1, "aula1"),
      new Paragraph({ text: "", spacing: { after: 150 } }),
      buildLessonTable(2, "aula2"),
      new Paragraph({ text: "", spacing: { after: 150 } }),
      buildLessonTable(3, "aula3"),
      new Paragraph({ text: "", spacing: { after: 150 } }),
      buildLessonTable(4, "aula4"),
      new Paragraph({ text: "", spacing: { after: 150 } }),
      buildLessonTable(5, "aula5"),
      new Paragraph({ text: "", spacing: { after: 150 } }),
      buildLessonTable(6, "aula6")
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: documentChildren,
      }
    ],
  });

  return await Packer.toBlob(doc);
}

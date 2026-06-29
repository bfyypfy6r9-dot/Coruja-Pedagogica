export interface ClassLesson {
  intro: string;
  desenv: string;
  concl: string;
}

export interface LessonPlanData {
  professor: string;
  turma: string;
  disciplina: string;
  bimestre: string;
  ano: string;
  semanaData: string;
  tema: string;
  objetosConhecimento: string;
  competencias: string;
  habilidades: string;
  problematizacao: string;
  objetivosAprendizagem: string;
  aula1: ClassLesson;
  aula2: ClassLesson;
  aula3: ClassLesson;
  aula4: ClassLesson;
  aula5: ClassLesson;
  aula6: ClassLesson;
  aula7: ClassLesson;
  aula8: ClassLesson;
  aula9: ClassLesson;
  aula10: ClassLesson;
  aula11: ClassLesson;
  aula12: ClassLesson;
}

export interface BNCCSkill {
  code: string;
  description: string;
}

export interface BNCCGradeData {
  grade: string;
  skills: BNCCSkill[];
}

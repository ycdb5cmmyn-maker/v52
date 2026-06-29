export type ArticleType =
  | 'noticia'
  | 'cronica'
  | 'entrevista'
  | 'editorial'
  | 'investigacion'
  | 'opinion'
  | 'otro';

export interface AnalyzeRequest {
  text: string;
  type: ArticleType;
}

export interface ScoreDimension {
  score: number;
  notes: string;
}

export interface ParagraphAnalysis {
  index: number;
  excerpt: string;
  findings: string[];
}

export interface AnalysisResult {
  score: number;
  summary: string;
  dimensions: {
    periodistico: ScoreDimension;
    narrativo: ScoreDimension;
    contextual: ScoreDimension;
    riesgo: ScoreDimension;
  };
  paragraphs: ParagraphAnalysis[];
  model: string;
  cached?: boolean;
}

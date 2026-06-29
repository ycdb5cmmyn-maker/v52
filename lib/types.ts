export interface ScoreResult {
  score: number;
  justificacion: string;
  evidencia?: string;
  recomendacion?: string;
  sub?: Record<string, number>;
}

export interface Scores {
  periodistico: ScoreResult;
  narrativo: ScoreResult;
  riesgo: ScoreResult;
  contextual: ScoreResult & { faltantes?: ContextoFaltante[] };
}

export interface ContextoFaltante {
  dimension: string;
  descripcion: string;
  impacto: 'alto' | 'medio' | 'bajo';
}

export interface Problema {
  problema: string;
  gravedad: 'alta' | 'media' | 'baja';
  solucion: string;
}

export interface ParrafoAnalisis {
  txt: string;
  idx: number;
  sev: 'ok' | 'warn' | 'alert';
  problemas: Array<{
    tipo: string;
    impacto: 'alto' | 'medio' | 'bajo';
    texto_evidencia?: string;
    sugerencia: string;
  }>;
  fortalezas: string[];
  error?: string;
}

export interface FuentesInfo {
  tipos_detectados: Array<{
    tipo: string;
    cantidad: number;
    ejemplos?: string[];
  }>;
  diversidad: number;
  independencia: number;
  concentracion_oficial: number;
}

export interface AnalisisCompleto {
  parrafos: ParrafoAnalisis[];
  scores: Scores;
  fuentes: FuentesInfo;
  tiempoCorreccion: number;
  razonTiempo: string;
  fortalezas: string[];
  problemasCriticos: Problema[];
  veredicto: string;
  accionInmediata: string;
  tipo: 'noticia' | 'cronica' | 'analisis' | 'columna' | 'editorial' | 'entrevista';
  texto: string;
  timestamp: number;
  id?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface AnalisisHistorico {
  id: string;
  timestamp: number;
  tipo: string;
  texto_preview: string;
  scores: {
    periodistico: number;
    narrativo: number;
    riesgo: number;
    contextual: number;
  };
}

/**
 * Tipos TypeScript para la API ICN
 */

export interface ParrafoAnalisis {
  txt: string;
  idx: number;
  sev: 'ok' | 'warn' | 'alert';
  problemas: ProblemaParrafo[];
  fortalezas: string[];
  error?: string;
}

export interface ProblemaParrafo {
  tipo: string;
  impacto: 'alto' | 'medio' | 'bajo';
  texto_evidencia?: string;
  sugerencia: string;
}

export interface ScoreDimension {
  score: number;
  justificacion: string;
  evidencia?: string;
  recomendacion?: string;
  sub?: Record<string, number>;
}

export interface ScoresContextual extends ScoreDimension {
  faltantes: DimensionFaltante[];
}

export interface DimensionFaltante {
  dimension: string;
  descripcion: string;
  impacto: 'alto' | 'medio' | 'bajo';
}

export interface TipoFuente {
  tipo: string;
  cantidad: number;
  ejemplos: string[];
}

export interface FuentesData {
  tipos_detectados: TipoFuente[];
  diversidad: number;
  independencia: number;
  concentracion_oficial: number;
}

export interface ProblemaCritico {
  problema: string;
  gravedad: 'alta' | 'media' | 'baja';
  solucion: string;
}

export interface AnalisisCompleto {
  parrafos: ParrafoAnalisis[];
  scores: {
    periodistico: ScoreDimension;
    narrativo: ScoreDimension;
    riesgo: ScoreDimension;
    contextual: ScoresContextual;
  };
  fuentes: FuentesData;
  tiempoCorreccion: number;
  razonTiempo: string;
  fortalezas: string[];
  problemasCriticos: ProblemaCritico[];
  veredicto: string;
  accionInmediata: string;
  tipo: string;
  texto: string;
  timestamp: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface RateLimitData {
  count: number;
  resetAt: number;
}

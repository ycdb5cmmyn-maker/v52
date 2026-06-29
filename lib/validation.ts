/**
 * Validación de entrada para la API
 */

export interface ValidateAnalyzeInput {
  texto?: unknown;
  tipo?: unknown;
}

export const VALID_TIPOS = ['noticia', 'cronica', 'analisis', 'columna', 'editorial', 'entrevista'];

const MIN_TEXTO_LENGTH = 100;
const MAX_TEXTO_LENGTH = 50000;

export function validateAnalyzeInput(body: any): {
  valid: boolean;
  error?: string;
  data?: { texto: string; tipo: string };
} {
  // Validar texto
  if (!body.texto || typeof body.texto !== 'string') {
    return {
      valid: false,
      error: 'El campo "texto" es requerido y debe ser una cadena de texto.',
    };
  }

  const texto = body.texto.trim();

  if (texto.length < MIN_TEXTO_LENGTH) {
    return {
      valid: false,
      error: `El texto debe tener al menos ${MIN_TEXTO_LENGTH} caracteres.`,
    };
  }

  if (texto.length > MAX_TEXTO_LENGTH) {
    return {
      valid: false,
      error: `El texto no puede exceder ${MAX_TEXTO_LENGTH} caracteres.`,
    };
  }

  // Validar que no sea solo números y caracteres especiales
  if (!/[a-záéíóúñ]/i.test(texto)) {
    return {
      valid: false,
      error: 'El texto debe contener palabras válidas.',
    };
  }

  // Validar tipo
  if (!body.tipo || typeof body.tipo !== 'string') {
    return {
      valid: false,
      error: 'El campo "tipo" es requerido. Opciones: noticia, crónica, análisis, columna, editorial, entrevista.',
    };
  }

  const tipo = body.tipo.toLowerCase();

  if (!VALID_TIPOS.includes(tipo)) {
    return {
      valid: false,
      error: `Tipo inválido. Debe ser uno de: ${VALID_TIPOS.join(', ')}`,
    };
  }

  return {
    valid: true,
    data: { texto, tipo },
  };
}

/**
 * Sanitizar texto
 */
export function sanitizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalizar espacios
    .slice(0, MAX_TEXTO_LENGTH); // Asegurar límite
}

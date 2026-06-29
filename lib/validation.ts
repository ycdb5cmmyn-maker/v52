import type { AnalyzeRequest, ArticleType } from './types';

const MIN_LENGTH = 100;
const MAX_LENGTH = 50_000;
const VALID_TYPES: ArticleType[] = [
  'noticia',
  'cronica',
  'entrevista',
  'editorial',
  'investigacion',
  'opinion',
  'otro'
];

export function sanitizeText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateAnalyzeInput(input: Partial<AnalyzeRequest>): { valid: true; value: AnalyzeRequest } | { valid: false; error: string } {
  if (typeof input.text !== 'string') {
    return { valid: false, error: 'Field "text" must be a string.' };
  }

  if (typeof input.type !== 'string') {
    return { valid: false, error: 'Field "type" must be a string.' };
  }

  const text = sanitizeText(input.text);
  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
    return { valid: false, error: `Field "text" must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters.` };
  }

  if (!VALID_TYPES.includes(input.type as ArticleType)) {
    return { valid: false, error: `Field "type" must be one of: ${VALID_TYPES.join(', ')}.` };
  }

  return {
    valid: true,
    value: {
      text,
      type: input.type as ArticleType
    }
  };
}

export const limits = { MIN_LENGTH, MAX_LENGTH, VALID_TYPES };

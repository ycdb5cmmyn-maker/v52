import type { AnalysisResult, ArticleType, ParagraphAnalysis } from './types';

const MODEL = 'claude-3-5-sonnet-20241022';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function fallbackAnalysis(text: string, type: ArticleType, reason: string): AnalysisResult {
  const paragraphs = splitParagraphs(text);
  const paragraphCount = paragraphs.length || 1;
  const base = Math.min(80, 35 + Math.floor(text.length / 1200));

  const periodistico = clampScore(base + (type === 'noticia' || type === 'investigacion' ? 8 : 0));
  const narrativo = clampScore(base + (paragraphCount > 3 ? 6 : 0));
  const contextual = clampScore(base + (text.length > 3000 ? 8 : 0));
  const riesgo = clampScore(Math.max(10, 80 - base));
  const score = clampScore(periodistico * 0.4 + narrativo * 0.25 + contextual * 0.25 + (100 - riesgo) * 0.1);

  const paragraphInfo: ParagraphAnalysis[] = paragraphs.slice(0, 8).map((paragraph, index) => ({
    index,
    excerpt: paragraph.slice(0, 240),
    findings: ['Analizado con fallback por indisponibilidad temporal del modelo.']
  }));

  return {
    score,
    summary: `Análisis completado con fallback seguro (${reason}).`,
    dimensions: {
      periodistico: { score: periodistico, notes: 'Evaluación heurística de fuentes y verificabilidad.' },
      narrativo: { score: narrativo, notes: 'Evaluación heurística de estructura y coherencia.' },
      contextual: { score: contextual, notes: 'Evaluación heurística de contexto y antecedentes.' },
      riesgo: { score: riesgo, notes: 'Evaluación heurística de carga valorativa y polarización.' }
    },
    paragraphs: paragraphInfo,
    model: `${MODEL}-fallback`
  };
}

function extractTextFromAnthropicResponse(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('content' in payload)) {
    return '';
  }

  const content = (payload as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text as string)
    .join('\n')
    .trim();
}

function parseJsonFromModelText(text: string): Record<string, unknown> | null {
  if (!text) {
    return null;
  }

  const direct = text.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const match = direct.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function callClaude(system: string, prompt: string, maxTokens: number): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractTextFromAnthropicResponse(payload);
  const parsed = parseJsonFromModelText(text);
  if (!parsed) {
    throw new Error('Unable to parse model JSON output');
  }

  return parsed;
}

export async function analyzeArticle(text: string, type: ArticleType): Promise<AnalysisResult> {
  const paragraphs = splitParagraphs(text).slice(0, 8);

  const paragraphFindings: ParagraphAnalysis[] = [];
  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    try {
      const result = await callClaude(
        'Eres un editor periodístico. Devuelve solo JSON: {"hallazgos":["..."]}.',
        `Tipo: ${type}\nPárrafo ${i + 1}: ${paragraph.slice(0, 1000)}`,
        300
      );

      const findings = Array.isArray(result.hallazgos)
        ? result.hallazgos.filter((item) => typeof item === 'string') as string[]
        : ['Sin observaciones críticas detectadas por el modelo.'];

      paragraphFindings.push({
        index: i,
        excerpt: paragraph.slice(0, 240),
        findings
      });
    } catch {
      paragraphFindings.push({
        index: i,
        excerpt: paragraph.slice(0, 240),
        findings: ['No fue posible analizar este párrafo con el modelo; se aplicó fallback.']
      });
    }
  }

  try {
    const result = await callClaude(
      'Analiza calidad noticiosa y responde solo JSON con score, summary y dimensions (periodistico/narrativo/contextual/riesgo).',
      `Tipo: ${type}\nTexto:\n${text.slice(0, 12000)}`,
      1400
    );

    const dimensionsPayload = (result.dimensions ?? {}) as Record<string, unknown>;
    const periodistico = clampScore(Number((dimensionsPayload.periodistico as { score?: number })?.score ?? 50));
    const narrativo = clampScore(Number((dimensionsPayload.narrativo as { score?: number })?.score ?? 50));
    const contextual = clampScore(Number((dimensionsPayload.contextual as { score?: number })?.score ?? 50));
    const riesgo = clampScore(Number((dimensionsPayload.riesgo as { score?: number })?.score ?? 50));

    const score = clampScore(Number(result.score ?? (periodistico * 0.4 + narrativo * 0.25 + contextual * 0.25 + (100 - riesgo) * 0.1)));

    return {
      score,
      summary: typeof result.summary === 'string' ? result.summary : 'Análisis completado correctamente.',
      dimensions: {
        periodistico: {
          score: periodistico,
          notes: ((dimensionsPayload.periodistico as { notes?: string })?.notes ?? 'Calidad periodística evaluada por modelo.').toString()
        },
        narrativo: {
          score: narrativo,
          notes: ((dimensionsPayload.narrativo as { notes?: string })?.notes ?? 'Calidad narrativa evaluada por modelo.').toString()
        },
        contextual: {
          score: contextual,
          notes: ((dimensionsPayload.contextual as { notes?: string })?.notes ?? 'Contexto evaluado por modelo.').toString()
        },
        riesgo: {
          score: riesgo,
          notes: ((dimensionsPayload.riesgo as { notes?: string })?.notes ?? 'Riesgo evaluado por modelo.').toString()
        }
      },
      paragraphs: paragraphFindings,
      model: MODEL
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    const fallback = fallbackAnalysis(text, type, reason);
    fallback.paragraphs = paragraphFindings.length > 0 ? paragraphFindings : fallback.paragraphs;
    return fallback;
  }
}

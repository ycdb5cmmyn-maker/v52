import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callLLM(
  system: string,
  user: string,
  maxTokens: number = 1000
): Promise<any> {
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const txt = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();

    // Extraer JSON aunque venga con texto alrededor
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) {
      return { raw: txt };
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return { raw: txt };
    }
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw error;
  }
}

export function getAgg(scores: {
  periodistico: number;
  narrativo: number;
  riesgo: number;
  contextual: number;
}): number {
  return Math.round(
    scores.periodistico * 0.4 +
      scores.narrativo * 0.25 +
      scores.contextual * 0.25 +
      (100 - scores.riesgo) * 0.1
  );
}

export function getSemaforo(scores: {
  periodistico: number;
  narrativo: number;
  riesgo: number;
}): 'publicable' | 'revisar' | 'critico' {
  const agg =
    scores.periodistico * 0.4 +
    scores.narrativo * 0.25 +
    (100 - scores.riesgo) * 0.25 +
    (100 - scores.riesgo) * 0.1;

  if (agg >= 68 && scores.riesgo < 35) return 'publicable';
  if (agg >= 45 || scores.riesgo < 55) return 'revisar';
  return 'critico';
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import { analyzeArticle } from '../../lib/analyzer';
import { cacheGet, cacheSet } from '../../lib/cache';
import type { AnalysisResult } from '../../lib/types';
import { applyCors, applyRateLimit } from '../../lib/middleware';
import { validateAnalyzeInput } from '../../lib/validation';

function buildCacheKey(text: string, type: string): string {
  const hash = createHash('sha256');
  hash.update(type);
  hash.update(':');
  hash.update(text);
  return hash.digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (applyCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!applyRateLimit(req, res)) {
    return;
  }

  const validation = validateAnalyzeInput(req.body ?? {});
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const { text, type } = validation.value;
  const key = buildCacheKey(text, type);

  const cached = cacheGet<AnalysisResult>(key);
  if (cached) {
    res.status(200).json({ ...cached, cached: true });
    return;
  }

  try {
    const analysis = await analyzeArticle(text, type);
    cacheSet(key, analysis);

    res.status(200).json({
      ...analysis,
      cached: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal analysis error';
    res.status(500).json({
      error: 'Analysis failed',
      details: message
    });
  }
}

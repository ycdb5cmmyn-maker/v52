import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeFullLLM, calculateICN } from '@/lib/analyzer';
import type { ApiResponse, AnalisisCompleto } from '@/lib/types';
import { withMiddleware, handleError } from '@/lib/middleware';
import { validateAnalyzeInput } from '@/lib/validation';
import { getCacheEntry, setCacheEntry, generateCacheKey } from '@/lib/cache';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AnalisisCompleto>>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Use POST.',
      timestamp: Date.now(),
    });
  }

  try {
    const validation = validateAnalyzeInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        timestamp: Date.now(),
      });
    }

    const { texto, tipo } = validation.data!;

    const cacheKey = generateCacheKey(texto, tipo);
    const cachedResult = getCacheEntry(cacheKey);
    if (cachedResult) {
      console.log('[CACHE HIT]', cacheKey);
      return res.status(200).json({
        success: true,
        data: cachedResult,
        timestamp: Date.now(),
      });
    }

    console.log('[ANALYSIS START]', { tipo, textoLength: texto.length });
    const startTime = Date.now();

    const result = await analyzeFullLLM(texto, tipo);
    setCacheEntry(cacheKey, result);

    const duration = Date.now() - startTime;
    const icn = calculateICN(
      result.scores.periodistico.score,
      result.scores.narrativo.score,
      result.scores.contextual.score,
      result.scores.riesgo.score
    );
    console.log('[ANALYSIS COMPLETE]', { duration: `${duration}ms`, icn });

    res.status(200).json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    handleError(error, res);
  }
}

export default withMiddleware(handler);

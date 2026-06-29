import type { NextApiRequest, NextApiResponse } from 'next';
import type { ApiResponse } from '@/lib/types';
import { withCORS } from '@/lib/middleware';

interface HealthResponse {
  status: 'ok' | 'error';
  message: string;
  timestamp: number;
  version: string;
  uptime: number;
  apiKey?: 'configured' | 'missing';
}

const startTime = Date.now();

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse<HealthResponse>>) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Use GET.',
      timestamp: Date.now(),
    });
  }

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  res.status(hasApiKey ? 200 : 503).json({
    success: hasApiKey,
    data: {
      status: hasApiKey ? 'ok' : 'error',
      message: hasApiKey ? 'API ICN operativa' : 'ANTHROPIC_API_KEY no configurada',
      timestamp: Date.now(),
      version: '1.0.0',
      uptime: Date.now() - startTime,
      apiKey: hasApiKey ? 'configured' : 'missing',
    },
    timestamp: Date.now(),
  });
}

export default withCORS(handler);

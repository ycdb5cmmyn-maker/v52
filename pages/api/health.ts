import type { NextApiRequest, NextApiResponse } from 'next';

interface HealthResponse {
  status: 'ok' | 'error';
  message: string;
  timestamp: number;
  version: string;
  uptime: number;
}

const startTime = Date.now();

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Método no permitido',
      timestamp: Date.now(),
      version: '1.0.0',
      uptime: Date.now() - startTime,
    });
  }

  // Verificar que la API Key está configurada
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  res.status(hasApiKey ? 200 : 503).json({
    status: hasApiKey ? 'ok' : 'error',
    message: hasApiKey
      ? 'API ICN operativa'
      : 'Falta configuración de ANTHROPIC_API_KEY',
    timestamp: Date.now(),
    version: '1.0.0',
    uptime: Date.now() - startTime,
  });
}

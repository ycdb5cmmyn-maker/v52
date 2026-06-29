import type { NextApiRequest, NextApiResponse } from 'next';
import type { ApiResponse } from './types';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Rate limiting: 60 requests per minute per IP
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000; // 1 minute

/**
 * Rate limiting middleware
 */
export function withRateLimit<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let limit = rateLimitMap.get(ip);

    if (!limit || now > limit.resetAt) {
      limit = { count: 0, resetAt: now + RATE_WINDOW };
      rateLimitMap.set(ip, limit);
    }

    if (limit.count >= RATE_LIMIT) {
      res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Max ${RATE_LIMIT} requests per minute.`,
        timestamp: Date.now(),
      });
      return;
    }

    limit.count++;
    await handler(req, res);
  };
}

/**
 * CORS middleware
 */
export function withCORS<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    // Permitir CORS desde cualquier origen (cambiar según necesidad)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    await handler(req, res);
  };
}

/**
 * Composición de middlewares
 */
export function withMiddleware<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return withCORS(withRateLimit(handler));
}

/**
 * Error handler
 */
export function handleError(error: unknown, res: NextApiResponse<ApiResponse<any>>) {
  const message = error instanceof Error ? error.message : 'Error interno del servidor';
  const statusCode = message.includes('Rate limit') ? 429 : message.includes('Método no permitido') ? 405 : 500;

  console.error('[API Error]', error);

  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: Date.now(),
  });
}

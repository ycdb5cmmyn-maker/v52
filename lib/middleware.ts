import type { NextApiRequest, NextApiResponse } from 'next';

const WINDOW_MS = 60_000;
const LIMIT = 60;

type RateState = {
  count: number;
  resetAt: number;
};

const requests = new Map<string, RateState>();

function getClientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}

export function applyRateLimit(req: NextApiRequest, res: NextApiResponse): boolean {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = requests.get(ip);

  if (!current || current.resetAt <= now) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    res.setHeader('X-RateLimit-Limit', LIMIT.toString());
    return true;
  }

  if (current.count >= LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({ error: 'Rate limit exceeded.' });
    return false;
  }

  current.count += 1;
  requests.set(ip, current);
  res.setHeader('X-RateLimit-Limit', LIMIT.toString());
  return true;
}

export function resetRateLimitState(): void {
  requests.clear();
}

export const rateLimitConfig = { WINDOW_MS, LIMIT };

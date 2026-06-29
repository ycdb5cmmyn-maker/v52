import type { NextApiRequest, NextApiResponse } from 'next';
import { applyCors } from '../../lib/middleware';

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (applyCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    anthropicConfigured: hasApiKey
  });
}

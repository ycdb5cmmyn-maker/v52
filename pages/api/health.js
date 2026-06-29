export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Método no permitido',
    });
  }

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  res.status(hasApiKey ? 200 : 503).json({
    status: hasApiKey ? 'ok' : 'error',
    message: hasApiKey ? 'API operativa' : 'ANTHROPIC_API_KEY no configurada',
    version: '1.0.0',
    apiKey: hasApiKey ? 'configured' : 'missing',
    timestamp: Date.now(),
  });
}

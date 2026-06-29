export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido',
    });
  }

  try {
    const { texto, tipo } = req.body;

    // Validación
    if (!texto || typeof texto !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo texto requerido',
      });
    }

    if (texto.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Texto debe tener al menos 100 caracteres',
      });
    }

    if (!tipo || typeof tipo !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo tipo requerido',
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'ANTHROPIC_API_KEY no configurada',
      });
    }

    // Importar SDK de Anthropic
    const Anthropic = require('@anthropic-ai/sdk').default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log('Iniciando análisis...');
    const startTime = Date.now();

    // Llamar a Claude
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analiza este artículo (tipo: ${tipo}) en 3 puntos clave:\n\n${texto.slice(0, 2000)}`,
        },
      ],
    });

    const duration = Date.now() - startTime;
    const analysis = response.content[0]?.text || 'Análisis completado';

    console.log(`Análisis completado en ${duration}ms`);

    return res.status(200).json({
      success: true,
      analysis,
      duration,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno',
    });
  }
}

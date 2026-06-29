import type { NextApiRequest, NextApiResponse } from 'next';

interface AnalyzeRequest {
  texto: string;
  tipo: string;
}

interface AnalyzeResponse {
  success: boolean;
  message: string;
  error?: string;
  timestamp: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalyzeResponse>
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido. Use POST.',
      timestamp: Date.now(),
    });
  }

  try {
    const { texto, tipo } = req.body as AnalyzeRequest;

    // Validación básica
    if (!texto || typeof texto !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'El campo "texto" es requerido y debe ser string.',
        message: 'Validación fallida',
        timestamp: Date.now(),
      });
    }

    if (!tipo || typeof tipo !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'El campo "tipo" es requerido.',
        message: 'Validación fallida',
        timestamp: Date.now(),
      });
    }

    if (texto.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'El texto debe tener al menos 100 caracteres.',
        message: 'Texto muy corto',
        timestamp: Date.now(),
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'ANTHROPIC_API_KEY no configurada en el servidor.',
        message: 'Servicio no disponible',
        timestamp: Date.now(),
      });
    }

    // Importar Anthropic
    const Anthropic = require('@anthropic-ai/sdk').default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Llamar a Claude para análisis simple
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Analiza este artículo periodístico (tipo: ${tipo}) en máximo 3 puntos clave:\n\n${texto.slice(0, 2000)}`,
        },
      ],
    });

    const analysis = response.content[0]?.text || 'Análisis completado';

    return res.status(200).json({
      success: true,
      message: analysis,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error en /api/analyze:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      message: 'Error en el análisis',
      timestamp: Date.now(),
    });
  }
}

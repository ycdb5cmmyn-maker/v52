import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeFullLLM } from '@/lib/analyzer';
import { ApiResponse, AnalisisCompleto } from '@/lib/types';

export const config = {
  maxDuration: 300, // 5 minutos
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<AnalisisCompleto>>
) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Use POST.',
      timestamp: Date.now(),
    });
  }

  try {
    const { texto, tipo } = req.body;

    // Validar entrada
    if (!texto || typeof texto !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'El campo "texto" es requerido y debe ser una cadena.',
        timestamp: Date.now(),
      });
    }

    if (!tipo || typeof tipo !== 'string') {
      return res.status(400).json({
        success: false,
        error:
          'El campo "tipo" es requerido. Opciones: noticia, crónica, análisis, columna, editorial, entrevista.',
        timestamp: Date.now(),
      });
    }

    // Validar longitud mínima
    if (texto.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'El texto debe tener al menos 100 caracteres.',
        timestamp: Date.now(),
      });
    }

    // Validar tipo
    const tiposValidos = [
      'noticia',
      'cronica',
      'analisis',
      'columna',
      'editorial',
      'entrevista',
    ];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}`,
        timestamp: Date.now(),
      });
    }

    console.log(`[API] Iniciando análisis de ${tipo} (${texto.length} caracteres)`);

    // Ejecutar análisis
    const resultado = await analyzeFullLLM(texto, tipo);

    return res.status(200).json({
      success: true,
      data: resultado,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Error en análisis:', error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error interno del servidor durante el análisis',
      timestamp: Date.now(),
    });
  }
}

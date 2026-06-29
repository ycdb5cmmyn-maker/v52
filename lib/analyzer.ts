import Anthropic from '@anthropic-ai/sdk';
import type { AnalisisCompleto, ParrafoAnalisis } from './types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Analiza un artículo completo con evaluación por párrafo y scores globales
 */
export async function analyzeFullLLM(
  texto: string,
  tipo: string,
  onProgress?: (msg: string, pct: number) => void
): Promise<AnalisisCompleto> {
  const progress = onProgress || (() => {});

  // Validación básica
  if (!texto || texto.trim().length < 100) {
    throw new Error('Texto debe tener al menos 100 caracteres');
  }

  // Dividir en párrafos
  const parrafos = texto
    .split(/\n+/)
    .filter((p) => p.trim().length > 20);

  if (parrafos.length === 0) {
    throw new Error('No se encontraron párrafos válidos');
  }

  // 1. Análisis por párrafo (máximo 8 para no exceder tiempo)
  progress('Analizando párrafos...', 10);

  const parSys = `Eres un editor periodístico experto. Analiza este párrafo de una pieza periodística del tipo "${tipo}" y responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional.

Formato exacto requerido:
{
  "sev": "ok" | "warn" | "alert",
  "problemas": [
    {
      "tipo": string,
      "impacto": "alto" | "medio" | "bajo",
      "texto_evidencia": string (opcional),
      "sugerencia": string
    }
  ],
  "fortalezas": [string]
}`;

  const parResults: ParrafoAnalisis[] = [];
  const maxPar = Math.min(parrafos.length, 8);

  for (let i = 0; i < maxPar; i++) {
    progress(`Analizando párrafo ${i + 1} de ${maxPar}...`, 10 + Math.round((i / maxPar) * 35));

    try {
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Párrafo a analizar:\n\n${parrafos[i].slice(0, 600)}`,
          },
        ],
        system: parSys,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Respuesta inesperada del modelo');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { sev: 'ok', problemas: [], fortalezas: [] };

      parResults.push({
        txt: parrafos[i],
        idx: i,
        sev: parsed.sev || 'ok',
        problemas: parsed.problemas || [],
        fortalezas: parsed.fortalezas || [],
      });
    } catch (e) {
      console.error(`Error analyzing paragraph ${i}:`, e);
      parResults.push({
        txt: parrafos[i],
        idx: i,
        sev: 'ok',
        problemas: [],
        fortalezas: [],
        error: e instanceof Error ? e.message : 'Error desconocido',
      });
    }
  }

  // Agregar párrafos restantes sin análisis detallado
  for (let i = maxPar; i < parrafos.length; i++) {
    parResults.push({
      txt: parrafos[i],
      idx: i,
      sev: 'ok',
      problemas: [],
      fortalezas: [],
    });
  }

  // 2. Scores globales
  progress('Calculando scores de calidad...', 50);

  const scoresSys = `Eres un evaluador de calidad periodística experto. Analiza el siguiente texto periodístico del tipo "${tipo}" y responde ÚNICAMENTE con un objeto JSON válido.

Formato exacto:
{
  "periodistico": {
    "score": número 0-100,
    "justificacion": string,
    "evidencia": string,
    "recomendacion": string,
    "sub": { "fuentes": número, "verificabilidad": número, "atribucion": número }
  },
  "narrativo": {
    "score": número 0-100,
    "justificacion": string,
    "evidencia": string,
    "recomendacion": string,
    "sub": { "estructura": número, "lead": número, "coherencia": número }
  },
  "riesgo": {
    "score": número 0-100,
    "justificacion": string,
    "evidencia": string,
    "recomendacion": string,
    "sub": { "opinativa": número, "polarizacion": número, "clickbait": número }
  },
  "contextual": {
    "score": número 0-100,
    "justificacion": string,
    "faltantes": [
      {
        "dimension": string,
        "descripcion": string,
        "impacto": "alto" | "medio" | "bajo"
      }
    ]
  },
  "fuentes": {
    "tipos_detectados": [
      { "tipo": string, "cantidad": número, "ejemplos": [string] }
    ],
    "diversidad": número 0-100,
    "independencia": número 0-100,
    "concentracion_oficial": número 0-100
  },
  "tiempo_estimado_correccion": número,
  "razon_tiempo": string,
  "fortalezas_principales": [string],
  "problemas_criticos": [
    { "problema": string, "gravedad": "alta" | "media" | "baja", "solucion": string }
  ]
}`;

  let scores = null;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: `Tipo de pieza: ${tipo}\n\nTexto:\n${texto.slice(0, 3500)}`,
        },
      ],
      system: scoresSys,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (e) {
    console.error('Error calculating scores:', e);
  }

  // Valores por defecto si el LLM falla
  const safePeriodistico = scores?.periodistico || {
    score: 50,
    justificacion: 'No se pudo calcular',
    evidencia: '',
    recomendacion: '',
    sub: { fuentes: 50, verificabilidad: 50, atribucion: 50 },
  };

  const safeNarrativo = scores?.narrativo || {
    score: 50,
    justificacion: 'No se pudo calcular',
    evidencia: '',
    recomendacion: '',
    sub: { estructura: 50, lead: 50, coherencia: 50 },
  };

  const safeRiesgo = scores?.riesgo || {
    score: 50,
    justificacion: 'No se pudo calcular',
    evidencia: '',
    recomendacion: '',
    sub: { opinativa: 50, polarizacion: 50, clickbait: 50 },
  };

  const safeContextual = scores?.contextual || {
    score: 50,
    justificacion: '',
    faltantes: [],
  };

  const safeFuentes = scores?.fuentes || {
    tipos_detectados: [],
    diversidad: 50,
    independencia: 50,
    concentracion_oficial: 50,
  };

  // 3. Resumen ejecutivo
  progress('Generando veredicto editorial...', 85);

  const execSys = `Eres el editor jefe de un medio argentino. Da un veredicto editorial directo en máximo 2 oraciones. Responde ÚNICAMENTE con JSON válido:
{
  "veredicto": string,
  "accion_inmediata": string
}`;

  let exec = {
    veredicto: 'Análisis completado. Revisa los scores por dimensión.',
    accion_inmediata: 'Prioriza los problemas de alta gravedad antes de publicar.',
  };

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Pieza tipo ${tipo} con scores: periodístico=${safePeriodistico.score} narrativo=${safeNarrativo.score} riesgo=${safeRiesgo.score} contextual=${safeContextual.score}. Problemas críticos: ${JSON.stringify(scores?.problemas_criticos || [])}`,
        },
      ],
      system: execSys,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        exec = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (e) {
    console.error('Error generating executive summary:', e);
  }

  progress('Análisis completo', 100);

  return {
    parrafos: parResults,
    scores: {
      periodistico: safePeriodistico,
      narrativo: safeNarrativo,
      riesgo: safeRiesgo,
      contextual: safeContextual,
    },
    fuentes: safeFuentes,
    tiempoCorreccion: scores?.tiempo_estimado_correccion || 15,
    razonTiempo: scores?.razon_tiempo || 'Análisis estándar',
    fortalezas: scores?.fortalezas_principales || [],
    problemasCriticos: scores?.problemas_criticos || [],
    veredicto: exec.veredicto || 'Análisis completado.',
    accionInmediata: exec.accion_inmediata || '',
    tipo,
    texto,
    timestamp: Date.now(),
  };
}

/**
 * Calcula el score ICN agregado
 */
export function calculateICN(
  periodistico: number,
  narrativo: number,
  contextual: number,
  riesgo: number
): number {
  return Math.round(periodistico * 0.4 + narrativo * 0.25 + contextual * 0.25 + (100 - riesgo) * 0.1);
}

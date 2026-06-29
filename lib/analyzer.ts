import { callLLM, getAgg, getSemaforo } from './llm';
import { AnalisisCompleto } from './types';

export async function analyzeFullLLM(
  texto: string,
  tipo: string,
  onProgress?: (msg: string, pct: number) => void
): Promise<AnalisisCompleto> {
  const log = (msg: string, pct: number) => {
    if (onProgress) onProgress(msg, pct);
    console.log(`[${pct}%] ${msg}`);
  };

  const parrafos = texto
    .split(/\n+/)
    .filter((p) => p.trim().length > 20);

  // 1. Análisis por párrafo
  log('Analizando párrafos...', 10);

  const parSys = `Eres un editor periodístico experto. Analiza este párrafo de una pieza periodística y responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes ni después. Formato: {"sev":"ok|warn|alert","problemas":[{"tipo":"...","impacto":"alto|medio|bajo","texto_evidencia":"...","sugerencia":"..."}],"fortalezas":["..."]}`;

  const parResults = [];
  const maxPar = Math.min(parrafos.length, 8);

  for (let i = 0; i < maxPar; i++) {
    log(
      `Analizando párrafo ${i + 1} de ${maxPar}...`,
      10 + Math.round((i / maxPar) * 35)
    );
    try {
      const r = await callLLM(
        parSys,
        `Párrafo a analizar: ${parrafos[i].slice(0, 600)}`,
        500
      );
      parResults.push({
        txt: parrafos[i],
        idx: i,
        sev: r.sev || 'ok',
        problemas: r.problemas || [],
        fortalezas: r.fortalezas || [],
      });
    } catch (e) {
      parResults.push({
        txt: parrafos[i],
        idx: i,
        sev: 'ok',
        problemas: [],
        fortalezas: [],
        error: (e as Error).message,
      });
    }
  }

  // Agregar párrafos restantes sin análisis
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
  log('Calculando scores de calidad...', 50);

  const scoresSys = `Eres un evaluador de calidad periodística experto. Analiza el siguiente texto periodístico y responde ÚNICAMENTE con un objeto JSON válido sin texto adicional. Formato: {"periodistico":{"score":0-100,"justificacion":"...","evidencia":"...","recomendacion":"...","sub":{...}},"narrativo":{...},"riesgo":{...},"contextual":{"score":0-100,"justificacion":"...","faltantes":[{"dimension":"...","descripcion":"...","impacto":"alto|medio|bajo"}]},"fuentes":{"tipos_detectados":[{"tipo":"...","cantidad":N}],"diversidad":0-100,"independencia":0-100,"concentracion_oficial":0-100},"tiempo_estimado_correccion":N,"razon_tiempo":"...","fortalezas_principales":["..."],"problemas_criticos":[{"problema":"...","gravedad":"alta|media|baja","solucion":"..."}]}`;

  let scores = null;
  try {
    scores = await callLLM(
      scoresSys,
      `Tipo de pieza: ${tipo}\n\nTexto:\n${texto.slice(0, 3500)}`,
      2500
    );
  } catch (e) {
    console.error('Error scores:', e);
  }

  // Valores por defecto si el LLM falla
  const safePeriodistico = scores?.periodistico?.score
    ? scores.periodistico
    : {
        score: 50,
        justificacion: 'No se pudo calcular',
        evidencia: '',
        recomendacion: '',
      };

  const safeNarrativo = scores?.narrativo?.score
    ? scores.narrativo
    : {
        score: 50,
        justificacion: 'No se pudo calcular',
        evidencia: '',
        recomendacion: '',
        sub: {},
      };

  const safeRiesgo =
    scores?.riesgo?.score !== undefined
      ? scores.riesgo
      : {
          score: 50,
          justificacion: 'No se pudo calcular',
          evidencia: '',
          recomendacion: '',
          sub: {},
        };

  const safeContextual = scores?.contextual?.score
    ? scores.contextual
    : { score: 50, justificacion: '', faltantes: [] };

  const safeFuentes = scores?.fuentes
    ? scores.fuentes
    : {
        tipos_detectados: [],
        diversidad: 50,
        independencia: 50,
        concentracion_oficial: 50,
      };

  // 3. Resumen ejecutivo
  log('Generando veredicto editorial...', 85);

  const execSys = `Eres el editor jefe de un medio argentino. Da un veredicto editorial directo en 2 oraciones máximas. Responde ÚNICAMENTE con JSON válido: {"veredicto":"texto","accion_inmediata":"texto"}`;

  let exec = { veredicto: '', accion_inmediata: '' };
  try {
    const r = await callLLM(
      execSys,
      `Pieza tipo ${tipo} con scores: periodístico=${safePeriodistico.score} narrativo=${safeNarrativo.score} riesgo=${safeRiesgo.score}. Problemas: ${(scores?.problemas_criticos || []).map((p: any) => p.problema).join('; ')}`,
      600
    );
    if (r.veredicto) exec = r;
  } catch (e) {
    exec = {
      veredicto: 'Análisis completado. Revisa los scores por dimensión.',
      accion_inmediata:
        'Prioriza los problemas de alta gravedad antes de publicar.',
    };
  }

  log('Análisis completo', 100);

  return {
    parrafos: parResults,
    scores: {
      periodistico: safePeriodistico,
      narrativo: safeNarrativo,
      riesgo: safeRiesgo,
      contextual: safeContextual,
    },
    fuentes: safeFuentes,
    tiempoCorreccion:
      (scores && scores.tiempo_estimado_correccion) || 5,
    razonTiempo: (scores && scores.razon_tiempo) || '',
    fortalezas: (scores && scores.fortalezas_principales) || [],
    problemasCriticos: (scores && scores.problemas_criticos) || [],
    veredicto: exec.veredicto || 'Análisis completado.',
    accionInmediata: exec.accion_inmediata || '',
    tipo: tipo as any,
    texto,
    timestamp: Date.now(),
  };
}

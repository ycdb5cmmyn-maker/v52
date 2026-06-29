import { useState, useRef, useMemo, useEffect, useCallback } from "react";

// ── PALETA ─────────────────────────────────────────────────────────────────
const C = {
  bg:"#080C14", surface:"#0D1117", panel:"#161B24", card:"#1C2333",
  border:"#21262D", border2:"#30363D",
  ink:"#E6EDF3", ink2:"#8B949E", ink3:"#484F58",
  teal:"#2EA9A1", tealB:"rgba(46,169,161,0.12)", tealD:"#1E7A74",
  green:"#3FB950", greenB:"rgba(63,185,80,0.12)",
  red:"#F85149", redB:"rgba(248,81,73,0.12)",
  amber:"#D29922", amberB:"rgba(210,153,34,0.12)",
  blue:"#58A6FF", blueB:"rgba(88,166,255,0.12)",
  purple:"#BC8CFF", purpleB:"rgba(188,140,255,0.12)",
  pink:"#FF7B72",
};

const SEMAFORO = {
  publicable:{ lbl:"Publicable",       icon:"●", col:C.green,  bg:C.greenB,  border:"rgba(63,185,80,0.3)"  },
  revisar:   { lbl:"Requiere revision",icon:"◐", col:C.amber,  bg:C.amberB,  border:"rgba(210,153,34,0.3)" },
  critico:   { lbl:"Riesgo alto",      icon:"●", col:C.red,    bg:C.redB,    border:"rgba(248,81,73,0.3)"  },
};

function getSemaforo(scores) {
  const { periodistico, narrativo, riesgo } = scores;
  const agg = periodistico * 0.4 + narrativo * 0.25 + (100 - riesgo) * 0.25 + (100 - riesgo) * 0.10;
  if (agg >= 68 && riesgo < 35) return "publicable";
  if (agg >= 45 || riesgo < 55) return "revisar";
  return "critico";
}

function getAgg(scores) {
  const { periodistico, narrativo, riesgo, contextual } = scores;
  return Math.round(periodistico * 0.40 + narrativo * 0.25 + contextual * 0.25 + (100 - riesgo) * 0.10);
}

// ── LLM ENGINE ─────────────────────────────────────────────────────────────
async function callLLM(system, user, maxTokens) {
  maxTokens = maxTokens || 1000;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error("API error " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  // Extraer JSON aunque venga con texto alrededor
  const match = txt.match(/\{[\s\S]*\}/);
  if (!match) return { raw: txt };
  try { return JSON.parse(match[0]); }
  catch { return { raw: txt }; }
}

async function analyzeFullLLM(texto, tipo, onProgress) {
  const parrafos = texto.split(/\n+/).filter(p => p.trim().length > 20);

  // 1. Analisis por parrafo (maximo 8 para no exceder tiempo)
  onProgress("Analizando parrafos...", 10);
  const parSys = "Eres un editor periodistico experto. Analiza este parrafo de una pieza periodistica y responde UNICAMENTE con un objeto JSON valido, sin texto adicional antes ni despues. Formato exacto: {\"afirmaciones_verificables\":7,\"atribucion\":5,\"calidad_fuente\":6,\"carga_valorativa\":3,\"evidencia_documental\":4,\"riesgo_opinion_no_atribuida\":2,\"contexto_presente\":6,\"problemas\":[{\"tipo\":\"string\",\"texto_evidencia\":\"string\",\"impacto\":\"alto\",\"sugerencia\":\"string\"}],\"fortalezas\":[\"string\"],\"sev\":\"ok\"}";

  const parResults = [];
  const maxPar = Math.min(parrafos.length, 8);
  for (let i = 0; i < maxPar; i++) {
    onProgress("Analizando parrafo " + (i+1) + " de " + maxPar + "...", 10 + Math.round((i / maxPar) * 35));
    try {
      const r = await callLLM(parSys, "Parrafo a analizar: " + parrafos[i].slice(0, 600), 500);
      parResults.push({ txt: parrafos[i], idx: i, sev: r.sev || "ok", problemas: r.problemas || [], fortalezas: r.fortalezas || [], scores: r });
    } catch(e) {
      parResults.push({ txt: parrafos[i], idx: i, sev: "ok", problemas: [], fortalezas: [], error: e.message });
    }
  }
  // Agregar parrafos restantes sin analisis
  for (let i = maxPar; i < parrafos.length; i++) {
    parResults.push({ txt: parrafos[i], idx: i, sev: "ok", problemas: [], fortalezas: [] });
  }

  // 2. Scores globales
  onProgress("Calculando scores de calidad...", 50);
  const scoresSys = "Eres un evaluador de calidad periodistica experto. Analiza el siguiente texto periodistico y responde UNICAMENTE con un objeto JSON valido sin texto adicional. Formato exacto con estos campos numericos del 0 al 100: {\"periodistico\":{\"score\":70,\"justificacion\":\"texto\",\"evidencia\":\"cita textual\",\"recomendacion\":\"texto\",\"sub\":{\"verificabilidad\":70,\"diversidad_fuentes\":60,\"documentacion\":65,\"atribucion\":75,\"precision_factual\":70}},\"narrativo\":{\"score\":65,\"justificacion\":\"texto\",\"evidencia\":\"cita\",\"recomendacion\":\"texto\",\"sub\":{\"estructura_lead\":70,\"coherencia_titular\":65,\"contexto\":60,\"claridad\":70,\"jerarquia\":65}},\"riesgo\":{\"score\":30,\"justificacion\":\"texto\",\"evidencia\":\"cita\",\"recomendacion\":\"texto\",\"sub\":{\"carga_opinativa\":25,\"polarizacion\":20,\"clickbait\":15,\"dependencia_oficial\":40,\"sensacionalismo\":20}},\"contextual\":{\"score\":55,\"justificacion\":\"texto\",\"faltantes\":[{\"dimension\":\"Contexto historico\",\"descripcion\":\"descripcion concreta\",\"impacto\":\"alto\"}]},\"fuentes\":{\"tipos_detectados\":[{\"tipo\":\"oficial\",\"cantidad\":3,\"ejemplos\":[\"ejemplo\"]}],\"diversidad\":60,\"independencia\":55,\"concentracion_oficial\":45},\"tiempo_estimado_correccion\":8,\"razon_tiempo\":\"texto\",\"fortalezas_principales\":[\"fortaleza 1\",\"fortaleza 2\"],\"problemas_criticos\":[{\"problema\":\"descripcion\",\"gravedad\":\"alta\",\"parrafo_aprox\":2,\"solucion\":\"solucion concreta\"}]}";

  let scores = null;
  try {
    scores = await callLLM(scoresSys, "Tipo de pieza: " + tipo + "\n\nTexto:\n" + texto.slice(0, 3500), 2500);
  } catch(e) {
    console.error("Error scores:", e);
  }

  // Valores por defecto si el LLM falla
  const safePeriodistico = (scores && scores.periodistico && scores.periodistico.score) ? scores.periodistico : { score: 50, justificacion: "No se pudo calcular", evidencia: "", recomendacion: "", sub: { verificabilidad:50, diversidad_fuentes:50, documentacion:50, atribucion:50, precision_factual:50 } };
  const safeNarrativo = (scores && scores.narrativo && scores.narrativo.score) ? scores.narrativo : { score: 50, justificacion: "No se pudo calcular", evidencia: "", recomendacion: "", sub: { estructura_lead:50, coherencia_titular:50, contexto:50, claridad:50, jerarquia:50 } };
  const safeRiesgo = (scores && scores.riesgo && scores.riesgo.score !== undefined) ? scores.riesgo : { score: 50, justificacion: "No se pudo calcular", evidencia: "", recomendacion: "", sub: { carga_opinativa:50, polarizacion:50, clickbait:50, dependencia_oficial:50, sensacionalismo:50 } };
  const safeContextual = (scores && scores.contextual && scores.contextual.score) ? scores.contextual : { score: 50, justificacion: "", faltantes: [] };
  const safeFuentes = (scores && scores.fuentes) ? scores.fuentes : { tipos_detectados: [], diversidad: 50, independencia: 50, concentracion_oficial: 50 };

  // 3. Resumen ejecutivo
  onProgress("Generando veredicto editorial...", 85);
  const execSys = "Eres el editor jefe de un medio argentino. Da un veredicto editorial directo en 2 oraciones maximas. Responde UNICAMENTE con JSON valido: {\"veredicto\":\"texto\",\"accion_inmediata\":\"texto\"}";
  let exec = { veredicto: "", accion_inmediata: "" };
  try {
    const r = await callLLM(execSys, "Pieza tipo " + tipo + " con scores: periodistico=" + safePeriodistico.score + " narrativo=" + safeNarrativo.score + " riesgo=" + safeRiesgo.score + ". Problemas: " + JSON.stringify((scores && scores.problemas_criticos) || []).slice(0,300), 300);
    if (r.veredicto) exec = r;
  } catch(e) {
    exec = { veredicto: "Analisis completado. Revisa los scores por dimension.", accion_inmediata: "Prioriza los problemas de alta gravedad antes de publicar." };
  }

  onProgress("Analisis completo", 100);

  return {
    parrafos: parResults,
    scores: {
      periodistico: safePeriodistico,
      narrativo: safeNarrativo,
      riesgo: safeRiesgo,
      contextual: safeContextual,
    },
    fuentes: safeFuentes,
    tiempoCorreccion: (scores && scores.tiempo_estimado_correccion) || 5,
    razonTiempo: (scores && scores.razon_tiempo) || "",
    fortalezas: (scores && scores.fortalezas_principales) || [],
    problemasCriticos: (scores && scores.problemas_criticos) || [],
    veredicto: exec.veredicto || "Analisis completado.",
    accionInmediata: exec.accion_inmediata || "",
    tipo,
    texto,
    timestamp: Date.now(),
  };
}

// ── STORAGE ─────────────────────────────────────────────────────────────────
async function saveAnalysis(data) {
  try {
    const list = await loadHistory();
    const id = "an_" + Date.now();
    const entry = { id, timestamp: data.timestamp, tipo: data.tipo, texto_preview: data.texto.slice(0, 120), scores: { periodistico: data.scores.periodistico.score, narrativo: data.scores.narrativo.score, riesgo: data.scores.riesgo.score, contextual: data.scores.contextual.score } };
    list.unshift(entry);
    await window.storage.set("icn_history", JSON.stringify(list.slice(0, 20)));
    await window.storage.set("icn_analysis_" + id, JSON.stringify(data));
    return id;
  } catch { return null; }
}

async function loadHistory() {
  try {
    const r = await window.storage.get("icn_history");
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function loadAnalysis(id) {
  try {
    const r = await window.storage.get("icn_analysis_" + id);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

// ── EXPORT ──────────────────────────────────────────────────────────────────
function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "icn_analisis_" + Date.now() + ".json"; a.click();
}

function exportCSV(data) {
  const rows = [["Dimension","Score","Justificacion"]];
  rows.push(["Calidad Periodistica", data.scores.periodistico.score, data.scores.periodistico.justificacion]);
  rows.push(["Calidad Narrativa", data.scores.narrativo.score, data.scores.narrativo.justificacion]);
  rows.push(["Riesgo Editorial", data.scores.riesgo.score, data.scores.riesgo.justificacion]);
  rows.push(["Cobertura Contextual", data.scores.contextual.score, ""]);
  rows.push(["Score Agregado", getAgg({ periodistico: data.scores.periodistico.score, narrativo: data.scores.narrativo.score, riesgo: data.scores.riesgo.score, contextual: data.scores.contextual.score }), ""]);
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "icn_analisis_" + Date.now() + ".csv"; a.click();
}

function exportPrint(data) {
  const agg = getAgg({ periodistico: data.scores.periodistico.score, narrativo: data.scores.narrativo.score, riesgo: data.scores.riesgo.score, contextual: data.scores.contextual.score });
  const sem = getSemaforo({ periodistico: data.scores.periodistico.score, narrativo: data.scores.narrativo.score, riesgo: data.scores.riesgo.score });
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>ICN - Informe de Analisis</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#111;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#333}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5;font-weight:600}.estado{font-size:18px;font-weight:700;padding:8px 16px;border-radius:4px;display:inline-block;margin:8px 0}.score{font-size:32px;font-weight:700}.meta{color:#666;font-size:13px}pre{white-space:pre-wrap;font-family:inherit;font-size:13px;background:#f9f9f9;padding:12px;border-left:3px solid #ddd}</style></head><body>
  <h1>Indice de Calidad Noticiosa — Informe Editorial</h1>
  <p class="meta">Generado: ${new Date(data.timestamp).toLocaleString("es-AR")} | Tipo: ${data.tipo} | ICN v4.0</p>
  <h2>Estado Editorial</h2>
  <div class="estado">${SEMAFORO[sem].icon} ${SEMAFORO[sem].lbl}</div>
  <p><span class="score">${agg}</span>/100 — Score agregado</p>
  <p><strong>Veredicto:</strong> ${data.veredicto}</p>
  <p><strong>Accion inmediata:</strong> ${data.accionInmediata}</p>
  <p><strong>Tiempo estimado de correccion:</strong> ${data.tiempoCorreccion} minutos</p>
  <h2>Scores por dimension</h2>
  <table><tr><th>Dimension</th><th>Score</th><th>Justificacion</th></tr>
  <tr><td>Calidad Periodistica</td><td>${data.scores.periodistico.score}/100</td><td>${data.scores.periodistico.justificacion}</td></tr>
  <tr><td>Calidad Narrativa</td><td>${data.scores.narrativo.score}/100</td><td>${data.scores.narrativo.justificacion}</td></tr>
  <tr><td>Riesgo Editorial</td><td>${data.scores.riesgo.score}/100</td><td>${data.scores.riesgo.justificacion}</td></tr>
  <tr><td>Cobertura Contextual</td><td>${data.scores.contextual.score}/100</td><td></td></tr></table>
  <h2>Problemas criticos</h2>
  ${(data.problemasCriticos||[]).map(p=>`<p><strong>[${p.gravedad.toUpperCase()}]</strong> ${p.problema}<br><em>Solucion:</em> ${p.solucion}</p>`).join("")}
  <h2>Contexto faltante</h2>
  ${(data.scores.contextual.faltantes||[]).map(f=>`<p><strong>${f.dimension}:</strong> ${f.descripcion}</p>`).join("")}
  <h2>Fuentes</h2>
  ${(data.fuentes.tipos_detectados||[]).map(f=>`<p>${f.tipo}: ${f.cantidad} menciones</p>`).join("")}
  <p><em>Este informe es generado automaticamente por ICN. El sistema asiste, no reemplaza el criterio editorial humano.</em></p>
  </body></html>`);
  w.document.close(); w.print();
}

// ── UI ATOMS ────────────────────────────────────────────────────────────────
function ScorePill({ score, size }) {
  size = size || "md";
  const col = score >= 65 ? C.green : score >= 45 ? C.amber : C.red;
  const fs = size === "lg" ? 36 : size === "sm" ? 13 : 20;
  return <span style={{ fontFamily:"monospace", fontSize:fs, fontWeight:700, color:col }}>{score}</span>;
}

function Bar({ val, col, h }) {
  h = h || 4;
  col = col || (val >= 65 ? C.green : val >= 45 ? C.amber : C.red);
  return (
    <div style={{ height:h, background:C.border, borderRadius:h/2, overflow:"hidden" }}>
      <div style={{ height:"100%", width:val+"%", background:col, borderRadius:h/2, transition:"width .4s" }}/>
    </div>
  );
}

function Tag({ children, col, bg }) {
  return <span style={{ fontSize:10, fontFamily:"monospace", padding:"2px 7px", borderRadius:3, color:col||C.teal, background:bg||C.tealB, border:"1px solid "+(col||C.teal)+"44" }}>{children}</span>;
}

function Section({ title, right, children }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, borderBottom:"1px solid "+C.border, paddingBottom:8 }}>
        <div style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.18em", textTransform:"uppercase", color:C.ink3, fontWeight:600 }}>{title}</div>
        {right && <div style={{ fontSize:11, color:C.ink3 }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background:C.card, border:"1px solid "+C.border, borderRadius:8, padding:"18px 20px", ...style }}>{children}</div>;
}

// ── RADAR CHART ─────────────────────────────────────────────────────────────
function Radar({ data, size }) {
  size = size || 160;
  const cx = size/2, cy = size/2, r = size/2 - 24;
  const n = data.length;
  const pts = data.map((d, i) => {
    const a = (Math.PI * 2 * i / n) - Math.PI / 2;
    const rv = (d.val / 100) * r;
    return { x: cx + rv * Math.cos(a), y: cy + rv * Math.sin(a), lx: cx + (r + 14) * Math.cos(a), ly: cy + (r + 14) * Math.sin(a), label: d.label };
  });
  const polygon = pts.map(p => p.x + "," + p.y).join(" ");
  const gridPts = (frac) => data.map((_, i) => {
    const a = (Math.PI * 2 * i / n) - Math.PI / 2;
    return (cx + frac * r * Math.cos(a)) + "," + (cy + frac * r * Math.sin(a));
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
      {[0.25, 0.5, 0.75, 1].map(f => <polygon key={f} points={gridPts(f)} fill="none" stroke={C.border} strokeWidth="1"/>)}
      {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos((Math.PI*2*i/n)-Math.PI/2)} y2={cy + r * Math.sin((Math.PI*2*i/n)-Math.PI/2)} stroke={C.border} strokeWidth="1"/>)}
      <polygon points={polygon} fill={C.teal} fillOpacity="0.15" stroke={C.teal} strokeWidth="1.5"/>
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={C.teal}/>)}
      {pts.map((p, i) => <text key={i} x={p.lx} y={p.ly} fill={C.ink3} fontSize="8" textAnchor="middle" dominantBaseline="middle">{p.label}</text>)}
    </svg>
  );
}

// ── COMANDO CENTRAL — tarjeta principal ────────────────────────────────────
function CommandCard({ result, onExplain }) {
  const scores = {
    periodistico: result.scores.periodistico.score,
    narrativo: result.scores.narrativo.score,
    riesgo: result.scores.riesgo.score,
    contextual: result.scores.contextual.score,
  };
  const agg = getAgg(scores);
  const sem = getSemaforo(scores);
  const S = SEMAFORO[sem];
  const alertCount = (result.problemasCriticos||[]).filter(p => p.gravedad === "alta").length;

  return (
    <div style={{ background:"linear-gradient(135deg, "+C.card+" 0%, "+C.panel+" 100%)", border:"1px solid "+S.border, borderRadius:12, padding:"24px 28px", marginBottom:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, right:0, width:200, height:200, background:S.col, opacity:0.03, borderRadius:"50%", transform:"translate(30%, -30%)" }}/>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr auto auto", gap:24, alignItems:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, lineHeight:1, color:S.col, fontFamily:"monospace", fontWeight:700 }}>{agg}</div>
          <div style={{ fontSize:10, color:C.ink3, fontFamily:"monospace", letterSpacing:"0.1em", marginTop:2 }}>SCORE ICN</div>
        </div>
        <div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:S.bg, border:"1px solid "+S.border, borderRadius:20, padding:"6px 14px", marginBottom:10 }}>
            <span style={{ color:S.col, fontSize:14 }}>{S.icon}</span>
            <span style={{ color:S.col, fontWeight:600, fontSize:14 }}>{S.lbl}</span>
          </div>
          <div style={{ fontSize:13, color:C.ink2, lineHeight:1.6, maxWidth:480 }}>{result.veredicto}</div>
          <div style={{ marginTop:8, fontSize:12, color:C.ink3 }}>
            <span style={{ color:C.amber, fontFamily:"monospace" }}>→ </span>{result.accionInmediata}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:120 }}>
          <div style={{ background:C.panel, border:"1px solid "+C.border, borderRadius:6, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:700, color:alertCount > 0 ? C.red : C.green }}>{alertCount}</div>
            <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, textTransform:"uppercase", letterSpacing:"0.1em" }}>Alertas criticas</div>
          </div>
          <div style={{ background:C.panel, border:"1px solid "+C.border, borderRadius:6, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:700, color:C.teal }}>{result.tiempoCorreccion}<span style={{ fontSize:12 }}> min</span></div>
            <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, textTransform:"uppercase", letterSpacing:"0.1em" }}>Para publicar</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <button onClick={onExplain} style={{ background:C.tealB, color:C.teal, border:"1px solid "+C.tealD, borderRadius:6, padding:"8px 16px", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" }}>Ver explicacion</button>
          <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, textAlign:"center" }}>ICN v4.0</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20, paddingTop:16, borderTop:"1px solid "+C.border }}>
        {[
          ["Periodistico", scores.periodistico, "40%"],
          ["Narrativo", scores.narrativo, "25%"],
          ["Contextual", scores.contextual, "25%"],
          ["Riesgo inv.", 100 - scores.riesgo, "10%"],
        ].map(([lbl, val, peso]) => (
          <div key={lbl}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:C.ink2 }}>{lbl}</span>
              <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color: val >= 65 ? C.green : val >= 45 ? C.amber : C.red }}>{val}</span>
            </div>
            <Bar val={val}/>
            <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, marginTop:2 }}>peso {peso}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VISTA EJECUTIVA ─────────────────────────────────────────────────────────
function VistaEjecutiva({ result }) {
  const scores = { periodistico: result.scores.periodistico.score, narrativo: result.scores.narrativo.score, riesgo: result.scores.riesgo.score, contextual: result.scores.contextual.score };
  const radarData = [
    { label:"Period.", val: scores.periodistico },
    { label:"Narrat.", val: scores.narrativo },
    { label:"Context.", val: scores.contextual },
    { label:"Bajo riesgo", val: 100 - scores.riesgo },
  ];
  const problemas = (result.problemasCriticos||[]).slice(0,3);
  const fortalezas = (result.fortalezas||[]).slice(0,3);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:20 }}>
      <div>
        <Radar data={radarData} size={200}/>
        <div style={{ marginTop:10, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.ink3, fontFamily:"monospace" }}>Tiempo estimado</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.teal, fontFamily:"monospace" }}>{result.tiempoCorreccion} min</div>
          <div style={{ fontSize:10, color:C.ink3, lineHeight:1.5, marginTop:4 }}>{result.razonTiempo}</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card>
          <Section title="3 problemas principales">
            {problemas.length === 0 && <div style={{ fontSize:12, color:C.green }}>Sin problemas criticos detectados</div>}
            {problemas.map((p,i) => (
              <div key={i} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", gap:6, alignItems:"flex-start", marginBottom:3 }}>
                  <Tag col={p.gravedad==="alta"?C.red:p.gravedad==="media"?C.amber:C.ink3} bg={p.gravedad==="alta"?C.redB:p.gravedad==="media"?C.amberB:"transparent"}>{p.gravedad}</Tag>
                  <div style={{ fontSize:12, color:C.ink, lineHeight:1.5 }}>{p.problema}</div>
                </div>
                <div style={{ fontSize:11, color:C.ink3, marginLeft:0 }}>→ {p.solucion}</div>
              </div>
            ))}
          </Section>
        </Card>
        <Card>
          <Section title="3 fortalezas">
            {fortalezas.length === 0 && <div style={{ fontSize:12, color:C.ink3 }}>Sin fortalezas destacadas</div>}
            {fortalezas.map((f,i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:10 }}>
                <span style={{ color:C.green, fontSize:14, flexShrink:0 }}>✓</span>
                <div style={{ fontSize:12, color:C.ink2, lineHeight:1.5 }}>{f}</div>
              </div>
            ))}
          </Section>
        </Card>
      </div>
    </div>
  );
}

// ── VISTA EXPERTA ─────────────────────────────────────────────────────────────
function VistaExperta({ result }) {
  const scores = result.scores;
  const allSubs = [
    { cat:"Calidad Periodistica (40%)", col:C.blue, items: Object.entries(scores.periodistico.sub||{}).map(([k,v])=>({ k: k.replace(/_/g," "), v })), just: scores.periodistico.justificacion, rec: scores.periodistico.recomendacion, ev: scores.periodistico.evidencia },
    { cat:"Calidad Narrativa (25%)", col:C.purple, items: Object.entries(scores.narrativo.sub||{}).map(([k,v])=>({ k: k.replace(/_/g," "), v })), just: scores.narrativo.justificacion, rec: scores.narrativo.recomendacion, ev: scores.narrativo.evidencia },
    { cat:"Riesgo Editorial (25%)", col:C.red, items: Object.entries(scores.riesgo.sub||{}).map(([k,v])=>({ k: k.replace(/_/g," "), v })), just: scores.riesgo.justificacion, rec: scores.riesgo.recomendacion, ev: scores.riesgo.evidencia, invertido:true },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
      {allSubs.map(dim => (
        <Card key={dim.cat}>
          <div style={{ fontFamily:"monospace", fontSize:9, color:dim.col, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12, fontWeight:600 }}>{dim.cat}</div>
          {dim.items.map(({ k, v }) => (
            <div key={k} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:C.ink2, textTransform:"capitalize" }}>{k}</span>
                <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color: dim.invertido ? (v <= 35 ? C.green : v <= 65 ? C.amber : C.red) : (v >= 65 ? C.green : v >= 45 ? C.amber : C.red) }}>{v}</span>
              </div>
              <Bar val={dim.invertido ? 100-v : v} col={dim.invertido ? (v<=35?C.green:v<=65?C.amber:C.red) : undefined}/>
            </div>
          ))}
          <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid "+C.border }}>
            <div style={{ fontSize:11, color:C.ink2, lineHeight:1.6, marginBottom:6 }}>{dim.just}</div>
            {dim.ev && <div style={{ fontSize:10, color:C.ink3, background:C.panel, padding:"6px 8px", borderRadius:4, borderLeft:"2px solid "+dim.col, lineHeight:1.5, marginBottom:6 }}>"{dim.ev}"</div>}
            {dim.rec && <div style={{ fontSize:11, color:dim.col }}>→ {dim.rec}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── TEXTO ANOTADO ─────────────────────────────────────────────────────────────
function TextoAnotado({ result }) {
  const [activePar, setActivePar] = useState(null);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, border:"1px solid "+C.border, borderRadius:8, overflow:"hidden" }}>
      <div style={{ borderRight:"1px solid "+C.border }}>
        <div style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.16em", textTransform:"uppercase", color:C.ink3, padding:"10px 14px", borderBottom:"1px solid "+C.border, background:C.panel, fontWeight:600 }}>Texto anotado</div>
        <div style={{ padding:12, maxHeight:560, overflowY:"auto" }}>
          {result.parrafos.map((par, i) => {
            const sev = par.sev || "ok";
            const bc = sev==="alert" ? C.red : sev==="warn" ? C.amber : C.border;
            const bg = activePar===i ? C.tealB : sev==="alert" ? C.redB : sev==="warn" ? C.amberB : "transparent";
            const nprob = (par.problemas||[]).length;
            return (
              <div key={i} onClick={() => setActivePar(activePar===i?null:i)}
                style={{ padding:"8px 10px 8px 16px", marginBottom:5, border:"1px solid "+(activePar===i?C.teal:bc), borderRadius:5, cursor:"pointer", position:"relative", background:bg }}>
                <div style={{ position:"absolute", left:5, top:14, width:5, height:5, borderRadius:"50%", background:bc }}/>
                <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, marginBottom:2 }}>p.{i+1} {nprob > 0 && <span style={{ color:bc }}>· {nprob} obs.</span>}</div>
                <div style={{ fontSize:11, color:C.ink2, lineHeight:1.5 }}>{par.txt.length > 220 ? par.txt.slice(0,220)+"…" : par.txt}</div>
                {(par.problemas||[]).length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:5 }}>
                    {(par.problemas||[]).slice(0,3).map((pr,j) => <Tag key={j} col={pr.impacto==="alto"?C.red:pr.impacto==="medio"?C.amber:C.ink3} bg={pr.impacto==="alto"?C.redB:pr.impacto==="medio"?C.amberB:"transparent"}>{pr.tipo}</Tag>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.16em", textTransform:"uppercase", color:C.ink3, padding:"10px 14px", borderBottom:"1px solid "+C.border, background:C.panel, display:"flex", justifyContent:"space-between", alignItems:"center", fontWeight:600 }}>
          {activePar !== null ? "Parrafo "+(activePar+1)+" — detalle" : "Selecciona un parrafo"}
          {activePar !== null && <button onClick={() => setActivePar(null)} style={{ fontFamily:"monospace", fontSize:9, color:C.teal, background:"transparent", border:"1px solid "+C.tealD, borderRadius:4, padding:"2px 7px", cursor:"pointer" }}>← Todos</button>}
        </div>
        <div style={{ padding:12, maxHeight:560, overflowY:"auto" }}>
          {activePar === null && (
            <div style={{ padding:"40px 20px", textAlign:"center", color:C.ink3, fontSize:12 }}>
              Hace clic en un parrafo para ver el analisis detallado con evidencia textual y sugerencias de mejora.
            </div>
          )}
          {activePar !== null && (() => {
            const par = result.parrafos[activePar];
            if (!par) return null;
            return (
              <div>
                <div style={{ background:C.panel, border:"1px solid "+C.border, borderRadius:6, padding:"10px 12px", marginBottom:12, fontSize:11, color:C.ink2, lineHeight:1.6 }}>{par.txt}</div>
                {(par.fortalezas||[]).length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontFamily:"monospace", fontSize:9, color:C.green, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6, fontWeight:600 }}>Fortalezas</div>
                    {par.fortalezas.map((f,i) => <div key={i} style={{ fontSize:11, color:C.ink2, marginBottom:4, paddingLeft:10, borderLeft:"2px solid "+C.green }}>✓ {f}</div>)}
                  </div>
                )}
                {(par.problemas||[]).length > 0 && (
                  <div>
                    <div style={{ fontFamily:"monospace", fontSize:9, color:C.red, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8, fontWeight:600 }}>Observaciones</div>
                    {par.problemas.map((pr,i) => (
                      <div key={i} style={{ background:C.card, border:"1px solid "+C.border, borderLeft:"3px solid "+(pr.impacto==="alto"?C.red:pr.impacto==="medio"?C.amber:C.ink3), borderRadius:4, padding:"9px 11px", marginBottom:8 }}>
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                          <Tag col={pr.impacto==="alto"?C.red:pr.impacto==="medio"?C.amber:C.ink3} bg={pr.impacto==="alto"?C.redB:pr.impacto==="medio"?C.amberB:"transparent"}>{pr.impacto}</Tag>
                          <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:600, color:C.ink }}>{pr.tipo}</span>
                        </div>
                        {pr.texto_evidencia && <div style={{ fontSize:10, color:C.ink3, background:C.panel, padding:"5px 8px", borderRadius:3, marginBottom:5, lineHeight:1.5 }}>"{pr.texto_evidencia}"</div>}
                        <div style={{ fontSize:11, color:C.ink2 }}>→ {pr.sugerencia}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── CONTEXTO FALTANTE ─────────────────────────────────────────────────────────
function ContextoFaltante({ result }) {
  const faltantes = result.scores.contextual?.faltantes || [];
  const altos = faltantes.filter(f => f.impacto === "alto");
  const medios = faltantes.filter(f => f.impacto === "medio");
  const bajos = faltantes.filter(f => f.impacto === "bajo");

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
        {[["Impacto alto", altos, C.red, C.redB],["Impacto medio", medios, C.amber, C.amberB],["A considerar", bajos, C.ink3, C.panel]].map(([lbl, list, col, bg]) => (
          <div key={lbl} style={{ background:bg, border:"1px solid "+col+"44", borderRadius:6, padding:"12px 14px" }}>
            <div style={{ fontFamily:"monospace", fontSize:9, color:col, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10, fontWeight:600 }}>{lbl} ({list.length})</div>
            {list.length === 0 && <div style={{ fontSize:11, color:C.ink3 }}>Sin elementos</div>}
            {list.map((f,i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:600, color:C.ink, marginBottom:2 }}>{f.dimension}</div>
                <div style={{ fontSize:11, color:C.ink2, lineHeight:1.5 }}>{f.descripcion}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, padding:"8px 12px", background:C.panel, borderRadius:4, border:"1px solid "+C.border }}>
        Score contextual: {result.scores.contextual.score}/100 — La cobertura contextual pondera antecedentes historicos, marco institucional, impacto economico, perspectiva ciudadana, alcance federal e internacional, consecuencias futuras, aspectos legales y transparencia documental.
      </div>
    </div>
  );
}

// ── FUENTES ────────────────────────────────────────────────────────────────────
function FuentesPanel({ result }) {
  const f = result.fuentes || {};
  const tipos = f.tipos_detectados || [];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
      <div>
        <Section title="Tipos de fuentes detectadas">
          {tipos.length === 0 && <div style={{ fontSize:12, color:C.ink3 }}>Sin datos de fuentes</div>}
          {tipos.map((t,i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, color:C.ink, textTransform:"capitalize" }}>{t.tipo}</span>
                <span style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:C.teal }}>{t.cantidad}</span>
              </div>
              <Bar val={Math.min(100, t.cantidad * 10)} col={C.teal} h={3}/>
              {t.ejemplos && t.ejemplos.length > 0 && <div style={{ fontSize:10, color:C.ink3, marginTop:2 }}>{t.ejemplos.slice(0,2).join(", ")}</div>}
            </div>
          ))}
        </Section>
      </div>
      <div>
        <Section title="Metricas de diversidad">
          {[
            ["Diversidad", f.diversidad||0, C.teal],
            ["Independencia", f.independencia||0, C.blue],
            ["Concentracion oficial (inv.)", 100-(f.concentracion_oficial||0), C.amber],
          ].map(([lbl, val, col]) => (
            <div key={lbl} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:C.ink2 }}>{lbl}</span>
                <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:col }}>{val}</span>
              </div>
              <Bar val={val} col={col} h={5}/>
            </div>
          ))}
          <div style={{ marginTop:12, padding:"10px", background:C.panel, borderRadius:4, border:"1px solid "+C.border }}>
            <div style={{ fontSize:10, color:C.ink3, lineHeight:1.6 }}>
              La taxonomia de fuentes distingue: oficial, judicial, legislativa, academica, tecnica, empresarial, sociedad civil, testimonial, documental, reservada verificada y anonima sin corroborar. La concentracion de fuentes oficiales por encima del 60% se considera un indicador de riesgo de captura editorial.
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── EDITOR IA ─────────────────────────────────────────────────────────────────
function EditorIA({ result }) {
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState(null);
  const [loading, setLoading] = useState(false);
  const PREGUNTAS = [
    "Como mejoro esta nota?",
    "Por que bajo el score?",
    "Que contexto falta?",
    "Que fuente deberia incorporar?",
    "Como subo 10 puntos?",
    "Cuales son los problemas mas urgentes?",
  ];

  const ask = useCallback(async (q) => {
    setLoading(true); setRespuesta(null);
    const sys = "Sos un editor periodistico experto. Responde en base EXCLUSIVAMENTE al siguiente analisis de la nota. No inventes informacion. Devuelve SOLO JSON: {\"respuesta\": string, \"pasos\": [string]}";
    const ctx = "ANALISIS:\nScore periodistico: "+result.scores.periodistico.score+"\nScore narrativo: "+result.scores.narrativo.score+"\nRiesgo: "+result.scores.riesgo.score+"\nContextual: "+result.scores.contextual.score+"\nVeredicto: "+result.veredicto+"\nProblemas: "+JSON.stringify(result.problemasCriticos||[])+"\nContexto faltante: "+JSON.stringify(result.scores.contextual.faltantes||[])+"\nFuentes: "+JSON.stringify(result.fuentes||{})+"\n\nPREGUNTA: "+q;
    try {
      const r = await callLLM(sys, ctx, 600);
      setRespuesta(r);
    } catch { setRespuesta({ respuesta:"Error al consultar el modelo.", pasos:[] }); }
    setLoading(false);
  }, [result]);

  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
        {PREGUNTAS.map(q => <button key={q} onClick={() => { setPregunta(q); ask(q); }} style={{ fontSize:11, padding:"5px 12px", background:C.card, border:"1px solid "+C.border, borderRadius:20, color:C.ink2, cursor:"pointer" }}>{q}</button>)}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input value={pregunta} onChange={e => setPregunta(e.target.value)} onKeyDown={e => e.key==="Enter" && ask(pregunta)} placeholder="Hacé una pregunta sobre esta nota..." style={{ flex:1, background:C.card, border:"1px solid "+C.border, borderRadius:6, padding:"9px 12px", fontSize:12, color:C.ink, outline:"none" }}/>
        <button onClick={() => ask(pregunta)} disabled={loading||!pregunta.trim()} style={{ background:C.teal, color:C.bg, border:"none", borderRadius:6, padding:"9px 18px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
          {loading ? "..." : "Consultar"}
        </button>
      </div>
      {loading && <div style={{ padding:"24px", textAlign:"center", color:C.ink3, fontSize:12 }}>Consultando al editor IA...</div>}
      {respuesta && (
        <Card>
          <div style={{ fontSize:13, color:C.ink, lineHeight:1.7, marginBottom:12 }}>{respuesta.respuesta}</div>
          {(respuesta.pasos||[]).length > 0 && (
            <div style={{ borderTop:"1px solid "+C.border, paddingTop:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.teal, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8, fontWeight:600 }}>Pasos concretos</div>
              {respuesta.pasos.map((p,i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:C.teal, flexShrink:0 }}>{i+1}.</span>
                  <div style={{ fontSize:12, color:C.ink2, lineHeight:1.5 }}>{p}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── HISTORIAL ─────────────────────────────────────────────────────────────────
function Historial({ onLoad }) {
  const [history, setHistory] = useState([]);
  useEffect(() => { loadHistory().then(setHistory); }, []);
  const handleLoad = async (id) => {
    const data = await loadAnalysis(id);
    if (data) onLoad(data);
  };
  if (history.length === 0) return <div style={{ padding:"32px", textAlign:"center", color:C.ink3, fontSize:13 }}>Sin analisis guardados. Los analisis se guardan automaticamente.</div>;
  return (
    <div>
      {history.map(h => {
        const agg = getAgg({ periodistico: h.scores.periodistico, narrativo: h.scores.narrativo, riesgo: h.scores.riesgo, contextual: h.scores.contextual });
        return (
          <div key={h.id} onClick={() => handleLoad(h.id)} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:6, padding:"12px 14px", marginBottom:8, cursor:"pointer", display:"grid", gridTemplateColumns:"auto 1fr auto", gap:14, alignItems:"center" }}>
            <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:700, color:agg>=65?C.green:agg>=45?C.amber:C.red }}>{agg}</div>
            <div>
              <div style={{ fontSize:12, color:C.ink, marginBottom:2 }}>{h.texto_preview}...</div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3 }}>{new Date(h.timestamp).toLocaleString("es-AR")} · {h.tipo}</div>
            </div>
            <div style={{ fontSize:11, color:C.teal }}>Cargar →</div>
          </div>
        );
      })}
    </div>
  );
}

// ── COMPARATIVO ────────────────────────────────────────────────────────────────
function Comparativo() {
  const [slots, setSlots] = useState(Array(3).fill(null).map((_,i) => ({ id:i, medio:"", tipo:"noticia", texto:"", result:null, loading:false })));
  const [analizando, setAnalizando] = useState(false);
  const updSlot = (i, p) => setSlots(s => s.map((sl,j) => j===i ? {...sl,...p} : sl));

  const runComp = async () => {
    setAnalizando(true);
    const activos = slots.filter(s => s.texto.trim());
    for (const s of activos) {
      updSlot(s.id, { loading:true });
      try {
        const r = await analyzeFullLLM(s.texto, s.tipo, () => {});
        updSlot(s.id, { loading:false, result:r });
      } catch { updSlot(s.id, { loading:false }); }
    }
    setAnalizando(false);
  };

  const withResults = slots.filter(s => s.result);

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        {slots.map((sl, i) => (
          <div key={sl.id} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:8, padding:14 }}>
            <input value={sl.medio} onChange={e => updSlot(i,"medio",e.target.value)} placeholder={"Medio "+(i+1)} style={{ width:"100%", background:C.panel, border:"1px solid "+C.border, color:C.ink, fontSize:12, padding:"6px 9px", borderRadius:4, outline:"none", marginBottom:8 }}/>
            <select value={sl.tipo} onChange={e => updSlot(i,"tipo",e.target.value)} style={{ width:"100%", background:C.panel, border:"1px solid "+C.border, color:C.ink, fontSize:12, padding:"6px 9px", borderRadius:4, outline:"none", marginBottom:8 }}>
              {["noticia","cronica","analisis","columna","editorial","entrevista"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <textarea value={sl.texto} onChange={e => updSlot(i,"texto",e.target.value)} placeholder="Pega el texto..." style={{ width:"100%", height:120, background:C.panel, border:"1px solid "+C.border, color:C.ink, fontSize:11, padding:"8px", borderRadius:4, outline:"none", resize:"vertical" }}/>
            {sl.loading && <div style={{ fontSize:11, color:C.teal, marginTop:4, fontFamily:"monospace" }}>Analizando...</div>}
            {sl.result && <div style={{ fontSize:11, color:C.green, marginTop:4 }}>✓ Analisis listo</div>}
          </div>
        ))}
      </div>
      <button onClick={runComp} disabled={analizando} style={{ background:C.purple, color:C.bg, border:"none", borderRadius:6, padding:"9px 20px", fontSize:12, fontWeight:700, cursor:"pointer", marginBottom:20, fontFamily:"monospace" }}>
        {analizando ? "Analizando..." : "Comparar medios →"}
      </button>

      {withResults.length >= 2 && (
        <div>
          <Section title="Comparativa de scores">
            <div style={{ display:"grid", gridTemplateColumns:"repeat("+withResults.length+",1fr)", gap:12, marginBottom:20 }}>
              {withResults.map((sl, i) => {
                const sc = { periodistico: sl.result.scores.periodistico.score, narrativo: sl.result.scores.narrativo.score, riesgo: sl.result.scores.riesgo.score, contextual: sl.result.scores.contextual.score };
                const agg = getAgg(sc);
                const sem = getSemaforo(sc);
                const S = SEMAFORO[sem];
                return (
                  <Card key={i}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.ink, marginBottom:8 }}>{sl.medio || ("Medio "+(i+1))}</div>
                    <div style={{ fontFamily:"monospace", fontSize:32, fontWeight:700, color:S.col, marginBottom:4 }}>{agg}</div>
                    <div style={{ fontSize:11, color:S.col, marginBottom:12 }}>{S.icon} {S.lbl}</div>
                    {[["Periodistico", sc.periodistico],["Narrativo", sc.narrativo],["Contextual", sc.contextual],["Riesgo", sc.riesgo]].map(([lbl, val]) => (
                      <div key={lbl} style={{ marginBottom:7 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ fontSize:10, color:C.ink3 }}>{lbl}</span>
                          <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:lbl==="Riesgo"?(val<=35?C.green:val<=65?C.amber:C.red):(val>=65?C.green:val>=45?C.amber:C.red) }}>{val}</span>
                        </div>
                        <Bar val={lbl==="Riesgo"?100-val:val} col={lbl==="Riesgo"?(val<=35?C.green:val<=65?C.amber:C.red):undefined} h={3}/>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          </Section>

          <Section title="Contexto faltante comparado">
            <div style={{ display:"grid", gridTemplateColumns:"repeat("+withResults.length+",1fr)", gap:12 }}>
              {withResults.map((sl, i) => (
                <div key={i} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:6, padding:12 }}>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.12em" }}>{sl.medio || ("Medio "+(i+1))}</div>
                  {(sl.result.scores.contextual.faltantes||[]).slice(0,4).map((f,j) => (
                    <div key={j} style={{ fontSize:10, color:C.ink2, marginBottom:5, paddingLeft:8, borderLeft:"2px solid "+(f.impacto==="alto"?C.red:f.impacto==="medio"?C.amber:C.ink3) }}>{f.dimension}: {f.descripcion}</div>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

// ── METODOLOGIA ────────────────────────────────────────────────────────────────
function Metodologia() {
  const secciones = [
    { titulo:"Que mide el ICN", contenido:"El Indice de Calidad Noticiosa evalua piezas periodisticas en tres dimensiones independientes: calidad periodistica, calidad narrativa y riesgo editorial. El score agregado pondera estas dimensiones segun su relevancia metodologica para el periodismo factual argentino." },
    { titulo:"Formula del score agregado", contenido:"Score ICN = 40% calidad periodistica + 25% calidad narrativa + 25% cobertura contextual + 10% riesgo editorial invertido. La ponderacion refleja la importancia relativa de cada dimension en la evaluacion editorial profesional." },
    { titulo:"Calidad periodistica (40%)", contenido:"Mide verificabilidad de afirmaciones, diversidad e independencia de fuentes, presencia de documentacion, completitud de atribucion y precision factual. Es la dimension mas pesada porque constituye el nucleo del periodismo factual." },
    { titulo:"Calidad narrativa (25%)", contenido:"Evalua estructura del lead, coherencia titular-cuerpo, presencia de contexto, claridad expositiva y jerarquia de informacion. Critica en generos noticiosos; con criterios diferenciados para columnas y editoriales." },
    { titulo:"Cobertura contextual (25%)", contenido:"Identifica dimensiones ausentes: antecedentes historicos, marco legal o institucional, datos economicos, perspectiva ciudadana, actores afectados, alcance federal e internacional, consecuencias futuras y transparencia documental." },
    { titulo:"Riesgo editorial (10% invertido)", contenido:"Detecta carga opinativa no atribuida, polarizacion linguistica (endogrupo/exogrupo segun Van Dijk), clickbait, dependencia excesiva de fuentes oficiales y sensacionalismo. Se incorpora como factor de correccion negativo." },
    { titulo:"Analisis por parrafo con LLM", contenido:"Cada parrafo es evaluado por el modelo de lenguaje con instrucciones especificas segun el genero. El modelo identifica evidencia textual concreta, tipo de problema y sugerencia de mejora. Las regex actuan como senales auxiliares de deteccion, no como evaluadores principales." },
    { titulo:"Taxonomia de fuentes", contenido:"Se distinguen 11 tipos: oficial, judicial, legislativa, academica, tecnica, empresarial, sociedad civil, testimonial, documental, reservada verificada y anonima sin corroborar. La concentracion de fuentes oficiales por encima del 60% activa alerta de posible captura editorial. Art. 43 CN: el secreto de fuentes es derecho constitucional; las fuentes reservadas con corroboración no penalizan el score." },
    { titulo:"Limites del sistema", contenido:"El ICN es una herramienta de asistencia editorial, no un oraculo. El analisis automatico puede cometer errores, especialmente en textos ambiguos, generos hibridos o contextos especializados. Ningun puntaje automatico reemplaza el criterio editorial humano. Los resultados deben interpretarse como insumos para la decision, no como veredictos definitivos." },
    { titulo:"Diferencia entre indicio y conclusion", contenido:"El sistema detecta indicios: presencia de vocabulario evaluativo, ausencia de fuente en un parrafo, condicional sin atribucion. Estos son senales que el editor debe verificar e interpretar en contexto. La calificacion final es responsabilidad del equipo editorial." },
  ];
  return (
    <div>
      <div style={{ background:C.redB, border:"1px solid rgba(248,81,73,0.3)", borderRadius:6, padding:"12px 16px", marginBottom:20, fontSize:12, color:C.ink2, lineHeight:1.6 }}>
        <strong style={{ color:C.red }}>Advertencia metodologica: </strong>Este sistema asiste, no reemplaza el criterio editorial humano. Los puntajes son indicios automaticos que deben ser interpretados por profesionales periodisticos con conocimiento del contexto, el medio y el genero especifico de cada pieza.
      </div>
      {secciones.map(s => (
        <Card key={s.titulo} style={{ marginBottom:10 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.teal, fontWeight:600, marginBottom:8 }}>{s.titulo}</div>
          <div style={{ fontSize:12, color:C.ink2, lineHeight:1.7 }}>{s.contenido}</div>
        </Card>
      ))}
    </div>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("analizador");
  const [tipo, setTipo] = useState("noticia");
  const [texto, setTexto] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ msg:"", pct:0 });
  const [result, setResult] = useState(null);
  const [innerTab, setInnerTab] = useState("ejecutivo");
  const [showExplain, setShowExplain] = useState(false);
  const wc = texto.trim() ? texto.trim().split(/\s+/).length : 0;

  const runAnalysis = async () => {
    if (!texto.trim()) { alert("Pega el texto de la nota."); return; }
    setAnalyzing(true); setResult(null); setShowExplain(false);
    setProgress({ msg:"Iniciando...", pct:0 });
    try {
      const r = await analyzeFullLLM(texto, tipo, (msg, pct) => setProgress({ msg, pct }));
      if (!r || !r.scores) throw new Error("El analisis no devolvio resultados validos.");
      setResult(r);
      setInnerTab("ejecutivo");
      try { await saveAnalysis(r); } catch {}
    } catch (e) {
      console.error(e);
      alert("Error en el analisis: " + (e.message || "Error desconocido. Revisa la consola."));
    }
    setAnalyzing(false);
  };

  const tabSt = (t) => ({
    fontFamily:"monospace", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase",
    color:tab===t?C.teal:C.ink3, padding:"8px 18px", cursor:"pointer", border:"none",
    borderBottom:tab===t?"2px solid "+C.teal:"2px solid transparent", marginBottom:-1,
    background:"none", fontWeight:tab===t?600:400,
  });

  const itabSt = (t) => ({
    fontFamily:"monospace", fontSize:10, padding:"5px 14px", cursor:"pointer",
    background:innerTab===t?C.tealB:"transparent", color:innerTab===t?C.teal:C.ink3,
    border:"1px solid "+(innerTab===t?C.tealD:C.border), borderRadius:4,
  });

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.ink, fontFamily:"system-ui,-apple-system,sans-serif", fontSize:13, lineHeight:1.5 }}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}"}</style>

      {/* TOP BAR */}
      <div style={{ background:C.surface, borderBottom:"1px solid "+C.border, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50, height:48 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontFamily:"monospace", fontWeight:700, fontSize:12, color:C.teal, letterSpacing:"0.1em" }}>ICN</div>
          <div style={{ width:1, height:20, background:C.border }}/>
          <div style={{ fontSize:12, color:C.ink2 }}>Editorial Command Center</div>
          <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, background:C.panel, padding:"2px 6px", borderRadius:3 }}>v4.0</div>
        </div>
        <div style={{ display:"flex", gap:0, borderBottom:"1px solid transparent" }}>
          {[["analizador","Analizador"],["comparativo","Comparativo"],["historial","Historial"],["metodologia","Metodologia"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} style={tabSt(t)}>{l}</button>
          ))}
        </div>
        <div style={{ fontFamily:"monospace", fontSize:9, color:C.teal, background:C.tealB, border:"1px solid "+C.tealD, padding:"3px 8px", borderRadius:3 }}>ONLINE</div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 24px 60px" }}>

        {/* ANALIZADOR */}
        {tab === "analizador" && (
          <div>
            {!result && !analyzing && (
              <div>
                <div style={{ marginBottom:24 }}>
                  <h1 style={{ fontSize:28, fontWeight:600, letterSpacing:"-0.02em", marginBottom:6, color:C.ink }}>Editorial Command Center</h1>
                  <div style={{ fontSize:14, color:C.ink3 }}>Analisis periodistico con IA — calidad, narrativa, riesgo editorial y contexto faltante</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:16 }}>
                  <Card>
                    <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
                      <div style={{ flex:1 }}>
                        <label style={{ fontFamily:"monospace", fontSize:9, color:C.ink3, letterSpacing:"0.12em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Tipo de pieza</label>
                        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ background:C.panel, border:"1px solid "+C.border, color:C.ink, fontSize:12, padding:"7px 10px", borderRadius:4, outline:"none", width:"100%" }}>
                          {["noticia","cronica","analisis","columna","entrevista","editorial"].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ position:"relative" }}>
                      <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pega el texto completo de la nota aqui. El analisis incluye evaluacion semantica parrafo por parrafo con IA, tres scores independientes, contexto faltante y explicacion de cada puntaje." style={{ width:"100%", height:220, resize:"vertical", background:C.panel, border:"1px solid "+C.border, color:C.ink, fontFamily:"system-ui,sans-serif", fontSize:12, lineHeight:1.75, padding:"12px 14px", outline:"none", borderRadius:4 }}/>
                      <span style={{ position:"absolute", bottom:8, right:10, fontFamily:"monospace", fontSize:9, color:C.ink3 }}>{wc} palabras</span>
                    </div>
                    <button onClick={runAnalysis} style={{ width:"100%", background:C.teal, color:C.bg, border:"none", borderRadius:4, padding:"11px", fontSize:13, fontWeight:700, cursor:"pointer", marginTop:10, fontFamily:"monospace", letterSpacing:"0.06em" }}>
                      Analizar nota →
                    </button>
                  </Card>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {[["40%","Calidad periodistica","Fuentes, verificacion, documentacion, atribucion"],["25%","Calidad narrativa","Lead, estructura, coherencia titular, claridad"],["25%","Cobertura contextual","Antecedentes, marco legal, actores, consecuencias"],["10%","Riesgo editorial inv.","Opinion no atribuida, polarizacion, clickbait"]].map(([peso,titulo,desc]) => (
                      <Card key={titulo} style={{ padding:"12px 14px" }}>
                        <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                          <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:C.teal, minWidth:34 }}>{peso}</div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500, color:C.ink, marginBottom:2 }}>{titulo}</div>
                            <div style={{ fontSize:11, color:C.ink3 }}>{desc}</div>
                          </div>
                        </div>
                      </Card>
                    ))}
                    <div style={{ fontSize:10, color:C.ink3, padding:"8px 12px", background:C.panel, borderRadius:4, border:"1px solid "+C.border, lineHeight:1.6 }}>
                      El analisis LLM por parrafo toma ~45 segundos. Usa el motor semantico de Claude, no solo regex.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {analyzing && (
              <div style={{ padding:"80px 0", textAlign:"center" }}>
                <div style={{ width:40, height:40, border:"3px solid "+C.border, borderTopColor:C.teal, borderRadius:"50%", margin:"0 auto 20px", animation:"spin .8s linear infinite" }}/>
                <div style={{ fontSize:14, color:C.ink, marginBottom:8, fontWeight:500 }}>{progress.msg || "Iniciando analisis..."}</div>
                <div style={{ width:300, margin:"0 auto 8px" }}>
                  <Bar val={progress.pct} col={C.teal} h={4}/>
                </div>
                <div style={{ fontFamily:"monospace", fontSize:11, color:C.ink3 }}>{progress.pct}%</div>
              </div>
            )}

            {result && !analyzing && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                  <div>
                    <h2 style={{ fontSize:18, fontWeight:500, color:C.ink, marginBottom:2 }}>Resultado del analisis</h2>
                    <div style={{ fontSize:11, color:C.ink3 }}>{result.tipo} · {new Date(result.timestamp).toLocaleString("es-AR")} · {result.texto.trim().split(/\s+/).length} palabras</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => exportPrint(result)} style={{ background:"transparent", color:C.ink2, border:"1px solid "+C.border, borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}>Imprimir PDF</button>
                    <button onClick={() => exportJSON(result)} style={{ background:"transparent", color:C.ink2, border:"1px solid "+C.border, borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}>JSON</button>
                    <button onClick={() => exportCSV(result)} style={{ background:"transparent", color:C.ink2, border:"1px solid "+C.border, borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}>CSV</button>
                    <button onClick={() => { setResult(null); setTexto(""); }} style={{ background:C.tealB, color:C.teal, border:"1px solid "+C.tealD, borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}>Nueva nota</button>
                  </div>
                </div>

                <CommandCard result={result} onExplain={() => setShowExplain(!showExplain)}/>

                <div style={{ display:"flex", gap:4, marginBottom:16 }}>
                  {[["ejecutivo","Vista ejecutiva"],["experto","Vista experta"],["parrafos","Texto anotado"],["contexto","Contexto faltante"],["fuentes","Fuentes"],["ia","Editor IA"]].map(([t,l]) => (
                    <button key={t} onClick={() => setInnerTab(t)} style={itabSt(t)}>{l}</button>
                  ))}
                </div>

                {innerTab === "ejecutivo" && <VistaEjecutiva result={result}/>}
                {innerTab === "experto" && <VistaExperta result={result}/>}
                {innerTab === "parrafos" && <TextoAnotado result={result}/>}
                {innerTab === "contexto" && <ContextoFaltante result={result}/>}
                {innerTab === "fuentes" && <FuentesPanel result={result}/>}
                {innerTab === "ia" && <EditorIA result={result}/>}
              </div>
            )}
          </div>
        )}

        {tab === "comparativo" && <Comparativo/>}
        {tab === "historial" && <Historial onLoad={(data) => { setResult(data); setTab("analizador"); setInnerTab("ejecutivo"); }}/>}
        {tab === "metodologia" && <Metodologia/>}
      </div>

      {/* FOOTER */}
      <div style={{ borderTop:"1px solid "+C.border, padding:"12px 24px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3 }}>Score = 40% periodistico + 25% narrativo + 25% contextual + 10% (100-riesgo) · ICN v4.0 · LLM semantico por parrafo</div>
          <div style={{ fontFamily:"monospace", fontSize:9, color:C.ink3 }}>© 2026 Florencia Marquez Bonino · Maestria en Periodismo, UdeSA</div>
        </div>
      </div>
    </div>
  );
}

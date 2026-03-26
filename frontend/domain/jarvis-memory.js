/**
 * Jarvis memoria operativa — localStorage separado de hnf-memory (Autopilot / aprobaciones).
 */

const V = '1';
const LS_BRIEFS = 'hnf_jarvis_briefs_v1';
const LS_ACTION_SUG = 'hnf_jarvis_actions_suggested_v1';
const LS_ACTION_DONE = 'hnf_jarvis_actions_taken_v1';
const LS_ALERTS_SEEN = 'hnf_jarvis_alerts_seen_v1';
const LS_BLOCKERS = 'hnf_jarvis_recurring_blockers_v1';
const LS_OUTLOOK = 'hnf_jarvis_outlook_intake_v1';
const LS_VAULT_IMPORTS = 'hnf_jarvis_historical_vault_imports_v1';
const LS_VAULT_PATTERNS = 'hnf_jarvis_historical_vault_patterns_v1';
const LS_AUTONOMIC = 'hnf_jarvis_autonomic_cycles_v1';
const LS_EVOLUTIVE = 'hnf_jarvis_evolutive_v1';
const LS_INBOUND_MEANING = 'hnf_jarvis_inbound_meaning_v1';
const LS_DECISION_LOG = 'hnf_jarvis_decision_log_v1';
const MAX_INBOUND = 48;
const MAX_DECISIONS = 60;

const readJson = (key, fb) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
};

const writeJson = (key, v) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const normCliente = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * @param {object} brief - Resultado de buildJarvisDailyBrief
 */
export function rememberJarvisBrief(brief) {
  const arr = readJson(LS_BRIEFS, []);
  const row = {
    v: V,
    at: new Date().toISOString(),
    fecha: brief?.fecha,
    estadoGeneral: brief?.estadoGeneral,
    resumenEjecutivo: brief?.resumenEjecutivo,
    prioridadesCriticas: Array.isArray(brief?.prioridadesCriticas) ? brief.prioridadesCriticas.slice(0, 12) : [],
    bloqueos: Array.isArray(brief?.bloqueos) ? brief.bloqueos.slice(0, 12) : [],
    riesgos: Array.isArray(brief?.riesgos) ? brief.riesgos.slice(0, 12) : [],
  };
  arr.push(row);
  writeJson(LS_BRIEFS, arr.slice(-80));

  const bl = readJson(LS_BLOCKERS, []);
  for (const b of row.bloqueos) {
    const t = typeof b === 'string' ? b : b?.texto || b?.mensaje || '';
    if (String(t).trim()) bl.push({ at: row.at, texto: String(t).slice(0, 200) });
  }
  writeJson(LS_BLOCKERS, bl.slice(-200));
}

/**
 * @param {object} action - Ítem de action board o similar
 * @param {string} [kind] - 'sugerida' | 'tomada'
 * @param {string} [actor]
 */
export function rememberJarvisAction(action, kind = 'sugerida', actor) {
  const row = {
    v: V,
    at: new Date().toISOString(),
    id: action?.id,
    titulo: action?.titulo,
    modulo: action?.modulo,
    bucket: action?.bucket,
    origen: action?.origen,
    actor: actor || null,
    kind,
  };
  if (kind === 'tomada') {
    const arr = readJson(LS_ACTION_DONE, []);
    arr.push(row);
    writeJson(LS_ACTION_DONE, arr.slice(-120));
  } else {
    const arr = readJson(LS_ACTION_SUG, []);
    arr.push(row);
    writeJson(LS_ACTION_SUG, arr.slice(-120));
  }
}

/**
 * Registrar alerta ejecutiva vista (código + título).
 */
export function rememberJarvisAlertSeen(alert) {
  const arr = readJson(LS_ALERTS_SEEN, []);
  arr.push({
    v: V,
    at: new Date().toISOString(),
    code: alert?.code,
    title: alert?.title,
    severity: alert?.severity,
  });
  writeJson(LS_ALERTS_SEEN, arr.slice(-150));
}

export function getJarvisMemorySummary() {
  const briefs = readJson(LS_BRIEFS, []);
  const sug = readJson(LS_ACTION_SUG, []);
  const done = readJson(LS_ACTION_DONE, []);
  const seen = readJson(LS_ALERTS_SEEN, []);
  const blockers = readJson(LS_BLOCKERS, []);
  return {
    version: V,
    briefsGuardados: briefs.length,
    ultimoBriefAt: briefs.length ? briefs[briefs.length - 1].at : null,
    sugeridasRecientes: sug.slice(-15).reverse(),
    tomadasRecientes: done.slice(-15).reverse(),
    alertasVistasRecientes: seen.slice(-20).reverse(),
    muestrasBloqueos: blockers.slice(-25).reverse(),
  };
}

function countMapDays(entries, keyFn, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const m = new Map();
  for (const e of entries) {
    const t = new Date(e.at || e.fecha || 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    const k = keyFn(e);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/**
 * Patrones repetidos sobre historial Jarvis (sin re-ejecutar motores).
 */
export function getJarvisRecurringPatterns() {
  const briefs = readJson(LS_BRIEFS, []);
  const sug = readJson(LS_ACTION_SUG, []);
  const seen = readJson(LS_ALERTS_SEEN, []);
  const blockers = readJson(LS_BLOCKERS, []);

  const clienteHits = new Map();
  for (const b of briefs) {
    for (const p of b.prioridadesCriticas || []) {
      const t = String(typeof p === 'string' ? p : p?.texto || p?.titulo || p || '');
      const m = t.match(/cliente[:\s]+([^·|,\n]+)/i) || t.match(/\b([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ0-9 .&-]{2,40})\b/);
      const c = m ? normCliente(m[1]) : '';
      if (c && c.length > 2) clienteHits.set(c, (clienteHits.get(c) || 0) + 1);
    }
  }

  const topClientesRiesgo = [...clienteHits.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cliente, apariciones]) => ({
      cliente,
      apariciones,
      nota: 'Aparece en varios briefs recientes como prioridad o contexto.',
    }));

  const byModulo = countMapDays(sug, (e) => e.modulo || '—', 14);
  const topModulosCarga = [...byModulo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([modulo, count]) => ({ modulo, accionesSugeridas: count }));

  const docObservadoLento = seen.filter((x) => String(x.code || '').includes('DOC_OBSERVADO')).length;
  const opUrgente = seen.filter((x) => String(x.code || '').includes('OP_URGENTE')).length;

  const textoPatrones = [];
  if (topClientesRiesgo.length) {
    const top = topClientesRiesgo[0];
    textoPatrones.push(
      `Cliente recurrente en prioridades del brief (${top.cliente}: ~${top.apariciones} menciones en ventana reciente).`
    );
  }
  if (docObservadoLento >= 3) {
    textoPatrones.push('Documentos observados aparecen repetidamente en alertas vistas: revisar tiempo de respuesta Lyn/técnico.');
  }
  if (opUrgente >= 2) {
    textoPatrones.push('Oportunidades urgentes vistas varias veces: validar gestión comercial.');
  }

  const blockerFrases = countMapDays(blockers, (e) => String(e.texto || '').slice(0, 80), 21);
  const cuellosRepetidos = [...blockerFrases.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([frase, veces]) => ({ frase, veces }));

  return {
    version: V,
    topClientesRiesgo,
    topModulosCarga,
    cuellosRepetidos,
    textoPatrones,
  };
}

/**
 * @param {object} ev - tipo, cliente, owner, detalle, sourceId, etc.
 */
export function rememberOutlookIntakeEvent(ev = {}) {
  const arr = readJson(LS_OUTLOOK, []);
  const row = {
    v: V,
    ...ev,
    at: new Date().toISOString(),
    tipo: ev.tipo || 'ingesta',
  };
  if (row.detalle != null) row.detalle = String(row.detalle).slice(0, 400);
  arr.push(row);
  writeJson(LS_OUTLOOK, arr.slice(-600));
  return row;
}

/**
 * @param {object} row - folderName, summary, batchId, etc.
 */
export function rememberHistoricalVaultImport(row = {}) {
  const arr = readJson(LS_VAULT_IMPORTS, []);
  const s = row.summary && typeof row.summary === 'object' ? row.summary : null;
  arr.push({
    v: V,
    at: new Date().toISOString(),
    folderName: row.folderName || null,
    batchId: row.batchId || null,
    summary: s
      ? {
          totalFiles: s.totalFiles,
          recordsCreated: s.recordsCreated,
          duplicados: s.duplicados,
          monthsDetected: s.monthsDetected,
        }
      : null,
  });
  writeJson(LS_VAULT_IMPORTS, arr.slice(-120));
}

/**
 * @param {object} pattern - code, title, detail, client, severity
 */
export function rememberHistoricalPattern(pattern = {}) {
  const arr = readJson(LS_VAULT_PATTERNS, []);
  arr.push({
    v: V,
    at: new Date().toISOString(),
    code: pattern.code || null,
    title: pattern.title || null,
    detail: String(pattern.detail || '').slice(0, 240),
    client: pattern.client || null,
    severity: pattern.severity || null,
  });
  writeJson(LS_VAULT_PATTERNS, arr.slice(-200));
}

export function getHistoricalVaultMemorySummary() {
  const imports = readJson(LS_VAULT_IMPORTS, []);
  const pats = readJson(LS_VAULT_PATTERNS, []);
  const byMonth = new Map();
  for (const im of imports) {
    const m = im.summary?.monthsDetected;
    if (Array.isArray(m)) {
      for (const x of m) {
        if (x) byMonth.set(x, (byMonth.get(x) || 0) + 1);
      }
    }
  }
  return {
    version: V,
    importsTotales: imports.length,
    importsRecientes: imports.slice(-12).reverse(),
    patronesRecientes: pats.slice(-20).reverse(),
    mesesMencionadosEnImport: [...byMonth.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([mes, n]) => ({ mes, cargas: n })),
  };
}

/**
 * @param {object} envelope - resultado computeJarvisAutonomicEnvelope / runJarvisAutonomicCycle
 */
export function rememberAutonomicCycle(envelope = {}) {
  const arr = readJson(LS_AUTONOMIC, []);
  arr.push({
    v: V,
    at: new Date().toISOString(),
    systemHealth: envelope.systemHealth,
    riskLevel: envelope.riskLevel,
    efficiencyScore: envelope.efficiencyScore,
    opportunityScore: envelope.opportunityScore,
    findingsN: envelope.analysis?.findings?.length ?? 0,
    failuresN: Array.isArray(envelope.internalFailures) ? envelope.internalFailures.length : 0,
    tasksN: envelope.execute?.tasks?.length ?? 0,
  });
  writeJson(LS_AUTONOMIC, arr.slice(-80));
}

export function getAutonomicCycleMemorySummary() {
  const arr = readJson(LS_AUTONOMIC, []);
  return {
    version: V,
    ciclosGuardados: arr.length,
    ultimos: arr.slice(-12).reverse(),
  };
}

export {
  getControlState,
  getMode,
  getToggles,
  resetToSafeDefaults,
  setMode,
  setToggle,
} from './jarvis-control-center.js';

/**
 * @param {string} tipo
 * @param {object} [payload]
 */
export function appendMemoryEvent(tipo, payload = {}) {
  const arr = readJson(LS_EVOLUTIVE, []);
  arr.push({
    v: V,
    at: new Date().toISOString(),
    tipo: String(tipo || 'evento'),
    payload: payload && typeof payload === 'object' ? payload : { v: payload },
  });
  writeJson(LS_EVOLUTIVE, arr.slice(-200));
}

export function getEvolutiveMemoryEvents(limit = 40) {
  const arr = readJson(LS_EVOLUTIVE, []);
  return arr.slice(-limit).reverse();
}

export function detectPatternFromHistory() {
  const briefs = readJson(LS_BRIEFS, []);
  const last = briefs.slice(-5);
  if (last.length < 3) {
    return { backlogTrend: 'unknown', detail: 'Historial insuficiente de briefs para tendencia.' };
  }
  const counts = last.map((b) => (Array.isArray(b.bloqueos) ? b.bloqueos.length : 0));
  let up = true;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] < counts[i - 1]) up = false;
  }
  if (up && counts[counts.length - 1] > counts[0]) {
    return { backlogTrend: 'up', detail: 'Bloqueos en brief en tendencia alcista — subir vigilancia de presión.' };
  }
  return { backlogTrend: 'flat', detail: 'Sin escalada clara de bloqueos en últimos briefs.' };
}

export function adjustHeuristics() {
  const pattern = detectPatternFromHistory();
  return {
    pressureBias: pattern.backlogTrend === 'up' ? 0.15 : 0,
    pattern,
  };
}

/**
 * @param {object} event - interpretación unificada de ingesta (ver jarvis-unified-intake-engine)
 */
export function rememberInboundMeaning(event) {
  const arr = readJson(LS_INBOUND_MEANING, []);
  const row = {
    v: V,
    at: new Date().toISOString(),
    canal: event?.canal,
    titulo: event?.titulo,
    origen: event?.origen,
    cliente: event?.cliente,
    responsable: event?.responsable,
    urgencia: event?.urgencia,
    riesgo: event?.riesgo,
    oportunidad: event?.oportunidad,
    impactoEconomico: event?.impactoEconomico,
    resumen: event?.resumen,
    accionSugerida: event?.accionSugerida,
    vinculoSugerido: event?.vinculoSugerido,
    queEntro: event?.queEntro,
    significa: event?.significa,
    queRiesgoGenera: event?.queRiesgoGenera,
    queOportunidadAbre: event?.queOportunidadAbre,
    queAccionRecomienda: event?.queAccionRecomienda,
  };
  arr.push(row);
  writeJson(LS_INBOUND_MEANING, arr.slice(-MAX_INBOUND));
}

/**
 * @param {object} event - decisión o salida ejecutiva registrada
 */
export function rememberJarvisDecision(event) {
  const arr = readJson(LS_DECISION_LOG, []);
  arr.push({
    v: V,
    at: new Date().toISOString(),
    tipo: event?.tipo || 'decision',
    texto: event?.texto,
    payload: event?.payload && typeof event.payload === 'object' ? event.payload : {},
  });
  writeJson(LS_DECISION_LOG, arr.slice(-MAX_DECISIONS));
}

export function getRecentOperationalMemory(limit = 16) {
  const inbound = readJson(LS_INBOUND_MEANING, []);
  const decisions = readJson(LS_DECISION_LOG, []);
  const merged = [
    ...inbound.map((x) => ({ kind: 'inbound', ...x })),
    ...decisions.map((x) => ({ kind: 'decision', ...x })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return merged.slice(0, Math.max(1, limit));
}

export function getLastSignalsForGreeting() {
  const recent = readJson(LS_INBOUND_MEANING, []).slice(-3);
  if (!recent.length) return '';
  const last = recent[recent.length - 1];
  const c = last.cliente && last.cliente !== '—' ? last.cliente : '';
  const canal = last.canal || 'entrada';
  const tit = (last.titulo || last.resumen || '').slice(0, 72);
  if (!tit) return '';
  return `Última señal: ${canal}${c ? ` · ${c}` : ''} — ${tit}.`;
}

export function getInboundMeaningOnly(limit = 20) {
  const arr = readJson(LS_INBOUND_MEANING, []);
  return arr.slice(-limit).reverse();
}

export function getOutlookFollowUpMemorySummary() {
  const arr = readJson(LS_OUTLOOK, []);
  const byTipo = new Map();
  const byCliente = new Map();
  const byOwner = new Map();
  for (const e of arr) {
    const t = e.tipo || '—';
    byTipo.set(t, (byTipo.get(t) || 0) + 1);
    const c = e.cliente || '—';
    if (c !== '—') byCliente.set(c, (byCliente.get(c) || 0) + 1);
    const o = e.owner || '—';
    if (o !== '—') byOwner.set(o, (byOwner.get(o) || 0) + 1);
  }
  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, count]) => ({ key: k, count }));
  return {
    version: V,
    totalEventos: arr.length,
    topTipos: top(byTipo, 8),
    topClientes: top(byCliente, 8),
    topOwners: top(byOwner, 8),
    ultimas: arr.slice(-24).reverse(),
  };
}

/**
 * HNF Autopilot — primera capa de ejecución sobre Intelligence + Flow Control.
 * No envía correo/WhatsApp ni cierra OT: solo acciones internas seguras + cola de aprobación.
 */

import { buildTodayOperationsPanel } from './hnf-intelligence-engine.js';
import { rememberAutopilotDecision } from './hnf-memory.js';

export const HNF_AUTOPILOT_VERSION = '2026-03-22';

const LS_PENDING = 'hnf_autopilot_pending_v1';
const LS_METRICS = 'hnf_autopilot_metrics_v1';

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

let lastCycleResult = null;

/** @type {{ otIds: Set<string>, flotaIds: Set<string>, riskTags: string[], updatedAt: string|null }} */
let highlightState = {
  otIds: new Set(),
  flotaIds: new Set(),
  riskTags: [],
  updatedAt: null,
};

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48) || 'x';

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function loadPending() {
  const arr = readJson(LS_PENDING, []);
  return Array.isArray(arr) ? arr : [];
}

function savePending(arr) {
  writeJson(LS_PENDING, arr.slice(-200));
}

function loadMetrics() {
  const m = readJson(LS_METRICS, {});
  return {
    autoEjecutadas: Number(m.autoEjecutadas) || 0,
    escaladasAprobacion: Number(m.escaladasAprobacion) || 0,
    soloAviso: Number(m.soloAviso) || 0,
    ciclos: Number(m.ciclos) || 0,
  };
}

function saveMetrics(m) {
  writeJson(LS_METRICS, m);
}

export function getAutopilotHighlights() {
  return {
    otIds: [...highlightState.otIds],
    flotaIds: [...highlightState.flotaIds],
    riskTags: [...highlightState.riskTags],
    updatedAt: highlightState.updatedAt,
  };
}

export function getLastAutopilotCycle() {
  return lastCycleResult;
}

export function listPendingApprovals() {
  return loadPending().filter((p) => p.estado === 'pendiente_aprobacion');
}

/**
 * @param {ReturnType<import('./hnf-intelligence-engine.js').getDirectorOperationalBrief>} brief
 * @param {object|null} [viewData]
 */
export function buildAutopilotQueue(brief, viewData = null) {
  /** @type {object[]} */
  const q = [];
  const execQ = brief?.executionQueue || [];
  const flow = brief?.flow || {};
  const risks = flow.risks || [];
  const issues = brief?.issues || [];
  const retrasos = flow.state?.retrasos || [];

  const seenOt = new Set();
  const seenFlo = new Set();

  for (const it of execQ) {
    const oid = it.nav?.otId;
    if (oid && !seenOt.has(oid)) {
      seenOt.add(oid);
      q.push({
        id: uid('ap-auto-ot'),
        tipo: 'prioridad_visual_ot',
        origen: 'intel',
        prioridad: it.tipo === 'CRITICO' ? 1 : 2,
        accion: `Priorizar visualmente OT ${oid}`,
        motivo: it.titulo || it.codigo,
        riesgo: 'ninguno',
        requiereAprobacion: false,
        nav: { view: 'clima', otId: oid },
        payload: { otId: oid, codigo: it.codigo },
        bucket: 'auto',
      });
    }
    const fid = it.nav?.flotaId;
    if (fid && !seenFlo.has(fid)) {
      seenFlo.add(fid);
      q.push({
        id: uid('ap-auto-flo'),
        tipo: 'prioridad_visual_flota',
        origen: 'intel',
        prioridad: it.tipo === 'CRITICO' ? 1 : 3,
        accion: `Priorizar solicitud flota ${fid}`,
        motivo: it.titulo || it.codigo,
        riesgo: 'ninguno',
        requiereAprobacion: false,
        nav: { view: 'flota', flotaId: fid },
        payload: { flotaId: fid, codigo: it.codigo },
        bucket: 'auto',
      });
    }
  }

  for (const r of retrasos) {
    if (r.tipo === 'permiso' && r.referenciaId && r.referenciaId !== '—') {
      q.push({
        id: uid('ap-permiso'),
        tipo: 'destacar_permiso_riesgo',
        origen: 'flow',
        prioridad: 2,
        accion: `Permiso / cotización en riesgo (${r.referenciaId})`,
        motivo: r.descripcion || 'Retraso en respuesta',
        riesgo: 'bajo',
        requiereAprobacion: false,
        nav: r.modulo === 'flota' ? { view: 'flota', flotaId: r.referenciaId } : { view: 'flota' },
        payload: { retraso: r },
        bucket: 'auto',
      });
    }
  }

  for (const r of risks) {
    if (r.criticidad === 'alta') {
      q.push({
        id: uid('ap-flag-riesgo'),
        tipo: 'marcar_evento_riesgo_alto',
        origen: 'flow',
        prioridad: 2,
        accion: `Marcar riesgo operativo: ${r.code}`,
        motivo: r.mensaje,
        riesgo: 'bajo',
        requiereAprobacion: false,
        nav: null,
        payload: { risk: r },
        bucket: 'auto',
      });
    }
  }

  const rawOts = viewData?.ots?.data ?? viewData?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter((o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota');
  let sugN = 0;
  for (const o of otsClima) {
    if (o.estado === 'terminado') continue;
    if (!o.tecnicoAsignado || !String(o.tecnicoAsignado).trim()) continue;
    q.push({
      id: uid('ap-sug'),
      tipo: 'sugerir_responsable',
      origen: 'autopilot',
      prioridad: 4,
      accion: `Responsable sugerido · ${o.id}`,
      motivo: `${o.tecnicoAsignado} (${o.cliente || '—'})`,
      riesgo: 'ninguno',
      requiereAprobacion: false,
      nav: { view: 'clima', otId: o.id },
      payload: { otId: o.id, tecnico: o.tecnicoAsignado },
      bucket: 'auto',
    });
    sugN += 1;
    if (sugN >= 5) break;
  }

  if (viewData) {
    try {
      const today = buildTodayOperationsPanel(viewData);
      for (const it of today.topCierres || []) {
        const idMatch = String(it.titulo || '').match(/^([A-Z0-9-]+)\s*·/i);
        const oid = idMatch ? idMatch[1] : null;
        if (oid && !seenOt.has(`cerrar-${oid}`)) {
          seenOt.add(`cerrar-${oid}`);
          q.push({
            id: uid('ap-cierre-listo'),
            tipo: 'destacar_ot_lista_cierre',
            origen: 'intel',
            prioridad: 2,
            accion: `Destacar OT lista para cierre (${oid})`,
            motivo: it.descripcion || it.titulo,
            riesgo: 'ninguno',
            requiereAprobacion: false,
            nav: it.nav || { view: 'clima', otId: oid },
            payload: { otId: oid },
            bucket: 'auto',
          });
        }
      }
    } catch {
      /* sin datos suficientes */
    }
  }

  for (const it of execQ) {
    const pid = `apr-${it.codigo}-${slug(it.refKey || it.titulo)}`;
    q.push({
      id: pid,
      tipo: 'escalacion_aprobacion_erp',
      origen: 'intel',
      prioridad: it.tipo === 'CRITICO' ? 1 : 2,
      accion: it.accionCorta || 'Ejecutar en ERP (requiere humano)',
      motivo: it.titulo || it.codigo,
      riesgo: it.tipo === 'CRITICO' ? 'alto' : 'medio',
      requiereAprobacion: true,
      nav: it.nav || null,
      payload: { queueItem: it },
      bucket: 'approval',
    });
  }

  const seenIss = new Set();
  for (const it of issues) {
    if (it.tipo !== 'ATENCION') continue;
    if (seenIss.has(it.code)) continue;
    seenIss.add(it.code);
    q.push({
      id: uid('ap-aviso'),
      tipo: 'aviso_informativo',
      origen: 'intel',
      prioridad: 3,
      accion: 'Recomendación operativa',
      motivo: it.mensaje,
      riesgo: 'bajo',
      requiereAprobacion: false,
      nav: null,
      payload: { issue: it },
      bucket: 'notify',
    });
  }

  for (const r of risks) {
    if (r.criticidad === 'media' || r.criticidad === 'baja') {
      q.push({
        id: uid('ap-risk-info'),
        tipo: 'aviso_riesgo',
        origen: 'flow',
        prioridad: 4,
        accion: 'Señal de riesgo',
        motivo: r.mensaje,
        riesgo: 'bajo',
        requiereAprobacion: false,
        nav: null,
        payload: { risk: r },
        bucket: 'notify',
      });
    }
  }

  const cobroCodes = new Set(['CLIM_SIN_COBRO', 'CLIM_SIN_COSTO', 'CLIM_SIN_PDF']);
  for (const it of execQ) {
    if (!cobroCodes.has(it.codigo)) continue;
    q.push({
      id: uid('ap-rec-cobro'),
      tipo: 'recordatorio_interno',
      origen: 'autopilot',
      prioridad: it.tipo === 'CRITICO' ? 2 : 3,
      accion: 'Recordatorio interno · economía / cierre',
      motivo: it.titulo || it.codigo,
      riesgo: 'ninguno',
      requiereAprobacion: false,
      nav: it.nav || null,
      payload: { codigo: it.codigo, refKey: it.refKey },
      bucket: 'auto',
    });
  }

  for (const it of execQ.slice(0, 6)) {
    q.push({
      id: uid('ap-borrador'),
      tipo: 'borrador_interno',
      origen: 'autopilot',
      prioridad: 4,
      accion: 'Borrador de pasos sugeridos (no enviado)',
      motivo: `${it.codigo}: ${it.descripcion || it.titulo}`,
      riesgo: 'ninguno',
      requiereAprobacion: false,
      nav: it.nav || null,
      payload: { borrador: true, codigo: it.codigo },
      bucket: 'auto',
    });
  }

  q.sort((a, b) => a.prioridad - b.prioridad);
  return q;
}

export function classifyAutopilotActions(brief, viewData = null) {
  const queue = buildAutopilotQueue(brief, viewData);
  return {
    automaticasSeguras: queue.filter((x) => x.bucket === 'auto'),
    requierenAprobacion: queue.filter((x) => x.bucket === 'approval'),
    soloNotificar: queue.filter((x) => x.bucket === 'notify'),
  };
}

function toPendingRecord(item) {
  return {
    id: item.id,
    accion: item.accion,
    descripcion: item.motivo,
    motivo: `Origen: ${item.origen} · ${item.tipo}`,
    impacto: item.riesgo === 'alto' ? 'Alto — afecta cierre o cobro' : 'Medio — requiere validación en ERP',
    riesgo: item.riesgo === 'alto' ? 'alto' : item.riesgo === 'medio' ? 'medio' : 'bajo',
    aprobadoPor: null,
    estado: 'pendiente_aprobacion',
    nav: item.nav,
    codigoOrigen: item.payload?.queueItem?.codigo || item.payload?.codigo || item.tipo,
    modulo: item.payload?.queueItem?.modulo || item.origen,
    creadoEn: new Date().toISOString(),
    queueRefId: item.id,
  };
}

function executeSafeItem(item) {
  const out = { id: item.id, tipo: item.tipo, detalle: item.accion };
  switch (item.tipo) {
    case 'prioridad_visual_ot':
      if (item.payload?.otId) highlightState.otIds.add(item.payload.otId);
      break;
    case 'prioridad_visual_flota':
      if (item.payload?.flotaId) highlightState.flotaIds.add(item.payload.flotaId);
      break;
    case 'marcar_evento_riesgo_alto':
      if (item.payload?.risk?.code) highlightState.riskTags.push(String(item.payload.risk.code));
      break;
    case 'destacar_ot_lista_cierre':
      if (item.payload?.otId) highlightState.otIds.add(item.payload.otId);
      break;
    case 'destacar_permiso_riesgo':
      if (item.payload?.retraso?.referenciaId)
        highlightState.flotaIds.add(String(item.payload.retraso.referenciaId));
      break;
    default:
      break;
  }
  highlightState.updatedAt = new Date().toISOString();
  return out;
}

/**
 * @param {ReturnType<import('./hnf-intelligence-engine.js').getDirectorOperationalBrief>} brief
 * @param {object|null} [viewData]
 */
export function runAutopilotCycle(brief, viewData = null) {
  highlightState.otIds = new Set();
  highlightState.flotaIds = new Set();
  highlightState.riskTags = [];

  const classified = classifyAutopilotActions(brief, viewData);
  const ejecutadas = [];
  const notificaciones = [];
  const pendientesAprobacion = [];
  for (const it of classified.automaticasSeguras) {
    ejecutadas.push(executeSafeItem(it));
  }

  for (const it of classified.soloNotificar) {
    notificaciones.push({
      id: it.id,
      texto: it.motivo,
      tipo: it.tipo,
      origen: it.origen,
    });
  }

  const existing = loadPending();
  const byId = new Map(existing.map((p) => [p.id, p]));
  let nuevasEscalaciones = 0;

  for (const it of classified.requierenAprobacion) {
    const rec = toPendingRecord(it);
    if (!byId.has(rec.id)) {
      byId.set(rec.id, rec);
      nuevasEscalaciones += 1;
    } else if (byId.get(rec.id).estado === 'pendiente_aprobacion') {
      /* mantener */
    }
  }

  const merged = [...byId.values()].sort(
    (a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn))
  );
  savePending(merged);

  pendientesAprobacion.push(...merged.filter((p) => p.estado === 'pendiente_aprobacion'));

  const metrics = loadMetrics();
  metrics.autoEjecutadas += ejecutadas.length;
  metrics.soloAviso += notificaciones.length;
  metrics.escaladasAprobacion += nuevasEscalaciones;
  metrics.ciclos += 1;
  saveMetrics(metrics);

  const noToca = [
    'No se envían correos, WhatsApp ni cambios de estado en servidor.',
    'No se cierra OT ni se guarda economía sin paso humano en Clima/Flota.',
    `${classified.requierenAprobacion.length} ítem(s) de cola Intel quedan solo como propuesta hasta aprobación.`,
  ];

  const resumen = {
    at: new Date().toISOString(),
    ejecutadas: ejecutadas.length,
    notificaciones: notificaciones.length,
    pendientesAprobacion: pendientesAprobacion.length,
    nuevasEscalaciones,
    noToca,
    highlights: getAutopilotHighlights(),
  };

  lastCycleResult = {
    ejecutadas,
    pendientesAprobacion,
    notificaciones,
    resumen,
  };

  return lastCycleResult;
}

export function approveAutopilotAction(actionId, actor) {
  const arr = loadPending();
  const idx = arr.findIndex((p) => p.id === actionId);
  if (idx === -1) return { ok: false, error: 'not_found' };
  const p = arr[idx];
  if (p.estado !== 'pendiente_aprobacion') return { ok: false, error: 'estado_invalido' };
  p.estado = 'aprobada';
  p.aprobadoPor = actor || 'operador';
  p.resueltoEn = new Date().toISOString();
  arr[idx] = p;
  savePending(arr);
  rememberAutopilotDecision({
    tipo: 'aprobada',
    actionId,
    codigo: p.codigoOrigen,
    modulo: p.modulo,
    actor: p.aprobadoPor,
  });
  return { ok: true, item: p };
}

export function rejectAutopilotAction(actionId, actor) {
  const arr = loadPending();
  const idx = arr.findIndex((p) => p.id === actionId);
  if (idx === -1) return { ok: false, error: 'not_found' };
  const p = arr[idx];
  if (p.estado !== 'pendiente_aprobacion') return { ok: false, error: 'estado_invalido' };
  p.estado = 'rechazada';
  p.aprobadoPor = actor || 'operador';
  p.resueltoEn = new Date().toISOString();
  arr[idx] = p;
  savePending(arr);
  rememberAutopilotDecision({
    tipo: 'rechazada',
    actionId,
    codigo: p.codigoOrigen,
    modulo: p.modulo,
    actor: p.aprobadoPor,
  });
  return { ok: true, item: p };
}

export function getAutopilotMetrics() {
  const m = loadMetrics();
  const minutosEstimados = m.autoEjecutadas * 4 + m.soloAviso * 1;
  return {
    ...m,
    tiempoProtegidoMinutosEstimado: minutosEstimados,
    notaTiempo:
      'Estimación simple (4 min por acción automática interna + 1 min por aviso). Base gerencial, no contabilidad.',
  };
}

export function resetAutopilotSessionData() {
  lastCycleResult = null;
  highlightState = { otIds: new Set(), flotaIds: new Set(), riskTags: [], updatedAt: null };
}

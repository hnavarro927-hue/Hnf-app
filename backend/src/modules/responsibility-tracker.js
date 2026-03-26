/**
 * Seguimiento de responsabilidades en memoria (sin base de datos).
 * Código interno: nombres técnicos OK; las respuestas API usan etiquetas en español.
 */

const tasks = new Map();

export const responsibilityStore = {
  lastCycleAt: null,
  nextCycleAt: null,
  cashSnapshot: null,
  operationalSummary: null,
};

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

export function syncTasksFromCycle(incoming) {
  const seen = new Set();
  const now = new Date().toISOString();
  for (const t of incoming) {
    if (!t?.id) continue;
    seen.add(t.id);
    const prev = tasks.get(t.id);
    if (prev?.estado === 'resuelto') {
      tasks.set(t.id, { ...prev });
      continue;
    }
    const estado = prev?.estado === 'en_proceso' ? 'en_proceso' : t.estado || 'pendiente';
    tasks.set(t.id, {
      ...t,
      estado,
      timestamp: prev?.timestamp || t.timestamp || now,
    });
  }
  for (const id of [...tasks.keys()]) {
    if (!seen.has(id)) {
      const row = tasks.get(id);
      if (row?.estado === 'en_proceso') continue;
      tasks.delete(id);
    }
  }
}

export function updateTaskState(id, estado) {
  const row = tasks.get(id);
  if (!row) return null;
  if (!['pendiente', 'en_proceso', 'resuelto'].includes(estado)) return null;
  const next = {
    ...row,
    estado,
    updatedAt: new Date().toISOString(),
  };
  tasks.set(id, next);
  return next;
}

export function getActiveTasks() {
  return [...tasks.values()].filter((t) => t.estado !== 'resuelto');
}

export function getTasksByResponsable(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  return getActiveTasks().filter((t) => String(t.responsable || '').toLowerCase() === n);
}

export function detectarAtrasos(nowMs = Date.now()) {
  const out = [];
  for (const t of getActiveTasks()) {
    const due = t.tiempoLimiteMs ? Number(t.tiempoLimiteMs) : null;
    if (!due) continue;
    if (nowMs > due) {
      out.push({ ...t, atrasado: true, msAtraso: nowMs - due });
    }
  }
  return out;
}

export function getAllTasksForApi() {
  return [...tasks.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function setCashSnapshot(snap) {
  responsibilityStore.cashSnapshot = snap;
}

export function setOperationalSummary(text) {
  responsibilityStore.operationalSummary = text;
}

export function buildResponsibilityApiPayload() {
  const now = Date.now();
  const list = getActiveTasks().map((t) => {
    const started = t.timestamp ? new Date(t.timestamp).getTime() : now;
    const transcurridoMin = Math.max(0, Math.round((now - started) / 60000));
    const nivel = Number(t.nivel_presion) || 1;
    let etiquetaPresion = 'Normal';
    if (nivel >= 4) etiquetaPresion = 'Bloqueo operativo';
    else if (nivel >= 3) etiquetaPresion = 'Crítico';
    else if (nivel >= 2) etiquetaPresion = 'Alto';
    return {
      id: t.id,
      tipo: t.tipo,
      descripcion: t.descripcion,
      responsable: t.responsable,
      estado: t.estado,
      tiempo_transcurrido_min: transcurridoMin,
      nivel_presion: nivel,
      etiqueta_presion: etiquetaPresion,
      impacto: t.impacto || '—',
      tiempo_objetivo: t.tiempo_objetivo || '—',
    };
  });

  const cash = responsibilityStore.cashSnapshot || {
    riesgo_total: 0,
    recuperable_hoy: 0,
    fuga_estimada: 0,
    prioridad: 'BAJA',
  };

  return {
    tareas: list,
    ciclo: {
      ultima_revision: responsibilityStore.lastCycleAt,
      proxima_actualizacion: responsibilityStore.nextCycleAt,
      automatico_activo: true,
    },
    impacto_economico: {
      riesgo_total: roundMoney(cash.riesgo_total),
      recuperable_hoy: roundMoney(cash.recuperable_hoy),
      fuga_estimada: roundMoney(cash.fuga_estimada),
      prioridad: cash.prioridad || 'BAJA',
    },
    resumen: responsibilityStore.operationalSummary || '',
  };
}

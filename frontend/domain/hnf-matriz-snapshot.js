/**
 * Agrega datos reales para la Matriz HNF (sin inventar cifras).
 * Reglas documentadas en comentarios por bloque.
 */

const CLOSED = new Set(['cerrada', 'cerrado', 'terminado']);

const isOtOpen = (o) => !CLOSED.has(String(o?.estado || '').toLowerCase().trim());

const parseYmd = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const money = (n) => Number(n) || 0;

const unwrapOts = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/**
 * OT fuera de SLA (heurística operativa): abierta y fecha de visita ya pasó (solo día),
 * o lleva más de 7 días en estado pendiente sin fecha válida.
 */
export function countOtFueraSla(ots) {
  const list = unwrapOts(ots);
  const today = startOfToday();
  let n = 0;
  for (const o of list) {
    if (!isOtOpen(o)) continue;
    const fd = parseYmd(o.fecha);
    if (fd && fd < today) {
      n += 1;
      continue;
    }
    if (!fd && String(o.estado || '').toLowerCase() === 'pendiente') {
      const creado = new Date(o.creadoEn || o.createdAt || 0).getTime();
      if (Number.isFinite(creado) && Date.now() - creado > 7 * 86400000) n += 1;
    }
  }
  return n;
}

export function countGastosPendientesAprobacion(expenses) {
  const list = Array.isArray(expenses) ? expenses : [];
  return list.filter((e) => String(e.estadoAprobacion || 'registrado') === 'registrado').length;
}

/** Solicitudes core en bandeja gerencial (aprox. rendiciones / revisión Lyn). */
export function countRendicionesPendientes(solicitudes) {
  const list = Array.isArray(solicitudes) ? solicitudes : [];
  return list.filter((s) =>
    ['pendiente_aprobacion', 'observado'].includes(String(s.estado || '').toLowerCase())
  ).length;
}

const MS_SIN_RESPUESTA = 72 * 3600000;

/** Leads activos sin interacción reciente (72 h) y no cerrados. */
export function countLeadsSinRespuesta(leads) {
  const list = Array.isArray(leads) ? leads : [];
  const now = Date.now();
  let n = 0;
  for (const L of list) {
    const est = String(L.estado || '').toLowerCase();
    if (est.startsWith('cerrado_')) continue;
    const t = new Date(L.ultimaInteraccion || L.fechaCreacion || L.createdAt || 0).getTime();
    if (!Number.isFinite(t)) continue;
    if (now - t > MS_SIN_RESPUESTA) n += 1;
  }
  return n;
}

export function buildMatrizKpis({ ots, expenses }) {
  const list = unwrapOts(ots);
  const ex = Array.isArray(expenses) ? expenses : [];
  const today = startOfToday();
  const month0 = startOfMonth();
  const todayYmd = today.toISOString().slice(0, 10);
  const monthY = month0.getFullYear();
  const monthM = month0.getMonth();

  let ingresosEstimadosHoy = 0;
  let ingresosEnProceso = 0;
  let ingresosCerradosMes = 0;
  let gastosHoy = 0;
  let gastosMes = 0;
  let utilidadCerradasMes = 0;
  let sumTicketMes = 0;
  let nTicketMes = 0;

  for (const o of list) {
    const cob = money(o.montoCobrado);
    const util = money(o.utilidad);
    const cerr = !isOtOpen(o);
    const fd = parseYmd(o.fecha);
    const visitaHoy = fd && fd.toISOString().slice(0, 10) === todayYmd;

    if (!cerr) {
      ingresosEnProceso += cob;
      if (visitaHoy) ingresosEstimadosHoy += cob;
    }

    const cierre = new Date(o.cerradoEn || o.updatedAt || 0);
    if (cerr && Number.isFinite(cierre.getTime())) {
      if (cierre.getFullYear() === monthY && cierre.getMonth() === monthM) {
        ingresosCerradosMes += cob;
        utilidadCerradasMes += util;
        if (cob > 0) {
          sumTicketMes += cob;
          nTicketMes += 1;
        }
      }
    }
  }

  for (const e of ex) {
    const monto = money(e.monto);
    const f = parseYmd(e.fecha);
    if (!f || !Number.isFinite(f.getTime())) continue;
    if (f.toISOString().slice(0, 10) === todayYmd) gastosHoy += monto;
    if (f.getFullYear() === monthY && f.getMonth() === monthM) gastosMes += monto;
  }

  const ticketPromedioMes = nTicketMes > 0 ? Math.round(sumTicketMes / nTicketMes) : 0;
  const utilidadEstimada = utilidadCerradasMes - gastosMes;

  return {
    ingresosEstimadosHoy,
    ingresosEnProceso,
    ingresosCerradosMes,
    gastosHoy,
    gastosMes,
    utilidadEstimada,
    ticketPromedioMes,
  };
}

const isFlotaOt = (o) => {
  const t = String(o?.tipoServicio || '').toLowerCase();
  return t.includes('flota') || t.includes('traslado');
};

export function unidadNegocioResumen(ots, unidad) {
  const list = unwrapOts(ots);
  const filtered = list.filter((o) => (unidad === 'flota' ? isFlotaOt(o) : !isFlotaOt(o)));
  const abiertas = filtered.filter(isOtOpen).length;
  const sla = countOtFueraSla(filtered);
  return { abiertas, fueraSla: sla, total: filtered.length };
}

/** Timeline unificada (orden descendente por tiempo). */
export function buildMatrizActividad({ ots, expenses, events, auditRows, limit = 24 }) {
  const rows = [];

  const listO = unwrapOts(ots);
  for (const o of listO) {
    const t = new Date(o.createdAt || o.creadoEn || 0).getTime();
    if (!Number.isFinite(t)) continue;
    rows.push({
      t,
      label: `OT ${o.id || ''}`,
      detail: `${o.cliente || '—'} · ${o.estado || '—'}`,
      kind: 'ot',
    });
  }

  const ex = Array.isArray(expenses) ? expenses : [];
  for (const e of ex) {
    const t = new Date(e.updatedAt || e.fecha || 0).getTime();
    if (!Number.isFinite(t)) continue;
    const st = e.estadoAprobacion || 'registrado';
    rows.push({
      t,
      label: 'Gasto',
      detail: `${money(e.monto)} · ${st} · ${String(e.descripcion || '').slice(0, 60)}`,
      kind: 'gasto',
    });
  }

  const ev = Array.isArray(events) ? events : [];
  for (const x of ev) {
    const t = new Date(x.createdAt || x.at || 0).getTime();
    if (!Number.isFinite(t)) continue;
    rows.push({
      t,
      label: x.tipo || 'Evento',
      detail: String(x.descripcion || x.message || x.estado || '').slice(0, 120),
      kind: 'evento',
    });
  }

  const aud = Array.isArray(auditRows) ? auditRows : [];
  for (const a of aud) {
    const t = new Date(a.at || 0).getTime();
    if (!Number.isFinite(t)) continue;
    rows.push({
      t,
      label: a.action || 'Auditoría',
      detail: `${a.actor || '—'} · ${a.resource || ''}`.trim(),
      kind: 'audit',
    });
  }

  rows.sort((a, b) => b.t - a.t);
  return rows.slice(0, limit);
}

export function listGastosPendientesAprobacion(expenses) {
  const list = Array.isArray(expenses) ? expenses : [];
  return list.filter((e) => String(e.estadoAprobacion || 'registrado') === 'registrado');
}

export function listOcRecientes(ocList, limit = 6) {
  const raw = Array.isArray(ocList) ? ocList : [];
  const sorted = [...raw].sort((a, b) =>
    String(b.updatedAt || b.creadoAt || '').localeCompare(String(a.updatedAt || a.creadoAt || ''))
  );
  return sorted.slice(0, limit);
}

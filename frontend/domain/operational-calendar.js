/**
 * Calendario operativo Clima — alertas, parseo futuro, base de reportes comerciales.
 */

export const OPERATIONAL_CALENDAR_DOMAIN_VERSION = '2026-03-22';

const pad2 = (n) => String(n).padStart(2, '0');

/** Rango por defecto para API merge (3 semanas atrás + ~10 adelante). */
export function defaultOperationalCalendarRange() {
  const d = new Date();
  const desde = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 21);
  const hasta = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 70);
  const toYmd = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  return { desde: toYmd(desde), hasta: toYmd(hasta) };
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const toMin = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  return h * 60 + mi;
};

const overlapInterval = (a0, a1, b0, b1) => {
  const A0 = toMin(a0);
  const A1 = toMin(a1);
  const B0 = toMin(b0);
  const B1 = toMin(b1);
  if (A0 == null || A1 == null || B0 == null || B1 == null) return false;
  return Math.max(A0, B0) < Math.min(A1, B1);
};

const weekKey = (ymd) => {
  const d = new Date(`${ymd}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

/**
 * Base para importar desde texto / tabla / futuro OCR-Excel.
 * @param {string} input
 */
export function parsePlanningBlock(input) {
  const s = String(input || '').trim();
  if (!s) {
    return {
      ok: false,
      records: [],
      hint: 'Pegá filas con fecha, tienda, franja y tipo (UI/UE). OCR e importación Excel se conectarán aquí.',
      version: OPERATIONAL_CALENDAR_DOMAIN_VERSION,
    };
  }
  const lines = s.split(/\r?\n/).filter(Boolean);
  return {
    ok: false,
    records: [],
    hint:
      'Parser estructurado pendiente: se detectaron líneas para mapeo futuro a registros (regex por cliente o CSV).',
    linesDetected: lines.length,
    sample: lines.slice(0, 3),
    version: OPERATIONAL_CALENDAR_DOMAIN_VERSION,
  };
}

/**
 * Vista previa de reportes comerciales (agregados; sin PDF aún).
 */
export function buildOperationalCalendarReportPreview(entries, { desde, hasta } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const byTienda = new Map();
  const byTecnico = new Map();
  let ui = 0;
  let ue = 0;
  let uieu = 0;
  let ejecutado = 0;
  let programado = 0;

  for (const e of list) {
    const f = String(e.fecha || '').slice(0, 10);
    if (desde && f < desde) continue;
    if (hasta && f > hasta) continue;
    const tn = e.tiendaNombre || e.tiendaId || '—';
    byTienda.set(tn, (byTienda.get(tn) || 0) + 1);
    const tech = String(e.tecnicoAsignado || '').trim() || 'Sin asignar';
    byTecnico.set(tech, (byTecnico.get(tech) || 0) + 1);
    const u = String(e.tipoUnidad || '').toUpperCase();
    if (u.includes('UI+UE') || u === 'UI+UE') uieu += 1;
    else if (u.includes('UI')) ui += 1;
    if (u.includes('UE')) ue += 1;
    if (e.estado === 'ejecutado') ejecutado += 1;
    if (e.estado === 'programado' || e.estado === 'en_ruta') programado += 1;
  }

  return {
    version: OPERATIONAL_CALENDAR_DOMAIN_VERSION,
    periodo: { desde: desde || null, hasta: hasta || null },
    totales: {
      visitas: list.length,
      ejecutado,
      programadoOEnRuta: programado,
    },
    coberturaUnidad: { ui, ue, uiMasUe: uieu },
    topTiendas: [...byTienda.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, n]) => ({ nombre, visitas: n })),
    topTecnicos: [...byTecnico.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([nombre, n]) => ({ nombre, visitas: n })),
  };
}

/**
 * @param {object} ctx
 * @param {object[]} ctx.entries - merge backend
 * @param {object[]} ctx.ots
 * @param {object[]} ctx.mantenciones
 * @param {object[]} ctx.tiendas
 * @param {object[]} ctx.clientes
 */
export function computeOperationalCalendarAlerts(ctx) {
  const entries = Array.isArray(ctx.entries) ? ctx.entries : [];
  const ots = Array.isArray(ctx.ots) ? ctx.ots : [];
  const mantenciones = Array.isArray(ctx.mantenciones) ? ctx.mantenciones : [];
  const tiendas = Array.isArray(ctx.tiendas) ? ctx.tiendas : [];
  const clientes = Array.isArray(ctx.clientes) ? ctx.clientes : [];

  const tiendaById = Object.fromEntries(tiendas.map((t) => [t.id, t]));
  const clienteById = Object.fromEntries(clientes.map((c) => [c.id, c]));

  /** @type {Array<{ code: string, severity: 'critical'|'warning'|'info', mensaje: string, detalle?: string }>} */
  const alerts = [];

  for (const e of entries) {
    if (!['programado', 'en_ruta'].includes(e.estado)) continue;
    if (e.referenciaOtId) continue;
    alerts.push({
      code: 'CAL_SIN_OT',
      severity: 'warning',
      mensaje: `Visita programada sin OT vinculada (${e.tiendaNombre || e.tiendaId} · ${e.fecha})`,
      detalle: e.virtual ? 'Desde mantención plan' : 'Registro calendario operativo',
    });
  }

  const otsClima = ots.filter((o) => String(o.tipoServicio || 'clima').toLowerCase() !== 'flota');
  for (const o of otsClima) {
    if (o.estado !== 'terminado') continue;
    const f = String(o.fecha || '').slice(0, 10);
    const cn = norm(o.cliente);
    const match = entries.some((e) => {
      if (String(e.fecha).slice(0, 10) !== f) return false;
      if (e.estado === 'ejecutado') return false;
      const ec = norm(e.cliente);
      return ec && cn && (ec === cn || ec.includes(cn) || cn.includes(ec));
    });
    if (match) {
      alerts.push({
        code: 'CAL_OT_TERM_SIN_EJEC',
        severity: 'warning',
        mensaje: `OT ${o.id} terminada pero calendario sin «ejecutado» el mismo día (${f})`,
        detalle: o.cliente || '—',
      });
    }
  }

  const byTechDay = new Map();
  for (const e of entries) {
    const tech = String(e.tecnicoAsignado || '').trim();
    if (!tech) continue;
    const k = `${e.fecha}|${tech}`;
    byTechDay.set(k, (byTechDay.get(k) || 0) + 1);
  }
  for (const [k, n] of byTechDay) {
    if (n >= 5) {
      const [fecha, tech] = k.split('|');
      alerts.push({
        code: 'CAL_TEC_SOBRECARGA',
        severity: 'warning',
        mensaje: `Técnico con ${n} visitas el ${fecha}`,
        detalle: tech,
      });
    }
  }

  const seenSol = new Set();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.tiendaId !== b.tiendaId) continue;
      if (String(a.fecha) !== String(b.fecha)) continue;
      if (!overlapInterval(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) continue;
      const sk = [a.id, b.id].sort().join('|');
      if (seenSol.has(sk)) continue;
      seenSol.add(sk);
      alerts.push({
        code: 'CAL_SOLAPE',
        severity: 'critical',
        mensaje: `Solape de franja en ${a.tiendaNombre || a.tiendaId} · ${a.fecha}`,
        detalle: `${a.horaInicio}-${a.horaFin} vs ${b.horaInicio}-${b.horaFin}`,
      });
    }
  }

  const visitsByWeekCliente = new Map();
  const tiendasPorCliente = new Map();
  for (const t of tiendas) {
    tiendasPorCliente.set(t.clienteId, (tiendasPorCliente.get(t.clienteId) || 0) + 1);
  }
  for (const e of entries) {
    const t = tiendaById[e.tiendaId];
    if (!t) continue;
    const wk = weekKey(String(e.fecha).slice(0, 10));
    const k = `${t.clienteId}|${wk}`;
    visitsByWeekCliente.set(k, (visitsByWeekCliente.get(k) || 0) + 1);
  }
  const seenLowUtil = new Set();
  for (const [cid, nTiendas] of tiendasPorCliente) {
    if (nTiendas < 3) continue;
    const weeks = new Set();
    for (const k of visitsByWeekCliente.keys()) {
      if (k.startsWith(`${cid}|`)) weeks.add(k.split('|')[1]);
    }
    for (const wk of weeks) {
      const v = visitsByWeekCliente.get(`${cid}|${wk}`) || 0;
      if (v > 0 && v < 2) {
        const sk = `${cid}|${wk}`;
        if (seenLowUtil.has(sk)) continue;
        seenLowUtil.add(sk);
        const c = clienteById[cid];
        alerts.push({
          code: 'CAL_BAJA_UTIL_SEM',
          severity: 'info',
          mensaje: `Baja utilización semanal (${wk}) para cliente con varias tiendas`,
          detalle: c?.nombre || cid,
        });
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const t of tiendas) {
    const lastDone = mantenciones
      .filter((m) => m.tiendaId === t.id && m.estado === 'realizado')
      .map((m) => m.fecha)
      .sort()
      .pop();
    if (!lastDone || lastDone >= today) continue;
    const future = mantenciones.some(
      (m) => m.tiendaId === t.id && m.fecha > lastDone && m.fecha >= today.slice(0, 10)
    );
    const futCal = entries.some(
      (e) => e.tiendaId === t.id && String(e.fecha) > lastDone && String(e.fecha) >= today.slice(0, 10)
    );
    if (!future && !futCal) {
      const days = Math.floor(
        (new Date(today) - new Date(`${lastDone}T12:00:00`)) / 86400000
      );
      if (days > 45) {
        const c = clienteById[t.clienteId];
        alerts.push({
          code: 'CAL_SIN_CONTINUIDAD',
          severity: 'warning',
          mensaje: `Tienda «${t.nombre}» sin próxima visita tras mantención realizada (${lastDone})`,
          detalle: c?.nombre || '—',
        });
      }
    }
  }

  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  return alerts.slice(0, 24);
}

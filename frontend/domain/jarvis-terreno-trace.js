/**
 * Trazabilidad mínima terreno (ingreso/salida tienda) — JARVIS_TERRENO_TRACE_V1
 */

const LS_KEY = 'JARVIS_TERRENO_TRACE_V1';
const MAX = 60;

const read = () => {
  try {
    const r = localStorage.getItem(LS_KEY);
    const j = r ? JSON.parse(r) : { rows: [] };
    return Array.isArray(j.rows) ? j.rows : [];
  } catch {
    return [];
  }
};

const write = (rows) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ rows: rows.slice(0, MAX) }));
  } catch {
    /* ignore */
  }
};

/**
 * @param {object} row
 * @param {string} row.tecnico
 * @param {string} row.tienda
 * @param {'ingreso'|'salida'} row.tipo_marca
 * @param {number} [row.hora_detectada]
 * @param {string} [row.canal]
 */
export function appendTerrenoRow(row) {
  const tecnico = String(row?.tecnico || '').trim();
  const tienda = String(row?.tienda || '').trim();
  const tipo_marca = row?.tipo_marca === 'salida' ? 'salida' : 'ingreso';
  if (!tecnico || !tienda) return null;
  const r = {
    id: `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    tecnico,
    tienda,
    tipo_marca,
    hora_detectada: Number(row.hora_detectada) || Date.now(),
    canal: String(row.canal || '').trim() || '—',
    at: new Date().toISOString(),
  };
  const prev = read();
  write([r, ...prev]);
  try {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-terreno-updated'));
  } catch {
    /* ignore */
  }
  return r;
}

export function listTerrenoRows() {
  return read();
}

/**
 * Agrupa por técnico+tienda: último ingreso y última salida.
 */
export function buildTerrenoEstadoTable() {
  const rows = read();
  const key = (t) => `${String(t.tecnico).toLowerCase()}|${String(t.tienda).toLowerCase()}`;
  const map = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) {
      map.set(k, {
        tecnico: r.tecnico,
        tienda: r.tienda,
        ingresoTs: null,
        salidaTs: null,
        canal: r.canal,
      });
    }
    const agg = map.get(k);
    const ts = Number(r.hora_detectada) || new Date(r.at).getTime();
    if (r.tipo_marca === 'ingreso') {
      if (agg.ingresoTs == null || ts > agg.ingresoTs) agg.ingresoTs = ts;
    } else {
      if (agg.salidaTs == null || ts > agg.salidaTs) agg.salidaTs = ts;
    }
  }
  return [...map.values()].map((x) => {
    let estado = '—';
    if (x.ingresoTs && (!x.salidaTs || x.salidaTs < x.ingresoTs)) {
      estado = 'En tienda / sin salida registrada';
    } else if (x.ingresoTs && x.salidaTs && x.salidaTs >= x.ingresoTs) {
      estado = 'Ciclo cerrado';
    } else if (!x.ingresoTs && x.salidaTs) {
      estado = 'Solo salida registrada';
    }
    return { ...x, estado };
  });
}

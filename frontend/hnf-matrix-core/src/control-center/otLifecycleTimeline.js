/**
 * Timeline operativa desde campos reales de la OT (sin inventar eventos).
 * Orden fijo de presentación: creación → asignación → cierre → aprobación → envío.
 */

const fmtShort = (iso) => {
  if (iso == null || iso === '') return null;
  try {
    return new Date(String(iso)).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso).slice(0, 16);
  }
};

function findAsignacionHistorial(historial) {
  const h = Array.isArray(historial) ? historial : [];
  const hit = h.find((e) => {
    const a = String(e?.accion || '').toLowerCase();
    return a.includes('asign') || a === 'asignacion';
  });
  return hit?.at || null;
}

function findAprobacionLyn(ot) {
  const hist = Array.isArray(ot?.lynAprobacionHistorial) ? ot.lynAprobacionHistorial : [];
  const rev = [...hist].reverse();
  const hit = rev.find((e) => {
    const ac = String(e?.accion || '').toLowerCase();
    const en = String(e?.estadoNuevo || '').toLowerCase();
    return ac.includes('aprobar') || ac.includes('lyn_aprobar') || en === 'aprobado_lyn';
  });
  return hit?.at || null;
}

/**
 * @param {Record<string, unknown>} ot
 * @returns {{ id: string, key: string, label: string, fecha: string | null, hecho: boolean }[]}
 */
export function buildOtLifecycleTimeline(ot) {
  const creado = ot?.creadoEn || ot?.createdAt || null;
  const asign = findAsignacionHistorial(ot?.historial);
  const cierre = ot?.cerradoEn || null;
  const estado = String(ot?.estado || '').toLowerCase();
  const cerrada = ['cerrada', 'finalizada', 'facturada'].includes(estado);
  const aprob = findAprobacionLyn(ot);
  const envio = ot?.enviadoCliente && ot?.fechaEnvio ? ot.fechaEnvio : null;

  const rows = [
    { id: 'crear', key: 'creacion', label: 'Creación', fecha: creado, hecho: Boolean(creado) },
    { id: 'asig', key: 'asignacion', label: 'Asignación', fecha: asign, hecho: Boolean(asign) },
    {
      id: 'cerr',
      key: 'cierre',
      label: 'Cierre',
      fecha: cerrada ? cierre || '—' : cierre,
      hecho: cerrada || Boolean(cierre),
    },
    { id: 'apr', key: 'aprobacion', label: 'Aprobación', fecha: aprob, hecho: Boolean(aprob) },
    { id: 'env', key: 'envio', label: 'Envío', fecha: envio, hecho: Boolean(envio) },
  ];

  return rows.map((r) => ({
    ...r,
    fechaCorta:
      r.fecha && r.fecha !== '—' ? fmtShort(r.fecha) : r.fecha === '—' ? '—' : null,
  }));
}

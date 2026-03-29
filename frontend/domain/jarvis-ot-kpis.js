/**
 * KPIs reales desde la lista de OT del corte (Jarvis / loadFullOperationalData).
 */

const isClosedEstado = (e) => {
  const s = String(e || '')
    .trim()
    .toLowerCase();
  return ['terminado', 'cerrada', 'cerrado'].includes(s);
};

const todayLocalIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * @param {object} viewData
 * @returns {{ nuevasHoy: number, enProceso: number, atrasadas: number, sinAsignar: number }}
 */
export function computeJarvisOtKpis(viewData) {
  const ots = viewData?.planOts ?? viewData?.ots?.data ?? [];
  if (!Array.isArray(ots)) {
    return { nuevasHoy: 0, enProceso: 0, atrasadas: 0, sinAsignar: 0 };
  }
  const today = todayLocalIso();
  let nuevasHoy = 0;
  let enProceso = 0;
  let atrasadas = 0;
  let sinAsignar = 0;

  for (const o of ots) {
    if (isClosedEstado(o.estado)) continue;

    const st = String(o.estado || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const creado = String(o.creadoEn || o.createdAt || '').slice(0, 10);
    if (creado === today && (st === 'nueva' || st === 'asignada' || st === 'pendiente')) {
      nuevasHoy += 1;
    }
    if (st === 'en_proceso' || st === 'en proceso') {
      enProceso += 1;
    }

    const tech = String(o.tecnicoAsignado || '').trim();
    if (!tech || tech.toLowerCase() === 'por asignar') {
      sinAsignar += 1;
    }

    const fechaVisita = String(o.fecha || '').slice(0, 10);
    if (fechaVisita && fechaVisita < today) {
      atrasadas += 1;
    }
  }

  return { nuevasHoy, enProceso, atrasadas, sinAsignar };
}

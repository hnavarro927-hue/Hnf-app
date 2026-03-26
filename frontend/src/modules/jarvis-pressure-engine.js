/**
 * Presión operativa (cliente): tareas derivadas del estado unificado.
 * Nombres técnicos solo en código; la UI consume etiquetas ya traducidas.
 */

const nowIso = () => new Date().toISOString();

const nivelDesdeHoras = (horas, gravedad) => {
  let n = 1;
  if (gravedad === 'CRITICA') {
    if (horas >= 0.25) n = 2;
    if (horas >= 1) n = 3;
    if (horas >= 6) n = 4;
  } else if (gravedad === 'ALTA') {
    if (horas >= 1) n = 2;
    if (horas >= 4) n = 3;
    if (horas >= 12) n = 4;
  } else {
    if (horas >= 8) n = 2;
    if (horas >= 24) n = 3;
    if (horas >= 72) n = 4;
  }
  return n;
};

const responsablePorTipo = (tipo) => {
  if (/OT|evidencia|clima|Clima/i.test(tipo)) return 'Romina';
  if (/correo|cliente|oportunidad|WhatsApp|comercial/i.test(tipo)) return 'Gery';
  if (/documento|pago|administraci/i.test(tipo)) return 'Lyn';
  return 'Hernan';
};

/**
 * @param {object} unified - estado Jarvis unificado
 * @param {string} integrationStatus
 * @returns {object[]}
 */
export function buildPressureTasksFromUnified(unified, integrationStatus) {
  const tasks = [];
  const ts = nowIso();
  const planOts = Array.isArray(unified?.planOts) ? unified.planOts : [];
  const openOts = planOts.filter((o) => String(o?.estado || '') !== 'terminado');
  const outlookN = Array.isArray(unified?.outlookFeed?.messages) ? unified.outlookFeed.messages.length : 0;
  const wa = unified?.whatsappFeed?.messages;
  const waN = Array.isArray(wa) ? wa.length : unified?.whatsappFeed && typeof unified.whatsappFeed === 'object' ? 1 : 0;
  const oppsN = Array.isArray(unified?.commercialOpportunities) ? unified.commercialOpportunities.length : 0;
  const cal = unified?.operationalCalendar;
  const calN = Array.isArray(cal?.entries) ? cal.entries.length : Array.isArray(cal) ? cal.length : 0;
  const docsN = Array.isArray(unified?.technicalDocuments) ? unified.technicalDocuments.length : 0;

  let otsSinEv = 0;
  for (const ot of openOts) {
    const gaps = unified?.__gapsOt?.get?.(ot?.id);
    if (gaps === undefined) continue;
    if (gaps > 0) otsSinEv += 1;
  }

  const push = (row) => {
    const horas = 0;
    row.nivel_presion = nivelDesdeHoras(horas, row.gravedad);
    row.responsable = row.responsable || responsablePorTipo(row.tipo);
    row.timestamp = row.timestamp || ts;
    tasks.push(row);
  };

  if (otsSinEv > 0) {
    push({
      id: 'cli_ot_evidencia',
      tipo: 'OT · evidencias',
      descripcion: `Faltan evidencias en ${otsSinEv} OT`,
      gravedad: 'CRITICA',
      estado: 'pendiente',
      tiempo_objetivo: 'Inmediata',
      impacto: 'Cierre detenido; cobro en riesgo',
    });
  }

  if (integrationStatus === 'conectado' && outlookN === 0) {
    push({
      id: 'cli_outlook',
      tipo: 'Correos',
      descripcion:
        'No se detectan correos formales recientes de Granleasing en la bandeja cargada',
      gravedad: openOts.length ? 'ALTA' : 'NORMAL',
      estado: 'pendiente',
      tiempo_objetivo: openOts.length ? 'Dentro de 1 hora' : 'Dentro del día',
      impacto: 'Seguimiento comercial sin visibilidad',
    });
  }

  if (integrationStatus === 'conectado' && waN === 0) {
    push({
      id: 'cli_whatsapp',
      tipo: 'WhatsApp',
      descripcion:
        'No hay registros recientes en Reportes Clima, Central Ops, Granleasing ni West en el feed',
      gravedad: 'NORMAL',
      estado: 'pendiente',
      tiempo_objetivo: 'Dentro del día',
      impacto: 'Conversaciones de obra no centralizadas',
    });
  }

  if (integrationStatus === 'conectado' && oppsN === 0) {
    push({
      id: 'cli_oportunidades',
      tipo: 'Oportunidades comerciales',
      descripcion: 'Oportunidades comerciales no ingresadas',
      gravedad: 'ALTA',
      estado: 'pendiente',
      tiempo_objetivo: 'Dentro de 1 hora',
      impacto: 'Proyección comercial sin base',
    });
  }

  if (integrationStatus === 'conectado' && calN === 0) {
    push({
      id: 'cli_calendario',
      tipo: 'Planificación',
      descripcion: 'Calendario sin planificación visible',
      gravedad: 'ALTA',
      estado: 'pendiente',
      tiempo_objetivo: 'Dentro de 1 hora',
      impacto: 'Visitas sin control de agenda',
    });
  }

  if (integrationStatus === 'conectado' && docsN === 0 && openOts.length > 0) {
    push({
      id: 'cli_documentos',
      tipo: 'Documentos técnicos',
      descripcion: 'Sin documentos técnicos visibles para aprobación Lyn / trazabilidad',
      gravedad: 'NORMAL',
      estado: 'pendiente',
      tiempo_objetivo: 'Dentro del día',
      impacto: 'Aprobaciones limitadas',
    });
  }

  return tasks;
}

/**
 * Anota conteo de huecos de evidencia por OT (evita import circular en la vista).
 * @param {object} unified
 * @param {import('../../utils/ot-evidence.js').getEvidenceGaps} getEvidenceGaps
 */
export function attachEvidenceGapCounts(unified, getEvidenceGaps) {
  const m = new Map();
  const planOts = Array.isArray(unified?.planOts) ? unified.planOts : [];
  for (const ot of planOts) {
    if (String(ot?.estado || '') === 'terminado') continue;
    const g = getEvidenceGaps(ot);
    m.set(ot?.id, g.length);
  }
  return { ...unified, __gapsOt: m };
}

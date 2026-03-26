/**
 * Núcleo operativo unificado — todo ingreso como evento_operativo (flujo único).
 * @see buildFlujoOperativoUnificado, normalizeToEvento, calcularAccion
 */

export const EVENTO_TIPOS = ['whatsapp', 'correo', 'ot', 'documento', 'comercial'];
export const EVENTO_ESTADOS = ['nuevo', 'clasificado', 'en_proceso', 'bloqueado', 'cerrado'];
export const EVENTO_PRIORIDADES = ['critica', 'alta', 'media', 'baja'];

/** @typedef {typeof EVENTO_TIPOS[number]} EventoTipo */
/** @typedef {typeof EVENTO_ESTADOS[number]} EventoEstado */
/** @typedef {typeof EVENTO_PRIORIDADES[number]} EventoPrioridad */

/**
 * @typedef {object} EventoOperativo
 * @property {string} id
 * @property {EventoTipo} tipo
 * @property {string} cliente
 * @property {string} origen
 * @property {EventoEstado} estado
 * @property {EventoPrioridad} prioridad
 * @property {string} responsable
 * @property {number} tiempo_sin_gestion
 * @property {number} riesgo_dinero
 * @property {string} accion_sugerida
 * @property {boolean} requiere_accion
 * @property {boolean} evidencia_faltante
 * @property {string} ultima_actividad
 * @property {Record<string, unknown>} metadata
 */

const PRIO_RANK = { critica: 4, alta: 3, media: 2, baja: 1 };

function hoursSince(iso) {
  const t = new Date(iso || 0).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3600000);
}

function mapJarvisPrioridad(p) {
  const u = String(p || '').toUpperCase();
  if (u === 'CRITICO' || u === 'CRÍTICA' || u === 'CRITICA') return 'critica';
  if (u === 'ALTO' || u === 'ALTA') return 'alta';
  if (u === 'BAJO' || u === 'BAJA') return 'baja';
  return 'media';
}

function mapTipoFromJarvis(ev) {
  const tc = String(ev.tipoClasificado || '').toLowerCase();
  const canal = String(ev.canalSalida || ev.canal || '').toLowerCase();
  if (canal === 'whatsapp' || tc === 'whatsapp') return 'whatsapp';
  if (canal === 'correo' || tc === 'correo') return 'correo';
  if (tc === 'ot' || canal === 'ot' || canal === 'ot_sistema') return 'ot';
  if (tc === 'comercial' || ev.generaOportunidad) return 'comercial';
  return 'documento';
}

/**
 * Normaliza un registro crudo a evento_operativo.
 * @param {object} raw
 * @param {'jarvis_operativo'|'whatsapp'|'correo'|'manual'|'documento'|'ot'|'comercial'} source
 * @returns {EventoOperativo}
 */
export function normalizeToEvento(raw, source) {
  const nowIso = new Date().toISOString();
  if (source === 'jarvis_operativo') {
    const ev = raw || {};
    const at = ev.at || nowIso;
    const tipo = mapTipoFromJarvis(ev);
    const ex = String(ev.rawExcerpt || '').toLowerCase();
    const evidenciaFaltante =
      /evidencia|hueco|sin cierre|sin pdf|sin informe/i.test(ex) ||
      /evidencia|hueco|sin cierre/i.test(String(ev.accionInmediata || ''));
    let estado = /** @type {EventoEstado} */ ('nuevo');
    if (ev.generaRiesgo && evidenciaFaltante) estado = 'bloqueado';
    else if (ev.tipoSalida || ev.tipoClasificado) estado = 'clasificado';
    const base = {
      id: String(ev.id || `jev-${Date.now()}`),
      tipo,
      cliente: String(ev.clienteDetectado || ev.cliente || '—'),
      origen: String(ev.fuente || ev.archivo || 'ingesta'),
      estado,
      prioridad: mapJarvisPrioridad(ev.prioridad),
      responsable: String(ev.responsableSugerido || ev.responsable || '—'),
      tiempo_sin_gestion: hoursSince(at),
      riesgo_dinero: Math.round(Number(ev.impactoEconomicoHeuristico ?? ev.impactoEconomicoEstimado) || 0),
      accion_sugerida: String(ev.accionInmediata || 'Revisar y asignar').slice(0, 240),
      requiere_accion: true,
      evidencia_faltante: evidenciaFaltante,
      ultima_actividad: at,
      metadata: { source: 'jarvis_operativo', rawId: ev.id, vinculoSugerido: ev.vinculoSugerido },
    };
    const acc = calcularAccion(base);
    return { ...base, accion_sugerida: acc };
  }

  if (source === 'whatsapp') {
    const m = raw || {};
    const at = m.updatedAt || m.createdAt || m.fecha || nowIso;
    const evids = Array.isArray(m.evidencias) ? m.evidencias.length : 0;
    const evidenciaFaltante = evids === 0 && String(m.estado || '') !== 'cerrado';
    const base = {
      id: `wa-${m.id || Math.random().toString(36).slice(2)}`,
      tipo: /** @type {EventoTipo} */ ('whatsapp'),
      cliente: String(m.cliente || '—'),
      origen: 'whatsapp',
      estado: /** @type {EventoEstado} */ (String(m.estado || 'en_proceso') === 'cerrado' ? 'cerrado' : 'en_proceso'),
      prioridad: /** @type {EventoPrioridad} */ ('media'),
      responsable: String(m.tecnico || '—'),
      tiempo_sin_gestion: hoursSince(at),
      riesgo_dinero: 0,
      accion_sugerida: String(m.descripcion || m.observaciones || 'Seguimiento WhatsApp').slice(0, 240),
      requiere_accion: String(m.estado || '') !== 'cerrado',
      evidencia_faltante: evidenciaFaltante,
      ultima_actividad: typeof at === 'string' ? at : nowIso,
      metadata: { source: 'whatsapp', otIdRelacionado: m.otIdRelacionado, waId: m.id },
    };
    return { ...base, accion_sugerida: calcularAccion(base) };
  }

  if (source === 'correo') {
    const msg = raw || {};
    const at = msg.receivedAt || msg.date || msg.updatedAt || nowIso;
    const base = {
      id: `mail-${msg.id || msg.messageId || Math.random().toString(36).slice(2)}`,
      tipo: /** @type {EventoTipo} */ ('correo'),
      cliente: String(msg.cliente || msg.from || '—'),
      origen: 'correo',
      estado: 'nuevo',
      prioridad: /** @type {EventoPrioridad} */ ('media'),
      responsable: '—',
      tiempo_sin_gestion: hoursSince(at),
      riesgo_dinero: 0,
      accion_sugerida: String(msg.subject || msg.asunto || 'Revisar correo').slice(0, 240),
      requiere_accion: true,
      evidencia_faltante: false,
      ultima_actividad: typeof at === 'string' ? at : nowIso,
      metadata: { source: 'correo', messageId: msg.id },
    };
    return { ...base, accion_sugerida: calcularAccion(base) };
  }

  if (source === 'comercial') {
    const o = raw || {};
    const at = o.updatedAt || o.createdAt || nowIso;
    const base = {
      id: `opp-${o.id || Math.random().toString(36).slice(2)}`,
      tipo: /** @type {EventoTipo} */ ('comercial'),
      cliente: String(o.cliente || o.clienteNombre || '—'),
      origen: 'comercial',
      estado: 'en_proceso',
      prioridad: /** @type {EventoPrioridad} */ ('alta'),
      responsable: String(o.responsable || '—'),
      tiempo_sin_gestion: hoursSince(at),
      riesgo_dinero: Math.round(Number(o.valorEstimado || o.monto || 0) || 0),
      accion_sugerida: 'Gestionar oportunidad',
      requiere_accion: true,
      evidencia_faltante: false,
      ultima_actividad: typeof at === 'string' ? at : nowIso,
      metadata: { source: 'comercial', oppId: o.id },
    };
    return { ...base, accion_sugerida: calcularAccion(base) };
  }

  if (source === 'ot') {
    const ot = raw || {};
    const at = ot.updatedAt || ot.fecha || ot.createdAt || nowIso;
    const st = String(ot.estado || ot.status || '').toLowerCase();
    const cerrado = /cerrad|complet|factur/i.test(st);
    const base = {
      id: `ot-${ot.id || ot.numero || ot.codigo || Math.random().toString(36).slice(2)}`,
      tipo: /** @type {EventoTipo} */ ('ot'),
      cliente: String(ot.cliente || ot.clienteNombre || '—'),
      origen: 'erp',
      estado: cerrado ? 'cerrado' : 'en_proceso',
      prioridad: /** @type {EventoPrioridad} */ ('media'),
      responsable: String(ot.tecnico || ot.responsable || '—'),
      tiempo_sin_gestion: hoursSince(at),
      riesgo_dinero: Math.round(Number(ot.montoPendiente || ot.saldo || 0) || 0),
      accion_sugerida: cerrado ? 'Archivar' : 'Avanzar cierre OT',
      requiere_accion: !cerrado,
      evidencia_faltante: /pendiente|evidencia|sin informe/i.test(JSON.stringify(ot)),
      ultima_actividad: typeof at === 'string' ? at : nowIso,
      metadata: { source: 'ot', otId: ot.id },
    };
    return { ...base, accion_sugerida: calcularAccion(base) };
  }

  const base = {
    id: `man-${Date.now().toString(36)}`,
    tipo: /** @type {EventoTipo} */ ('documento'),
    cliente: '—',
    origen: String(source || 'manual'),
    estado: 'nuevo',
    prioridad: /** @type {EventoPrioridad} */ ('media'),
    responsable: '—',
    tiempo_sin_gestion: 0,
    riesgo_dinero: 0,
    accion_sugerida: 'Clasificar ingreso',
    requiere_accion: true,
    evidencia_faltante: false,
    ultima_actividad: nowIso,
    metadata: { source: source || 'manual', raw },
  };
  return { ...base, accion_sugerida: calcularAccion(base) };
}

/**
 * Motor de decisión por evento.
 * @param {EventoOperativo} evento
 * @returns {string}
 */
export function calcularAccion(evento) {
  if (evento.evidencia_faltante) return 'Subir evidencia';
  if (evento.tiempo_sin_gestion > 24) return 'Hacer seguimiento';
  if (evento.tipo === 'comercial') return 'Contactar cliente';
  if (evento.estado === 'bloqueado') return 'Resolver bloqueo';
  return evento.accion_sugerida || 'Revisar en flujo unificado';
}

/**
 * @param {object} viewData
 * @returns {EventoOperativo[]}
 */
export function buildFlujoOperativoUnificado(viewData) {
  const vd = viewData || {};
  const out = [];
  const seen = new Set();

  for (const ev of Array.isArray(vd.jarvisOperativeEvents) ? vd.jarvisOperativeEvents : []) {
    if (!ev?.id) continue;
    const e = normalizeToEvento(ev, 'jarvis_operativo');
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }

  for (const m of Array.isArray(vd.whatsappFeed?.messages) ? vd.whatsappFeed.messages : []) {
    const e = normalizeToEvento(m, 'whatsapp');
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }

  const msgs = Array.isArray(vd.outlookFeed?.messages) ? vd.outlookFeed.messages : [];
  for (const msg of msgs) {
    const e = normalizeToEvento(msg, 'correo');
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }

  for (const o of Array.isArray(vd.commercialOpportunities) ? vd.commercialOpportunities : []) {
    const e = normalizeToEvento(o, 'comercial');
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }

  const ots = Array.isArray(vd.planOts) ? vd.planOts : [];
  for (const ot of ots.slice(0, 40)) {
    const e = normalizeToEvento(ot, 'ot');
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
    }
  }

  out.sort((a, b) => {
    const pr = (PRIO_RANK[b.prioridad] || 0) - (PRIO_RANK[a.prioridad] || 0);
    if (pr !== 0) return pr;
    return b.tiempo_sin_gestion - a.tiempo_sin_gestion;
  });

  return out;
}

/**
 * @param {EventoOperativo[]} eventos
 */
export function aggregateMandoFromEventos(eventos) {
  const list = Array.isArray(eventos) ? eventos : [];
  const activos = list.filter((e) => e.estado !== 'cerrado');
  const bloqueados = activos.filter((e) => e.estado === 'bloqueado').length;
  const criticos = activos.filter((e) => e.prioridad === 'critica').length;
  const dinero = activos.reduce((s, e) => s + (Number(e.riesgo_dinero) || 0), 0);
  let estado_general = 'ok';
  if (criticos > 0 || bloqueados > 2) estado_general = 'critico';
  else if (bloqueados > 0 || criticos > 0) estado_general = 'atencion';
  else if (activos.some((e) => e.prioridad === 'alta')) estado_general = 'atencion';
  return {
    estado_general,
    dinero_en_riesgo: dinero,
    eventos_bloqueados: bloqueados,
    eventos_criticos: criticos,
    total_activos: activos.length,
  };
}

function navigateForEvento(e, { intelNavigate, navigateToView }) {
  if (!e) return;
  const meta = e.metadata || {};
  if (e.tipo === 'whatsapp' && meta.otIdRelacionado) {
    navigateToView?.('clima', { otId: meta.otIdRelacionado });
    return;
  }
  if (e.tipo === 'whatsapp') {
    intelNavigate?.({ view: 'jarvis' });
    return;
  }
  if (e.tipo === 'correo') {
    intelNavigate?.({ view: 'jarvis-intake' });
    return;
  }
  if (e.tipo === 'comercial') {
    navigateToView?.('oportunidades');
    return;
  }
  if (e.tipo === 'ot' && meta.otId != null) {
    navigateToView?.('clima', { otId: meta.otId });
    return;
  }
  if (e.tipo === 'ot') {
    navigateToView?.('clima');
    return;
  }
  intelNavigate?.({ view: 'jarvis' });
}

/**
 * Ejecuta la siguiente acción global sobre el evento más urgente.
 * @param {EventoOperativo[]} eventos
 * @param {{ intelNavigate?: Function, navigateToView?: Function }} nav
 */
export function ejecutarPropuestaGlobal(eventos, nav) {
  const ex = typeof document !== 'undefined' ? document.getElementById('hnf-ejecutar-propuesta-mando') : null;
  if (ex instanceof HTMLButtonElement && !ex.disabled) {
    ex.click();
    return;
  }
  const list = (Array.isArray(eventos) ? eventos : []).filter((e) => e.requiere_accion && e.estado !== 'cerrado');
  list.sort((a, b) => (PRIO_RANK[b.prioridad] || 0) - (PRIO_RANK[a.prioridad] || 0));
  const top = list[0];
  if (top) navigateForEvento(top, nav);
  else nav?.intelNavigate?.({ view: 'jarvis', focusMando: true });
}

export function fmtHorasSinGestion(h) {
  if (h < 1) return '<1 h';
  if (h < 24) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}

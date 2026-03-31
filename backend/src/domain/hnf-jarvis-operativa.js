/**
 * Jarvis operativo — espejo de frontend/domain/hnf-operativa-reglas.js (heurística v1).
 * Usado al persistir OT para historial trazable. Mantener umbrales alineados con HEURISTICA_OPERATIVA_V1 en frontend.
 */

const ESTADOS_INGRESO_KANBAN = new Set(['nueva', 'asignada', 'pendiente_validacion']);

const HEURISTICA_OPERATIVA_V1 = {
  diasRiesgoIngresoSinMovimiento: 5,
};

function diasDesdeIso(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (86400 * 1000);
}

export function etiquetaOrigenSolicitudParaUi(origenSolicitud, origenPedido) {
  const o = String(origenSolicitud || origenPedido || '')
    .trim()
    .toLowerCase();
  if (o === 'whatsapp') return 'WhatsApp';
  if (o === 'email' || o === 'correo') return 'Correo';
  return 'Manual';
}

export function operadorTitularAutomaticoPorTipoServicio(tipoServicio) {
  const t = String(tipoServicio || '').toLowerCase().trim();
  if (t === 'clima') return 'Romina';
  if (t === 'flota') return 'Gery';
  return null;
}

function jarvisHeuristicaPrioridadOperativa(o) {
  const motivos = [];
  const lyn0 = String(o.aprobacionLynEstado || '')
    .trim()
    .toLowerCase();
  if (lyn0 === 'observado_lyn') {
    motivos.push('aprobacionLynEstado:observado_lyn');
    return { nivel: 'alta', motivos };
  }

  const origen = String(o.origenSolicitud || o.origenPedido || '')
    .trim()
    .toLowerCase();
  let score = 0;
  if (origen === 'whatsapp') {
    score += 3;
    motivos.push('origen:whatsapp');
  } else if (origen === 'email' || origen === 'correo') {
    score += 1;
    motivos.push('origen:correo');
  } else {
    motivos.push('origen:manual');
  }

  const sub = String(o.subtipoServicio || '').toLowerCase();
  if (sub.includes('emergencia')) {
    score += 2;
    motivos.push('subtipo:emergencia');
  }

  const tipo = String(o.tipoServicio || '').toLowerCase();
  if (tipo === 'flota') {
    score += 1;
    motivos.push('tipo:flota');
  }

  if (Boolean(o.pendienteRespuestaCliente)) {
    score += 1;
    motivos.push('pendienteRespuestaCliente');
  }

  const est = String(o.estado || '')
    .trim()
    .toLowerCase();
  const dCreacion = diasDesdeIso(o.creadoEn || o.createdAt);
  if (dCreacion != null && ESTADOS_INGRESO_KANBAN.has(est) && dCreacion >= 3) {
    score += 2;
    motivos.push('ingreso≥3d');
  }

  const umbralR = HEURISTICA_OPERATIVA_V1.diasRiesgoIngresoSinMovimiento;
  if (dCreacion != null && ESTADOS_INGRESO_KANBAN.has(est) && dCreacion >= umbralR) {
    motivos.push('criterio:estancamiento_ingreso');
    return { nivel: 'alta', motivos };
  }

  const niv = score >= 4 ? 'alta' : score >= 2 ? 'media' : 'baja';
  return { nivel: niv, motivos };
}

/**
 * Líneas extra de historial al crear OT (origen, asignación titular Clima/Flota, prioridad heurística vs guardada).
 * @param {object} data — payload ya fusionado con id/timestamps mínimos
 */
export function buildJarvisOperativaHistorialAlta(data) {
  const origenLabel = etiquetaOrigenSolicitudParaUi(data.origenSolicitud, data.origenPedido);
  const lines = [
    {
      accion: 'jarvis_origen',
      detalle: `Origen registrado: ${origenLabel}`,
      actor: 'sistema',
    },
  ];

  const tit = operadorTitularAutomaticoPorTipoServicio(data.tipoServicio);
  if (tit) {
    lines.push({
      accion: 'jarvis_asignacion',
      detalle: `Asignación automática titular operativo: ${tit}`,
      actor: 'sistema',
    });
  } else {
    lines.push({
      accion: 'jarvis_asignacion',
      detalle: 'Sin asignación automática de titular (tipo distinto de Clima/Flota)',
      actor: 'sistema',
    });
  }

  const heur = jarvisHeuristicaPrioridadOperativa(data);
  const guardada = String(data.prioridadOperativa || 'media').toLowerCase();
  lines.push({
    accion: 'jarvis_prioridad',
    detalle: `Prioridad sugerida (heurística): ${heur.nivel} [${heur.motivos.join('; ')}] · valor guardado en OT: ${guardada}`,
    actor: 'sistema',
  });

  return lines;
}

/**
 * Modelo operativo HNF: orígenes, clasificación, flujo interno e informe.
 * Dominio puro — sin I/O. Persistencia en operationalEvent.repository.
 */

export const ORIGEN_EVENTO = {
  WHATSAPP_CLIENTE: 'whatsapp_cliente',
  WHATSAPP_INTERNO: 'whatsapp_interno',
  CORREO: 'correo',
  MANUAL: 'manual',
  SISTEMA: 'sistema',
};

export const TIPO_EVENTO_OPERATIVO = {
  SOLICITUD_CLIENTE: 'solicitud_cliente',
  REPORTE_LLEGADA_TIENDA: 'reporte_llegada_tienda',
  REPORTE_SALIDA_TIENDA: 'reporte_salida_tienda',
  EVIDENCIA_PENDIENTE: 'evidencia_pendiente',
  AUTORIZACION_REQUERIDA: 'autorizacion_requerida',
  INFORME_REVISION: 'informe_listo_para_revision',
  TRASLADO_SOLICITADO: 'traslado_solicitado',
  INCIDENCIA: 'incidencia',
  SEGUIMIENTO_COMERCIAL: 'seguimiento_comercial',
  PENDIENTE_INTERPRETAR: 'pendiente_interpretar',
};

export const ESTADO_FLUJO_OPERATIVO = {
  RECIBIDO: 'recibido',
  INTERPRETADO: 'interpretado',
  REGISTRADO: 'registrado',
  REVISION_ROMINA: 'en_revision_romina',
  REVISION_GERY: 'en_revision_gery',
  ESPERANDO_APROBACION: 'esperando_aprobacion',
  APROBADO: 'aprobado',
  OBSERVADO: 'observado',
  EN_EJECUCION: 'en_ejecucion',
  LISTO_CLIENTE: 'listo_para_cliente',
  CERRADO: 'cerrado',
};

const URGENCIA = ['baja', 'media', 'alta', 'critica'];

/**
 * Clasificación heurística por texto + contexto (sin LLM).
 * @param {{ text?: string, origen?: string, hints?: Record<string, unknown> }} input
 */
export function classifyOperationalEvent(input) {
  const text = String(input?.text || '').toLowerCase();
  const hints = input?.hints && typeof input.hints === 'object' ? input.hints : {};
  const origen = String(input?.origen || '');

  if (!text.trim() && !hints.forceTipo) {
    return {
      tipo_evento: TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR,
      subtipo: 'sin_texto',
      urgencia: 'media',
    };
  }

  if (/\b(autoriz|aprobación|aprobacion|ok\s*dir|visto\s*buen)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.AUTORIZACION_REQUERIDA, subtipo: 'autorizacion', urgencia: 'alta' };
  }
  if (/\b(llegu[eé]|en\s+tienda|llegada|ingreso\s+tienda)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.REPORTE_LLEGADA_TIENDA, subtipo: 'check_in', urgencia: 'baja' };
  }
  if (/\b(sal[ií]|egres[oé]|retir[oé]|fin\s+visita|cerramos\s+tienda)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.REPORTE_SALIDA_TIENDA, subtipo: 'check_out', urgencia: 'baja' };
  }
  if (/\b(evidencia|foto|pdf|adjunt|sin\s+foto|falta\s+evidencia)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.EVIDENCIA_PENDIENTE, subtipo: 'adjuntos', urgencia: 'media' };
  }
  if (/\b(informe|revisión\s+lyn|revisar\s+informe|listo\s+para\s+revis)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.INFORME_REVISION, subtipo: 'documento', urgencia: 'media' };
  }
  if (/\b(traslado|flota|ruta|veh[ií]culo|camioneta)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.TRASLADO_SOLICITADO, subtipo: 'movilidad', urgencia: 'media' };
  }
  if (/\b(incidente|falla|urgente|cr[ií]tico|no\s+funciona)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.INCIDENCIA, subtipo: 'operativa', urgencia: 'alta' };
  }
  if (/\b(cotiz|oportunidad|propuesta|comercial|seguimiento)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.SEGUIMIENTO_COMERCIAL, subtipo: 'pipeline', urgencia: 'baja' };
  }
  if (/\b(solicitud|pedido|necesitamos|requerimos|cliente\s+pide)\b/i.test(text)) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.SOLICITUD_CLIENTE, subtipo: 'entrada', urgencia: 'media' };
  }

  if (origen.includes('whatsapp')) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.SOLICITUD_CLIENTE, subtipo: 'whatsapp_generico', urgencia: 'media' };
  }
  if (origen === ORIGEN_EVENTO.CORREO) {
    return { tipo_evento: TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR, subtipo: 'correo_sin_clasificar', urgencia: 'media' };
  }

  return { tipo_evento: TIPO_EVENTO_OPERATIVO.PENDIENTE_INTERPRETAR, subtipo: 'generico', urgencia: 'media' };
}

export function normalizeUrgencia(u) {
  const s = String(u || '').toLowerCase();
  return URGENCIA.includes(s) ? s : 'media';
}

/**
 * @param {object} event - evento persistido completo
 */
export function buildInternalReportFromEvent(event) {
  const ev = event && typeof event === 'object' ? event : {};
  const audit = Array.isArray(ev.audit) ? ev.audit : [];
  const last = audit.length ? audit[audit.length - 1] : null;
  return {
    evento_id: ev.id,
    cliente: ev.cliente ?? null,
    sucursal: ev.sucursal ?? ev.tienda ?? null,
    ubicacion: ev.ubicacion ?? null,
    hora_entrada: ev.hora_entrada_tienda ?? null,
    hora_salida: ev.hora_salida_tienda ?? null,
    responsable: ev.responsable ?? ev.tecnico ?? null,
    resumen_operativo: ev.resumen_interpretado || ev.mensaje_original?.slice?.(0, 500) || null,
    evidencias: ev.evidencia_relacionada ?? [],
    estado_revision: ev.estado?.startsWith('en_revision') ? ev.estado : ev.etapa_revision ?? null,
    estado_aprobacion:
      ev.estado === ESTADO_FLUJO_OPERATIVO.ESPERANDO_APROBACION
        ? 'pendiente'
        : ev.estado === ESTADO_FLUJO_OPERATIVO.APROBADO
          ? 'aprobado'
          : ev.aprobado_por
            ? 'aprobado'
            : 'no_aplica',
    aprobado_por: ev.aprobado_por ?? null,
    ultimo_movimiento: last
      ? { en: last.at, actor: last.actor, accion: last.action, de: last.from_estado, a: last.to_estado }
      : null,
    generado_en: new Date().toISOString(),
  };
}

export function assertValidEstadoTransition(from, to) {
  const values = new Set(Object.values(ESTADO_FLUJO_OPERATIVO));
  if (!values.has(to)) return { ok: false, error: `estado destino inválido: ${to}` };
  if (from && !values.has(from)) return { ok: false, error: `estado origen inválido: ${from}` };
  return { ok: true };
}

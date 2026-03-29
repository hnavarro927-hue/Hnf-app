/**
 * Brief de ingreso: delega en el motor Jarvis v1 + textos legibles para la vista.
 */

import { briefToOtTrace, runJarvisIntakeClassification } from './jarvis-intake-engine.js';

/**
 * Arma contexto de coincidencias desde datos ya cargados en la app (sin API extra).
 * @param {object} data - viewData (clients, ots, planOts, vehicles)
 */
export function buildJarvisMatchContextFromViewData(data = {}) {
  const clientes = [];
  const rawClients = data?.clients?.data ?? data?.clients;
  if (Array.isArray(rawClients)) {
    for (const c of rawClients) {
      clientes.push({
        id: c.id ?? null,
        nombre: c.nombre || c.name || c.cliente,
        contacto: c.contacto,
        telefono: c.telefono,
        email: c.email,
      });
    }
  }
  const otsRaw = data?.planOts ?? data?.ots?.data ?? [];
  const otsMuestra = (Array.isArray(otsRaw) ? otsRaw : []).slice(0, 120).map((o) => ({
    cliente: o.cliente,
    telefonoContacto: o.telefonoContacto,
    id: o.id,
  }));
  const vehRaw = data?.vehicles?.data ?? data?.vehicles;
  const vehicles = Array.isArray(vehRaw) ? vehRaw : [];
  return { clientes, otsMuestra, vehicles };
}

/**
 * @param {object} opts
 * @param {object} opts.formLike
 * @param {object} [opts.matchContext] - resultado de buildJarvisMatchContextFromViewData
 */
export function buildIngresoJarvisBrief({ formLike = {}, matchContext = {} } = {}) {
  const descripcion = String(formLike.descripcion || '').trim();
  const observaciones = String(formLike.observaciones || '').trim();
  const brief = runJarvisIntakeClassification(
    {
      origen: formLike.origen,
      tipoServicio: formLike.tipo,
      tipo: formLike.tipo,
      cliente: formLike.cliente,
      contacto: formLike.contacto,
      telefono: formLike.telefono,
      emailCorreo: formLike.emailCorreo,
      whatsappNumero: formLike.whatsappNumero,
      comuna: formLike.comuna,
      direccion: formLike.direccion,
      descripcion,
      observaciones,
      filesMeta: Array.isArray(formLike.filesMeta) ? formLike.filesMeta : [],
      actorIngreso: formLike.actorIngreso || 'operador',
    },
    matchContext
  );

  const resumen = [
    brief.area_sugerida && `Área: ${brief.area_sugerida}`,
    `Destino sugerido: ${brief.bandeja_destino} → ${brief.notificacion_destino || '—'}`,
    `Confianza Jarvis: ${brief.confianza_jarvis}%`,
    brief.cliente_detectado?.match &&
      `Cliente: ${brief.cliente_detectado.match.replace(/_/g, ' ')}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const importante =
    brief.advertencias?.length ? brief.advertencias.join(' ') : 'Sin alertas críticas en este momento.';

  const recomendaciones = brief.accion_sugerida || '—';

  const faltantes = [];
  if (!String(formLike.cliente || '').trim()) faltantes.push('Nombre del cliente / empresa');
  if (!String(formLike.telefono || '').trim() && formLike.origen !== 'whatsapp') faltantes.push('Teléfono');
  if (formLike.origen === 'whatsapp' && (!String(formLike.whatsappNumero || '').trim() || !String(formLike.whatsappNombre || '').trim())) {
    faltantes.push('WhatsApp: número y nombre');
  }
  if (!String(formLike.comuna || '').trim()) faltantes.push('Comuna');
  if (!descripcion || descripcion.length < 8) faltantes.push('Descripción del pedido');

  const faltantesText = faltantes.length
    ? `Datos faltantes o incompletos: ${faltantes.join(', ')}.`
    : 'Sin faltantes críticos visibles.';

  return {
    resumen: resumen || 'Completá origen, cliente y tipo para ver el resumen de Jarvis.',
    importante,
    recomendaciones,
    faltantes: faltantesText,
    engineBrief: brief,
    duplicado_probable: brief.duplicado_probable,
    bandeja_destino: brief.bandeja_destino,
    confianza_jarvis: brief.confianza_jarvis,
  };
}

/**
 * Trazabilidad para adjuntar al POST de creación de OT.
 */
export function buildJarvisIntakeTraceForOt(formLike, matchContext, actor) {
  const b = buildIngresoJarvisBrief({
    formLike: { ...formLike, actorIngreso: actor },
    matchContext,
  }).engineBrief;
  return briefToOtTrace(b, { otId: null, actor });
}

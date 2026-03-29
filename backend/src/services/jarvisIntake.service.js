import {
  runJarvisIntakeClassification,
  flattenBriefForJarvisEvent,
  briefToOtTrace,
} from '../domain/jarvis-intake-engine.js';
import { jarvisOperativeEventsRepository } from '../repositories/jarvisOperativeEvents.repository.js';

/**
 * Clasificación sin persistir (validación servidor / otros clientes).
 */
export function classifyIntakeBody(body = {}, matchContext = {}) {
  const input = {
    origen: body.origen,
    tipoServicio: body.tipoServicio || body.tipo,
    tipo: body.tipo,
    cliente: body.cliente,
    contacto: body.contacto,
    telefono: body.telefono,
    emailCorreo: body.emailCorreo,
    whatsappNumero: body.whatsappNumero,
    comuna: body.comuna,
    direccion: body.direccion,
    descripcion: body.descripcion,
    observaciones: body.observaciones,
    filesMeta: body.filesMeta,
    actorIngreso: body.actorIngreso || 'api',
  };
  return runJarvisIntakeClassification(input, matchContext);
}

/**
 * Persiste evento operativo a partir del brief plano (POST manual).
 */
export async function appendJarvisIntakeEvent(body = {}) {
  const matchContext = {
    clientes: Array.isArray(body.clientesMuestra) ? body.clientesMuestra : [],
    otsMuestra: Array.isArray(body.otsMuestra) ? body.otsMuestra : [],
    vehicles: Array.isArray(body.vehiclesMuestra) ? body.vehiclesMuestra : [],
  };
  const brief =
    body.brief && typeof body.brief === 'object'
      ? body.brief
      : runJarvisIntakeClassification(
          {
            origen: body.origen,
            tipoServicio: body.tipoServicio || body.tipo,
            tipo: body.tipo,
            cliente: body.cliente,
            contacto: body.contacto,
            telefono: body.telefono,
            emailCorreo: body.emailCorreo,
            whatsappNumero: body.whatsappNumero,
            comuna: body.comuna,
            direccion: body.direccion,
            descripcion: body.descripcion,
            observaciones: body.observaciones,
            filesMeta: body.filesMeta,
            actorIngreso: body.actorIngreso || 'api',
          },
          matchContext
        );
  const flat = flattenBriefForJarvisEvent(brief, {
    estado_revision: body.estado_revision || 'pendiente_validacion',
    observacion_revision: body.observacion_revision,
    actor_revision: body.actor_revision,
    fuente: body.fuente || 'jarvis_intake_api',
    otRelacionada: body.otRelacionada,
  });
  return jarvisOperativeEventsRepository.append(flat);
}

/**
 * Tras crear OT: evento de línea de tiempo Jarvis (no bloquea si falla).
 */
export async function appendEventFromOtTrace(trace, { otId, actor }) {
  if (!trace || typeof trace !== 'object' || !trace.engineVersion) return null;
  const excerpt = [
    trace.cliente_detectado?.nombre,
    trace.contacto_detectado?.nombre,
    trace.accion_sugerida,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 2000);
  const ev = {
    rawExcerpt: excerpt || `OT ${otId} · ingesta Jarvis`,
    tipoClasificado: 'jarvis_intake_v1',
    prioridad: trace.prioridad_sugerida === 'alta' ? 'ALTO' : 'NORMAL',
    canalSalida: trace.origen_detectado || 'manual',
    accionInmediata: String(trace.accion_sugerida || '').slice(0, 2000),
    clienteDetectado: trace.cliente_detectado?.nombre || null,
    origen_detectado: trace.origen_detectado,
    area_sugerida: trace.area_sugerida,
    confianza_jarvis: trace.confianza_jarvis,
    contacto_detectado: trace.contacto_detectado?.nombre || null,
    duplicado_probable: Boolean(trace.duplicado_probable),
    bandeja_destino: trace.bandeja_destino,
    notificacion_destino: trace.notificacion_destino,
    estado_revision: 'aprobado_incorporado',
    observacion_revision: null,
    actor_revision: actor,
    otRelacionada: otId,
    jarvisTrace: trace.trace || [],
    advertencias: trace.advertencias || [],
    fuente: 'ot_alta',
  };
  return jarvisOperativeEventsRepository.append(ev);
}

export const jarvisIntakeService = {
  classifyIntakeBody,
  appendJarvisIntakeEvent,
  appendEventFromOtTrace,
  briefToOtTrace,
};

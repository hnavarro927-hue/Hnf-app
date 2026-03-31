/**
 * Pipeline operativo Jarvis: intake estructurado → validación → clasificación → OT real
 * → asignación Romina/Gery → trazabilidad (jarvisIntakeTrace vía otService.create).
 */
import { createRequire } from 'node:module';

import { otService } from './ot.service.js';

const require = createRequire(import.meta.url);
const { clasificarArea, detectarRiesgo, sugerirPrioridad } = require('../intake/jarvis-intake');

export const mapJarvisSourceToOrigenSolicitud = (source) => {
  const s = String(source ?? '')
    .trim()
    .toLowerCase();
  if (s === 'whatsapp') return 'whatsapp';
  if (s === 'email') return 'email';
  if (s === 'llamada') return 'llamada';
  return 'interno';
};

/**
 * @param {Record<string, unknown>} body - Payload HTTP (texto, cliente, source, …)
 * @param {string} actor - Actor HNF (sesión / legado)
 * @returns {Promise<{ ok: true, ot: object } | { ok: false, errors: string[] }>}
 */
export async function createRealOtFromJarvisIntakeBody(body, actor) {
  const texto = String(body?.texto ?? '').trim();
  const cliente = String(body?.cliente ?? '').trim();

  if (!texto) {
    return { ok: false, errors: ['El campo texto es obligatorio.'] };
  }
  if (!cliente) {
    return { ok: false, errors: ['El campo cliente es obligatorio.'] };
  }

  const area = clasificarArea(texto);
  const responsable = area === 'clima' ? 'Romina' : 'Gery';
  const prioridadSugerida = sugerirPrioridad(texto, cliente, area);
  const riesgoDetectado = detectarRiesgo(texto);

  console.log('JARVIS DECISION:', {
    area,
    responsable,
    cliente: body.cliente,
  });
  console.log('JARVIS PRIORIDAD:', { prioridadSugerida, riesgoDetectado });

  const origenSolicitud = mapJarvisSourceToOrigenSolicitud(body?.source);
  const origenPedido = String(body?.source ?? 'manual')
    .trim()
    .slice(0, 120);

  const tipoServicio = area === 'flota' ? 'flota' : 'clima';
  const tecnicoAsignado = responsable;

  const now = new Date();
  const fecha = now.toISOString().slice(0, 10);
  const hora = now.toTimeString().slice(0, 5);
  const prioridadOperativa = prioridadSugerida;

  const payload = {
    cliente,
    direccion: String(body?.direccion ?? '').trim() || 'Por definir',
    comuna: String(body?.comuna ?? '').trim() || 'Sin comuna',
    contactoTerreno: String(body?.contactoTerreno ?? '').trim() || cliente || 'Contacto',
    telefonoContacto: String(body?.telefonoContacto ?? '').trim() || '0',
    tipoServicio,
    subtipoServicio: String(body?.subtipoServicio ?? '').trim() || 'Ingreso Jarvis',
    origenSolicitud,
    origenPedido: origenPedido || 'manual',
    prioridadOperativa,
    prioridadSugerida,
    riesgoDetectado,
    tecnicoAsignado,
    estadoCoreOverride: 'pendiente',
    fecha,
    hora,
    observaciones: texto,
    operationMode: 'manual',
  };

  if (origenSolicitud === 'whatsapp') {
    payload.whatsappContactoNumero =
      String(body?.whatsappContactoNumero ?? '').trim() || '0000000000';
    payload.whatsappContactoNombre =
      String(body?.whatsappContactoNombre ?? '').trim() || cliente || 'Contacto';
  }

  const item = await otService.create(payload, actor);
  if (item.errors) {
    return { ok: false, errors: item.errors };
  }
  return { ok: true, ot: item };
}

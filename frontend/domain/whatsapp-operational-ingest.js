/**
 * WhatsApp → ingesta operativa estructurada (sin UI de chat).
 * Jarvis/heurísticas: tipo de caso, urgencia y acción sugerida.
 */

import { detectClienteFromText } from './jarvis-active-intake-engine.js';

export const CASO_TIPOS = ['ot', 'consulta', 'cierre', 'problema'];
export const URGENCIAS = ['alta', 'media', 'baja'];

/**
 * @param {object} m - mensaje del feed WhatsApp
 */
export function getWhatsappInterpretedText(m) {
  const raw = m?.rawOriginal;
  const body = typeof raw?.body === 'string' ? raw.body : '';
  const desc = String(m?.descripcion || m?.observaciones || '').trim();
  const t = body.trim() || desc;
  return t.slice(0, 2000);
}

/**
 * @param {object} m
 * @returns {{ casoTipo: string, urgencia: string, accionSugerida: string, textoInterpretado: string, clienteDetectado: string }}
 */
export function classifyWhatsappOperative(m) {
  const textoInterpretado = getWhatsappInterpretedText(m);
  const lower = textoInterpretado.toLowerCase();
  const fromField = String(m?.cliente || m?.parsedData?.cliente || '').trim();
  const clienteDetectado =
    fromField || detectClienteFromText(textoInterpretado) || '';

  let casoTipo = /** @type {typeof CASO_TIPOS[number]} */ ('consulta');
  if (
    /\bot\b|orden de trabajo|orden trabajo|ot[\s#:_-]*\d|visita técnica|mantención programada|ruta técn/i.test(
      lower
    )
  ) {
    casoTipo = 'ot';
  } else if (/cierre|cerrar\s*ot|informe final|listo para cerrar|cerramos|cerrada la visita/i.test(lower)) {
    casoTipo = 'cierre';
  } else if (
    /no enfrí|no calient|falla|urgencia|parada|emergencia|reclamo|no funciona|temperatura incorrecta/i.test(
      lower
    )
  ) {
    casoTipo = 'problema';
  }

  let urgencia = /** @type {typeof URGENCIAS[number]} */ ('media');
  if (/urgente|emergencia|parada|crític|critico|inmediat|ya mismo|hoy sí o sí/i.test(lower)) {
    urgencia = 'alta';
  } else if (/sin apuro|cuando puedan|no es urgente|a la brevedad sin/i.test(lower)) {
    urgencia = 'baja';
  }

  const acciones = {
    ot: 'Revisar en Clima: crear o vincular OT y asignar técnico.',
    consulta: 'Responder al cliente o derivar; registrar en sistema si genera trabajo.',
    cierre: 'Validar evidencias y cierre de OT en Clima.',
    problema: 'Priorizar diagnóstico o visita; documentar en OT.',
  };
  const accionSugerida = acciones[casoTipo] || acciones.consulta;

  return {
    casoTipo,
    urgencia,
    accionSugerida,
    textoInterpretado: textoInterpretado.slice(0, 900),
    clienteDetectado,
  };
}

/**
 * Estados de negocio en panel ingreso (alineado a Romina/Gery).
 * @param {string} estadoWa
 */
export function mapWhatsappEstadoToIngreso(estadoWa) {
  const s = String(estadoWa || '').toLowerCase();
  if (/cerrad|resuel|complet|terminad|facturad/.test(s)) return 'completo';
  if (/proceso|asign|visita|curso/.test(s)) return 'en_proceso';
  return 'pendiente';
}

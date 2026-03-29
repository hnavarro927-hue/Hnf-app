/**
 * Flujo modular OT · Clima (solo frontend).
 * Etapas fijas, validación para avanzar, textos operativos no técnicos.
 */

import { getEvidenceGaps, getQualityCloseGaps, otHasResponsible } from '../utils/ot-evidence.js';
import { buildOtOperationalBrief } from './operational-intelligence.js';

export const CLIMA_OT_FLOW_STAGES = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'clasificacion', label: 'Clasificación' },
  { id: 'asignacion', label: 'Asignación' },
  { id: 'ejecucion', label: 'Ejecución' },
  { id: 'informe', label: 'Informe' },
  { id: 'cierre', label: 'Cierre' },
];

export const detailStageStorageKey = (otId) => `hnf-clima-ot-flow-detail:${otId}`;

export const createFlowStorageKey = () => 'hnf-clima-ot-flow-create';

export function readStoredStageIndex(key, maxIdx) {
  try {
    const raw = sessionStorage.getItem(key);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= maxIdx) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

export function writeStoredStageIndex(key, idx) {
  try {
    sessionStorage.setItem(key, String(idx));
  } catch {
    /* ignore */
  }
}

const hasText = (v) => String(v ?? '').trim().length > 0;

/** Validación para avanzar desde la etapa `stageIndex` (0..5). */
export function validateDetailStageAdvance(ot, stageIndex, { economicsSaved = false } = {}) {
  if (!ot) return { ok: false, message: 'No hay orden seleccionada.' };

  if (stageIndex === 0) {
    if (!hasText(ot.cliente)) return { ok: false, message: 'Indicá el cliente antes de continuar.' };
    if (!hasText(ot.direccion)) return { ok: false, message: 'Falta la dirección del sitio.' };
    if (!hasText(ot.comuna)) return { ok: false, message: 'Falta la comuna.' };
    if (!hasText(ot.contactoTerreno)) return { ok: false, message: 'Falta el contacto en terreno.' };
    if (!hasText(ot.telefonoContacto)) return { ok: false, message: 'Falta un teléfono de contacto.' };
    return { ok: true, message: '' };
  }

  if (stageIndex === 1) {
    if (!hasText(ot.subtipoServicio)) return { ok: false, message: 'Definí el subtipo de servicio (qué se hace).' };
    const origen = String(ot.origenSolicitud || ot.origenPedido || '').trim();
    if (!origen) return { ok: false, message: 'Falta el origen del pedido o solicitud.' };
    return { ok: true, message: '' };
  }

  if (stageIndex === 2) {
    if (!otHasResponsible(ot)) {
      return {
        ok: false,
        message: 'Asigná un técnico (o escribí el nombre) antes de pasar a ejecución.',
      };
    }
    return { ok: true, message: '' };
  }

  if (stageIndex === 3) {
    if (!hasText(ot.resumenTrabajo)) {
      return { ok: false, message: 'Escribí un resumen corto de lo realizado en terreno.' };
    }
    const ev = getEvidenceGaps(ot);
    if (ev.length) {
      return {
        ok: false,
        message:
          'Faltan fotos obligatorias (antes / durante / después) en algún equipo o en la visita. Completá la evidencia para seguir.',
      };
    }
    return { ok: true, message: '' };
  }

  if (stageIndex === 4) {
    const q = getQualityCloseGaps(ot);
    if (q.length) {
      return {
        ok: false,
        message: q.map((x) => x.text).join(' '),
      };
    }
    const brief = buildOtOperationalBrief(ot, { economicsSaved });
    if (brief.blockers.length) {
      return {
        ok: false,
        message: brief.blockers.map((b) => b.detail).join(' '),
      };
    }
    return { ok: true, message: '' };
  }

  return { ok: true, message: '' };
}

/** Líneas Jarvis por etapa (copiloto contextual). */
export function jarvisLinesForDetailStage(ot, stageIndex, { economicsSaved = false } = {}) {
  if (!ot) return ['Elegí una OT del listado para ver sugerencias.'];
  const lines = [];
  const brief = buildOtOperationalBrief(ot, { economicsSaved });
  switch (stageIndex) {
    case 0:
      lines.push('Verificá que cliente y contacto coincidan con quien recibe al técnico.');
      if (!hasText(ot.direccion)) lines.push('La dirección completa evita demoras en ruta.');
      break;
    case 1:
      lines.push('El origen y el tipo de servicio definen la bandeja y el seguimiento interno.');
      if (!hasText(ot.subtipoServicio)) lines.push('Un subtipo claro ayuda al técnico a preparar herramientas.');
      break;
    case 2:
      if (!otHasResponsible(ot)) lines.push('Siguiente paso sugerido: elegir técnico y guardar.');
      else lines.push('Actualizá el estado si la visita ya está confirmada o en marcha.');
      break;
    case 3: {
      const ev = getEvidenceGaps(ot);
      if (ev.length) lines.push('Faltan fotos: revisá cada equipo y los bloques antes / durante / después.');
      else lines.push('Evidencia completa. Revisá equipos y textos antes del informe.');
      if (!(ot.equipos?.length > 0)) lines.push('Registrá al menos un equipo si hubo intervención en máquinas.');
      break;
    }
    case 4:
      if (!ot.pdfUrl) lines.push('Acción sugerida: generar PDF de borrador para revisión interna.');
      if (brief.blockers.length) lines.push('Aún hay requisitos pendientes en el checklist operativo.');
      else lines.push('Listo para revisar el informe y pasar a cierre.');
      break;
    case 5:
      lines.push('El cierre bloquea si faltan evidencias, textos, economía guardada o responsable.');
      break;
    default:
      lines.push('Seguí el orden de etapas para no omitir datos críticos.');
  }
  return lines.slice(0, 4);
}

export function nextActionHintForDetailStage(ot, stageIndex) {
  const labels = ['Revisá datos de contacto', 'Confirmá clasificación', 'Guardá asignación', 'Cargá ejecución y fotos', 'Revisá informe y PDF', 'Cerrá la OT si todo está listo'];
  return labels[stageIndex] || 'Continuá';
}

/** --- Alta OT (crear) por etapas --- */

export function validateCreateStageAdvance(formRoot, eqContainer, stageIndex) {
  const q = (name) => formRoot?.elements?.[name]?.value?.trim?.() ?? '';

  if (stageIndex === 0) {
    if (!q('cliente')) return { ok: false, message: 'El cliente es obligatorio.' };
    if (!q('direccion')) return { ok: false, message: 'La dirección es obligatoria.' };
    if (!q('comuna')) return { ok: false, message: 'La comuna es obligatoria.' };
    if (!q('contactoTerreno')) return { ok: false, message: 'El contacto en terreno es obligatorio.' };
    if (!q('telefonoContacto')) return { ok: false, message: 'El teléfono es obligatorio.' };
    return { ok: true, message: '' };
  }

  if (stageIndex === 1) {
    if (!q('tipoServicio')) return { ok: false, message: 'Elegí el tipo de servicio.' };
    if (!q('subtipoServicio')) return { ok: false, message: 'Indicá el subtipo de servicio.' };
    if (!q('fecha') || !q('hora')) return { ok: false, message: 'Fecha y hora son obligatorias.' };
    const origen = q('origenSolicitudCreate');
    if (!origen) return { ok: false, message: 'Elegí el origen de la solicitud.' };
    if (origen === 'whatsapp') {
      const waNum = formRoot?.elements?.whatsappNumeroCreate?.value?.trim?.() ?? '';
      const waNom = formRoot?.elements?.whatsappNombreCreate?.value?.trim?.() ?? '';
      if (!waNum || !waNom) {
        return { ok: false, message: 'Con origen WhatsApp, número y nombre de contacto son obligatorios.' };
      }
    }
    return { ok: true, message: '' };
  }

  if (stageIndex === 2) {
    return { ok: true, message: '' };
  }

  if (stageIndex === 3) {
    return { ok: true, message: '' };
  }

  if (stageIndex === 4) {
    return { ok: true, message: '' };
  }

  return { ok: true, message: '' };
}

export function jarvisLinesForCreateStage(stageIndex) {
  const map = [
    ['Los datos de contacto son la base de la visita.', 'Usá nombre comercial y persona que recibe al técnico.'],
    ['Tipo y subtipo definen la bandeja (Clima / Flota) y la prioridad operativa.', 'Si el origen es WhatsApp, registrá número y nombre.'],
    ['Modo automático permite sugerencias; modo manual deja el control en el equipo.', 'Elegí técnico o dejá «Por asignar» si aún no está definido.'],
    ['Podés dejar textos en blanco y completarlos después en la OT.', 'Un resumen temprano ayuda a planificar.'],
    ['Agregá equipos ahora o más tarde desde el detalle de la OT.', 'Cada equipo puede llevar sus propias fotos.'],
    ['Revisá el resumen y tocá «Crear OT» para registrar la visita.'],
  ];
  return map[stageIndex] || map[0];
}

/**
 * Capa de inteligencia operativa del copiloto: riesgos, huecos de proceso, sugerencias.
 */

import {
  computeCopilotOperationalTrace,
  describeProcessGap,
} from './jarvis-copilot-trace.js';
import { HNF_PROCESS_RULES } from './jarvis-copilot-knowledge.js';

function cardByOtId(cards, otId) {
  const id = String(otId || '').trim();
  if (!id) return null;
  for (const c of Array.isArray(cards) ? cards : []) {
    if (String(c?.otId || '').trim() === id) return c;
  }
  return null;
}

function tecnicoSinAsignar(ot) {
  const t = String(ot?.tecnicoAsignado || '').trim();
  if (!t) return true;
  const l = t.toLowerCase();
  return l === 'sin asignar' || l === 'por asignar';
}

function otUrgenteHeuristic(ot, cards) {
  const ctrl = cardByOtId(cards, ot?.id);
  if (ctrl?.global === 'rojo') return true;
  const blob = `${ot?.observaciones || ''} ${ot?.resumenTrabajo || ''}`.toLowerCase();
  if (/\burgent|urgencia|crític|critico|prioridad\s*:\s*urgente|prioridad\s*alta\b/.test(blob)) {
    return true;
  }
  const p = String(ot?.prioridad || ot?.prioridadServicio || '').toLowerCase();
  if (p && /alta|urgente|crit|critic/.test(p)) return true;
  return false;
}

function clientesConMultiplesAbiertas(abiertas) {
  const m = new Map();
  for (const o of abiertas) {
    const c = String(o?.cliente || '').trim();
    if (!c) continue;
    m.set(c, (m.get(c) || 0) + 1);
  }
  return [...m.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name, count: n }));
}

function sugerirTecnicoPorComuna(otObjetivo, abiertas) {
  const com = String(otObjetivo?.comuna || '')
    .trim()
    .toLowerCase();
  if (!com) return null;
  for (const o of abiertas) {
    if (o === otObjetivo) continue;
    const c2 = String(o?.comuna || '')
      .trim()
      .toLowerCase();
    if (c2 !== com) continue;
    if (tecnicoSinAsignar(o)) continue;
    return String(o.tecnicoAsignado).trim();
  }
  return null;
}

/**
 * @param {object} params
 * @param {string} params.intent
 * @param {object[]} params.abiertas
 * @param {object[]} params.cards
 * @param {object[]} [params.focusOts] OT destacadas en la respuesta (lista del comando)
 */
export function buildCopilotIntelligence({ intent, abiertas, cards, focusOts = [] }) {
  let accionSugerida = null;
  let mejoraSugerida = null;
  const riesgos = [];

  const sinTec = abiertas.filter(tecnicoSinAsignar);
  const urg = abiertas.filter((o) => otUrgenteHeuristic(o, cards));
  const urgSinTec = urg.filter(tecnicoSinAsignar);
  const multiCliente = clientesConMultiplesAbiertas(abiertas);

  const sampleOt = focusOts[0] || urg[0] || sinTec[0] || abiertas[0];
  if (sampleOt) {
    const ctrl = cardByOtId(cards, sampleOt.id);
    const trace = computeCopilotOperationalTrace(sampleOt, ctrl);
    const gap = describeProcessGap(sampleOt, trace);
    if (gap) riesgos.push(gap);
  }

  if (multiCliente.length) {
    const { name, count } = multiCliente[0];
    riesgos.push(`El cliente «${name}» ya tiene ${count} OT abiertas; puede haber incidencias similares o visitas duplicadas.`);
  }

  if (intent === 'resumen') {
    if (urgSinTec.length) {
      accionSugerida = `Hay ${urgSinTec.length} OT urgentes sin técnico: abrí Clima y asigná responsable antes de coordinar visita.`;
    } else if (sinTec.length) {
      accionSugerida = `Tenés ${sinTec.length} OT sin técnico; asigná en Clima para no frenar ejecución e informe.`;
    } else if (urg.length) {
      accionSugerida = `Revisá las urgentes en panel en vivo y validá fecha de visita con el cliente.`;
    }
    if (sampleOt && sinTec.includes(sampleOt)) {
      const sug = sugerirTecnicoPorComuna(sampleOt, abiertas);
      if (sug) {
        accionSugerida = `${accionSugerida ? `${accionSugerida} ` : ''}En la misma comuna hay otro caso con ${sug}; conviene valorar técnico de zona o ruta compartida.`.trim();
      }
    }
    mejoraSugerida = `${HNF_PROCESS_RULES.emergenciasPrioridad.texto} Activá reglas automáticas en Ingreso para emergencias recurrentes en clientes críticos.`;
  }

  if (intent === 'urgentes') {
    if (focusOts.length) {
      const o = focusOts[0];
      const ctrl = cardByOtId(cards, o.id);
      const trace = computeCopilotOperationalTrace(o, ctrl);
      const g = describeProcessGap(o, trace);
      if (g) riesgos.push(g);
      if (tecnicoSinAsignar(o)) {
        accionSugerida = `Priorizá asignación en OT ${o.id} (${String(o.cliente || '').trim() || 'cliente'}). Recomiendo dejar esta OT en prioridad alta hasta asignar.`;
        const sug = sugerirTecnicoPorComuna(o, abiertas);
        if (sug) accionSugerida += ` Podés probar con ${sug} si cubre la zona.`;
      } else {
        accionSugerida = `Seguí la OT ${o.id} en Clima: evidencia antes de informe y cierre.`;
      }
    }
    mejoraSugerida = HNF_PROCESS_RULES.evidenciaAntesCierre.texto;
  }

  if (intent === 'sin_asignar') {
    if (focusOts[0]) {
      const o = focusOts[0];
      const sug = sugerirTecnicoPorComuna(o, abiertas);
      if (sug) {
        accionSugerida = `Conviene asignar técnico de zona: en la misma comuna ya trabaja ${sug} en otra OT abierta.`;
      } else {
        accionSugerida = `Asigná técnico desde Clima; si es flota, coordiná con Gery para ventana de visita.`;
      }
    }
    mejoraSugerida = HNF_PROCESS_RULES.asignacionAntesEjecucion.texto;
  }

  if (intent === 'pendientes') {
    accionSugerida =
      focusOts.length > 0
        ? `Completá fotos y resumen en OT ${focusOts[0].id}; después generá el PDF en Clima.`
        : `Revisá evidencias y resumen antes de informe al cliente.`;
    mejoraSugerida =
      'Estandarizar checklist de evidencias en terreno para no retrasar cierre e informe al cliente.';
  }

  if (intent === 'empty' || intent === 'help') {
    mejoraSugerida =
      'Más adelante Jarvis combinará datos en vivo, reglas de proceso y documentación interna en una sola respuesta.';
  }

  const riesgoTexto = riesgos.length ? riesgos.slice(0, 2).join(' ') : null;

  return {
    accionSugerida,
    mejoraSugerida,
    riesgos,
    riesgoTexto,
    layersUsed: ['structured', 'process'],
  };
}

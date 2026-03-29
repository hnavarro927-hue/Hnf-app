/**
 * Panel persistente "Jarvis operativo" — contextual por vista (solo presentación).
 */

import { formatAllCloseBlockersMessage, getEvidenceGaps, otCanClose } from '../utils/ot-evidence.js';
import { computeCommandCenterMetrics } from '../domain/hnf-command-center-metrics.js';
import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';

const viewLabels = {
  jarvis: 'Portada de mando',
  'ingreso-operativo': 'Ingreso operativo',
  'bandeja-canal': 'Bandeja canal',
  clima: 'Clima · OT',
  flota: 'Flota',
  oportunidades: 'Comercial',
  planificacion: 'Planificación',
  'control-gerencial': 'Control gerencial',
  'hnf-core': 'Clientes HNF Core',
  finanzas: 'Finanzas',
  equipo: 'Equipo',
  'documentos-tecnicos': 'Documentos técnicos',
};

function formatSync(iso) {
  if (!iso) return 'Sin sincronización aún';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

function findOt(data, id) {
  if (!id) return null;
  const list = data?.planOts ?? data?.ots?.data ?? [];
  if (!Array.isArray(list)) return null;
  return list.find((o) => o.id === id) || null;
}

/**
 * @param {HTMLElement} rail
 * @param {object} ctx
 */
export function mountHnfJarvisOperationalRail(rail, ctx = {}) {
  if (!rail) return;
  rail.textContent = '';
  rail.className = 'hnf-jarvis-operational-rail';

  const {
    activeView = 'jarvis',
    data = {},
    integrationStatus = 'pendiente',
    lastDataRefreshAt = null,
    navigateToView,
    selectedOTId = null,
  } = ctx;

  const adn = buildHnfAdnSnapshot(data);
  const metrics = computeCommandCenterMetrics(data, { hnfAdn: adn });

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-rail__head';
  const brand = document.createElement('div');
  brand.className = 'hnf-jarvis-rail__brand';
  brand.innerHTML = '<span class="hnf-jarvis-rail__mark">J</span><div><strong>Jarvis operativo</strong><span class="hnf-jarvis-rail__view">' + (viewLabels[activeView] || 'Sistema') + '</span></div>';
  const pulse = document.createElement('div');
  pulse.className = 'hnf-jarvis-rail__pulse';
  pulse.innerHTML =
    '<span class="hnf-jarvis-rail__pulse-dot"></span><span>IA activa · monitoreando datos de sesión</span>';
  head.append(brand, pulse);

  const sync = document.createElement('p');
  sync.className = 'hnf-jarvis-rail__sync muted';
  sync.textContent = `Última sincronización: ${formatSync(lastDataRefreshAt)} · ${integrationStatus === 'conectado' ? 'En línea' : integrationStatus === 'sin conexión' ? 'Sin conexión' : 'Estado: ' + integrationStatus}`;

  const block = (title) => {
    const s = document.createElement('section');
    s.className = 'hnf-jarvis-rail__block';
    const h = document.createElement('h3');
    h.className = 'hnf-jarvis-rail__block-title';
    h.textContent = title;
    s.append(h);
    return s;
  };

  const resumen = block('Resumen contextual');
  const p1 = document.createElement('p');
  p1.className = 'hnf-jarvis-rail__p';
  p1.textContent = `OT activas: ${metrics.otActivas}. Riesgo / atraso señalado: ${metrics.otEnRiesgo}. Sin evidencia completa: ${metrics.otSinEvidenciaCompleta}.`;
  resumen.append(p1);

  const ot = activeView === 'clima' ? findOt(data, selectedOTId) : null;
  if (ot) {
    const pOt = document.createElement('p');
    pOt.className = 'hnf-jarvis-rail__p hnf-jarvis-rail__p--ot';
    const gaps = getEvidenceGaps(ot);
    pOt.innerHTML = `<strong>${ot.id}</strong> · ${ot.cliente || '—'}<br/><span class="muted small">${ot.estado || '—'} · ${gaps.length ? gaps.length + ' hueco(s) evidencia' : 'Evidencia OK'}</span>`;
    resumen.append(pOt);
    if (!otCanClose(ot)) {
      const warn = document.createElement('p');
      warn.className = 'hnf-jarvis-rail__warn';
      warn.textContent = formatAllCloseBlockersMessage(ot).slice(0, 220) + (formatAllCloseBlockersMessage(ot).length > 220 ? '…' : '');
      resumen.append(warn);
    }
  }

  const prioridad = block('Prioridad sugerida');
  const p2 = document.createElement('p');
  p2.className = 'hnf-jarvis-rail__p';
  if (metrics.otSinEvidenciaCompleta > 0) {
    p2.textContent = 'Completar evidencia fotográfica en OT abiertas antes de avanzar a informe.';
  } else if (metrics.otEnRiesgo > 0) {
    p2.textContent = 'Revisar OT en riesgo o atrasadas y reasignar técnico o fecha.';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    p2.textContent = `${metrics.solicitudesNuevasHoy} solicitud(es) flota nuevas hoy · abrir Flota.`;
  } else {
    p2.textContent = 'Operación estable. Revisá portada para alertas ejecutivas.';
  }
  prioridad.append(p2);

  const riesgo = block('Riesgo detectado');
  const pR = document.createElement('p');
  pR.className = 'hnf-jarvis-rail__p';
  if (metrics.otEnRiesgo > 0) {
    pR.textContent = `${metrics.otEnRiesgo} OT con señal de atraso o criticidad. Priorizar revisión en Clima.`;
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    pR.textContent = 'Evidencia incompleta en órdenes abiertas: riesgo de retrabajo o rechazo al cierre.';
  } else {
    pR.textContent = 'Sin riesgo operativo destacado en este corte de datos.';
  }
  riesgo.append(pR);

  const flujo = block('Estado del flujo');
  const pF = document.createElement('p');
  pF.className = 'hnf-jarvis-rail__p';
  pF.textContent = `Activas ${metrics.otActivas} · Pipeline flota ${metrics.flotaPipelineAbiertas} · Alertas ${metrics.alertasOperativas}.`;
  flujo.append(pF);

  const recordatorio = block('Datos / cierre');
  const pM = document.createElement('p');
  pM.className = 'hnf-jarvis-rail__p';
  if (ot) {
    const gaps = getEvidenceGaps(ot);
    const blockMsg = formatAllCloseBlockersMessage(ot);
    if (!otCanClose(ot)) {
      pM.textContent = blockMsg.slice(0, 260) + (blockMsg.length > 260 ? '…' : '');
    } else if (gaps.length) {
      pM.textContent = 'Completá evidencia antes de informar al cliente.';
    } else {
      pM.textContent = 'Esta OT cumple requisitos base para avanzar a informe o cierre.';
    }
  } else if (activeView === 'clima') {
    pM.textContent = 'Seleccioná una OT en la lista para ver bloqueos y recordatorios aquí.';
  } else {
    pM.textContent = 'En Clima, Jarvis muestra bloqueos de cierre y huecos de evidencia por OT.';
  }
  recordatorio.append(pM);

  const siguiente = block('Siguiente acción sugerida');
  const pS = document.createElement('p');
  pS.className = 'hnf-jarvis-rail__p hnf-jarvis-rail__p--action';
  if (ot && !otCanClose(ot)) {
    pS.textContent = 'Completá requisitos de cierre en la OT seleccionada o derivá a técnico.';
  } else if (metrics.otSinEvidenciaCompleta > 0) {
    pS.textContent = 'Abrir Clima y cargar fotos antes / durante / después donde falten.';
  } else if (metrics.solicitudesNuevasHoy > 0) {
    pS.textContent = 'Revisar solicitudes nuevas del día en Flota.';
  } else {
    pS.textContent = 'Revisar portada y alertas ejecutivas; operación estable en el corte actual.';
  }
  siguiente.append(pS);

  const acciones = block('Acción rápida');
  const row = document.createElement('div');
  row.className = 'hnf-jarvis-rail__actions';
  const mk = (label, view) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-jarvis-rail__action-btn';
    b.textContent = label;
    b.addEventListener('click', () => navigateToView?.(view));
    return b;
  };
  row.append(mk('Portada', 'jarvis'), mk('Clima', 'clima'), mk('Ingreso', 'ingreso-operativo'));
  acciones.append(row);

  rail.append(head, sync, resumen, prioridad, riesgo, flujo, recordatorio, siguiente, acciones);
}

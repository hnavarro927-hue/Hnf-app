import {
  etiquetaOrigenSolicitudOperativa,
  operadorTitularAutomaticoPorTipoServicio,
} from '../domain/hnf-operativa-reglas.js';

function el(className, tag = 'div') {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function humanOrigenDetectado(traceVal, ot) {
  const d = String(traceVal ?? '').trim();
  if (d) {
    const x = d.toLowerCase();
    if (x === 'whatsapp') return 'WhatsApp';
    if (x === 'correo' || x === 'email') return 'Correo';
    if (x === 'telefono' || x === 'llamada') return 'Teléfono';
    if (x === 'manual') return 'Manual';
    return d;
  }
  const raw = String(ot?.origenSolicitud || ot?.origenPedido || '').trim();
  if (!raw) return 'sin dato';
  return etiquetaOrigenSolicitudOperativa(ot.origenSolicitud, ot.origenPedido);
}

function fmtArea(ot) {
  const ts = String(ot?.tipoServicio ?? '').trim();
  if (ts) return ts.charAt(0).toUpperCase() + ts.slice(1).toLowerCase();
  const a = String(ot?.jarvisIntakeTrace?.area_sugerida ?? '').trim();
  return a || 'sin dato';
}

function fmtPrioridadOperativa(ot) {
  const p = String(ot?.prioridadOperativa ?? '').trim().toLowerCase();
  if (!p) return 'sin dato';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function fmtRiesgo(ot) {
  if (ot?.riesgoDetectado === true) return 'Sí';
  if (ot?.riesgoDetectado === false) return 'No';
  return 'sin dato';
}

function fmtAccion(ot) {
  const a = String(ot?.jarvisIntakeTrace?.accion_sugerida ?? '').trim();
  return a || 'sin dato';
}

function fmtResponsableTitular(ot) {
  if (!ot || typeof ot !== 'object') return 'sin dato';
  const tit = operadorTitularAutomaticoPorTipoServicio(ot.tipoServicio);
  if (tit) return tit;
  const tech = String(ot.tecnicoAsignado ?? '').trim();
  if (tech && tech.toLowerCase() !== 'por asignar') return tech;
  const r = String(ot.responsableActual ?? '').trim();
  if (r && r.toLowerCase() !== 'por asignar') return r;
  return 'sin dato';
}

/**
 * Núcleo visual (centro): área, prioridadOperativa, riesgoDetectado, acción sugerida (trace).
 */
function buildJarvisCoreInner(ot) {
  const wrap = el('hnf-cc__jarvis-core');
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', 'Jarvis núcleo operativo');

  const ring = el('hnf-cc__jarvis-core__ring');
  const inner = el('hnf-cc__jarvis-core__inner');

  const rows = [
    ['Área', ot ? fmtArea(ot) : 'sin dato'],
    ['Prioridad operativa', ot ? fmtPrioridadOperativa(ot) : 'sin dato'],
    ['Riesgo detectado', ot ? fmtRiesgo(ot) : 'sin dato'],
    ['Acción sugerida', ot ? fmtAccion(ot) : 'sin dato'],
  ];

  for (const [k, v] of rows) {
    const row = el('hnf-cc__jarvis-core__row');
    const kk = el('hnf-cc__jarvis-core__k');
    kk.textContent = k;
    const vv = el('hnf-cc__jarvis-core__v');
    vv.textContent = v;
    row.append(kk, vv);
    inner.append(row);
  }

  ring.append(inner);
  wrap.append(ring);
  return wrap;
}

/**
 * Layout flujo: origen (izq) · JarvisCore (centro) · responsable (der).
 * @returns {{ element: HTMLElement, setOt: (ot: object|null) => void }}
 */
export function createJarvisAlienFlow() {
  const root = el('hnf-cc__jarvis-flow');
  root.setAttribute('aria-label', 'Flujo Jarvis: origen, núcleo, responsable');

  const colOrigen = el('hnf-cc__jarvis-flow__col hnf-cc__jarvis-flow__col--origen');
  const colCore = el('hnf-cc__jarvis-flow__col hnf-cc__jarvis-flow__col--core');
  const colResp = el('hnf-cc__jarvis-flow__col hnf-cc__jarvis-flow__col--resp');

  const origenLabel = el('hnf-cc__jarvis-flow__label');
  origenLabel.textContent = 'Origen';
  const origenVal = el('hnf-cc__jarvis-flow__value');
  origenVal.textContent = 'sin dato';
  colOrigen.append(origenLabel, origenVal);

  const coreHost = el('hnf-cc__jarvis-flow__core-host');
  colCore.append(coreHost);

  const respLabel = el('hnf-cc__jarvis-flow__label');
  respLabel.textContent = 'Responsable';
  const respVal = el('hnf-cc__jarvis-flow__value hnf-cc__jarvis-flow__value--resp');
  respVal.textContent = 'sin dato';
  colResp.append(respLabel, respVal);

  root.append(colOrigen, colCore, colResp);

  function setOt(ot) {
    const trace = ot?.jarvisIntakeTrace && typeof ot.jarvisIntakeTrace === 'object' ? ot.jarvisIntakeTrace : null;
    origenVal.textContent = ot ? humanOrigenDetectado(trace?.origen_detectado, ot) : 'sin dato';
    respVal.textContent = ot ? fmtResponsableTitular(ot) : 'sin dato';
    coreHost.replaceChildren(buildJarvisCoreInner(ot));
  }

  setOt(null);

  return { element: root, setOt };
}

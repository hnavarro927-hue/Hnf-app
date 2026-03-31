import { etiquetaOrigenSolicitudOperativa } from '../domain/hnf-operativa-reglas.js';

/**
 * @param {object | null} ot
 */
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

function fmtResponsable(ot) {
  const tech = String(ot?.tecnicoAsignado ?? '').trim();
  if (tech && tech.toLowerCase() !== 'por asignar') return tech;
  const r = String(ot?.responsableActual ?? '').trim();
  if (r && r.toLowerCase() !== 'por asignar') return r;
  return 'sin dato';
}

function fmtPrioridad(ot) {
  const p = String(ot?.prioridadSugerida ?? ot?.prioridadOperativa ?? '')
    .trim()
    .toLowerCase();
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

function row(k, v) {
  return `
    <div class="hnf-jarvis-copilot__row">
      <span class="hnf-jarvis-copilot__k">${escapeHtml(k)}</span>
      <span class="hnf-jarvis-copilot__v">${escapeHtml(v)}</span>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Panel copiloto: campos solo desde OT real (trace + raíz); vacío → sin dato.
 * @param {{ focoOt: object | null }} p
 */
export function createJarvisCopilot({ focoOt }) {
  const root = document.createElement('div');
  root.className = 'hnf-jarvis-copilot';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Jarvis — copiloto (OT foco)');

  const ot = focoOt && typeof focoOt === 'object' ? focoOt : null;
  const ref = ot
    ? String(ot.id ?? '')
        .trim()
        .slice(0, 80) || 'sin id'
    : 'sin dato';
  const cliente = ot ? String(ot.cliente ?? '').trim().slice(0, 120) : '';

  const sub = ot
    ? `OT ${ref}${cliente ? ` · ${cliente}` : ''}`
    : 'sin OT en muestra — sin dato';

  const trace = ot?.jarvisIntakeTrace && typeof ot.jarvisIntakeTrace === 'object' ? ot.jarvisIntakeTrace : null;

  const rows = [
    row('Origen detectado', humanOrigenDetectado(trace?.origen_detectado, ot)),
    row('Área clasificada', ot ? fmtArea(ot) : 'sin dato'),
    row('Responsable sugerido', ot ? fmtResponsable(ot) : 'sin dato'),
    row('Prioridad sugerida', ot ? fmtPrioridad(ot) : 'sin dato'),
    row('Riesgo detectado', ot ? fmtRiesgo(ot) : 'sin dato'),
    row('Acción recomendada', ot ? fmtAccion(ot) : 'sin dato'),
  ].join('');

  root.innerHTML = `
    <h2 class="hnf-jarvis-copilot__title">Núcleo copiloto</h2>
    <p class="hnf-jarvis-copilot__sub">${escapeHtml(sub)}</p>
    <div class="hnf-jarvis-copilot__rows">${rows}</div>
  `;

  return root;
}

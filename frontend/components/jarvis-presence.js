import '../styles/jarvis-presence-copilot.css';

/**
 * @param {{ label: string, ok: boolean, pulse: boolean }} linea
 * @param {{ nRiesgo: number, nUrgentes: number, nPendAprobacion: number }} metrics
 * @param {string} suggestion
 * @param {{ variant?: 'default' | 'alien-bar' }} [opts]
 */
export function createJarvisPresence({ linea, metrics, suggestion, variant } = {}) {
  const root = document.createElement('div');
  root.className =
    variant === 'alien-bar' ? 'hnf-jarvis-presence hnf-jarvis-presence--alien-bar' : 'hnf-jarvis-presence';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Jarvis — presencia gerencial');

  const pulseClass =
    linea.pulse === false ? 'hnf-jarvis-presence__pulse hnf-jarvis-presence__pulse--off' : 'hnf-jarvis-presence__pulse';
  const stateClass = `hnf-jarvis-presence__state${linea.ok ? ' hnf-jarvis-presence__state--ok' : ''}${!linea.ok && linea.label !== 'sin dato' ? ' hnf-jarvis-presence__state--bad' : ''}`;

  root.innerHTML = `
    <div class="hnf-jarvis-presence__head">
      <div class="hnf-jarvis-presence__brand">
        <span class="${pulseClass}" aria-hidden="true"></span>
        <span class="hnf-jarvis-presence__name">Jarvis</span>
      </div>
      <span class="${stateClass}">${escapeHtml(linea.label)}</span>
    </div>
    <div class="hnf-jarvis-presence__grid">
      <div>
        <div class="hnf-jarvis-presence__metric-k">OTs en riesgo</div>
        <div class="hnf-jarvis-presence__metric-v">${metrics.nRiesgo}</div>
      </div>
      <div>
        <div class="hnf-jarvis-presence__metric-k">Urgentes</div>
        <div class="hnf-jarvis-presence__metric-v">${metrics.nUrgentes}</div>
      </div>
      <div>
        <div class="hnf-jarvis-presence__metric-k">Pend. aprobación</div>
        <div class="hnf-jarvis-presence__metric-v">${metrics.nPendAprobacion}</div>
      </div>
    </div>
    <div class="hnf-jarvis-presence__hint">
      <span class="hnf-jarvis-presence__hint-k">Sugerencia del momento</span>
      ${escapeHtml(suggestion)}
    </div>
  `;

  return root;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string | undefined} integrationStatus
 */
export function jarvisLineaDesdeIntegracion(integrationStatus) {
  const x = String(integrationStatus ?? '')
    .trim()
    .toLowerCase();
  if (x === 'conectado') return { label: 'En línea', ok: true, pulse: true };
  if (x === 'cargando') return { label: 'Actualizando', ok: true, pulse: true };
  if (x === 'sin conexión' || x === 'sin conexion')
    return { label: 'Sin conexión', ok: false, pulse: false };
  if (!x || x === 'pendiente') return { label: 'sin dato', ok: false, pulse: false };
  return { label: String(integrationStatus).trim() || 'sin dato', ok: true, pulse: true };
}

/**
 * Etiquetas Modo Alien (barra superior).
 * @param {string | undefined} integrationStatus
 */
export function jarvisLineaModoAlien(integrationStatus) {
  const x = String(integrationStatus ?? '')
    .trim()
    .toLowerCase();
  if (x === 'conectado') return { label: 'Online', ok: true, pulse: true };
  if (x === 'cargando') return { label: 'Actualizando', ok: true, pulse: true };
  if (x === 'sin conexión' || x === 'sin conexion')
    return { label: 'Sin conexión', ok: false, pulse: false };
  if (!x || x === 'pendiente') return { label: 'sin dato', ok: false, pulse: false };
  return { label: String(integrationStatus).trim() || 'sin dato', ok: true, pulse: true };
}

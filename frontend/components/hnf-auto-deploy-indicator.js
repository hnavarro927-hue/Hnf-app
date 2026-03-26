/**
 * Indicador ADN (solo desarrollo): lee estado del orquestador y /health.
 */
const STATUS_URL = '/hnf-auto-deploy-status.json';

const labelFor = (state, message, consoleWarn) => {
  if (consoleWarn) return 'Atención consola';
  if (state === 'restarting') return 'Reiniciando';
  if (state === 'error') return 'Error detectado';
  if (state === 'recovered') return 'Recuperado';
  if (state === 'starting') return 'Arranque…';
  if (state === 'active') return 'Sistema activo';
  if (message) return message;
  return 'Jarvis ADN';
};

const modifierFor = (state, consoleWarn) => {
  if (consoleWarn) return 'hnf-adn--warn';
  if (state === 'error') return 'hnf-adn--error';
  if (state === 'restarting' || state === 'starting') return 'hnf-adn--pending';
  if (state === 'recovered') return 'hnf-adn--recovered';
  return 'hnf-adn--ok';
};

export function createHnfAutoDeployIndicator() {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-adn-indicator';
  wrap.setAttribute('aria-live', 'polite');
  wrap.hidden = true;

  const inner = document.createElement('div');
  inner.className = 'hnf-adn-indicator__inner';
  const dot = document.createElement('span');
  dot.className = 'hnf-adn-indicator__dot';
  dot.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'hnf-adn-indicator__text';
  const sub = document.createElement('span');
  sub.className = 'hnf-adn-indicator__sub muted small';
  inner.append(dot, text, sub);
  wrap.append(inner);

  let timer = null;
  let misses = 0;

  const tick = async () => {
    let orchestrator = null;
    try {
      const r = await fetch(`${STATUS_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) orchestrator = await r.json();
    } catch {
      orchestrator = null;
    }

    if (!orchestrator) {
      misses += 1;
      if (misses >= 4) {
        wrap.hidden = true;
      }
      return;
    }
    misses = 0;
    wrap.hidden = false;

    const recentConsole =
      typeof window !== 'undefined' &&
      Array.isArray(window.__HNF_DEV_CONSOLE_ERRORS__) &&
      window.__HNF_DEV_CONSOLE_ERRORS__.some((e) => e && Date.now() - e.t < 90000);

    const state = orchestrator.state || 'active';
    const msg = orchestrator.message || '';
    const diagnosis = orchestrator.diagnosis || '';

    text.textContent = labelFor(state, msg, recentConsole);
    sub.textContent = recentConsole
      ? 'Se registraron errores en consola (dev).'
      : diagnosis || (orchestrator.backendHealth === false ? 'API en verificación…' : '');

    wrap.className = `hnf-adn-indicator ${modifierFor(state, recentConsole)}`;
  };

  return {
    element: wrap,
    start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), 2500);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

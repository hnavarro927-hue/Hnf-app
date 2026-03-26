/**
 * Ciclo vivo en superficie: cada 30s re-evalúa estado unificado y pinta Command Core (sin consola).
 */

import { buildJarvisDecisionEngine } from './jarvis-decision-engine.js';
import { getJarvisUnifiedState } from './jarvis-core.js';
import { JarvisMemoryEngine } from './jarvis-memory-engine.js';

const TICK_MS = 30_000;
let intervalId = null;
let tickCount = 0;

function applyToDom(decision, unified) {
  const root = document.querySelector('[data-jarvis-autonomic-root]');
  if (!root) return;

  const elEst = root.querySelector('[data-jarvis-autonomic-estado]');
  const elLine = root.querySelector('[data-jarvis-autonomic-line]');
  const elPri = root.querySelector('[data-jarvis-autonomic-prioridad]');
  const elImpact = root.querySelector('[data-jarvis-autonomic-impacto]');
  const elTime = root.querySelector('[data-jarvis-autonomic-time]');

  if (elEst) elEst.textContent = decision.estado;
  if (elLine) elLine.textContent = decision.accion;
  if (elPri) elPri.textContent = decision.prioridad;
  if (elImpact) {
    const n = Math.round(Number(decision.impacto) || 0);
    elImpact.textContent = n ? `~$${n.toLocaleString('es-CL')}` : '—';
  }
  if (elTime) {
    elTime.textContent = new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
  }

  root.dataset.jarvisEstado = String(decision.estado || 'NORMAL').toLowerCase();

  const hq = document.querySelector('.jarvis-hq.jarvis-hq--command');
  if (hq) {
    hq.classList.remove('jarvis-hq--autonomic-critico', 'jarvis-hq--autonomic-alto', 'jarvis-hq--autonomic-normal');
    const k =
      decision.estado === 'CRITICO'
        ? 'jarvis-hq--autonomic-critico'
        : decision.estado === 'ALTO'
          ? 'jarvis-hq--autonomic-alto'
          : 'jarvis-hq--autonomic-normal';
    hq.classList.add(k);
  }

  const nucleus = document.querySelector('.jarvis-nucleo-hero');
  if (nucleus) {
    nucleus.classList.remove(
      'jarvis-nucleo-hero--autonomic-critico',
      'jarvis-nucleo-hero--autonomic-alto',
      'jarvis-nucleo-hero--autonomic-normal'
    );
    if (decision.estado === 'CRITICO') nucleus.classList.add('jarvis-nucleo-hero--autonomic-critico');
    else if (decision.estado === 'ALTO') nucleus.classList.add('jarvis-nucleo-hero--autonomic-alto');
    else nucleus.classList.add('jarvis-nucleo-hero--autonomic-normal');
  }
}

/**
 * @param {{ getViewData: () => object | null | undefined }} opts
 */
export function startJarvisAutonomicSurface(opts) {
  const getViewData = opts?.getViewData;
  if (typeof getViewData !== 'function') return;
  if (intervalId != null) return;

  const tick = () => {
    try {
      const raw = getViewData() || {};
      const unified = getJarvisUnifiedState(raw);
      const decision = buildJarvisDecisionEngine({ unified });
      tickCount += 1;
      if (tickCount === 1 || tickCount % 10 === 0) {
        JarvisMemoryEngine.noteAutonomicTick({
          estado: decision.estado,
          prioridad: decision.prioridad,
          impacto: decision.impacto,
        });
      }
      applyToDom(decision, unified);
    } catch {
      /* noop */
    }
  };

  tick();
  intervalId = setInterval(tick, TICK_MS);
}

export function stopJarvisAutonomicSurface() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

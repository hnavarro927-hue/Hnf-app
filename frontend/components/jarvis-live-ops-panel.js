import '../styles/jarvis-live-ops-panel.css';
import { runJarvisOperationalDecisionEngine } from '../domain/jarvis-operational-decision-engine.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Panel vivo: estado Jarvis, diagnóstico, decisión, OT foco, riesgo.
 * @param {{
 *   integrationStatus?: string,
 *   viewData?: Record<string, unknown> | null,
 *   lastDataRefreshAt?: string | null,
 *   focoOt?: object | null,
 * }} p
 */
export function createJarvisLiveOpsPanel(p) {
  const engine = runJarvisOperationalDecisionEngine({
    integrationStatus: p.integrationStatus,
    viewData: p.viewData,
    lastDataRefreshAt: p.lastDataRefreshAt,
    focoOt: p.focoOt ?? null,
  });

  const { diagnostics } = engine;
  const foco = p.focoOt && typeof p.focoOt === 'object' ? p.focoOt : null;
  const focoLine = foco
    ? `${String(foco.id ?? 'sin id').slice(0, 48)} · ${String(foco.cliente ?? '').trim().slice(0, 60) || 'sin cliente'}`
    : 'sin dato';

  const riesgoFoco =
    foco?.riesgoDetectado === true ? 'alto' : foco?.riesgoDetectado === false ? 'bajo' : 'sin dato';

  const overallClass =
    diagnostics.overall === 'error'
      ? 'hnf-jarvis-live-ops__pill--bad'
      : diagnostics.overall === 'warning'
        ? 'hnf-jarvis-live-ops__pill--warn'
        : 'hnf-jarvis-live-ops__pill--ok';

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-live-ops';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Jarvis operador — diagnóstico y decisión');

  root.innerHTML = `
    <div class="hnf-jarvis-live-ops__head">
      <span class="hnf-jarvis-live-ops__title">Jarvis operador</span>
      <span class="hnf-jarvis-live-ops__pill ${overallClass}">${esc(engine.estadoGeneral)}</span>
    </div>
    <div class="hnf-jarvis-live-ops__grid">
      <div class="hnf-jarvis-live-ops__cell">
        <span class="hnf-jarvis-live-ops__k">Último diagnóstico</span>
        <p class="hnf-jarvis-live-ops__v">${esc(diagnostics.atIso.slice(0, 19))} UTC · sync ${esc(diagnostics.lastDataRefreshAtLabel)}</p>
        <p class="hnf-jarvis-live-ops__sub">${esc(diagnostics.summary)}</p>
      </div>
      <div class="hnf-jarvis-live-ops__cell">
        <span class="hnf-jarvis-live-ops__k">Acción recomendada</span>
        <p class="hnf-jarvis-live-ops__v hnf-jarvis-live-ops__v--accent">${esc(engine.accionRecomendada)}</p>
      </div>
      <div class="hnf-jarvis-live-ops__cell">
        <span class="hnf-jarvis-live-ops__k">OT foco actual</span>
        <p class="hnf-jarvis-live-ops__v">${esc(focoLine)}</p>
      </div>
      <div class="hnf-jarvis-live-ops__cell">
        <span class="hnf-jarvis-live-ops__k">Nivel de riesgo</span>
        <p class="hnf-jarvis-live-ops__v">General: ${esc(engine.nivelRiesgo)} · Foco: ${esc(riesgoFoco)}</p>
      </div>
    </div>
    <details class="hnf-jarvis-live-ops__details">
      <summary>Chequeos (${diagnostics.checks.length})</summary>
      <ul class="hnf-jarvis-live-ops__checks">
        ${diagnostics.checks
          .map(
            (c) => `
          <li class="hnf-jarvis-live-ops__check hnf-jarvis-live-ops__check--${c.status}">
            <strong>${esc(c.label)}</strong> · ${esc(c.status)}
            <span class="hnf-jarvis-live-ops__check-detail">${esc(c.detail)}</span>
          </li>`
          )
          .join('')}
      </ul>
    </details>
  `;

  return root;
}

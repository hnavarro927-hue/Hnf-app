import '../styles/jarvis-executive-copilot-strip.css';
import { runJarvisOperationalDecisionEngine } from '../domain/jarvis-operational-decision-engine.js';
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { countPendingJarvisDocumentReview } from '../domain/jarvis-universal-intake-storage.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greetingForAuth(authLabel) {
  const raw = String(authLabel || '').trim();
  const n = raw.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (n.includes('hernan')) {
    return 'Hernán: estado operativo consolidado para su lectura ejecutiva.';
  }
  if (raw && raw !== '—') {
    return `${raw.split(/\s+/)[0]}: resumen operativo listo.`;
  }
  return 'Equipo: resumen operativo listo.';
}

/**
 * Copiloto ejecutivo compacto (no chat): saludo, diagnóstico, documentos, acción.
 */
export function createJarvisExecutiveCopilotStrip({
  authLabel,
  integrationStatus,
  viewData,
  lastDataRefreshAt,
} = {}) {
  const raw = viewData?.planOts ?? viewData?.ots?.data ?? [];
  const list = Array.isArray(raw) ? raw : [];
  const jSig = buildJarvisGerencialSignals(list);
  const engine = runJarvisOperationalDecisionEngine({
    integrationStatus,
    viewData,
    lastDataRefreshAt,
    focoOt: jSig.focoOt,
  });
  const pendingDocs = countPendingJarvisDocumentReview();
  const docLine =
    pendingDocs > 0
      ? `${pendingDocs} documento(s) en cola con revision_jarvis_pendiente.`
      : 'Sin documentos pendientes de revisión Jarvis en cola local.';

  const diag = engine.diagnostics?.summary || 'diagnóstico incompleto';

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-exec-strip';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Jarvis copiloto ejecutivo');
  root.innerHTML = `
    <div class="hnf-jarvis-exec-strip__row">
      <p class="hnf-jarvis-exec-strip__greet">${esc(greetingForAuth(authLabel))}</p>
      <span class="hnf-jarvis-exec-strip__badge">${esc(engine.estadoGeneral)}</span>
    </div>
    <p class="hnf-jarvis-exec-strip__line"><span class="hnf-jarvis-exec-strip__k">Diagnóstico</span> ${esc(diag)}</p>
    <p class="hnf-jarvis-exec-strip__line"><span class="hnf-jarvis-exec-strip__k">Documentos</span> ${esc(docLine)}</p>
    <p class="hnf-jarvis-exec-strip__line hnf-jarvis-exec-strip__line--action"><span class="hnf-jarvis-exec-strip__k">Acción sugerida</span> ${esc(engine.accionRecomendada)}</p>
  `;
  return root;
}

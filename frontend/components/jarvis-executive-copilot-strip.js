import '../styles/jarvis-executive-copilot-strip.css';
import { runJarvisOperationalDecisionEngine } from '../domain/jarvis-operational-decision-engine.js';
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { countPendingJarvisDocumentReview } from '../domain/jarvis-universal-intake-storage.js';
import { getStarkDocumentsSummary } from '../services/stark-documents.service.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isHernanAuth(authLabel) {
  const n = String(authLabel || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return n.includes('hernan');
}

/**
 * Una línea ejecutiva con números reales (cola local + muestra /ots).
 */
function buildExecutiveHeadline(authLabel, pendingDocs, nRiesgoOt) {
  const p = Number(pendingDocs) || 0;
  const r = Number(nRiesgoOt) || 0;
  if (isHernanAuth(authLabel)) {
    if (p === 0 && r === 0) {
      return 'Hernán, Jarvis no registra documentos pendientes de clasificación ni OTs con riesgo detectado en la muestra actual.';
    }
    const docPart =
      p === 0
        ? 'ningún documento pendiente de clasificación'
        : `${p} documento${p === 1 ? '' : 's'} pendiente${p === 1 ? '' : 's'} de clasificación`;
    const riskPart =
      r === 0
        ? 'ninguna OT en riesgo'
        : `${r} OT${r === 1 ? '' : 's'} en riesgo`;
    return `Hernán, Jarvis detectó ${docPart} y ${riskPart}.`;
  }
  const who = String(authLabel || '').trim().split(/\s+/)[0] || 'Equipo';
  if (p === 0 && r === 0) {
    return `${who}, sin documentos pendientes de clasificación ni OTs con riesgo detectado en la muestra.`;
  }
  return `${who}, ${p} documento(s) pendiente(s) de clasificación y ${r} OT(s) con riesgo detectado.`;
}

function brandLineForAuth() {
  return 'Jarvis | Integridad Operativa HNF';
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
  const pendingLocal = countPendingJarvisDocumentReview();
  const headline = buildExecutiveHeadline(authLabel, pendingLocal, jSig.nRiesgo);
  const docLine =
    pendingLocal > 0
      ? `${pendingLocal} ítem(s) en cola local con revision_jarvis_pendiente (ingesta universal).`
      : 'Cola local de ingesta: sin revision_jarvis_pendiente.';

  const diag = engine.diagnostics?.summary || 'diagnóstico incompleto';

  const root = document.createElement('div');
  root.className = 'hnf-jarvis-exec-strip';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Jarvis copiloto ejecutivo');
  root.innerHTML = `
    <p class="hnf-jarvis-exec-strip__brand">${esc(brandLineForAuth())}</p>
    <div class="hnf-jarvis-exec-strip__row">
      <p class="hnf-jarvis-exec-strip__greet">${esc(headline)}</p>
      <span class="hnf-jarvis-exec-strip__badge">${esc(engine.estadoGeneral)}</span>
    </div>
    <p class="hnf-jarvis-exec-strip__line hnf-jarvis-exec-strip__stark-oc" hidden></p>
    <p class="hnf-jarvis-exec-strip__line"><span class="hnf-jarvis-exec-strip__k">Diagnóstico</span> ${esc(diag)}</p>
    <p class="hnf-jarvis-exec-strip__line hnf-jarvis-exec-strip__doc-local"><span class="hnf-jarvis-exec-strip__k">Detalle documentos</span> ${esc(docLine)}</p>
    <p class="hnf-jarvis-exec-strip__line hnf-jarvis-exec-strip__line--action"><span class="hnf-jarvis-exec-strip__k">Acción sugerida</span> ${esc(engine.accionRecomendada)}</p>
  `;

  const greetEl = root.querySelector('.hnf-jarvis-exec-strip__greet');
  const docDetailEl = root.querySelector('.hnf-jarvis-exec-strip__doc-local');
  const starkOcEl = root.querySelector('.hnf-jarvis-exec-strip__stark-oc');

  void getStarkDocumentsSummary()
    .then((sum) => {
      const sp = Number(sum.pendingClassification) || 0;
      const merged = Math.max(pendingLocal, sp);
      if (greetEl) {
        greetEl.textContent = buildExecutiveHeadline(authLabel, merged, jSig.nRiesgo);
      }
      if (docDetailEl) {
        const k = document.createElement('span');
        k.className = 'hnf-jarvis-exec-strip__k';
        k.textContent = 'Detalle documentos';
        const rest = `Local: ${pendingLocal}. Stark (servidor): ${sp} pendiente(s) de revisión documental.`;
        docDetailEl.replaceChildren(k, document.createTextNode(` ${rest}`));
      }
      if (starkOcEl && sum.lastOcEnRevision && isHernanAuth(authLabel)) {
        starkOcEl.textContent =
          'Hernán, se recibió una nueva OC y quedó en revisión documental (Stark Integrity).';
        starkOcEl.hidden = false;
      }
    })
    .catch(() => {});

  return root;
}

/**
 * Panel UI del copiloto Jarvis + ingesta con revisión y confirmación (sin guardado automático).
 */

import { processJarvisCopilotQuery } from '../domain/jarvis-assistant-engine.js';
import { runJarvisIngestionPipeline } from '../domain/jarvis-ingestion-engine.js';
import {
  applyGuidedAnswer,
  buildGuidedSummary,
  getGuidedPrompt,
  guidedSessionMissingRequired,
  parseGuidedIngestIntent,
  startGuidedSession,
} from '../domain/jarvis-guided-ingestion.js';
import { saveGuidedClient, saveGuidedDirectory } from '../domain/jarvis-ingestion-execute.js';
import { mountIngestionReviewBar } from './jarvis-assistant-ingestion-ui.js';

function appendSimpleAssistantBubble(log, text) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--assistant';
  const meta = document.createElement('span');
  meta.className = 'hnf-jarvis-assistant__msg-meta';
  meta.textContent = 'Jarvis';
  const body = document.createElement('div');
  body.className = 'hnf-jarvis-assistant__msg-body';
  body.textContent = text;
  wrap.append(meta, body);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
}

/** @param {{ datos?: string, accionSugerida?: string|null, mejoraSugerida?: string|null }} result */
function appendStructuredAssistantBubble(log, result) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--assistant';
  const meta = document.createElement('span');
  meta.className = 'hnf-jarvis-assistant__msg-meta';
  meta.textContent = 'Jarvis · copiloto operativo';

  const stack = document.createElement('div');
  stack.className = 'hnf-jarvis-assistant__copilot-stack';

  const mkBlock = (kind, label, text) => {
    if (!text) return null;
    const block = document.createElement('div');
    block.className = `hnf-jarvis-assistant__copilot-block hnf-jarvis-assistant__copilot-block--${kind}`;
    const lb = document.createElement('span');
    lb.className = 'hnf-jarvis-assistant__copilot-label';
    lb.textContent = label;
    const tx = document.createElement('div');
    tx.className = 'hnf-jarvis-assistant__copilot-text';
    tx.textContent = text;
    block.append(lb, tx);
    return block;
  };

  const datosBlock = mkBlock('datos', 'Datos', result.datos);
  if (datosBlock) stack.append(datosBlock);

  const accionBlock = mkBlock('accion', 'Acción sugerida', result.accionSugerida);
  if (accionBlock) stack.append(accionBlock);

  const mejoraBlock = mkBlock('mejora', 'Mejora sugerida', result.mejoraSugerida);
  if (mejoraBlock) stack.append(mejoraBlock);

  wrap.append(meta, stack);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
}

/**
 * @param {object} opts
 * @param {object} opts.data
 * @param {object[]} [opts.controlCards]
 * @param {object} [opts.ingestionHooks] postCargaMasiva, postExtendedClient, postInternalDirectory, createOt
 * @param {() => void|Promise<void>} [opts.onAfterIngestionSave]
 */
export function createJarvisAssistantPanel({
  data,
  controlCards = [],
  ingestionHooks = null,
  onAfterIngestionSave,
} = {}) {
  const section = document.createElement('section');
  section.className = 'hnf-jarvis-assistant hnf-jarvis-copilot-surface';
  section.setAttribute('aria-label', 'Asistente Jarvis');

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-assistant__head';
  const title = document.createElement('h2');
  title.className = 'hnf-jarvis-assistant__title';
  title.textContent = 'Asistente Jarvis';
  const sub = document.createElement('p');
  sub.className = 'hnf-jarvis-assistant__sub';
  sub.textContent =
    'Copiloto operativo e ingesta: subí CSV/TXT, revisá el resumen y guardá solo cuando confirmes. Chat: resumen · urgentes · sin asignar · pendientes. Ingesta guiada: «Ingresa conductor …», «Alta cliente …».';
  head.append(title, sub);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'hnf-jarvis-assistant__upload-row';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'hnf-jarvis-assistant__file';
  fileInput.accept = '.csv,.txt,.md,text/plain,text/csv';
  fileInput.setAttribute('aria-label', 'Archivo para ingesta Jarvis');
  fileInput.id = `jarvis-ingest-${Math.random().toString(36).slice(2, 9)}`;
  const fileLbl = document.createElement('label');
  fileLbl.className = 'hnf-jarvis-assistant__file-lbl';
  fileLbl.setAttribute('for', fileInput.id);
  fileLbl.textContent = 'Subir planilla o documento (CSV / TXT)';

  uploadRow.append(fileLbl, fileInput);

  const log = document.createElement('div');
  log.className = 'hnf-jarvis-assistant__log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');

  const reviewMount = mountIngestionReviewBar({
    log,
    hooks: ingestionHooks,
    pipelineResult: null,
    onAfterSave: () => onAfterIngestionSave?.(),
    onNotify: (msg) => appendSimpleAssistantBubble(log, msg),
  });

  const guidedBar = document.createElement('div');
  guidedBar.className = 'hnf-jarvis-ingestion-review hnf-jarvis-ingestion-review--guided';
  guidedBar.hidden = true;
  const guidedTitle = document.createElement('h3');
  guidedTitle.className = 'hnf-jarvis-ingestion-review__title';
  guidedTitle.textContent = 'Resumen · confirmación para guardar';
  const guidedPre = document.createElement('pre');
  guidedPre.className = 'hnf-jarvis-ingestion-review__pre';
  const guidedActions = document.createElement('div');
  guidedActions.className = 'hnf-jarvis-ingestion-review__actions';
  guidedBar.append(guidedTitle, guidedPre, guidedActions);

  const form = document.createElement('form');
  form.className = 'hnf-jarvis-assistant__form';
  form.setAttribute('novalidate', 'true');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'hnf-jarvis-assistant__input';
  input.name = 'mensaje';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute(
    'placeholder',
    'Chat o ingesta guiada · CSV con el botón de arriba'
  );
  input.setAttribute('aria-label', 'Mensaje al copiloto');

  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'hnf-jarvis-assistant__send';
  send.textContent = 'Enviar';

  form.append(input, send);

  const ctx = () => ({
    data: data && typeof data === 'object' ? data : {},
    controlCards: Array.isArray(controlCards) ? controlCards : [],
  });

  let guidedSession = null;
  let guidedAwaitConfirm = false;

  function clearGuidedUi() {
    guidedAwaitConfirm = false;
    guidedSession = null;
    guidedBar.hidden = true;
    guidedPre.textContent = '';
    guidedActions.replaceChildren();
  }

  function renderGuidedConfirm() {
    if (!guidedSession) return;
    guidedPre.textContent = `${buildGuidedSummary(guidedSession)}\n\n¿Deseás guardarlo en el sistema?`;
    guidedActions.replaceChildren();
    const bGuardar = document.createElement('button');
    bGuardar.type = 'button';
    bGuardar.className = 'primary-button hnf-jarvis-ingestion-review__btn';
    bGuardar.textContent = 'Guardar';
    bGuardar.addEventListener('click', async () => {
      if (!ingestionHooks) {
        appendSimpleAssistantBubble(log, 'No hay conexión a servicios de guardado en este contexto.');
        clearGuidedUi();
        return;
      }
      const miss = guidedSessionMissingRequired(guidedSession);
      if (miss.length) {
        appendSimpleAssistantBubble(
          log,
          `Faltan datos obligatorios: ${miss.join(', ')}. Usá «Editar» y completá por chat.`
        );
        return;
      }
      try {
        if (guidedSession.kind === 'cliente') await saveGuidedClient(guidedSession, ingestionHooks);
        else await saveGuidedDirectory(guidedSession, ingestionHooks);
        appendSimpleAssistantBubble(log, 'Listo: registro guardado en HNF (cliente extendido o directorio interno).');
        await onAfterIngestionSave?.();
      } catch (e) {
        appendSimpleAssistantBubble(log, `No se pudo guardar: ${e?.message || e}`);
      }
      clearGuidedUi();
    });
    const bEditar = document.createElement('button');
    bEditar.type = 'button';
    bEditar.className = 'secondary-button hnf-jarvis-ingestion-review__btn';
    bEditar.textContent = 'Editar';
    bEditar.addEventListener('click', () => {
      clearGuidedUi();
      appendSimpleAssistantBubble(
        log,
        'Ingesta guiada reiniciada. Volvé a escribir «Ingresa conductor …» o «Alta cliente …» para cargar desde cero.'
      );
    });
    const bCancelar = document.createElement('button');
    bCancelar.type = 'button';
    bCancelar.className = 'secondary-button hnf-jarvis-ingestion-review__btn';
    bCancelar.textContent = 'Cancelar';
    bCancelar.addEventListener('click', () => {
      clearGuidedUi();
      appendSimpleAssistantBubble(log, 'Ingesta guiada cancelada; no se guardó nada.');
    });
    guidedActions.append(bGuardar, bEditar, bCancelar);
    guidedBar.hidden = false;
  }

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    const text = await f.text();
    const pipeline = runJarvisIngestionPipeline({
      text,
      fileName: f.name,
      data: ctx().data,
    });
    appendSimpleAssistantBubble(log, `Archivo «${f.name}» analizado (sin guardar). Revisá el panel de acciones.`);
    reviewMount.setPipelineResult(pipeline);
  });

  appendSimpleAssistantBubble(
    log,
    'Listo. Base de inteligencia HNF v1: preguntá por permisos/aprobaciones Clima, flujo OT, demoras o «reglas operativas». Podés subir CSV/TXT (revisión previa), usar resumen/urgentes/pendientes o ingesta guiada. Nada se guarda sin confirmación explícita.'
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;

    const userWrap = document.createElement('div');
    userWrap.className = 'hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--user';
    const uMeta = document.createElement('span');
    uMeta.className = 'hnf-jarvis-assistant__msg-meta';
    uMeta.textContent = 'Vos';
    const uBody = document.createElement('div');
    uBody.className = 'hnf-jarvis-assistant__msg-body';
    uBody.textContent = raw;
    userWrap.append(uMeta, uBody);
    log.append(userWrap);
    log.scrollTop = log.scrollHeight;
    input.value = '';

    if (guidedSession && !guidedAwaitConfirm) {
      applyGuidedAnswer(guidedSession, raw);
      if (guidedSession.done) {
        guidedAwaitConfirm = true;
        renderGuidedConfirm();
      } else {
        const q = getGuidedPrompt(guidedSession);
        if (q) appendSimpleAssistantBubble(log, q);
      }
      return;
    }

    if (guidedSession && guidedAwaitConfirm) {
      appendSimpleAssistantBubble(
        log,
        'Usá los botones Guardar, Editar o Cancelar del panel de confirmación.'
      );
      return;
    }

    const guidedIntent = parseGuidedIngestIntent(raw);
    if (guidedIntent) {
      guidedSession = startGuidedSession(guidedIntent);
      guidedAwaitConfirm = false;
      const q = getGuidedPrompt(guidedSession);
      appendSimpleAssistantBubble(
        log,
        `Ingesta guiada iniciada para «${guidedIntent.name}». ${q || 'Completá los datos.'}`
      );
      return;
    }

    const result = processJarvisCopilotQuery(raw, ctx());
    appendStructuredAssistantBubble(log, result);
  });

  section.append(head, uploadRow, reviewMount.el, guidedBar, log, form);
  return section;
}

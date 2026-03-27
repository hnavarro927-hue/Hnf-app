/**
 * Panel UI del copiloto operativo Jarvis (datos + acción + mejora).
 */

import { processJarvisCopilotQuery } from '../domain/jarvis-assistant-engine.js';

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
 */
export function createJarvisAssistantPanel({ data, controlCards = [] } = {}) {
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
    'Copiloto operativo: lee OT y clientes cargados, detecta huecos de proceso y sugiere el siguiente paso. Atajos: resumen · urgentes · sin asignar · pendientes';
  head.append(title, sub);

  const log = document.createElement('div');
  log.className = 'hnf-jarvis-assistant__log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  log.setAttribute('aria-relevant', 'additions');

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
    'Ej.: resumen · urgentes · sin asignar · pendientes'
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

  appendSimpleAssistantBubble(
    log,
    'Listo. Pedí «resumen» para el panorama operativo. También podés consultar urgentes, casos sin técnico o pendientes de informe y evidencia. Las respuestas combinan datos en vivo con sugerencias de proceso.'
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

    const result = processJarvisCopilotQuery(raw, ctx());
    appendStructuredAssistantBubble(log, result);
  });

  section.append(head, log, form);
  return section;
}

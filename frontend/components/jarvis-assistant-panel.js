/**
 * Panel UI del asistente operativo Jarvis (reglas locales sobre OT en memoria).
 */

import { processJarvisAssistantQuery } from '../domain/jarvis-assistant-engine.js';

/**
 * @param {object} opts
 * @param {object} opts.data - mismo objeto de vista que usa Jarvis HQ
 * @param {object[]} [opts.controlCards] - tarjetas ADN / control por OT (opcional, mejora «urgentes»)
 */
export function createJarvisAssistantPanel({ data, controlCards = [] } = {}) {
  const section = document.createElement('section');
  section.className = 'hnf-jarvis-assistant';
  section.setAttribute('aria-label', 'Asistente Jarvis');

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-assistant__head';
  const title = document.createElement('h2');
  title.className = 'hnf-jarvis-assistant__title';
  title.textContent = 'Asistente Jarvis';
  const sub = document.createElement('p');
  sub.className = 'hnf-jarvis-assistant__sub';
  sub.textContent =
    'Consultas rápidas sobre las OT ya cargadas. Atajos: resumen · urgentes · sin asignar · pendientes';
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
  input.setAttribute('aria-label', 'Mensaje al asistente');

  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'hnf-jarvis-assistant__send';
  send.textContent = 'Enviar';

  form.append(input, send);

  const ctx = () => ({
    data: data && typeof data === 'object' ? data : {},
    controlCards: Array.isArray(controlCards) ? controlCards : [],
  });

  function appendBubble(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--${role}`;
    const meta = document.createElement('span');
    meta.className = 'hnf-jarvis-assistant__msg-meta';
    meta.textContent = role === 'user' ? 'Vos' : 'Jarvis';
    const body = document.createElement('div');
    body.className = 'hnf-jarvis-assistant__msg-body';
    body.textContent = text;
    wrap.append(meta, body);
    log.append(wrap);
    log.scrollTop = log.scrollHeight;
  }

  appendBubble(
    'assistant',
    'Listo. Preguntá por «resumen» para un pantallazo, o pedí «urgentes», «sin asignar» o «pendientes» (informe / evidencia).'
  );

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    appendBubble('user', raw);
    input.value = '';
    const { body } = processJarvisAssistantQuery(raw, ctx());
    appendBubble('assistant', body);
  });

  section.append(head, log, form);
  return section;
}

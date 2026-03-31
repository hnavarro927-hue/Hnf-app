/**
 * Franja fija bajo el topbar: núcleo operativo Jarvis (estructura, no adorno).
 */
export function createOperationalContextStrip({ jarvisLine, activeView, onNavigate } = {}) {
  const strip = document.createElement('div');
  strip.className = 'hnf-cc-operational-context';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'Núcleo operativo Jarvis');

  const main = document.createElement('div');
  main.className = 'hnf-cc-operational-context__main';

  const tag = document.createElement('span');
  tag.className = 'hnf-cc-operational-context__tag';
  tag.textContent = 'Jarvis';

  const line = document.createElement('p');
  line.className = 'hnf-cc-operational-context__line';
  line.textContent = jarvisLine || '—';

  main.append(tag, line);

  const actions = document.createElement('div');
  actions.className = 'hnf-cc-operational-context__actions';

  const slot = document.createElement('div');
  slot.className = 'hnf-cc-operational-context__quick-slot';
  slot.setAttribute('aria-hidden', 'true');
  slot.title = 'Acciones rápidas (extensible)';
  slot.textContent = '';

  const hq = document.createElement('button');
  hq.type = 'button';
  hq.className = 'hnf-cc-operational-context__hq';
  if (activeView === 'jarvis') {
    hq.textContent = 'Vista HQ activa';
    hq.disabled = true;
  } else {
    hq.textContent = 'Ir a Jarvis HQ';
    hq.addEventListener('click', () => onNavigate?.('jarvis'));
  }

  actions.append(slot, hq);
  strip.append(main, actions);
  return strip;
}

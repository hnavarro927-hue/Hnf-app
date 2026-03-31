import { createJarvisPanel } from '../jarvis-panel.js';

/**
 * Panel lateral Jarvis como núcleo del cockpit (no accesorio).
 */
export function createJarvisCorePanel() {
  const inner = createJarvisPanel();

  const wrap = document.createElement('aside');
  wrap.className = 'hnf-jarvis-core hnf-jarvis-core--cockpit';
  wrap.setAttribute('aria-label', 'Núcleo Jarvis');

  const ribbon = document.createElement('div');
  ribbon.className = 'hnf-jarvis-core__ribbon';
  ribbon.innerHTML =
    '<span class="hnf-jarvis-core__ribbon-tag">JARVIS</span><span class="hnf-jarvis-core__ribbon-text">Copiloto operativo · foco en la OT activa</span>';

  const halo = document.createElement('div');
  halo.className = 'hnf-jarvis-core__halo';

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-core__head';
  const pulse = document.createElement('span');
  pulse.className = 'hnf-jarvis-core__pulse';
  pulse.setAttribute('aria-hidden', 'true');
  const headTitle = document.createElement('span');
  headTitle.className = 'hnf-jarvis-core__head-title';
  headTitle.textContent = 'Núcleo vivo';
  const headSub = document.createElement('span');
  headSub.className = 'hnf-jarvis-core__head-sub';
  headSub.textContent = 'Contexto, riesgo y siguiente acción sugerida para la tarjeta seleccionada';
  head.append(pulse, headTitle, headSub);

  inner.element.classList.add('hnf-jarvis-core__embed');

  wrap.append(ribbon, halo, head, inner.element);
  return { element: wrap, setOt: inner.setOt };
}

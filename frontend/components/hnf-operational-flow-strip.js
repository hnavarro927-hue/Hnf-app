/**
 * Flujo operativo HNF (referencia visual): Entrada → … → Cierre.
 * @param {number} activeIndex Índice del paso activo (0..5).
 */
const STEPS = [
  { label: 'Entrada' },
  { label: 'Clasificación' },
  { label: 'Asignación' },
  { label: 'Ejecución' },
  { label: 'Informe' },
  { label: 'Cierre' },
];

export function createHnfOperationalFlowStrip(activeIndex = 0) {
  const nav = document.createElement('nav');
  nav.className = 'hnf-op-flow';
  nav.setAttribute('aria-label', 'Flujo operativo HNF');

  const track = document.createElement('div');
  track.className = 'hnf-op-flow__track';

  const idx = Math.max(0, Math.min(STEPS.length - 1, Number(activeIndex) || 0));

  STEPS.forEach((s, i) => {
    const step = document.createElement('span');
    step.className = 'hnf-op-flow__step';
    if (i < idx) step.classList.add('hnf-op-flow__step--done');
    else if (i === idx) step.classList.add('hnf-op-flow__step--active');
    else step.classList.add('hnf-op-flow__step--pending');
    step.textContent = s.label;
    track.append(step);
    if (i < STEPS.length - 1) {
      const arr = document.createElement('span');
      arr.className = 'hnf-op-flow__arr';
      arr.setAttribute('aria-hidden', 'true');
      arr.textContent = '→';
      track.append(arr);
    }
  });

  nav.append(track);
  return nav;
}

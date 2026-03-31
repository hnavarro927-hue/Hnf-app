/**
 * Marco de dashboard ejecutivo — estructura nueva (no .hnf-cap-control legacy).
 */
export function createControlDashboard() {
  const root = document.createElement('section');
  root.className = 'hnf-ccd';
  root.setAttribute('aria-label', 'Panel ejecutivo');

  const hero = document.createElement('header');
  hero.className = 'hnf-ccd__hero';

  const kpis = document.createElement('div');
  kpis.className = 'hnf-ccd__kpis';

  const jarvis = document.createElement('div');
  jarvis.className = 'hnf-ccd__jarvis-core hnf-ccd__jarvis-slot';

  const body = document.createElement('div');
  body.className = 'hnf-ccd__body';

  /* Núcleo Jarvis antes de la banda KPI: cerebro del tablero, luego métricas. */
  root.append(hero, jarvis, kpis, body);
  return { root, hero, kpis, jarvisZone: jarvis, body };
}

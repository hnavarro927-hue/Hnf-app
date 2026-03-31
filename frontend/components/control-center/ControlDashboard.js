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
  jarvis.className = 'hnf-ccd__jarvis-core';

  const body = document.createElement('div');
  body.className = 'hnf-ccd__body';

  root.append(hero, kpis, jarvis, body);
  return { root, hero, kpis, jarvisZone: jarvis, body };
}

import '../styles/hnf-enterprise-workspace.css';

/**
 * Shell empresarial HNF — una sola jerarquía por vista:
 * cabecera → señales → flujo → alta/quick ejecutivo → cuerpo (split / stack).
 * Reutilizable en Control gerencial, Flota y (fase 2) Clima.
 *
 * @param {{ variant: 'control' | 'flota'; ariaLabel?: string }} opts
 */
export function createHnfEnterpriseWorkspace({ variant, ariaLabel } = {}) {
  const root = document.createElement('section');
  root.className = `hnf-ew hnf-ew--${variant || 'generic'}`;
  if (ariaLabel) root.setAttribute('aria-label', ariaLabel);

  const header = document.createElement('header');
  header.className = 'hnf-ew__header';

  const signals = document.createElement('div');
  signals.className = 'hnf-ew__signals';

  const flow = document.createElement('div');
  flow.className = 'hnf-ew__flow';

  const quick = document.createElement('div');
  quick.className = 'hnf-ew__quick';

  const body = document.createElement('div');
  body.className = 'hnf-ew__body';

  root.append(header, signals, flow, quick, body);
  return { root, header, signals, flow, quick, body };
}

/** Tres columnas: bandeja | ficha | contexto (responsive). */
export function createHnfEwSplitThree() {
  const split = document.createElement('div');
  split.className = 'hnf-ew-split hnf-ew-split--three';
  const railNav = document.createElement('div');
  railNav.className = 'hnf-ew-split__cell hnf-ew-split__cell--nav';
  const main = document.createElement('div');
  main.className = 'hnf-ew-split__cell hnf-ew-split__cell--main';
  const railCtx = document.createElement('aside');
  railCtx.className = 'hnf-ew-split__cell hnf-ew-split__cell--context';
  split.append(railNav, main, railCtx);
  return { split, railNav, main, railCtx };
}

/** Dos columnas: rail de accesos | columna principal. */
export function createHnfEwSplitControl() {
  const split = document.createElement('div');
  split.className = 'hnf-ew-split hnf-ew-split--control';
  const railNav = document.createElement('div');
  railNav.className = 'hnf-ew-split__cell hnf-ew-split__cell--nav';
  const main = document.createElement('div');
  main.className = 'hnf-ew-split__cell hnf-ew-split__cell--main';
  split.append(railNav, main);
  return { split, railNav, main };
}

/**
 * Bloque colapsable estándar (métricas extensas, núcleo Jarvis, etc.).
 * @param {string} summaryText
 * @param {boolean} [open=false]
 */
export function createHnfEwDetails(summaryText, open = false) {
  const details = document.createElement('details');
  details.className = 'hnf-ew-details';
  const summary = document.createElement('summary');
  summary.className = 'hnf-ew-details__summary';
  summary.textContent = summaryText;
  const inner = document.createElement('div');
  inner.className = 'hnf-ew-details__body';
  details.append(summary, inner);
  if (open) details.open = true;
  return { details, body: inner };
}

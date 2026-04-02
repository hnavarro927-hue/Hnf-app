/* Jarvis decision: hnf-ds-jarvis.css vía app.css */

/**
 * Área operativa mostrada (alineado a tipoServicio / clasificación Jarvis).
 * @param {Record<string, unknown>} ot
 */
export function jarvisDecisionAreaLabel(ot) {
  const t = String(ot?.tipoServicio ?? '')
    .trim()
    .toLowerCase();
  if (t === 'clima' || t === 'flota') return t;
  if (t) return t;
  return '—';
}

/**
 * @param {Record<string, unknown>} ot
 */
export function jarvisDecisionResponsableLabel(ot) {
  const r = String(ot?.responsableActual ?? ot?.tecnicoAsignado ?? '')
    .trim();
  return r || '—';
}

/**
 * @param {Record<string, unknown>} ot
 * @param {{ variant?: 'compact' | 'full' }} [opts]
 * @returns {HTMLDivElement}
 */
export function buildJarvisDecisionCard(ot, opts = {}) {
  const variant = opts.variant === 'full' ? 'full' : 'compact';
  const root = document.createElement('div');
  root.className = `hnf-jarvis-decision hnf-jarvis-decision--${variant}`;
  root.setAttribute('aria-label', 'Jarvis — decisión operativa');

  const area = jarvisDecisionAreaLabel(ot);
  const responsable = jarvisDecisionResponsableLabel(ot);
  const pri = String(ot?.prioridadOperativa ?? ot?.prioridadSugerida ?? '—')
    .trim()
    .toLowerCase();
  const riesgo = Boolean(ot?.riesgoDetectado);

  const head = document.createElement('div');
  head.className = 'hnf-jarvis-decision__head';
  const title = document.createElement('span');
  title.className = 'hnf-jarvis-decision__title';
  title.textContent = 'Jarvis';
  head.append(title);
  const riskHint = document.createElement('span');
  riskHint.className = `hnf-jarvis-decision__risk${riesgo ? ' hnf-jarvis-decision__risk--on' : ''}`;
  riskHint.textContent = riesgo ? '⚠' : '○';
  riskHint.title = riesgo ? 'Riesgo detectado' : 'Sin señales de riesgo';
  head.append(riskHint);
  root.append(head);

  const grid = document.createElement('div');
  grid.className = 'hnf-jarvis-decision__grid';

  const mk = (k, v, areaClass) => {
    const cell = document.createElement('div');
    cell.className = 'hnf-jarvis-decision__cell';
    const kk = document.createElement('div');
    kk.className = 'hnf-jarvis-decision__k';
    kk.textContent = k;
    const vv = document.createElement('div');
    vv.className = `hnf-jarvis-decision__v${areaClass ? ` ${areaClass}` : ''}`;
    vv.textContent = v;
    cell.append(kk, vv);
    return cell;
  };

  const areaCls =
    area === 'clima'
      ? 'hnf-jarvis-decision__v--area-clima'
      : area === 'flota'
        ? 'hnf-jarvis-decision__v--area-flota'
        : '';

  grid.append(
    mk('Área', area === '—' ? '—' : area.toUpperCase(), areaCls),
    mk('Responsable', responsable, ''),
    mk('Prioridad', pri === '—' ? '—' : pri.toUpperCase(), ''),
    mk('Riesgo', riesgo ? 'Sí' : 'No', '')
  );
  root.append(grid);

  return root;
}

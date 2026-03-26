/**
 * Franja superior del centro Jarvis — lectura ejecutiva inmediata (sin ruido técnico).
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * @param {object} opts
 * @param {object} opts.model - Salida de buildExecutiveCommandModel
 * @param {function} [opts.intelNavigate]
 * @param {function} [opts.navigateToView]
 */
export function createHnfExecutiveMandoStrip({ model, intelNavigate, navigateToView } = {}) {
  const m = model && typeof model === 'object' ? model : {};
  const el = document.createElement('section');
  el.className = 'hnf-exec-mando';
  el.setAttribute('aria-label', 'Resumen ejecutivo del día');

  const top = document.createElement('div');
  top.className = 'hnf-exec-mando__top';

  const title = document.createElement('div');
  title.className = 'hnf-exec-mando__title-block';
  title.innerHTML = `<h2 class="hnf-exec-mando__h">Centro de mando</h2>
    <p class="hnf-exec-mando__lead">${esc(m.principalProblema)}</p>`;

  const mode = document.createElement('div');
  mode.className = 'hnf-exec-mando__mode';
  mode.innerHTML = `<span class="hnf-exec-mando__mode-label">Modo de decisión</span>
    <span class="hnf-exec-mando__mode-value">${esc(m.decisionMode?.label || 'Asistido')}</span>`;

  top.append(title, mode);

  const pills = document.createElement('div');
  pills.className = 'hnf-exec-mando__pills';

  const pill = (label, value, tone) => {
    const p = document.createElement('div');
    p.className = `hnf-exec-mando__pill ${tone ? `hnf-exec-mando__pill--${tone}` : ''}`;
    p.innerHTML = `<span class="hnf-exec-mando__pill-l">${esc(label)}</span>
      <span class="hnf-exec-mando__pill-v">${esc(value)}</span>`;
    return p;
  };

  const c = m.centro || {};
  pills.append(
    pill('WhatsApp hoy', String(m.whatsappHoy ?? 0), ''),
    pill('Correos hoy', String(m.correosHoy ?? 0), ''),
    pill('Solicitudes activas', String(m.solicitudesActivas ?? 0), ''),
    pill('Para validar', String(c.requiereValidacion ?? 0), c.requiereValidacion > 0 ? 'warn' : ''),
    pill('Aprobación', String(m.pendienteAprobacion ?? 0), m.pendienteAprobacion > 0 ? 'warn' : ''),
    pill('OT atención', String(m.otCriticas ?? 0), m.otCriticas > 0 ? 'crit' : ''),
    pill('Dinero en operación', m.dineroEnRiesgoLabel || '—', m.dineroEnRiesgo > 0 ? 'money' : '')
  );

  const action = document.createElement('div');
  action.className = 'hnf-exec-mando__action';
  action.innerHTML = `<p class="hnf-exec-mando__action-label">Próximo paso sugerido</p>
    <p class="hnf-exec-mando__action-text">${esc(m.accionSugerida)}</p>
    <p class="hnf-exec-mando__action-meta">Coordinación sugerida: <strong>${esc(m.responsableSugerido)}</strong></p>`;

  const navRow = document.createElement('div');
  navRow.className = 'hnf-exec-mando__nav';

  const mkNav = (label, view) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-exec-mando__link';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (typeof intelNavigate === 'function') intelNavigate({ view });
      else if (typeof navigateToView === 'function') navigateToView(view);
    });
    return b;
  };

  navRow.append(
    mkNav('Bandeja ingreso', 'bandeja-canal'),
    mkNav('Validación y clientes', 'hnf-core'),
    mkNav('Clima', 'clima'),
    mkNav('Flota', 'flota'),
    mkNav('Control', 'control-gerencial')
  );

  const alerts = document.createElement('ul');
  alerts.className = 'hnf-exec-mando__alerts';
  const list = Array.isArray(m.alertasEjecutivas) ? m.alertasEjecutivas.slice(0, 5) : [];
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'hnf-exec-mando__alert hnf-exec-mando__alert--ok';
    li.textContent = 'Sin alertas prioritarias en este momento.';
    alerts.append(li);
  } else {
    for (const a of list) {
      const li = document.createElement('li');
      li.className = 'hnf-exec-mando__alert';
      li.innerHTML = `<strong>${esc(a.titulo)}</strong> · ${esc(a.detalle)}`;
      if (a.nav?.view) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'hnf-exec-mando__alert-go';
        go.textContent = 'Abrir';
        go.addEventListener('click', () => {
          if (typeof intelNavigate === 'function') intelNavigate(a.nav);
          else if (typeof navigateToView === 'function') navigateToView(a.nav.view);
        });
        li.append(document.createTextNode(' '), go);
      }
      alerts.append(li);
    }
  }

  el.append(top, pills, action, navRow, alerts);
  return el;
}

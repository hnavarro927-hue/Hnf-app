/**
 * Jarvis Command Center — UI inmersiva (solo presentación).
 * Datos vía hnfAdn / modelos existentes; navegación y ejecutar igual que el mando previo.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';

let __hnfJarvisPrimaryActionFn = null;
if (typeof window !== 'undefined' && !window.__hnfJarvisPrimaryActionWired) {
  window.__hnfJarvisPrimaryActionWired = true;
  window.addEventListener('hnf-jarvis-primary-action', () => {
    if (typeof __hnfJarvisPrimaryActionFn === 'function') __hnfJarvisPrimaryActionFn();
  });
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function ctaFromAccion(s) {
  const u = String(s || '')
    .trim()
    .slice(0, 28);
  return u || 'Siguiente paso';
}

/**
 * @param {object} opts
 * @param {object} opts.data
 * @param {object} opts.liveCmdModel
 * @param {object} opts.alienDecision
 * @param {object} opts.unified
 * @param {*} [opts.lastDataRefreshAt]
 * @param {Function} [opts.intelNavigate]
 * @param {Function} [opts.navigateToView]
 * @param {Function} [opts.reloadApp]
 * @param {Function} [opts.getPulseState]
 */
export function createHnfJarvisCommandImmersive({
  data,
  liveCmdModel,
  alienDecision,
  unified: _unified,
  lastDataRefreshAt,
  intelNavigate,
  navigateToView,
  reloadApp,
  getPulseState,
} = {}) {
  const raw = data && typeof data === 'object' ? data : {};
  const adn = raw.hnfAdn && typeof raw.hnfAdn === 'object' ? raw.hnfAdn : buildHnfAdnSnapshot(raw);
  const exec =
    adn.executiveCommand && typeof adn.executiveCommand === 'object'
      ? adn.executiveCommand
      : buildExecutiveCommandModel(raw, {
          cards: adn.cards,
          bottleneck: adn.bottleneck,
          principalProblema: adn.principalProblema,
          recomendacion: adn.recomendacion,
          whatsappHoy: adn.whatsappHoy,
          dineroEnRiesgo: adn.dineroEnRiesgo,
          hnfCoreSolicitudStats: adn.hnfCoreSolicitudStats,
          alertas: adn.alertas,
        });

  const traffic = adn.traffic || { bloqueos: 0, pendientes: 0, ok: 0 };
  const cards = Array.isArray(adn.cards) ? adn.cards : [];
  const nucleo = adn.jarvisLiveOrbit?.nucleo || {};

  const pulseSnap =
    typeof getPulseState === 'function'
      ? getPulseState
      : () => ({ running: false });

  const analyzing = Boolean(pulseSnap()?.running);
  const estado = String(alienDecision?.estadoGlobal || '');
  const level = Number(liveCmdModel?.level) || 0;
  let pulseVariant = 'stable';
  if (analyzing) pulseVariant = 'analyze';
  else if (level >= 2 || estado === 'critico') pulseVariant = 'critical';
  else if (level >= 1 || estado === 'tension') pulseVariant = 'warning';

  let ambient = 'stable';
  if (pulseVariant === 'critical') ambient = 'critical';
  else if (pulseVariant === 'warning') ambient = 'warning';

  const sinAsignar = cards.filter((c) => {
    const t = String(c.tecnico || '').trim();
    return !t || t === '—';
  }).length;

  const pumaCritico = cards.some(
    (c) => c.global === 'rojo' && /\bpuma\b/i.test(String(c.cliente || ''))
  );

  const statusParts = ['IA Jarvis activo'];
  if (exec.otCriticas > 0) statusParts.push(`${exec.otCriticas} OT en riesgo`);
  if (pumaCritico) statusParts.push('Puma crítico');
  if (sinAsignar > 0) statusParts.push(`${sinAsignar} sin asignar`);
  if (statusParts.length === 1 && exec.principalProblema) {
    statusParts.push(truncate(exec.principalProblema, 64));
  }
  const statusLine = statusParts.join(' · ');
  const statusHasAlert = exec.otCriticas > 0 || pumaCritico || sinAsignar > 0 || level >= 1;

  const wrap = document.createElement('section');
  wrap.className = 'hnf-cc-immersive';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Centro de comando Jarvis');
  wrap.dataset.ambient = ambient;
  wrap.dataset.pulse = pulseVariant;

  const bg = document.createElement('div');
  bg.className = 'hnf-cc-immersive__bg';
  bg.setAttribute('aria-hidden', 'true');

  const ambientLayer = document.createElement('div');
  ambientLayer.className = 'hnf-cc-immersive__ambient';
  ambientLayer.setAttribute('aria-hidden', 'true');

  const grad = document.createElement('div');
  grad.className = 'hnf-cc-immersive__gradient';
  grad.setAttribute('aria-hidden', 'true');

  const top = document.createElement('header');
  top.className = 'hnf-cc-immersive__top';

  const statusEl = document.createElement('p');
  statusEl.className = 'hnf-cc-immersive__status';
  if (statusHasAlert) statusEl.classList.add('hnf-cc-immersive__status--alert');
  statusEl.textContent = statusLine;

  const pulseBtn = document.createElement('button');
  pulseBtn.type = 'button';
  pulseBtn.className = `hnf-cc-immersive__pulse hnf-cc-immersive__pulse--${pulseVariant}`;
  pulseBtn.setAttribute('aria-label', `Estado: ${pulseVariant}`);
  pulseBtn.title = analyzing ? 'Analizando ciclo MAPE' : 'Estado operativo';

  top.append(statusEl, pulseBtn);

  const modules = document.createElement('div');
  modules.className = 'hnf-cc-immersive__modules';

  const mkMod = (key, title, subtitle, view, extraClass = '') => {
    const mod = document.createElement('article');
    mod.className = `hnf-cc-mod ${extraClass}`.trim();
    mod.dataset.mod = key;

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'hnf-cc-mod__head';
    head.setAttribute('aria-expanded', 'false');

    const h = document.createElement('h2');
    h.className = 'hnf-cc-mod__title';
    h.textContent = title;

    const sub = document.createElement('p');
    sub.className = 'hnf-cc-mod__sub';
    sub.textContent = subtitle;

    const body = document.createElement('div');
    body.className = 'hnf-cc-mod__body';
    body.hidden = true;

    const go = document.createElement('span');
    go.className = 'hnf-cc-mod__go';
    go.textContent = 'Abrir vista →';

    head.append(h, sub);
    mod.append(head, body, go);

    const fillBody = () => {
      body.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'hnf-cc-mod__detail';
      p.textContent = subtitle;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hnf-cc-mod__cta';
      b.textContent = 'Ir al módulo';
      b.addEventListener('click', () => navigateToView?.(view));
      body.append(p, b);
    };
    fillBody();

    head.addEventListener('click', () => {
      const open = !mod.classList.contains('hnf-cc-mod--open');
      mod.classList.toggle('hnf-cc-mod--open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    });

    mod.addEventListener('dblclick', () => navigateToView?.(view));

    return mod;
  };

  const finLabel = exec.dineroEnRiesgo > 0 ? exec.dineroEnRiesgoLabel : 'Sin foco monetario urgente';
  const otLine =
    traffic.bloqueos > 0 || traffic.pendientes > 0
      ? `${traffic.bloqueos} crít. · ${traffic.pendientes} atención · ${traffic.ok} OK`
      : `${traffic.totalOt ?? cards.length} OT monitoreadas`;

  modules.append(
    mkMod('fin', 'Finanzas', truncate(finLabel, 72), 'finanzas', 'hnf-cc-mod--ne'),
    mkMod('ops', 'Operaciones', truncate(exec.lineaOperacionHoy, 80), 'operacion-control', 'hnf-cc-mod--nw'),
    mkMod('ot', 'OT / Tiempo', truncate(otLine, 72), 'clima', 'hnf-cc-mod--sw'),
    mkMod('fleet', 'Flota', `${exec.flotaAbiertas} solicitud(es) abierta(s)`, 'flota', 'hnf-cc-mod--se')
  );

  const center = document.createElement('div');
  center.className = 'hnf-cc-immersive__center';

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'hnf-cc-immersive__cta';
  cta.id = 'hnf-ejecutar-propuesta-mando';
  cta.textContent = ctaFromAccion(nucleo.siguienteAccion || adn.recomendacion);

  const runExec = () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  };
  cta.addEventListener('click', runExec);
  __hnfJarvisPrimaryActionFn = runExec;

  const sync = document.createElement('button');
  sync.type = 'button';
  sync.className = 'hnf-cc-immersive__sync';
  sync.textContent = 'Sincronizar';
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      sync.disabled = false;
    }
  });

  center.append(cta, sync);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'hnf-cc-immersive__fab';
  fab.textContent = 'Contexto IA';
  fab.setAttribute('aria-expanded', 'false');

  const backdrop = document.createElement('div');
  backdrop.className = 'hnf-cc-immersive__backdrop';

  const drawer = document.createElement('aside');
  drawer.className = 'hnf-cc-immersive__drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('aria-label', 'Panel contextual Jarvis');

  const drawerHead = document.createElement('div');
  drawerHead.className = 'hnf-cc-immersive__drawer-head';

  const drawerTitle = document.createElement('h3');
  drawerTitle.className = 'hnf-cc-immersive__drawer-title';
  drawerTitle.textContent = 'Intel & acciones';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'hnf-cc-immersive__drawer-close';
  closeBtn.textContent = 'Cerrar';

  drawerHead.append(drawerTitle, closeBtn);

  const alertsBlock = document.createElement('div');
  alertsBlock.className = 'hnf-cc-immersive__drawer-section';
  const alertsH = document.createElement('h4');
  alertsH.className = 'hnf-cc-immersive__drawer-h';
  alertsH.textContent = 'Alertas';
  const alertsUl = document.createElement('ul');
  alertsUl.className = 'hnf-cc-immersive__drawer-list';
  const alertas = Array.isArray(exec.alertasEjecutivas) ? exec.alertasEjecutivas : [];
  if (!alertas.length) {
    const li = document.createElement('li');
    li.className = 'hnf-cc-immersive__drawer-empty';
    li.textContent = 'Sin alertas ejecutivas en este corte.';
    alertsUl.append(li);
  } else {
    for (const a of alertas.slice(0, 8)) {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = a.titulo || 'Alerta';
      const span = document.createElement('span');
      span.textContent = truncate(a.detalle, 120);
      const row = document.createElement('div');
      row.className = 'hnf-cc-immersive__drawer-li';
      row.append(strong, span);
      if (a.nav?.view) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'hnf-cc-immersive__drawer-link';
        go.textContent = 'Ir';
        go.addEventListener('click', () => {
          if (typeof intelNavigate === 'function') intelNavigate(a.nav);
          else navigateToView?.(a.nav.view);
          closeDrawer();
        });
        row.append(go);
      }
      li.append(row);
      alertsUl.append(li);
    }
  }
  alertsBlock.append(alertsH, alertsUl);

  const recBlock = document.createElement('div');
  recBlock.className = 'hnf-cc-immersive__drawer-section';
  const recH = document.createElement('h4');
  recH.className = 'hnf-cc-immersive__drawer-h';
  recH.textContent = 'Recomendación';
  const recP = document.createElement('p');
  recP.className = 'hnf-cc-immersive__drawer-text';
  recP.textContent = truncate(exec.recomendacion || adn.recomendacion, 220);
  recBlock.append(recH, recP);

  const quick = document.createElement('div');
  quick.className = 'hnf-cc-immersive__drawer-section';
  const quickH = document.createElement('h4');
  quickH.className = 'hnf-cc-immersive__drawer-h';
  quickH.textContent = 'Acciones rápidas';
  const quickRow = document.createElement('div');
  quickRow.className = 'hnf-cc-immersive__quick';
  const qDefs = [
    { label: 'Ingesta', view: 'bandeja-canal' },
    { label: 'Planificación', view: 'planificacion' },
    { label: 'Comercial', view: 'oportunidades' },
    { label: 'Documentos', view: 'documentos-tecnicos' },
  ];
  for (const q of qDefs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-cc-immersive__quick-btn';
    b.textContent = q.label;
    b.addEventListener('click', () => {
      navigateToView?.(q.view);
      closeDrawer();
    });
    quickRow.append(b);
  }
  quick.append(quickH, quickRow);

  const meta = document.createElement('p');
  meta.className = 'hnf-cc-immersive__drawer-meta';
  try {
    const t = lastDataRefreshAt ? new Date(lastDataRefreshAt).toLocaleString('es-CL') : '—';
    meta.textContent = `Última sincronización: ${t}`;
  } catch {
    meta.textContent = '';
  }

  drawer.append(drawerHead, alertsBlock, recBlock, quick, meta);

  const openDrawer = () => {
    drawer.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    backdrop.classList.add('hnf-cc-immersive__backdrop--on');
    wrap.classList.add('hnf-cc-immersive--drawer-open');
    closeBtn.focus();
  };
  const closeDrawer = () => {
    drawer.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
    backdrop.classList.remove('hnf-cc-immersive__backdrop--on');
    wrap.classList.remove('hnf-cc-immersive--drawer-open');
  };

  pulseBtn.addEventListener('click', openDrawer);
  statusEl.addEventListener('click', openDrawer);
  statusEl.style.cursor = 'pointer';
  statusEl.setAttribute('role', 'button');
  statusEl.tabIndex = 0;
  statusEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDrawer();
    }
  });
  fab.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  wrap.append(bg, ambientLayer, grad, top, modules, center, fab, backdrop, drawer);

  return wrap;
}

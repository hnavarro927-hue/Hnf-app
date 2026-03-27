/**
 * Jarvis HQ — layout premium ejecutivo (solo presentación).
 * Reemplazo visual completo: grid alineado, sin órbita ni núcleo circular.
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { buildExecutiveCommandModel } from '../domain/hnf-executive-command.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';
import { getControlState, setMode } from '../domain/jarvis-control-center.js';

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
    .slice(0, 32);
  return u || 'Ejecutar siguiente paso';
}

function mapEstadoGlobal(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'critico') return { label: 'Crítico', tone: 'crit' };
  if (e === 'tension') return { label: 'Tensión operativa', tone: 'warn' };
  return { label: 'Estable', tone: 'ok' };
}

function mapJarvisMode(mode) {
  const m = String(mode || 'observe');
  if (m === 'autonomic_safe') return 'Automático (seguro)';
  if (m === 'assist') return 'Asistido';
  if (m === 'off') return 'Manual';
  return 'Observación';
}

/**
 * @param {object} opts
 * @param {object} opts.data
 * @param {object} opts.liveCmdModel
 * @param {object} opts.alienDecision
 * @param {Function} [opts.intelNavigate]
 * @param {Function} [opts.navigateToView]
 * @param {Function} [opts.reloadApp]
 * @param {Function} [opts.getPulseState]
 */
export function createHnfJarvisPremiumCommand({
  data,
  liveCmdModel,
  alienDecision,
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

  const nucleo = adn.jarvisLiveOrbit?.nucleo || {};
  const o = adn.orbits || {};
  const ctrl = getControlState();
  const estado = mapEstadoGlobal(alienDecision?.estadoGlobal);
  const level = Number(liveCmdModel?.level) || 0;
  if (level >= 2) estado.tone = 'crit';
  else if (level >= 1 && estado.tone === 'ok') estado.tone = 'warn';

  const pulseSnap = typeof getPulseState === 'function' ? getPulseState : () => ({ running: false });
  const analyzing = Boolean(pulseSnap()?.running);

  const alerts = Array.isArray(exec.alertasEjecutivas) ? exec.alertasEjecutivas : [];
  const firstAlert = alerts[0];
  const alertTitle = firstAlert?.titulo || 'Sin alerta prioritaria';
  const alertDetail = truncate(firstAlert?.detalle || exec.principalProblema || adn.principalProblema, 140);

  const runExec = () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  };
  __hnfJarvisPrimaryActionFn = runExec;

  const root = document.createElement('section');
  root.className = 'hnf-jarvis-premium';
  root.id = 'hnf-mando-principal-v2';
  root.setAttribute('aria-label', 'Centro de comando Jarvis');
  root.dataset.presenceTone = estado.tone;
  if (analyzing) root.dataset.pulseActive = '1';

  const atm = document.createElement('div');
  atm.className = 'hnf-jarvis-premium__atm';
  atm.setAttribute('aria-hidden', 'true');
  const atmGrad = document.createElement('div');
  atmGrad.className = 'hnf-jarvis-premium__atm-grad';
  atm.append(atmGrad);

  const shell = document.createElement('div');
  shell.className = 'hnf-jarvis-premium__shell';

  /* —— Encabezado ejecutivo —— */
  const execHeader = document.createElement('header');
  execHeader.className = 'hnf-jarvis-premium__exec';

  const mkCell = (eyebrow, extraClass = '') => {
    const cell = document.createElement('div');
    cell.className = `hnf-jarvis-premium__exec-cell ${extraClass}`.trim();
    return cell;
  };

  const cellEstado = mkCell('', 'hnf-jarvis-premium__exec-cell--estado');
  const labE = document.createElement('span');
  labE.className = 'hnf-jarvis-premium__exec-eyebrow';
  labE.textContent = 'Estado general';
  const rowE = document.createElement('div');
  rowE.className = 'hnf-jarvis-premium__exec-row';
  const dot = document.createElement('span');
  dot.className = `hnf-jarvis-premium__pulse-dot hnf-jarvis-premium__pulse-dot--${analyzing ? 'scan' : estado.tone}`;
  dot.title = analyzing ? 'Ciclo de análisis activo' : 'Señal operativa';
  const valE = document.createElement('strong');
  valE.className = 'hnf-jarvis-premium__exec-value';
  valE.textContent = estado.label;
  rowE.append(dot, valE);
  cellEstado.append(labE, rowE);

  const cellModo = mkCell();
  const labM = document.createElement('span');
  labM.className = 'hnf-jarvis-premium__exec-eyebrow';
  labM.textContent = 'Modo Jarvis';
  const chips = document.createElement('div');
  chips.className = 'hnf-jarvis-premium__mode-chips';
  const modeMap = [
    { key: 'autonomic_safe', label: 'Auto' },
    { key: 'assist', label: 'Asistido' },
    { key: 'observe', label: 'Manual' },
  ];
  const syncModes = () => {
    const { jarvisMode } = getControlState();
    const eff = jarvisMode === 'off' ? 'observe' : jarvisMode;
    chips.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('hnf-jarvis-premium__mode-chip--on', b.dataset.mode === eff);
    });
  };
  for (const x of modeMap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-jarvis-premium__mode-chip';
    b.dataset.mode = x.key;
    b.textContent = x.label;
    b.addEventListener('click', () => {
      setMode(x.key);
      syncModes();
    });
    chips.append(b);
  }
  syncModes();
  const modHint = document.createElement('span');
  modHint.className = 'hnf-jarvis-premium__exec-hint';
  modHint.textContent = mapJarvisMode(ctrl.jarvisMode);
  cellModo.append(labM, chips, modHint);

  const cellAlert = mkCell('', 'hnf-jarvis-premium__exec-cell--alert');
  const labA = document.createElement('span');
  labA.className = 'hnf-jarvis-premium__exec-eyebrow';
  labA.textContent = 'Alerta principal';
  const titA = document.createElement('strong');
  titA.className = 'hnf-jarvis-premium__alert-title';
  titA.textContent = alertTitle;
  const detA = document.createElement('p');
  detA.className = 'hnf-jarvis-premium__alert-detail';
  detA.textContent = alertDetail;
  const alertRow = document.createElement('div');
  alertRow.className = 'hnf-jarvis-premium__alert-row';
  alertRow.append(titA);
  if (firstAlert?.nav?.view) {
    const ver = document.createElement('button');
    ver.type = 'button';
    ver.className = 'hnf-jarvis-premium__alert-link';
    ver.textContent = 'Ver';
    ver.addEventListener('click', () => {
      if (typeof intelNavigate === 'function') intelNavigate(firstAlert.nav);
      else navigateToView?.(firstAlert.nav.view);
    });
    alertRow.append(ver);
  }
  cellAlert.append(labA, alertRow, detA);

  const cellNext = mkCell('', 'hnf-jarvis-premium__exec-cell--next');
  const labN = document.createElement('span');
  labN.className = 'hnf-jarvis-premium__exec-eyebrow';
  labN.textContent = 'Siguiente paso';
  const nextLine = document.createElement('p');
  nextLine.className = 'hnf-jarvis-premium__next-line';
  nextLine.textContent = truncate(
    liveCmdModel?.liveBrief || nucleo.problemaPrincipal || exec.recomendacion || adn.recomendacion,
    120
  );
  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'hnf-jarvis-premium__exec-cta';
  btnExec.textContent = ctaFromAccion(nucleo.siguienteAccion || exec.recomendacion || adn.recomendacion);
  btnExec.addEventListener('click', runExec);
  cellNext.append(labN, nextLine, btnExec);

  execHeader.append(cellEstado, cellModo, cellAlert, cellNext);

  /* —— Cuerpo: presencia + módulos —— */
  const main = document.createElement('div');
  main.className = 'hnf-jarvis-premium__main';

  const presence = document.createElement('div');
  presence.className = 'hnf-jarvis-premium__presence';
  presence.setAttribute('aria-label', 'Presencia operativa Jarvis');

  const presInner = document.createElement('div');
  presInner.className = 'hnf-jarvis-premium__presence-inner';

  const presTop = document.createElement('div');
  presTop.className = 'hnf-jarvis-premium__presence-top';
  const brand = document.createElement('span');
  brand.className = 'hnf-jarvis-premium__presence-brand';
  brand.textContent = 'JARVIS';
  const presSync = document.createElement('button');
  presSync.type = 'button';
  presSync.className = 'hnf-jarvis-premium__presence-sync';
  presSync.textContent = 'Sincronizar datos';
  presSync.addEventListener('click', async () => {
    presSync.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      presSync.disabled = false;
    }
  });
  presTop.append(brand, presSync);

  const focus = document.createElement('p');
  focus.className = 'hnf-jarvis-premium__presence-focus';
  focus.textContent = truncate(nucleo.problemaPrincipal || adn.principalProblema || 'Operación en curso.', 160);

  const metric = document.createElement('p');
  metric.className = 'hnf-jarvis-premium__presence-metric';
  const riskFmt =
    nucleo.dineroRiesgoFmt ||
    (adn.dineroEnRiesgo ? `Riesgo estimado ~$${Math.round(adn.dineroEnRiesgo).toLocaleString('es-CL')}` : 'Sin monto crítico en este corte');
  metric.textContent = riskFmt;

  presInner.append(presTop, focus, metric);
  presence.append(presInner);

  const modules = document.createElement('div');
  modules.className = 'hnf-jarvis-premium__modules';

  const defaults = {
    planificacion: { label: 'Planificación', view: 'planificacion', hint: 'Calendario operativo' },
    clima: { label: 'Clima', view: 'clima', hint: 'OT y tiempos' },
    flota: { label: 'Flota', view: 'flota', hint: 'Solicitudes y movilidad' },
    comercial: { label: 'Comercial', view: 'oportunidades', hint: 'Pipeline' },
    control: { label: 'Control', view: 'control-gerencial', hint: 'Gerencia y eventos' },
  };

  const order = ['planificacion', 'clima', 'flota', 'comercial', 'control'];
  for (const key of order) {
    const def = { ...defaults[key], ...(o[key] || {}) };
    const panel = document.createElement('button');
    panel.type = 'button';
    panel.className = 'hnf-jarvis-premium__panel';
    panel.addEventListener('click', () => navigateToView?.(def.view));

    const pEyebrow = document.createElement('span');
    pEyebrow.className = 'hnf-jarvis-premium__panel-eyebrow';
    pEyebrow.textContent = def.hint || 'Módulo';

    const pTitle = document.createElement('span');
    pTitle.className = 'hnf-jarvis-premium__panel-title';
    pTitle.textContent = def.label;

    const badge = def.badge != null && def.badge !== '' ? String(def.badge) : '—';
    const pSig = document.createElement('span');
    pSig.className = 'hnf-jarvis-premium__panel-signal';
    pSig.textContent = badge;

    const pGo = document.createElement('span');
    pGo.className = 'hnf-jarvis-premium__panel-go';
    pGo.textContent = 'Entrar';

    panel.append(pEyebrow, pTitle, pSig, pGo);
    modules.append(panel);
  }

  const intel = document.createElement('details');
  intel.className = 'hnf-jarvis-premium__intel';
  const intelSum = document.createElement('summary');
  intelSum.className = 'hnf-jarvis-premium__intel-sum';
  intelSum.textContent = 'Intel ampliado · alertas y accesos';
  const intelBody = document.createElement('div');
  intelBody.className = 'hnf-jarvis-premium__intel-body';
  if (!alerts.length) {
    const p = document.createElement('p');
    p.className = 'hnf-jarvis-premium__intel-empty';
    p.textContent = 'No hay más alertas en cola ejecutiva.';
    intelBody.append(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'hnf-jarvis-premium__intel-list';
    for (const a of alerts.slice(0, 12)) {
      const li = document.createElement('li');
      li.className = 'hnf-jarvis-premium__intel-li';
      const st = document.createElement('strong');
      st.textContent = truncate(a.titulo, 48);
      const sp = document.createElement('span');
      sp.textContent = truncate(a.detalle, 100);
      li.append(st, sp);
      if (a.nav?.view) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hnf-jarvis-premium__intel-btn';
        b.textContent = 'Abrir';
        b.addEventListener('click', () => {
          if (typeof intelNavigate === 'function') intelNavigate(a.nav);
          else navigateToView?.(a.nav.view);
        });
        li.append(b);
      }
      ul.append(li);
    }
    intelBody.append(ul);
  }
  const quick = document.createElement('div');
  quick.className = 'hnf-jarvis-premium__intel-quick';
  for (const q of [
    { t: 'Ingesta', v: 'bandeja-canal' },
    { t: 'Documentos', v: 'documentos-tecnicos' },
    { t: 'HNF Core', v: 'hnf-core' },
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hnf-jarvis-premium__intel-quick-btn';
    b.textContent = q.t;
    b.addEventListener('click', () => navigateToView?.(q.v));
    quick.append(b);
  }
  intelBody.append(quick);
  intel.append(intelSum, intelBody);

  main.append(presence, modules, intel);
  shell.append(execHeader, main);
  root.append(atm, shell);

  return root;
}

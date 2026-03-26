/**
 * Mando Jarvis — sistema operativo visual: cerebro + flujo problema → análisis → acción + órbitas.
 * Consume preferentemente `data.hnfAdn` (buildHnfAdnSnapshot en loadFullOperationalData).
 */

import { buildHnfAdnSnapshot } from '../domain/hnf-adn.js';
import { SEMAFORO_EMOJI } from '../domain/control-operativo-tiempo-real.js';
import { ejecutarPropuestaGlobal } from '../domain/evento-operativo.js';
import { otCanClose } from '../utils/ot-evidence.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

function flattenTopActions(board, limit = 5) {
  const order = ['ejecutar_hoy', 'cobrar_hoy', 'aprobar_hoy', 'revisar_hoy', 'vender_hoy', 'seguimiento'];
  const out = [];
  const b = board?.buckets || {};
  for (const key of order) {
    for (const a of b[key] || []) {
      out.push(a);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function findFirstCloseableOtId(raw) {
  const list = raw?.planOts ?? raw?.ots?.data ?? [];
  if (!Array.isArray(list)) return null;
  for (const ot of list) {
    if (String(ot?.estado || '').toLowerCase() === 'terminado') continue;
    try {
      if (otCanClose(ot)) return ot.id ?? ot._id ?? null;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * @param {object} p
 * @param {object} p.data
 * @param {object} p.liveCmdModel
 * @param {object} p.board
 * @param {Function} [p.intelNavigate]
 * @param {Function} [p.navigateToView]
 * @param {Function} [p.reloadApp]
 */
export function createHnfMandoPrincipalV2({
  data,
  liveCmdModel,
  board,
  intelNavigate,
  navigateToView,
  reloadApp,
}) {
  const raw = data || {};
  const adn = raw.hnfAdn && typeof raw.hnfAdn === 'object' ? raw.hnfAdn : buildHnfAdnSnapshot(raw);

  const wrap = document.createElement('section');
  wrap.className = 'hnf-jarvis-os hnf-mando-v2';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Jarvis — cerebro operativo HNF');

  const head = document.createElement('header');
  head.className = 'hnf-jarvis-os__head';
  head.innerHTML = `
    <div class="hnf-jarvis-os__brand">
      <span class="hnf-jarvis-os__dna">ADN HNF</span>
      <h2 class="hnf-jarvis-os__title">JARVIS · cerebro operativo</h2>
      <p class="hnf-jarvis-os__sub">Una sola lectura: riesgo del día, cuello de botella, decisión y órbitas conectadas.</p>
    </div>
    <div class="hnf-jarvis-os__pulse" role="status">
      <span class="hnf-jarvis-os__pulse-dot"></span>
      <span class="hnf-jarvis-os__pulse-txt">Datos unificados · loadFullOperationalData</span>
    </div>
  `;

  const flow = document.createElement('div');
  flow.className = 'hnf-jarvis-os__flow';
  flow.setAttribute('aria-label', 'Problema, análisis y acción');

  const colProblem = document.createElement('div');
  colProblem.className = 'hnf-jarvis-os__col hnf-jarvis-os__col--problem';
  colProblem.innerHTML = `<h3 class="hnf-jarvis-os__col-h"><span class="hnf-jarvis-os__ico hnf-jarvis-os__ico--red">🔴</span> Principal problema del día</h3>`;
  const problemP = document.createElement('p');
  problemP.className = 'hnf-jarvis-os__col-body';
  problemP.textContent = adn.principalProblema;
  colProblem.append(problemP);

  const metrics = document.createElement('div');
  metrics.className = 'hnf-jarvis-os__metrics';
  metrics.innerHTML = `
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--red"><span class="hnf-jarvis-os__metric-k">Bloqueos</span><strong>${adn.traffic.bloqueos}</strong></div>
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--amber"><span class="hnf-jarvis-os__metric-k">Pendientes</span><strong>${adn.traffic.pendientes}</strong></div>
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--green"><span class="hnf-jarvis-os__metric-k">OK</span><strong>${adn.traffic.ok}</strong></div>
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--neutral"><span class="hnf-jarvis-os__metric-k">Riesgo $</span><strong>$${fmtMoney(adn.dineroEnRiesgo)}</strong></div>
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--neutral"><span class="hnf-jarvis-os__metric-k">Eventos</span><strong>${adn.totalEventosActivos}</strong></div>
    <div class="hnf-jarvis-os__metric hnf-jarvis-os__metric--wa"><span class="hnf-jarvis-os__metric-k">WA hoy</span><strong>${adn.whatsappHoy}</strong></div>
  `;
  colProblem.append(metrics);

  const colAnalysis = document.createElement('div');
  colAnalysis.className = 'hnf-jarvis-os__col hnf-jarvis-os__col--analysis';
  colAnalysis.innerHTML = `<h3 class="hnf-jarvis-os__col-h"><span class="hnf-jarvis-os__ico hnf-jarvis-os__ico--amber">🟡</span> Análisis · cuello de botella</h3>`;
  const bottleneckP = document.createElement('p');
  bottleneckP.className = 'hnf-jarvis-os__col-body';
  if (adn.bottleneck) {
    bottleneckP.textContent = `${SEMAFORO_EMOJI[adn.bottleneck.global]} OT ${adn.bottleneck.otId} · ${adn.bottleneck.cliente} · técnico ${adn.bottleneck.tecnico}`;
  } else {
    bottleneckP.textContent = '🟢 Sin cuello crítico en este snapshot.';
  }
  const recP = document.createElement('p');
  recP.className = 'hnf-jarvis-os__recommend';
  recP.innerHTML = `<strong>Recomendación automática:</strong> ${adn.recomendacion}`;
  colAnalysis.append(bottleneckP, recP);

  const tops = flattenTopActions(board, 1);
  if (tops.length || liveCmdModel?.headline) {
    const sug = document.createElement('p');
    sug.className = 'muted small hnf-jarvis-os__sug';
    sug.textContent = tops.length
      ? `Acción sugerida (cola): ${String(tops[0].titulo || tops[0].motivo || '').slice(0, 140)}`
      : String(liveCmdModel?.headline || liveCmdModel?.mandatoryAction || '').slice(0, 160);
    if (sug.textContent.trim()) colAnalysis.append(sug);
  }

  const colAction = document.createElement('div');
  colAction.className = 'hnf-jarvis-os__col hnf-jarvis-os__col--action';
  colAction.innerHTML = `<h3 class="hnf-jarvis-os__col-h"><span class="hnf-jarvis-os__ico hnf-jarvis-os__ico--green">🟢</span> Acción inmediata</h3>`;

  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.id = 'hnf-ejecutar-propuesta-mando';
  btnExec.className = 'primary-button hnf-jarvis-os__btn-main';
  btnExec.textContent = 'Ejecutar ahora (cola inteligente)';
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
  });

  const rowQuick = document.createElement('div');
  rowQuick.className = 'hnf-jarvis-os__quick';
  const mkSec = (label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button hnf-jarvis-os__btn-sec';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  rowQuick.append(
    mkSec('Clima (OT)', () => navigateToView?.('clima')),
    mkSec('Ingreso datos', () => navigateToView?.('ingreso-operativo'))
  );
  colAction.append(btnExec, rowQuick);

  flow.append(colProblem, colAnalysis, colAction);

  const intelRow = document.createElement('div');
  intelRow.className = 'hnf-jarvis-os__intel-actions';
  intelRow.setAttribute('aria-label', 'Acciones inteligentes');
  const mkIntel = (label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button hnf-jarvis-os__intel-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const bottleneckId = adn.bottleneck?.otId ?? null;
  const closeId = findFirstCloseableOtId(raw);
  intelRow.append(
    mkIntel('Resolver cuello de botella', () => {
      if (bottleneckId) navigateToView?.('clima', { otId: bottleneckId });
      else ejecutarPropuestaGlobal(adn.eventosUnificados, { intelNavigate, navigateToView });
    }),
    mkIntel('Asignar técnico', () => {
      navigateToView?.('clima', bottleneckId ? { otId: bottleneckId } : undefined);
    }),
    mkIntel('Cerrar OT pendiente', () => {
      if (closeId) navigateToView?.('clima', { otId: closeId });
      else navigateToView?.('clima');
    }),
    mkIntel('Contactar cliente', () => navigateToView?.('whatsapp'))
  );

  const orbits = document.createElement('nav');
  orbits.className = 'hnf-jarvis-os__orbits';
  orbits.setAttribute('aria-label', 'Módulos orbitales');
  const orbitEntries = Object.values(adn.orbits || {});
  for (const o of orbitEntries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hnf-jarvis-os__orbit';
    const n = Number(o.badge) || 0;
    btn.innerHTML = `
      <span class="hnf-jarvis-os__orbit-label">${o.label}</span>
      <span class="hnf-jarvis-os__orbit-badge" data-empty="${n === 0 ? '1' : '0'}">${n}</span>
      <span class="hnf-jarvis-os__orbit-hint muted">${o.hint || ''}</span>
    `;
    btn.addEventListener('click', () => navigateToView?.(o.view));
    orbits.append(btn);
  }

  const detail = document.createElement('div');
  detail.className = 'hnf-jarvis-os__detail';
  const detH = document.createElement('h3');
  detH.className = 'hnf-jarvis-os__detail-h';
  detH.textContent = 'Detalle OT · flujo técnico → admin → cliente';
  const sc = document.createElement('div');
  sc.className = 'hnf-mando-v2__otscroll';
  const show = (adn.cards || []).slice(0, 14);
  if (!show.length) {
    sc.append(
      Object.assign(document.createElement('p'), {
        className: 'muted',
        textContent: 'Sin OT en datos. Revisá conexión API o planificación.',
      })
    );
  } else {
    for (const c of show) {
      const mini = document.createElement('article');
      mini.className = `hnf-mando-v2-mini hnf-mando-v2-mini--${c.global}`;
      mini.innerHTML = `
        <div class="hnf-mando-v2-mini__top"><span class="hnf-mando-v2-mini__glob">${SEMAFORO_EMOJI[c.global]}</span><span class="hnf-mando-v2-mini__id">${c.otId}</span></div>
        <div class="hnf-mando-v2-mini__cli">${c.cliente}</div>
        <div class="hnf-mando-v2-mini__tec">${c.tecnico}</div>
        <div class="hnf-mando-v2-mini__et">
          <span>T ${SEMAFORO_EMOJI[c.etapa1.semaforo]}</span>
          <span>A ${SEMAFORO_EMOJI[c.etapa2.semaforo]}</span>
          <span>C ${SEMAFORO_EMOJI[c.etapa3.semaforo]}</span>
        </div>
      `;
      mini.addEventListener('click', () => navigateToView?.('clima', { otId: c.otId }));
      mini.setAttribute('role', 'button');
      mini.tabIndex = 0;
      mini.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          navigateToView?.('clima', { otId: c.otId });
        }
      });
      sc.append(mini);
    }
  }
  detail.append(detH, sc);

  const foot = document.createElement('footer');
  foot.className = 'hnf-jarvis-os__foot';
  const btnRef = document.createElement('button');
  btnRef.type = 'button';
  btnRef.className = 'secondary-button';
  btnRef.textContent = 'Sincronizar ADN';
  btnRef.addEventListener('click', async () => {
    btnRef.disabled = true;
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      btnRef.disabled = false;
    }
  });
  foot.append(
    btnRef,
    Object.assign(document.createElement('span'), {
      className: 'muted small',
      textContent: 'Caché: recarga forzada en el dispositivo si no ves cambios.',
    })
  );

  wrap.append(head, flow, intelRow, orbits, detail, foot);
  return wrap;
}

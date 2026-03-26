/**
 * Bloque único de mando visible en la vista principal (jarvis).
 * Consolida estado del día, alertas OT, acción inmediata, tarjetas OT y señales WhatsApp/admin/cliente.
 */

import {
  buildControlOperativoAlertas,
  buildControlOperativoCards,
  SEMAFORO_EMOJI,
} from '../domain/control-operativo-tiempo-real.js';
import {
  aggregateMandoFromEventos,
  buildFlujoOperativoUnificado,
  ejecutarPropuestaGlobal,
} from '../domain/evento-operativo.js';

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
  const wrap = document.createElement('section');
  wrap.className = 'hnf-mando-v2';
  wrap.id = 'hnf-mando-principal-v2';
  wrap.setAttribute('aria-label', 'Centro de mando operativo principal');

  const ribbon = document.createElement('div');
  ribbon.className = 'hnf-mando-v2__ribbon';
  ribbon.innerHTML = `
    <div class="hnf-mando-v2__ribbon-main">
      <span class="hnf-mando-v2__ribbon-tag">VISTA PRINCIPAL · IPAD / OPERACIÓN</span>
      <h2 class="hnf-mando-v2__ribbon-h">CENTRO DE MANDO HNF</h2>
      <p class="hnf-mando-v2__ribbon-sub">Un solo panel: día, alertas, OT en vivo, WhatsApp y cuello de botella. Actualizado con cada sincronización.</p>
    </div>
  `;

  const eventosUnificados = buildFlujoOperativoUnificado(data || {});
  const agg = aggregateMandoFromEventos(eventosUnificados);
  const estadoTxt =
    agg.estado_general === 'critico' ? 'CRÍTICO' : agg.estado_general === 'atencion' ? 'ATENCIÓN' : 'OK';
  const estadoClass =
    agg.estado_general === 'critico' ? 'rojo' : agg.estado_general === 'atencion' ? 'naranja' : 'verde';

  const cards = buildControlOperativoCards(data || {});
  const alertas = buildControlOperativoAlertas(cards);

  const waMsgs = Array.isArray(data?.whatsappFeed?.messages) ? data.whatsappFeed.messages : [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const waHoy = waMsgs.filter((m) => {
    const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= dayStart.getTime();
  }).length;

  const rowEstado = document.createElement('div');
  rowEstado.className = 'hnf-mando-v2__row hnf-mando-v2__row--estado';
  rowEstado.innerHTML = `
    <div class="hnf-mando-v2__pill hnf-mando-v2__pill--${estadoClass}">
      <span class="hnf-mando-v2__pill-k">Estado del día</span>
      <strong class="hnf-mando-v2__pill-v">${estadoTxt}</strong>
    </div>
    <div class="hnf-mando-v2__pill hnf-mando-v2__pill--neutral">
      <span class="hnf-mando-v2__pill-k">Dinero en riesgo (eventos)</span>
      <strong class="hnf-mando-v2__pill-v">$${fmtMoney(agg.dinero_en_riesgo)}</strong>
    </div>
    <div class="hnf-mando-v2__pill hnf-mando-v2__pill--neutral">
      <span class="hnf-mando-v2__pill-k">Eventos activos</span>
      <strong class="hnf-mando-v2__pill-v">${agg.total_activos}</strong>
    </div>
    <div class="hnf-mando-v2__pill hnf-mando-v2__pill--wa">
      <span class="hnf-mando-v2__pill-k">WhatsApp hoy</span>
      <strong class="hnf-mando-v2__pill-v">${waHoy}</strong>
    </div>
  `;

  const rowAlertas = document.createElement('div');
  rowAlertas.className = 'hnf-mando-v2__alertas';
  const mkA = (emoji, n, txt) => {
    const d = document.createElement('div');
    d.className = 'hnf-mando-v2__alerta';
    d.append(
      Object.assign(document.createElement('span'), { className: 'hnf-mando-v2__alerta-n', textContent: String(n) }),
      Object.assign(document.createElement('span'), { className: 'hnf-mando-v2__alerta-t', textContent: `${emoji} ${txt}` })
    );
    return d;
  };
  rowAlertas.append(
    mkA('🔴', alertas.sinInformeTecnico, 'OT sin informe técnico'),
    mkA('🟠', alertas.pendientesAdmin, 'OT pendientes admin'),
    mkA('🔴', alertas.noEnviadasCliente, 'OT no enviadas a cliente')
  );

  const rowCuello = document.createElement('div');
  rowCuello.className = 'hnf-mando-v2__cuello';
  const cuelloTitle = document.createElement('h3');
  cuelloTitle.className = 'hnf-mando-v2__cuello-h';
  cuelloTitle.textContent = 'Quién frena el proceso (peor estado primero)';
  const cuelloUl = document.createElement('ul');
  cuelloUl.className = 'hnf-mando-v2__cuello-ul';
  const worst = [...cards].slice(0, 5);
  for (const c of worst) {
    if (c.global === 'verde') continue;
    const li = document.createElement('li');
    li.className = `hnf-mando-v2__cuello-li hnf-mando-v2__cuello-li--${c.global}`;
    li.textContent = `${SEMAFORO_EMOJI[c.global]} ${c.otId} · ${c.cliente} · técnico ${c.tecnico}`;
    cuelloUl.append(li);
  }
  if (!cuelloUl.childElementCount) {
    const li = document.createElement('li');
    li.className = 'hnf-mando-v2__cuello-li hnf-mando-v2__cuello-li--verde';
    li.textContent = '🟢 Sin cuellos críticos en este snapshot.';
    cuelloUl.append(li);
  }
  rowCuello.append(cuelloTitle, cuelloUl);

  const rowAccion = document.createElement('div');
  rowAccion.className = 'hnf-mando-v2__accion';
  const accIntro = document.createElement('p');
  accIntro.className = 'hnf-mando-v2__accion-intro';
  const tops = flattenTopActions(board, 4);
  accIntro.textContent = tops.length
    ? `Acción sugerida: ${String(tops[0].titulo || tops[0].motivo || 'Revisar cola').slice(0, 120)}`
    : (liveCmdModel?.headline || liveCmdModel?.mandatoryAction || 'Revisá OT en Clima y evidencias.');
  const btnExec = document.createElement('button');
  btnExec.type = 'button';
  btnExec.className = 'primary-button hnf-mando-v2__btn-exec';
  btnExec.textContent = 'EJECUTAR AHORA';
  btnExec.addEventListener('click', () => {
    ejecutarPropuestaGlobal(eventosUnificados, { intelNavigate, navigateToView });
  });
  const btnClima = document.createElement('button');
  btnClima.type = 'button';
  btnClima.className = 'secondary-button hnf-mando-v2__btn-sec';
  btnClima.textContent = 'Abrir Clima (OT)';
  btnClima.addEventListener('click', () => navigateToView?.('clima'));
  const btnIngreso = document.createElement('button');
  btnIngreso.type = 'button';
  btnIngreso.className = 'secondary-button hnf-mando-v2__btn-sec';
  btnIngreso.textContent = 'Ingreso operativo';
  btnIngreso.addEventListener('click', () => navigateToView?.('ingreso-operativo'));
  rowAccion.append(accIntro, btnExec, btnClima, btnIngreso);

  const otGrid = document.createElement('div');
  otGrid.className = 'hnf-mando-v2__otgrid';
  const otH = document.createElement('h3');
  otH.className = 'hnf-mando-v2__otgrid-h';
  otH.textContent = 'Flujo operativo por OT (técnico · admin · cliente)';
  otGrid.append(otH);

  const sc = document.createElement('div');
  sc.className = 'hnf-mando-v2__otscroll';
  const show = cards.slice(0, 12);
  if (!show.length) {
    sc.append(
      Object.assign(document.createElement('p'), {
        className: 'muted',
        textContent: 'Sin OT en datos. Conectá al API o revisá planificación.',
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
  otGrid.append(sc);

  const foot = document.createElement('footer');
  foot.className = 'hnf-mando-v2__foot';
  const btnRef = document.createElement('button');
  btnRef.type = 'button';
  btnRef.className = 'secondary-button hnf-mando-v2__btn-sec';
  btnRef.textContent = 'Sincronizar datos';
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
      textContent: 'Si no ves cambios: recarga forzada en el iPad (cerrar pestaña o ⌘+R).',
    })
  );

  wrap.append(ribbon, rowEstado, rowAlertas, rowCuello, rowAccion, otGrid, foot);
  return wrap;
}

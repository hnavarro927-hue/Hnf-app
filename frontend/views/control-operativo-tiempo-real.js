import {
  buildControlOperativoAlertas,
  buildControlOperativoCards,
  SEMAFORO_EMOJI,
} from '../domain/control-operativo-tiempo-real.js';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function semaforoBar(semaforo) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-cotr-semaforo';
  wrap.setAttribute('data-semaforo', semaforo);
  wrap.innerHTML = `
    <span class="hnf-cotr-semaforo__dot" data-s="rojo" title="Crítico / bloqueado">🔴</span>
    <span class="hnf-cotr-semaforo__dot" data-s="naranja" title="Retraso leve">🟠</span>
    <span class="hnf-cotr-semaforo__dot" data-s="amarillo" title="En proceso">🟡</span>
    <span class="hnf-cotr-semaforo__dot" data-s="verde" title="Completo">🟢</span>
  `;
  return wrap;
}

/**
 * Reemplazo total de "Flujo operativo unificado" — centro de mando por OT.
 */
export const controlOperativoTiempoRealView = ({
  data,
  integrationStatus,
  reloadApp,
  navigateToView,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-cotr';
  root.setAttribute('aria-label', 'Control operativo en tiempo real');

  const mandoBand = el('div', 'hnf-cotr__mandoband');
  mandoBand.append(
    el('span', 'hnf-cotr__mandoband-k', 'MANDO OPERATIVO'),
    el('span', 'hnf-cotr__mandoband-v', 'OT en vivo · 3 etapas · colores = severidad')
  );

  const head = el('header', 'hnf-cotr__head');
  head.append(
    el('h1', 'hnf-cotr__title', 'CONTROL OPERATIVO EN TIEMPO REAL'),
    el(
      'p',
      'hnf-cotr__lead muted',
      'Técnico · Administración (Romina) · Cliente. Sin chat: solo estado del flujo y cuellos de botella.'
    )
  );

  const toolbar = el('div', 'hnf-cotr__toolbar');
  const btnRef = el('button', 'primary-button hnf-cotr__btn-refresh', 'Actualizar');
  btnRef.type = 'button';
  btnRef.addEventListener('click', async () => {
    btnRef.disabled = true;
    btnRef.textContent = 'Actualizando…';
    try {
      if (typeof reloadApp === 'function') await reloadApp();
    } finally {
      btnRef.textContent = 'Actualizar';
      btnRef.disabled = false;
    }
  });
  const syncHint = el(
    'span',
    'muted small',
    integrationStatus === 'conectado' ? 'Datos sincronizados con el servidor.' : `Estado: ${integrationStatus || '—'}`
  );
  toolbar.append(btnRef, syncHint);

  const cards = buildControlOperativoCards(data || {});
  const alertas = buildControlOperativoAlertas(cards);

  const strip = el('div', 'hnf-cotr__alertas');
  const mkAlert = (emoji, n, label) => {
    const row = el('div', 'hnf-cotr__alerta');
    row.append(
      el('span', 'hnf-cotr__alerta-n', String(n)),
      el('span', 'hnf-cotr__alerta-txt', `${emoji} ${label}`)
    );
    return row;
  };
  strip.append(
    mkAlert('🔴', alertas.sinInformeTecnico, 'OT sin informe técnico (evidencias / PDF)'),
    mkAlert('🟠', alertas.pendientesAdmin, 'OT pendientes admin'),
    mkAlert('🔴', alertas.noEnviadasCliente, 'OT no enviadas a cliente')
  );

  const grid = el('div', 'hnf-cotr__grid');

  if (!cards.length) {
    const empty = el('div', 'hnf-cotr__empty tarjeta');
    empty.append(
      el('p', null, 'No hay órdenes de trabajo en el snapshot.'),
      el('p', 'muted small', 'Verificá conexión o cargá datos desde planificación / Clima.')
    );
    grid.append(empty);
  }

  for (const c of cards) {
    const card = el('article', 'hnf-cotr-card');
    card.setAttribute('data-global', c.global);

    const top = el('div', 'hnf-cotr-card__top');
    top.append(semaforoBar(c.global));
    const ids = el('div', 'hnf-cotr-card__ids');
    ids.append(el('span', 'hnf-cotr-card__otid muted', c.otId));
    top.append(ids);
    card.append(top);

    const who = el('div', 'hnf-cotr-card__who');
    who.append(
      el('strong', 'hnf-cotr-card__cliente', `Cliente: ${c.cliente}`),
      el('div', 'hnf-cotr-card__tec', `Técnico: ${c.tecnico}`)
    );
    card.append(who);

    const mkEtapa = (num, title, semaforo, bodyNodes) => {
      const sec = el('section', `hnf-cotr-etapa hnf-cotr-etapa--${semaforo}`);
      const h = el('div', 'hnf-cotr-etapa__head');
      h.append(
        el('span', 'hnf-cotr-etapa__badge', SEMAFORO_EMOJI[semaforo] || '⚪'),
        el('span', 'hnf-cotr-etapa__title', `ETAPA ${num}: ${title}`)
      );
      const bd = el('div', 'hnf-cotr-etapa__body');
      for (const n of bodyNodes) bd.append(n);
      sec.append(h, bd);
      return sec;
    };

    const e1 = c.etapa1;
    const e1lines = [
      el('p', 'hnf-cotr-etapa__row', `Salida: ${e1.salidaLabel}`),
      el(
        'p',
        'hnf-cotr-etapa__row hnf-cotr-etapa__row--emph',
        e1.minSinInforme != null ? `Tiempo sin informe: ${e1.minSinInforme} min` : 'Tiempo sin informe: —'
      ),
      el('p', 'hnf-cotr-etapa__meta', e1.lineaTecnica),
    ];
    if (c.waSignals?.salidaAt) {
      e1lines.push(el('p', 'hnf-cotr-etapa__wa', 'WA: salida de terreno detectada («retiramos» / similar)'));
    }
    if (c.waSignals?.fotosMencion) {
      e1lines.push(el('p', 'hnf-cotr-etapa__wa', 'WA: mención de fotos → seguimiento evidencia'));
    }
    card.append(mkEtapa(1, 'Técnico en terreno', e1.semaforo, e1lines));

    const e2 = c.etapa2;
    const e2body = [
      el('p', 'hnf-cotr-etapa__row', `Admin: ${e2.admin}`),
      el('p', 'hnf-cotr-etapa__row', `Estado: ${e2.estado}`),
      el('p', 'hnf-cotr-etapa__row', `Tiempo: ${e2.minutos} min`),
    ];
    if (c.waSignals?.informeListoAt) {
      e2body.push(el('p', 'hnf-cotr-etapa__wa', 'WA: «informe listo» detectado'));
    }
    card.append(mkEtapa(2, 'Administración', e2.semaforo, e2body));

    const e3 = c.etapa3;
    card.append(
      mkEtapa(3, 'Cliente', e3.semaforo, [
        el('p', 'hnf-cotr-etapa__row', 'Cliente:'),
        el('p', 'hnf-cotr-etapa__row hnf-cotr-etapa__row--emph', e3.estadoCliente),
      ])
    );

    const foot = el('footer', 'hnf-cotr-card__foot');
    foot.append(
      el('span', 'hnf-cotr-card__global-label', 'Estado global:'),
      el('span', `hnf-cotr-card__global-val hnf-cotr-card__global-val--${c.global}`, SEMAFORO_EMOJI[c.global] || '—')
    );
    card.append(foot);

    const go = el('button', 'secondary-button hnf-cotr-card__open', 'Abrir OT en Clima');
    go.type = 'button';
    go.addEventListener('click', () => navigateToView?.('clima', { otId: c.otId }));
    card.append(go);

    grid.append(card);
  }

  root.append(mandoBand, head, toolbar, strip, grid);
  return root;
};

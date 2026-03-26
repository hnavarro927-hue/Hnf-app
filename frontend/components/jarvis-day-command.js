/**
 * Jarvis Day Command — matriz única: Jarvis (triada) + mando táctil + cronología + carriles resumidos.
 * Datos: `buildJarvisLiveCommandBrief`; acciones: `jarvis-mando-actions`.
 */

import { buildMailtoUrl, commercialDraftPayload } from '../domain/jarvis-commercial-brain.js';
import { buildJarvisInfinityGuide } from '../domain/jarvis-infinity-guide.js';
import { AREA_BAND_CLASS } from '../domain/jarvis-contextual-identity.js';
import { HNF_MANDO_ACTIONS } from '../domain/jarvis-mando-actions.js';
import { relativeMinutesLabel } from '../domain/jarvis-live-command-brief.js';

const CAT_MOD = {
  whatsapp: 'jdc-cat--wa',
  ot: 'jdc-cat--ot',
  traslado: 'jdc-cat--tr',
  aprobacion: 'jdc-cat--ap',
  cierre: 'jdc-cat--ci',
  evidencia: 'jdc-cat--ev',
  incidencia: 'jdc-cat--in',
  operativo: 'jdc-cat--op',
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null && text !== '') n.textContent = text;
  return n;
}

function clip(s, max) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function timelineStateClass(estado) {
  const s = String(estado || '').toLowerCase().replace(/\s+/g, '_');
  if (s.includes('nuevo_ingreso') || s.includes('nuevo ingreso')) return 'jdc-tl-row--state-new';
  if (s.includes('requiere') || s.includes('accion') || s.includes('acción')) return 'jdc-tl-row--state-action';
  if (s.includes('resuelto') || s.includes('cerrado')) return 'jdc-tl-row--state-done';
  if (s.includes('escalado')) return 'jdc-tl-row--state-escalated';
  if (s.includes('interpretado')) return 'jdc-tl-row--state-ok';
  return '';
}

function resolveMandoIntel(act, model) {
  const brain = model.commercialBrain;
  if (act.intelKey === 'commercialDraft' && brain) {
    return { commercial: commercialDraftPayload(brain, '') };
  }
  if (act.intelKey === 'climaCliente' && brain?.cliente) {
    const badCliente = [
      'Cartera prioritaria',
      'Cartera · brief',
      'Pipeline declarado',
      'Cartera · potencial declarado',
    ].includes(brain.cliente);
    if (!badCliente) return { climaFilter: { clienteContains: brain.cliente } };
  }
  return null;
}

function navigateWithIntel(navigateToView, view, intel) {
  if (intel && typeof intel === 'object' && Object.keys(intel).length) navigateToView?.(view, intel);
  else navigateToView?.(view);
}

/**
 * @param {object} opts
 * @param {ReturnType<import('../domain/jarvis-live-command-brief.js').buildJarvisLiveCommandBrief>} opts.model
 * @param {function} opts.navigateToView
 * @param {function} opts.refresh
 */
export function createJarvisDayCommand({ model, navigateToView, refresh } = {}) {
  const m = model || {};
  const accent = m.contextAccent || {};
  const section = el('section', `jarvis-day-command jdc-console hnf-adn-console ${accent.rootClass || ''}`.trim());
  section.setAttribute('data-command-level', String(m.level ?? 0));
  if (accent.key) section.setAttribute('data-context-accent', accent.key);
  section.setAttribute('aria-label', 'Jarvis · consola de mando');

  /* —— Barra temporal viva —— */
  const topbar = el('div', 'jdc-topbar');
  const topLeft = el('div', 'jdc-topbar__left');
  const clockWrap = el('div', 'jdc-clock-wrap');
  const clockEl = el('time', 'jdc-clock');
  clockEl.setAttribute('data-jdc-clock', '');
  const dateEl = el('span', 'jdc-date muted small');
  dateEl.setAttribute('data-jdc-date', '');
  clockWrap.append(clockEl, dateEl);
  const liveDot = el('span', 'jdc-live-dot');
  liveDot.setAttribute('title', 'Señal viva');
  topLeft.append(clockWrap, liveDot);

  const chip = (label, val, mod) => {
    const d = el('div', `jdc-chip ${mod || ''}`.trim());
    d.append(el('span', 'jdc-chip__l', label), el('span', 'jdc-chip__v', val));
    return d;
  };

  const topChips = el('div', 'jdc-topbar__chips');
  topChips.append(
    chip('Presión', m.pressureText || '—', m.level >= 2 ? 'jdc-chip--crit' : m.level >= 1 ? 'jdc-chip--warn' : ''),
    chip('Caja', m.topBar?.moneyShort || '—', (m.heldMoney?.bloqueado ?? 0) > 0 ? 'jdc-chip--money' : ''),
    chip('Hito', clip(m.nextMilestone || '—', 40), ''),
    chip('Canal', clip(m.dominantChannel || '—', 28), ''),
    chip('Owner', clip(m.criticalResponsible || '—', 22), '')
  );
  topbar.append(topLeft, topChips);
  section.append(topbar);

  const tw = m.temporalWindows || {};
  const otStale = m.otStaleCounts || { h24: 0, h48: 0, h72: 0 };
  const winStrip = el('div', 'jdc-window-strip');
  winStrip.setAttribute('role', 'tablist');
  winStrip.setAttribute('aria-label', 'Lectura por ventana temporal');
  const winPanels = el('div', 'jdc-window-panels');
  const mkWinBtn = (id, label) => {
    const b = el('button', 'jdc-window-strip__btn', label);
    b.type = 'button';
    b.dataset.jdcWin = id;
    b.setAttribute('role', 'tab');
    return b;
  };
  const bToday = mkWinBtn('today', 'Hoy');
  const bWeek = mkWinBtn('week', 'Semana');
  const bMonth = mkWinBtn('month', 'Mes');
  winStrip.append(bToday, bWeek, bMonth);

  const mkStat = (lab, val, hot) => {
    const d = el('div', `jdc-window-stat ${hot ? 'jdc-window-stat--hot' : ''}`);
    d.append(el('span', 'jdc-window-stat__l', lab), el('span', 'jdc-window-stat__v', val));
    return d;
  };

  const panelToday = el('div', 'jdc-window-panel');
  panelToday.dataset.jdcWinPanel = 'today';
  const pt = tw.today || {};
  const ingHoy = m.pulseTiles?.find((x) => x.key === 'ingresos');
  const evPen = m.pulseTiles?.find((x) => x.key === 'evidencias');
  const apprP = m.pulseTiles?.find((x) => x.key === 'aprob');
  const cierreP = m.pulseTiles?.find((x) => x.key === 'cierres');
  const gridToday = el('div', 'jdc-window-panel__grid');
  const riesgoK =
    pt.riesgoDinero > 0 ? `~$${Math.round(Number(pt.riesgoDinero) / 1000)}k` : '—';
  gridToday.append(
    mkStat('Ingresos (ventana)', String(pt.ingresos ?? '—'), false),
    mkStat('Pend. cerebro', String(pt.pendientes ?? '—'), (pt.pendientes || 0) >= 1),
    mkStat('Críticos', String(pt.criticos ?? '—'), (pt.criticos || 0) >= 1),
    mkStat('Opp. detectadas', String(pt.oportunidades ?? '—'), (pt.oportunidades || 0) >= 1),
    mkStat('Riesgo $ (ref.)', riesgoK, Number(pt.riesgoDinero) > 200000),
    mkStat('Ingresos panel', String(ingHoy?.value ?? '—'), Boolean(ingHoy?.critical)),
    mkStat('Evid. pend.', String(evPen?.value ?? '—'), Boolean(evPen?.critical)),
    mkStat('Aprobaciones', String(apprP?.value ?? '—'), Boolean(apprP?.critical)),
    mkStat('Cierres listos', String(cierreP?.value ?? pt.cierresListosPanel ?? '—'), false)
  );
  panelToday.append(
    el('p', 'jdc-window-panel__lead', clip(pt.linea || 'Sin agregados del día.', 140)),
    gridToday
  );

  const panelWeek = el('div', 'jdc-window-panel');
  panelWeek.dataset.jdcWinPanel = 'week';
  panelWeek.hidden = true;
  const pw = tw.week || {};
  const gridWeek = el('div', 'jdc-window-panel__grid');
  gridWeek.append(
    mkStat('Eventos 7 días', String(pw.ingresos ?? '—'), (pw.ingresos || 0) >= 8),
    mkStat('Pend. cerebro', String(pw.pendientes ?? '—'), (pw.pendientes || 0) >= 2),
    mkStat('Críticos', String(pw.criticos ?? '—'), (pw.criticos || 0) >= 1),
    mkStat('Opp.', String(pw.oportunidades ?? '—'), false),
    mkStat('Riesgo $ (ref.)', pw.riesgoDinero > 0 ? `~$${Math.round(pw.riesgoDinero / 1000)}k` : '—', false),
    mkStat('OT >24h sin mov.', String(otStale.h24 ?? 0), (otStale.h24 || 0) >= 1),
    mkStat('OT >48h', String(otStale.h48 ?? 0), (otStale.h48 || 0) >= 1),
    mkStat('OT >72h', String(otStale.h72 ?? 0), (otStale.h72 || 0) >= 1)
  );
  panelWeek.append(
    el('p', 'jdc-window-panel__lead', clip(pw.linea || 'Ventana 7 días.', 140)),
    gridWeek,
    el(
      'p',
      'jdc-window-panel__foot muted small',
      tw.topClienteFriccion && tw.topClienteN
        ? `Mayor frecuencia interpretada: ${tw.topClienteFriccion} (${tw.topClienteN} eventos en datos cargados).`
        : 'Cliente con más fricción: pendiente de más ingresos clasificados.'
    )
  );

  const panelMonth = el('div', 'jdc-window-panel');
  panelMonth.dataset.jdcWinPanel = 'month';
  panelMonth.hidden = true;
  const pm = tw.month || {};
  const p30 = tw.d30 || {};
  const gridMonth = el('div', 'jdc-window-panel__grid');
  gridMonth.append(
    mkStat('Mes (calendario)', String(pm.ingresos ?? '—'), false),
    mkStat('Pend. cerebro', String(pm.pendientes ?? '—'), false),
    mkStat('Críticos', String(pm.criticos ?? '—'), false),
    mkStat('Opp.', String(pm.oportunidades ?? '—'), false),
    mkStat('Últimos 30 días', String(p30.ingresos ?? '—'), false),
    mkStat('30d · criticos', String(p30.criticos ?? '—'), (p30.criticos || 0) >= 1)
  );
  panelMonth.append(
    el('p', 'jdc-window-panel__lead', clip(pm.linea || 'Mes calendario.', 140)),
    gridMonth,
    el('p', 'jdc-window-panel__foot muted small', clip(p30.linea || '', 120))
  );

  winPanels.append(panelToday, panelWeek, panelMonth);
  section.append(winStrip, winPanels);

  let activeWin = 'today';
  const syncWinUi = () => {
    for (const b of winStrip.querySelectorAll('[data-jdc-win]')) {
      const on = b.dataset.jdcWin === activeWin;
      b.classList.toggle('jdc-window-strip__btn--on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const p of winPanels.querySelectorAll('[data-jdc-win-panel]')) {
      p.hidden = p.dataset.jdcWinPanel !== activeWin;
    }
    section.setAttribute('data-jdc-window', activeWin);
  };
  bToday.addEventListener('click', () => {
    activeWin = 'today';
    syncWinUi();
  });
  bWeek.addEventListener('click', () => {
    activeWin = 'week';
    syncWinUi();
  });
  bMonth.addEventListener('click', () => {
    activeWin = 'month';
    syncWinUi();
  });
  syncWinUi();

  if (accent.label) {
    const ctxBar = el('div', 'jdc-context-bar');
    ctxBar.append(el('span', 'jdc-context-bar__tag', 'Contexto'), el('span', 'jdc-context-bar__name', accent.label));
    section.append(ctxBar);
  }

  const infinity = buildJarvisInfinityGuide(m);
  const recId = infinity.primary?.mandoId || null;

  /* —— Infinity: guía activa + cadena continua —— */
  const infWrap = el('div', 'jdc-infinity');
  const infHead = el('div', 'jdc-infinity__head');
  infHead.append(
    el('span', 'jdc-infinity__brand', 'JARVIS · siguiente paso'),
    el('span', 'jdc-infinity__next-hint', infinity.nextHint || '')
  );
  const infChips = el('div', 'jdc-infinity__chips');
  infChips.setAttribute('role', 'tablist');
  infinity.chain.forEach((step, i) => {
    const b = el(
      'button',
      `jdc-infinity__chip ${i === infinity.primaryIdx ? 'jdc-infinity__chip--now' : 'jdc-infinity__chip--trail'}`
    );
    b.type = 'button';
    b.textContent = step.label;
    b.title = step.view;
    b.addEventListener('click', () => {
      if (step.intel) navigateToView?.(step.view, step.intel);
      else navigateToView?.(step.view);
    });
    infChips.append(b);
  });
  const infCta = el('button', 'jdc-infinity__cta');
  infCta.type = 'button';
  infCta.append(
    el('span', 'jdc-infinity__cta-k', 'Ejecutar ahora'),
    el('span', 'jdc-infinity__cta-v', infinity.primary?.label || 'Sincronizar')
  );
  infCta.addEventListener('click', () => {
    const p = infinity.primary;
    if (!p) {
      refresh?.();
      return;
    }
    if (p.intel) navigateToView?.(p.view, p.intel);
    else navigateToView?.(p.view);
  });
  infWrap.append(infHead, infChips, infCta);
  section.append(infWrap);

  /* —— Mando táctil (ejecuta) —— */
  const mando = el('div', 'jdc-mando');
  mando.setAttribute('role', 'toolbar');
  mando.setAttribute('aria-label', 'Acciones rápidas del mando');
  for (const act of HNF_MANDO_ACTIONS) {
    const extra = recId && act.id === recId ? ' jdc-mando__btn--jarvis-next' : '';
    const b = el('button', `jdc-mando__btn jdc-mando__btn--${act.band}${extra}`);
    b.type = 'button';
    b.dataset.mandoId = act.id;
    b.append(el('span', 'jdc-mando__ico', act.icon || '·'), el('span', 'jdc-mando__lab', act.label));
    b.addEventListener('click', () => {
      if (act.action === 'refresh') refresh?.();
      else {
        const intel = resolveMandoIntel(act, m);
        navigateWithIntel(navigateToView, act.view, intel);
      }
    });
    mando.append(b);
  }
  section.append(mando);

  /* —— Pulso cronológico (una línea escaneable) —— */
  const ticker = el('div', 'jdc-ticker');
  const parts = String(m.streamLine || '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) {
    for (const p of parts.slice(0, 6)) {
      const sp = el('span', 'jdc-ticker__bit', p);
      ticker.append(sp);
    }
  } else {
    ticker.append(el('span', 'jdc-ticker__bit muted', 'Sin eventos indexados aún'));
  }
  section.append(ticker);

  /* —— Matriz: Jarvis interpreta (triada) —— */
  const matrix = el('div', 'jdc-matrix');
  const interpret = el('div', 'jdc-interpret');
  interpret.append(
    el('span', 'jdc-interpret__kicker', 'JARVIS · interpreta'),
    el('h2', 'jdc-interpret__headline', m.headline || m.liveBrief || '—')
  );

  const tri = m.jarvisTriad || {};
  const triad = el('div', 'jdc-triad');
  const triCard = (key, title) => {
    const card = el('div', 'jdc-triad__card');
    card.append(el('span', 'jdc-triad__k', title), el('p', 'jdc-triad__v', tri[key] || '—'));
    return card;
  };
  triad.append(triCard('detecta', 'Detecta'), triCard('recomienda', 'Recomienda'), triCard('dispara', 'Dispara acción'));
  interpret.append(triad);

  if (m.mandatoryAction) {
    const man = el('div', 'jdc-mandatory-strip');
    man.append(el('span', 'jdc-mandatory-strip__k', 'Mando'), el('span', 'jdc-mandatory-strip__v', clip(m.mandatoryAction, 96)));
    interpret.append(man);
  }

  matrix.append(interpret);

  const ger = m.gerencialStrip;
  if (ger && (ger.operarHoy || ger.venderHoy || ger.dineroLine)) {
    const strip = el('div', 'jdc-gerencial');
    strip.append(el('span', 'jdc-gerencial__tag', 'Gerencia · hoy'));
    const pill = (k, v) => {
      const d = el('div', 'jdc-gerencial__pill');
      d.append(el('span', 'jdc-gerencial__k', k), el('span', 'jdc-gerencial__v', v || '—'));
      return d;
    };
    strip.append(pill('Operar', ger.operarHoy), pill('Vender', ger.venderHoy), pill('Dinero', ger.dineroLine));
    matrix.append(strip);
  }

  /* —— Carriles = chips con navegación —— */
  const laneRow = el('div', 'jdc-lane-pills');
  laneRow.setAttribute('aria-label', 'Carriles priorizados');
  for (const s of m.laneSummaries || []) {
    const pillText = s.key === 'caja' ? s.label : `${s.label} · ${s.count}`;
    const b = el('button', `jdc-lane-pill jdc-lane-pill--${s.tone || 'neutral'}`, pillText);
    b.type = 'button';
    b.addEventListener('click', () => navigateToView?.(s.view));
    laneRow.append(b);
  }
  matrix.append(laneRow);

  /* —— Negocio: propuesta concreta + 1 dato (correo) + acciones —— */
  const brain = m.commercialBrain;
  const cp = m.commercialPulse;
  if (brain && cp) {
    const wrap = el('div', 'jdc-commercial-matrix');
    const top = el('div', 'jdc-commercial-matrix__head');
    top.append(
      el('span', 'jdc-commercial-matrix__badge', 'Negocio · propuesta'),
      el('p', 'jdc-commercial-matrix__detecta', cp.detecta || brain.detecta || '')
    );
    const props = el('div', 'jdc-commercial-matrix__props');
    props.append(
      el('span', 'jdc-commercial-matrix__chip jdc-commercial-matrix__chip--cli', cp.cliente || '—'),
      el('span', 'jdc-commercial-matrix__chip', cp.servicioLabel || '—'),
      el(
        'span',
        'jdc-commercial-matrix__chip jdc-commercial-matrix__chip--money',
        `~$${Number(cp.valorEstimado || 0).toLocaleString('es-CL')} + IVA ref.`
      )
    );

    const quickAct = el('div', 'jdc-commercial-matrix__quick');
    const mkQuick = (label, fn) => {
      const b = el('button', 'jdc-commercial-matrix__qbtn', label);
      b.type = 'button';
      b.addEventListener('click', fn);
      return b;
    };
    quickAct.append(
      mkQuick('Copiar propuesta', async () => {
        try {
          await navigator.clipboard.writeText(brain.cuerpoCorreo || '');
        } catch {
          /* ignore */
        }
      }),
      mkQuick('Abrir WhatsApp', () => navigateToView?.('whatsapp')),
      mkQuick('Solo asunto/cuerpo (mail)', () => {
        window.location.href = buildMailtoUrl('', brain.asunto, brain.cuerpoCorreo);
      })
    );

    const det = document.createElement('details');
    det.className = 'jdc-commercial-matrix__details';
    const sum = document.createElement('summary');
    sum.className = 'jdc-commercial-matrix__sum';
    sum.textContent = 'Ver texto del correo (opcional)';
    const preview = el('textarea', 'jdc-commercial-matrix__preview');
    preview.readOnly = true;
    preview.rows = 4;
    preview.setAttribute('aria-label', 'Texto listo para enviar');
    preview.value = brain.cuerpoCorreo || '';
    det.append(sum, preview);

    const slugDomain = () => {
      const c = String(brain.cliente || 'cliente');
      const slug = c.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 22) || 'cliente';
      return `${slug}.cl`;
    };
    const dom = slugDomain();
    const emailChips = el('div', 'jdc-commercial-matrix__email-chips');
    ['operaciones', 'soporte', 'mantencion', 'facturacion'].forEach((prefix) => {
      const c = el('button', 'jdc-email-chip', `${prefix}@`);
      c.type = 'button';
      c.addEventListener('click', () => {
        emailIn.value = `${prefix}@${dom}`;
      });
      emailChips.append(c);
    });

    const emailRow = el('div', 'jdc-commercial-matrix__email');
    const emailIn = document.createElement('input');
    emailIn.type = 'email';
    emailIn.className = 'jdc-commercial-matrix__email-in';
    emailIn.placeholder = 'Opcional: tocá un chip o escribí solo si querés destinatario fijo';
    emailIn.setAttribute('autocomplete', 'email');
    emailIn.id = `jdc-commercial-email-${Math.random().toString(36).slice(2, 8)}`;
    const emailLab = el('label', 'jdc-commercial-matrix__email-lab', 'Correo (1 toque o vacío)');
    emailLab.setAttribute('for', emailIn.id);
    emailRow.append(emailLab, emailChips, emailIn);

    const actions = el('div', 'jdc-commercial-matrix__actions');
    const mkAct = (cls, label, fn) => {
      const b = el('button', cls, label);
      b.type = 'button';
      b.addEventListener('click', fn);
      return b;
    };
    actions.append(
      mkAct('jdc-cbtn jdc-cbtn--primary', 'Generar propuesta', () => {
        navigateToView?.('oportunidades', { commercial: commercialDraftPayload(brain, emailIn.value) });
      }),
      mkAct('jdc-cbtn jdc-cbtn--send', 'Enviar', () => {
        window.location.href = buildMailtoUrl(emailIn.value.trim(), brain.asunto, brain.cuerpoCorreo);
      }),
      mkAct('jdc-cbtn jdc-cbtn--ghost', 'Ver oportunidad', () => {
        if (brain.opportunityId) {
          navigateToView?.('oportunidades', {
            commercial: { mode: 'focus', opportunityId: brain.opportunityId },
          });
        } else {
          navigateToView?.('oportunidades', {
            commercial: { mode: 'list', filterCliente: brain.cliente },
          });
        }
      })
    );

    wrap.append(top, props, quickAct, det, emailRow, actions);
    matrix.append(wrap);
  }

  section.append(matrix);

  /* —— Cuerpo: timeline + lateral —— */
  const body = el('div', 'jdc-body');

  const tlWrap = el('div', 'jdc-timeline-wrap');
  tlWrap.append(el('h3', 'jdc-section-title', 'Línea del día'));
  const tlAxis = el('div', 'jdc-timeline-axis');

  for (const row of m.dayTimeline || []) {
    const bandCls = AREA_BAND_CLASS[row.areaBand] || 'jdc-band--ops';
    const stateCls = timelineStateClass(row.estado);
    const sem = String(row.semaforo || 'verde').toLowerCase();
    const item = el(
      'article',
      `jdc-tl-row ${row.fresh ? 'jdc-tl-row--fresh' : ''} ${bandCls} ${stateCls}`.trim()
    );
    item.setAttribute('data-ts', String(row.ts || ''));
    if (row.fresh) item.setAttribute('data-hnf-adn-active', '1');

    const timeCol = el('div', 'jdc-tl-row__time');
    const dot = el('span', `jdc-tl-dot jdc-tl-dot--${sem === 'rojo' || sem === 'ambar' || sem === 'verde' ? sem : 'verde'}`);
    dot.setAttribute('title', `Semáforo · ${sem}`);
    const relEl = el('span', 'jdc-tl-row__rel muted small', row.ageBadge || relativeMinutesLabel(row.ts));
    relEl.setAttribute('data-jdc-rel', '');
    timeCol.append(dot, el('span', 'jdc-tl-row__hm', row.timeHm || '—'), relEl);

    const main = el('div', 'jdc-tl-row__main');
    const head = el('div', 'jdc-tl-row__head');
    const abbr = el('span', 'jdc-tl-abbr', row.channelAbbr || 'OP');
    const typeBadge = el('span', `jdc-cat ${CAT_MOD[row.category] || CAT_MOD.operativo}`, row.typeLabel || '—');
    head.append(abbr, typeBadge, el('span', 'jdc-tl-row__cliente', row.clienteTienda || '—'));

    const meta = el('div', 'jdc-tl-row__meta');
    const chipMeta = (t) => el('span', 'jdc-tl-meta-chip', t);
    meta.append(
      chipMeta(clip(row.estado || '—', 26)),
      chipMeta(clip(row.impacto || '—', 30)),
      chipMeta(clip(row.responsable || '—', 22))
    );
    const nextLine = clip(row.siguiente_paso || '', 96);
    const nextEl = el('p', 'jdc-tl-row__next', nextLine || 'Siguiente paso: coordinar en panel operativo.');

    const actions = el('div', 'jdc-tl-row__actions');
    const go = el('button', 'jdc-tl-go', 'Ir');
    go.type = 'button';
    go.addEventListener('click', () => navigateToView?.(row.navigateView || 'jarvis'));
    actions.append(go);

    main.append(head, meta, nextEl);
    item.append(timeCol, main, actions);
    tlAxis.append(item);
  }

  if (!tlAxis.childElementCount) {
    tlAxis.append(el('p', 'jdc-tl-placeholder muted', 'Sin eventos del día en datos cargados.'));
  }
  tlWrap.append(tlAxis);
  body.append(tlWrap);

  const side = el('div', 'jdc-side');

  const risk = el('div', 'jdc-risk');
  risk.append(el('h3', 'jdc-section-title', 'Riesgo · caja'));
  risk.append(el('p', 'jdc-risk__line', m.impactLine || '—'));
  const mini = el('div', 'jdc-risk__mini');
  for (const t of m.pulseTiles || []) {
    const d = el('div', `jdc-mini ${t.critical ? 'jdc-mini--hot' : ''}`);
    d.append(el('span', 'jdc-mini__l', t.label), el('span', 'jdc-mini__v', String(t.value)));
    mini.append(d);
  }
  risk.append(mini);
  side.append(risk);

  const lanes = m.lanes || {};
  const compact = el('div', 'jdc-lanes-compact');
  const block = (title, lines) => {
    const wrap = el('div', 'jdc-lane-block');
    wrap.append(el('h4', 'jdc-lane-block__t', title));
    const ul = el('ul', 'jdc-lane-block__ul');
    const arr = Array.isArray(lines) ? lines : [];
    for (const line of arr.slice(0, 4)) {
      ul.append(el('li', 'jdc-lane-block__li', clip(line, 92)));
    }
    if (!ul.childElementCount) ul.append(el('li', 'jdc-lane-block__li muted', '—'));
    wrap.append(ul);
    return wrap;
  };
  compact.append(block('Ahora', lanes.ahora), block('Próx. 2 h', lanes.proximas2h), block('Atrasos', lanes.atrasados));
  side.append(compact);

  const memList = Array.isArray(m.clientMemory) ? m.clientMemory : [];
  if (memList.length) {
    const memSec = el('div', 'jdc-client-memory');
    memSec.append(el('h3', 'jdc-section-title', 'Memoria por cliente'));
    const ul = el('ul', 'jdc-client-memory__ul');
    for (const row of memList.slice(0, 5)) {
      const li = el('li', 'jdc-client-memory__li');
      const top = el('div', 'jdc-client-memory__head');
      top.append(
        el('span', 'jdc-client-memory__name', clip(row.display || row.clienteKey, 28)),
        el('span', 'jdc-client-memory__badge muted small', relativeMinutesLabel(row.ultimoContacto))
      );
      const sub = el('p', 'jdc-client-memory__sub muted small');
      sub.textContent = [
        row.ultimoEstado ? `Estado: ${row.ultimoEstado}` : null,
        row.ultimoResponsable ? `Resp.: ${clip(row.ultimoResponsable, 18)}` : null,
        row.otRelacionadas ? `OT abiertas ~${row.otRelacionadas}` : null,
        row.patron || null,
      ]
        .filter(Boolean)
        .join(' · ');
      li.append(top, sub);
      ul.append(li);
    }
    memSec.append(ul);
    side.append(memSec);
  }

  const mg = m.memoryGrid;
  if (mg?.senales) {
    const gridMg = el('div', 'jdc-memory-grid');
    gridMg.append(el('h3', 'jdc-section-title', 'ADN · memoria viva'));
    const s = mg.senales;
    gridMg.append(
      el(
        'p',
        'jdc-memory-grid__sig muted small',
        `Repetición clientes: ${s.clientesConRepeticion} · Atraso: ${s.eventosConAtraso} · Evidencia: ${s.evidenciaFaltante} · Opp: ${s.oportunidades}`
      )
    );
    if (mg.topTecnicos?.length) {
      gridMg.append(
        el(
          'p',
          'jdc-memory-grid__line muted small',
          `Carga sugerida: ${mg.topTecnicos
            .slice(0, 3)
            .map((x) => `${clip(x.key, 14)} (${x.count})`)
            .join(' · ')}`
        )
      );
    }
    if (mg.topSucursales?.length) {
      gridMg.append(
        el(
          'p',
          'jdc-memory-grid__line muted small',
          `Sucursales: ${mg.topSucursales
            .slice(0, 3)
            .map((x) => `${clip(x.key, 16)} (${x.count})`)
            .join(' · ')}`
        )
      );
    }
    side.append(gridMg);
  }

  const sideAct = el('div', 'jdc-side-actions');
  sideAct.append(el('h3', 'jdc-section-title', 'Ejecutar'));
  const sRow = el('div', 'jdc-side-actions__row');
  const sBtn = (label, view, intel) => {
    const b = el('button', 'jdc-side-actions__btn', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      if (intel) navigateToView?.(view, intel);
      else navigateToView?.(view);
    });
    return b;
  };
  sRow.append(
    sBtn('Escalar', 'operacion-control'),
    sBtn('Asignar', 'panel-operativo-vivo'),
    sBtn('Evidencia', 'clima'),
    sBtn('Cliente', 'clima', resolveMandoIntel({ intelKey: 'climaCliente' }, m))
  );
  sideAct.append(sRow);
  side.append(sideAct);

  body.append(side);
  section.append(body);

  const updateClock = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    dateEl.textContent = now.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const updateRelativeTimes = () => {
    for (const item of tlAxis.querySelectorAll('[data-ts]')) {
      const iso = item.getAttribute('data-ts');
      const rel = item.querySelector('[data-jdc-rel]');
      if (iso && rel) rel.textContent = relativeMinutesLabel(iso);
    }
  };

  let tickCount = 0;
  const tick = () => {
    updateClock();
    tickCount += 1;
    if (tickCount % 30 === 0) updateRelativeTimes();
  };

  tick();

  return { element: section, tick, updateRelativeTimes };
}

export function createJarvisLiveCommandLayer(opts) {
  return createJarvisDayCommand(opts);
}

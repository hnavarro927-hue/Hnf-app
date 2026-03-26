const EVAL_LINES = [
  'Analizando flujo operativo…',
  'Detectando cuellos…',
  'Priorizando ingresos…',
  'Esperando señal crítica…',
  'Cruzando OT y pipeline comercial…',
  'Sincronizando memoria operativa…',
];

let typewriterSeq = 0;

export function typewriterInto(el, text, msPerChar = 16) {
  if (!el) return;
  const seq = ++typewriterSeq;
  const full = String(text ?? '');
  el.textContent = '';
  let i = 0;
  const step = () => {
    if (seq !== typewriterSeq) return;
    if (i > full.length) return;
    el.textContent = full.slice(0, i);
    i += 1;
    if (i <= full.length) setTimeout(step, msPerChar);
  };
  step();
}

function countOpenOt(viewData) {
  const ots = viewData?.ots?.data || [];
  return ots.filter((o) => String(o.estado || '') !== 'terminado').length;
}

export function generarMicroDecision(mergedState, viewData, tick) {
  const line = EVAL_LINES[tick % EVAL_LINES.length];
  const bloqueos = mergedState?.bloqueos ?? 0;
  const opps = mergedState?.oportunidades ?? 0;
  const openOt = countOpenOt(viewData);
  const hasData = Boolean(viewData && typeof viewData === 'object');

  let lastAnalysis = 'Último análisis: flujo estable.';
  let nextAction = 'Siguiente acción: mantener monitoreo activo.';

  if (!hasData) {
    lastAnalysis = 'Jarvis detecta baja actividad comercial → sin fuentes conectadas aún.';
    nextAction = 'Sugerencia: sincronizar datos o disparar ingesta.';
  } else if (opps === 0 && openOt < 2) {
    lastAnalysis = 'Jarvis detecta baja actividad comercial → pocos frentes abiertos.';
    nextAction = 'Sugerencia: activar seguimiento comercial y revisar OT pendientes.';
  } else if (bloqueos > 200000) {
    lastAnalysis = 'Jarvis detecta presión económica concentrada en trabajo no cobrado.';
    nextAction = 'Sugerencia: desbloquear cierres y cobros con fecha límite hoy.';
  } else if (opps > 0) {
    lastAnalysis = `Jarvis detecta ${opps} oportunidad(es) activa(s) en evolución.`;
    nextAction = 'Sugerencia: priorizar cierre inmediato en pipeline caliente.';
  } else if (openOt > 5) {
    lastAnalysis = `Jarvis detecta ${openOt} OT abiertas — carga operativa visible.`;
    nextAction = 'Sugerencia: ordenar por margen y fecha de compromiso.';
  }

  return { evalLine: line, lastAnalysis, nextAction };
}

export function actualizarEstadoConsciente(tick) {
  return {
    visualPhase: tick % 3,
    indicatorShift: tick % 5,
  };
}

function applyConsciousDom(payload) {
  const root = document.getElementById('hnf-jarvis-presence-root');
  if (!root) return;

  if (payload.eventMode) {
    root.dataset.jarvisConscious = 'event';
    const evalLine = root.querySelector('.jarvis-presence__eval-line');
    const kicker = root.querySelector('.jarvis-presence__eval-kicker');
    if (kicker) kicker.textContent = 'Evento externo';
    if (evalLine) {
      if (evalLine.dataset.jarvisEventHold !== '1') {
        evalLine.dataset.jarvisEventHold = '1';
        typewriterInto(evalLine, 'Evento detectado → recalculando…', 14);
      } else {
        evalLine.textContent = 'Evento detectado → recalculando…';
      }
    }
    root.classList.add('jarvis-presence--flash');
    setTimeout(() => root.classList.remove('jarvis-presence--flash'), 700);
    return;
  }

  const evalLineClear = root.querySelector('.jarvis-presence__eval-line');
  if (evalLineClear) evalLineClear.dataset.jarvisEventHold = '';

  root.dataset.jarvisConscious = 'vigilancia';
  const { visualPhase, evalLine, lastAnalysis, nextAction } = payload;
  root.dataset.jarvisVisualPhase = String(visualPhase);
  root.dataset.jarvisIndicator = String(payload.indicatorShift ?? 0);

  const kicker = root.querySelector('.jarvis-presence__eval-kicker');
  if (kicker) kicker.textContent = 'Jarvis está evaluando…';

  const evalEl = root.querySelector('.jarvis-presence__eval-line');
  if (evalEl && evalEl.textContent !== evalLine) typewriterInto(evalEl, evalLine, 12);

  const lastEl = root.querySelector('.jarvis-presence__intel-last');
  const nextEl = root.querySelector('.jarvis-presence__intel-next');
  if (lastEl) {
    lastEl.textContent = lastAnalysis;
    lastEl.classList.remove('jarvis-presence__intel--tick');
    void lastEl.offsetWidth;
    lastEl.classList.add('jarvis-presence__intel--tick');
  }
  if (nextEl) {
    nextEl.textContent = nextAction;
    nextEl.classList.remove('jarvis-presence__intel--tick');
    void nextEl.offsetWidth;
    nextEl.classList.add('jarvis-presence__intel--tick');
  }

  root.classList.toggle('jarvis-presence--phase-alt', visualPhase === 1);
  root.classList.toggle('jarvis-presence--phase-warm', visualPhase === 2);

  const section = root.closest('.dashboard-module--stack');
  if (section && payload.indicatorShift != null && payload.indicatorShift % 2 === 0) {
    section.classList.add('jarvis-presence--neighbor-tick');
    setTimeout(() => section.classList.remove('jarvis-presence--neighbor-tick'), 750);
  }
}

let consciousTick = 0;
let eventLockUntil = 0;
let intervalId = null;

export function notifyJarvisExternalEvent(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-external-event', { detail: detail ?? null }));
  }
}

export function startJarvisConsciousLoop({ getMergedState, getViewData }) {
  if (intervalId != null) clearInterval(intervalId);

  const tick = () => {
    if (Date.now() < eventLockUntil) {
      applyConsciousDom({ eventMode: true });
      return;
    }
    consciousTick += 1;
    const merged = getMergedState();
    const vd = getViewData();
    const micro = generarMicroDecision(merged, vd, consciousTick);
    const { visualPhase, indicatorShift } = actualizarEstadoConsciente(consciousTick);
    applyConsciousDom({
      eventMode: false,
      visualPhase,
      indicatorShift,
      evalLine: micro.evalLine,
      lastAnalysis: micro.lastAnalysis,
      nextAction: micro.nextAction,
    });
  };

  tick();
  intervalId = setInterval(tick, 2500);

  if (typeof window !== 'undefined' && !externalListenerAttached) {
    externalListenerAttached = true;
    window.addEventListener('hnf-jarvis-external-event', () => {
      eventLockUntil = Date.now() + 4500;
      applyConsciousDom({ eventMode: true });
    });
  }

  return () => clearInterval(intervalId);
}

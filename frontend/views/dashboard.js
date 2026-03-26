import { createCard } from '../components/card.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';
import {
  attachGuidanceToIntelNav,
  buildIntelExecutionQueue,
  buildTodayOperationsPanel,
  detectOperationalIssues,
  generateActionPlan,
  getOperationalHealthState,
  getOperationalSnapshot,
  getProactiveSignals,
  runAIAnalysis,
} from '../domain/hnf-intelligence-engine.js';
import { computeCommercialOpportunitySummary } from '../domain/technical-document-intelligence.js';

const pad2 = (n) => String(n).padStart(2, '0');

const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const mondayOf = (d) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
};

const addDaysYmd = (ymd, delta) => {
  const [y, m, dd] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, dd + delta);
  return toYmd(dt);
};

const monthRangeYmd = (d = new Date()) => {
  const start = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const end = toYmd(last);
  return { start, end };
};

const estadoRed = (s) =>
  ({ conectado: 'Conectado', 'sin conexión': 'Sin conexión', cargando: 'Cargando…', pendiente: '—' }[s] || s || '—');

const countBy = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

const avgCloseHours = (ots) => {
  const closed = ots.filter((o) => o.estado === 'terminado' && o.cerradoEn);
  let total = 0;
  let n = 0;
  for (const o of closed) {
    const end = new Date(o.cerradoEn).getTime();
    const start = o.creadoEn ? new Date(o.creadoEn).getTime() : NaN;
    if (!Number.isFinite(start)) continue;
    const h = (end - start) / 3600000;
    if (h >= 0 && h < 720) {
      total += h;
      n += 1;
    }
  }
  return n ? total / n : null;
};

const isFlotaPipeline = (s) =>
  ['recibida', 'evaluacion', 'cotizada', 'aprobada', 'programada', 'en_ruta', 'completada'].includes(s);

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const isOtClima = (o) => (o.tipoServicio || 'clima') !== 'flota';
const isOtFlotaTipo = (o) => String(o.tipoServicio || 'clima') === 'flota';

/** Ingreso real flota (solicitud): solo ingresoFinal > 0. Referencia aparte. */
const flotaSolIngresoReal = (s) => {
  const f = roundMoney(s.ingresoFinal);
  return f > 0 ? f : 0;
};

/** Referencia visual si aún no hay ingreso final positivo. */
const flotaSolIngresoReferencia = (s) => {
  if (roundMoney(s.ingresoFinal) > 0) return 0;
  return roundMoney(s.ingresoEstimado) || roundMoney(s.monto) || 0;
};

const flotaSolUtilidadReal = (s) => {
  const inc = flotaSolIngresoReal(s);
  if (inc <= 0) return 0;
  return roundMoney(inc - roundMoney(s.costoTotal));
};

const climaOtIngresoReal = (o) => roundMoney(o.montoCobrado);
const climaOtCosto = (o) => roundMoney(o.costoTotal);
const climaOtUtilidad = (o) => roundMoney(o.utilidad ?? climaOtIngresoReal(o) - climaOtCosto(o));

const formatMoney = (n) =>
  roundMoney(n).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Margen sobre ingreso real únicamente; sin ingreso real no aplica. */
const formatMargenPct = (ingresoReal, utilidadReal) => {
  const ing = roundMoney(ingresoReal);
  if (ing <= 0) return '—';
  const pct = (roundMoney(utilidadReal) / ing) * 100;
  if (!Number.isFinite(pct)) return '—';
  return `${pct.toFixed(1)}%`;
};

const margenSortValue = (ingresoReal, utilidadReal) => {
  const ing = roundMoney(ingresoReal);
  if (ing <= 0) return -Infinity;
  return roundMoney(utilidadReal) / ing;
};

const techKey = (o) => (String(o.tecnicoAsignado || '').trim() || 'Sin técnico');

const flotaRespKey = (s) =>
  String(s.responsable || '').trim() || String(s.conductor || '').trim() || 'Sin responsable';

const monthLabelEs = (d = new Date()) =>
  d.toLocaleString('es-CL', { month: 'long', year: 'numeric' });

const parseActivityTs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const s = String(raw);
  const t = new Date(s).getTime();
  if (Number.isFinite(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`).getTime();
  return NaN;
};

const formatRefresh = (iso) => {
  if (!iso) return '— (aún no hubo una carga exitosa con el servidor)';
  try {
    return new Date(iso).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return String(iso);
  }
};

const formatRelativeAgo = (iso) => {
  if (!iso) return 'sin registro de sincronización';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 12) return 'hace unos segundos';
  if (sec < 60) return `hace ${sec} segundos`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 36) return `hace ${h} h`;
  return formatRefresh(iso);
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const portalSvgIcon = (pathD) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'portal-tile__icon-svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', pathD);
  svg.append(p);
  return svg;
};

export const dashboardView = ({
  apiBaseLabel,
  integrationStatus,
  lastDataRefreshAt,
  data,
  reloadApp,
  navigateToView,
  intelNavigate,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'dashboard-module dashboard-module--stack dashboard-ops';

  const jarvisPresence = document.createElement('div');
  jarvisPresence.className = 'jarvis-presence';
  jarvisPresence.id = 'hnf-jarvis-presence-root';
  jarvisPresence.dataset.jarvisEstado = 'normal';
  jarvisPresence.dataset.jarvisPrioridad = 'normal';
  jarvisPresence.innerHTML = `
    <div class="jarvis-presence__row">
      <div class="jarvis-core-wrap" aria-hidden="true">
        <div class="jarvis-core">
          <span class="jarvis-core__ring jarvis-core__ring--a"></span>
          <span class="jarvis-core__ring jarvis-core__ring--b"></span>
        </div>
      </div>
      <div class="jarvis-presence__copy">
        <h1 class="jarvis-presence__saludo"></h1>
        <p class="jarvis-presence__mensaje"></p>
        <span class="jarvis-presence__mantra"></span>
        <p class="jarvis-presence__eval-kicker"></p>
        <p class="jarvis-presence__eval-line"></p>
        <div class="jarvis-presence__intel">
          <p class="jarvis-presence__intel-last"></p>
          <p class="jarvis-presence__intel-next"></p>
        </div>
        <p class="jarvis-presence__decision-line"></p>
      </div>
    </div>
  `;
  section.append(jarvisPresence);

  const today = toYmd(new Date());
  const weekStart = toYmd(mondayOf(new Date()));
  const weekEnd = addDaysYmd(weekStart, 6);
  const { start: monthStart, end: monthEnd } = monthRangeYmd();

  const ots = data?.ots?.data || [];
  const clients = data?.clients?.data || [];
  const vehicles = data?.vehicles?.data || [];
  const expenses = data?.expenses?.data || [];
  const planMantenciones = data?.planMantenciones || [];
  const flotaSolicitudes = data?.flotaSolicitudes || [];

  const otDay = ots.filter((o) => o.fecha === today);
  const otWeek = ots.filter((o) => o.fecha >= weekStart && o.fecha <= weekEnd);
  const otMonth = ots.filter((o) => o.fecha >= monthStart && o.fecha <= monthEnd);
  const otMonthClima = otMonth.filter(isOtClima);
  const otMonthFlotaTipo = otMonth.filter(isOtFlotaTipo);

  const flotaMonth = flotaSolicitudes.filter((s) => s.fecha >= monthStart && s.fecha <= monthEnd);
  const mantMonth = planMantenciones.filter((m) => m.fecha >= monthStart && m.fecha <= monthEnd);

  const climaIngresoRealMes = otMonthClima.reduce((t, o) => t + climaOtIngresoReal(o), 0);
  const climaCostoMes = otMonthClima.reduce((t, o) => t + climaOtCosto(o), 0);
  const climaUtilidadMes = otMonthClima.reduce((t, o) => t + climaOtUtilidad(o), 0);

  const flotaSolIngresoRealMes = flotaMonth.reduce((t, s) => t + flotaSolIngresoReal(s), 0);
  const flotaSolIngresoRefMes = flotaMonth.reduce((t, s) => t + flotaSolIngresoReferencia(s), 0);
  const flotaSolCostoMes = flotaMonth.reduce((t, s) => t + roundMoney(s.costoTotal), 0);
  const flotaSolUtilidadRealMes = flotaMonth.reduce((t, s) => t + flotaSolUtilidadReal(s), 0);

  const otFlotaTipoIngresoMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtIngresoReal(o), 0);
  const otFlotaTipoCostoMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtCosto(o), 0);
  const otFlotaTipoUtilidadMes = otMonthFlotaTipo.reduce((t, o) => t + climaOtUtilidad(o), 0);

  const ingresoRealTotalMes =
    climaIngresoRealMes + flotaSolIngresoRealMes + otFlotaTipoIngresoMes;
  const costoTotalMes = climaCostoMes + flotaSolCostoMes + otFlotaTipoCostoMes;
  const utilidadRealTotalMes =
    climaUtilidadMes + flotaSolUtilidadRealMes + otFlotaTipoUtilidadMes;

  const clienteNorm = (name) => String(name || '—').trim() || '—';
  const emptyClienteRow = () => ({
    registros: 0,
    ingresoReal: 0,
    ingresoRef: 0,
    costo: 0,
    utilidadReal: 0,
    pendientes: 0,
  });
  const clienteAgg = new Map();
  const addToCliente = (name, delta) => {
    const k = clienteNorm(name);
    if (!clienteAgg.has(k)) clienteAgg.set(k, emptyClienteRow());
    const c = clienteAgg.get(k);
    c.registros += delta.registros || 0;
    c.ingresoReal += delta.ingresoReal || 0;
    c.ingresoRef += delta.ingresoRef || 0;
    c.costo += delta.costo || 0;
    c.utilidadReal += delta.utilidadReal || 0;
    c.pendientes += delta.pendientes || 0;
  };

  otMonthClima.forEach((o) => {
    addToCliente(o.cliente, {
      registros: 1,
      ingresoReal: climaOtIngresoReal(o),
      costo: climaOtCosto(o),
      utilidadReal: climaOtUtilidad(o),
      pendientes: o.estado !== 'terminado' ? 1 : 0,
    });
  });
  otMonthFlotaTipo.forEach((o) => {
    addToCliente(o.cliente, {
      registros: 1,
      ingresoReal: climaOtIngresoReal(o),
      costo: climaOtCosto(o),
      utilidadReal: climaOtUtilidad(o),
      pendientes: o.estado !== 'terminado' ? 1 : 0,
    });
  });
  flotaMonth.forEach((s) => {
    addToCliente(s.cliente, {
      registros: 1,
      ingresoReal: flotaSolIngresoReal(s),
      ingresoRef: flotaSolIngresoReferencia(s),
      costo: roundMoney(s.costoTotal),
      utilidadReal: flotaSolUtilidadReal(s),
      pendientes: s.estado !== 'cerrada' ? 1 : 0,
    });
  });

  const emptyRespRow = () => ({
    otTotal: 0,
    otTerm: 0,
    flotaTotal: 0,
    flotaCerr: 0,
    flotaComp: 0,
    pendientes: 0,
    ingresoReal: 0,
    utilidadReal: 0,
  });
  const respAgg = new Map();
  const addResp = (key, patch) => {
    const k = String(key || '').trim() || '—';
    if (!respAgg.has(k)) respAgg.set(k, emptyRespRow());
    const r = respAgg.get(k);
    r.otTotal += patch.otTotal || 0;
    r.otTerm += patch.otTerm || 0;
    r.flotaTotal += patch.flotaTotal || 0;
    r.flotaCerr += patch.flotaCerr || 0;
    r.flotaComp += patch.flotaComp || 0;
    r.pendientes += patch.pendientes || 0;
    r.ingresoReal += patch.ingresoReal || 0;
    r.utilidadReal += patch.utilidadReal || 0;
  };

  [...otMonthClima, ...otMonthFlotaTipo].forEach((o) => {
    addResp(techKey(o), {
      otTotal: 1,
      otTerm: o.estado === 'terminado' ? 1 : 0,
      pendientes: o.estado !== 'terminado' ? 1 : 0,
      ingresoReal: climaOtIngresoReal(o),
      utilidadReal: climaOtUtilidad(o),
    });
  });
  flotaMonth.forEach((s) => {
    addResp(flotaRespKey(s), {
      flotaTotal: 1,
      flotaCerr: s.estado === 'cerrada' ? 1 : 0,
      flotaComp: s.estado === 'completada' ? 1 : 0,
      pendientes: s.estado !== 'cerrada' ? 1 : 0,
      ingresoReal: flotaSolIngresoReal(s),
      utilidadReal: flotaSolUtilidadReal(s),
    });
  });

  const byEstado = (list) => countBy(list, (o) => o.estado || '—');
  const estMonth = byEstado(otMonth);

  const tecMonthTerm = countBy(
    otMonth.filter((o) => o.estado === 'terminado'),
    (o) => (o.tecnicoAsignado || 'Sin técnico').trim() || 'Sin técnico'
  );
  const tecMonthAll = countBy(otMonth, (o) => (o.tecnicoAsignado || 'Sin técnico').trim() || 'Sin técnico');

  const creadasMes = otMonth.length;
  const terminadasMes = otMonth.filter((o) => o.estado === 'terminado').length;
  const pctTerm =
    creadasMes > 0 ? Math.round((terminadasMes / creadasMes) * 1000) / 10 : null;

  const avgH = avgCloseHours(ots);
  const avgCloseLabel =
    avgH == null ? '— (falta creadoEn en OT antiguas)' : `${avgH < 24 ? avgH.toFixed(1) + ' h' : (avgH / 24).toFixed(1) + ' días'}`;

  const flotaActivas = flotaSolicitudes.filter((s) => isFlotaPipeline(s.estado));
  const flotaPendientes = flotaSolicitudes.filter((s) => String(s.estado || '') === 'recibida');

  const flotaAprobadaNoEjecutada = flotaSolicitudes.filter((s) => s.estado === 'aprobada').length;
  const flotaCompletadaNoCerrada = flotaSolicitudes.filter((s) => s.estado === 'completada').length;
  const otSinCostos = ots.filter(
    (o) => o.estado === 'terminado' && (!Number(o.costoTotal) || Number(o.costoTotal) <= 0)
  ).length;
  const otTerminadasNoInformadas = ots.filter(
    (o) => o.estado === 'terminado' && (!o.pdfUrl || !String(o.pdfUrl).trim())
  ).length;

  const flotaCerradaSinIngresoFinal = flotaSolicitudes.filter(
    (s) => s.estado === 'cerrada' && roundMoney(s.ingresoFinal) <= 0
  ).length;

  const flotaRecibidaMas2Dias = flotaSolicitudes.filter((s) => {
    if (String(s.estado) !== 'recibida') return false;
    const ref = s.createdAt || (s.fecha ? `${String(s.fecha).slice(0, 10)}T12:00:00` : '');
    const t = ref ? new Date(ref).getTime() : NaN;
    if (!Number.isFinite(t)) return false;
    return (Date.now() - t) / 86400000 > 2;
  }).length;

  const otInformadasNoCobradas = ots.filter(
    (o) =>
      o.estado === 'terminado' &&
      o.pdfUrl &&
      String(o.pdfUrl).trim().length > 0 &&
      roundMoney(o.montoCobrado) <= 0
  ).length;

  const tiendasConRealizado = new Set(
    planMantenciones.filter((m) => m.estado === 'realizado' && m.tiendaId).map((m) => m.tiendaId)
  );
  const tiendaTieneMantFutura = (tid) =>
    planMantenciones.some(
      (m) =>
        m.tiendaId === tid &&
        String(m.fecha || '') > today &&
        (m.estado === 'pendiente' || m.estado === 'programado')
    );
  const mantSinContinuidadTiendas = [...tiendasConRealizado].filter(
    (tid) => !tiendaTieneMantFutura(tid)
  ).length;

  const prox7End = addDaysYmd(today, 7);
  const mantProx = planMantenciones.filter(
    (m) => m.fecha >= today && m.fecha <= prox7End && (m.estado === 'programado' || m.estado === 'pendiente')
  );

  const mantAtras = planMantenciones.filter((m) => m.fecha < today && m.estado !== 'realizado');

  const otAbiertas = ots.filter((o) => o.estado !== 'terminado');
  const otSinFotos = ots.filter((o) => o.estado !== 'terminado' && getEvidenceGaps(o).length > 0);

  const otPend = ots.filter((o) => o.estado === 'pendiente').length;
  const otProc = ots.filter((o) => o.estado === 'en proceso').length;
  const otTerm = ots.filter((o) => o.estado === 'terminado').length;

  const alerts = [];
  if (otAbiertas.length) alerts.push(`${otAbiertas.length} OT sin cerrar (no terminadas).`);
  if (otSinFotos.length) alerts.push(`${otSinFotos.length} OT abiertas con fotos incompletas por equipo/bloque.`);
  if (mantAtras.length) alerts.push(`${mantAtras.length} mantenciones vencidas (fecha pasada y no realizadas).`);
  if (flotaAprobadaNoEjecutada)
    alerts.push(`${flotaAprobadaNoEjecutada} servicio(s) flota en «aprobada» (pendientes de programar / ejecutar).`);
  if (otSinCostos) alerts.push(`${otSinCostos} OT terminadas sin costos cargados (costo total en 0).`);
  if (flotaRecibidaMas2Dias)
    alerts.push(
      `${flotaRecibidaMas2Dias} solicitud(es) flota en «recibida» con más de 2 días sin avanzar.`
    );

  const tecTop = [...tecMonthAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const statusClass =
    integrationStatus === 'conectado'
      ? 'diagnostico-status diagnostico-status--ok'
      : integrationStatus === 'cargando'
        ? 'diagnostico-status diagnostico-status--pending'
        : 'diagnostico-status diagnostico-status--bad';

  const statusTitle =
    integrationStatus === 'conectado'
      ? 'Conexión correcta'
      : integrationStatus === 'cargando'
        ? 'Conectando con el servidor…'
        : 'Sin conexión con el servidor';

  const statusDetail =
    integrationStatus === 'conectado'
      ? 'Los datos de esta pantalla se cargaron bien. Revisá las alertas si hay algo pendiente de cerrar o cobrar.'
      : integrationStatus === 'cargando'
        ? 'Esperá un momento mientras se obtienen los datos.'
        : 'No se pudo contactar al API. Revisá que el backend esté en marcha y la URL en la configuración.';

  const pilotBar = document.createElement('div');
  pilotBar.className = 'module-toolbar ops-toolbar';
  const livePill = document.createElement('div');
  livePill.className = `ops-toolbar-live ${
    integrationStatus === 'conectado'
      ? 'ops-toolbar-live--ok'
      : integrationStatus === 'cargando'
        ? 'ops-toolbar-live--load'
        : 'ops-toolbar-live--off'
  }`;
  const liveDot = document.createElement('span');
  liveDot.className = 'ops-live-dot ops-live-dot--toolbar';
  const liveLbl = document.createElement('span');
  liveLbl.className = 'ops-toolbar-live__text';
  liveLbl.textContent =
    integrationStatus === 'conectado'
      ? `Datos vivos · ${formatRelativeAgo(lastDataRefreshAt)}`
      : integrationStatus === 'cargando'
        ? 'Sincronizando…'
        : 'Sin enlace al servidor';
  livePill.append(liveDot, liveLbl);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'secondary-button hnf-action-sync';
  refreshBtn.title = 'Recarga OT, flota y planificación desde el API.';
  const syncLab = document.createElement('span');
  syncLab.className = 'hnf-action-sync__label';
  syncLab.textContent = 'Sincronizar';
  const syncLd = document.createElement('span');
  syncLd.className = 'hnf-action-sync__loader';
  syncLd.setAttribute('aria-hidden', 'true');
  refreshBtn.append(syncLab, syncLd);
  const refreshHint = document.createElement('span');
  refreshHint.className = 'muted module-toolbar__hint';
  refreshHint.textContent = 'Pulse corta: actualiza el centro de operaciones.';
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('is-loading');
    await (typeof reloadApp === 'function' ? reloadApp() : Promise.resolve(false));
    refreshBtn.classList.remove('is-loading');
    refreshBtn.disabled = false;
  });
  pilotBar.append(livePill, refreshBtn, refreshHint);
  section.append(pilotBar);

  const opsStack = document.createElement('div');
  opsStack.className = 'ops-intro-stack';

  const hero = document.createElement('div');
  hero.className = 'ops-hero';
  ['ops-hero__veil', 'ops-hero__aurora', 'ops-hero__particles', 'ops-hero__core'].forEach((c) => {
    const el = document.createElement('div');
    el.className = c;
    el.setAttribute('aria-hidden', 'true');
    hero.append(el);
  });
  const hc = document.createElement('div');
  hc.className = 'ops-hero__content';
  const brand = document.createElement('p');
  brand.className = 'ops-hero__brand';
  brand.textContent = 'HNF Servicios Integrales';
  const headline = document.createElement('h1');
  headline.className = 'ops-hero__headline';
  headline.textContent = 'Centro de Operaciones Inteligente';
  const tagline = document.createElement('p');
  tagline.className = 'ops-hero__tagline';
  tagline.textContent = 'Control total de Clima y Flota en tiempo real';
  const heroLive = document.createElement('div');
  heroLive.className = 'ops-hero__live';
  const hDot = document.createElement('span');
  hDot.className = 'ops-live-dot';
  const hLiveTxt = document.createElement('span');
  hLiveTxt.className = 'ops-live-text';
  hLiveTxt.textContent = `Última sincronización ${formatRelativeAgo(lastDataRefreshAt)} · ${apiBaseLabel || 'API'}`;
  heroLive.append(hDot, hLiveTxt);
  hc.append(brand, headline, tagline, heroLive);
  hero.append(hc);

  const portalGrid = document.createElement('div');
  portalGrid.className = 'portal-grid portal-grid--premium';

  const ICON_CLIM =
    'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z';
  const ICON_PLAN =
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
  const ICON_FLOT =
    'M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 11h12v4H3v-4zm0-2h12V7l-2-3H5L3 7v2zm14 6h3l2 2v3h-5v-5z';
  const ICON_ADM =
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z';
  const ICON_IA =
    'M13 10V3L4 14h7v7l9-11h-7z';
  const ICON_OPP = 'M3 17l6-6 4 4 8-8M3 21h18M3 3v18h18';

  const mkPortalTile = (viewId, modClass, pathD, kicker, title, desc) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `portal-tile portal-tile--${modClass}`;
    const iconWrap = document.createElement('span');
    iconWrap.className = 'portal-tile__icon-wrap';
    iconWrap.append(portalSvgIcon(pathD));
    const body = document.createElement('span');
    body.className = 'portal-tile__body';
    const k = document.createElement('span');
    k.className = 'portal-tile__kicker';
    k.textContent = kicker;
    const t = document.createElement('span');
    t.className = 'portal-tile__title';
    t.textContent = title;
    const d = document.createElement('span');
    d.className = 'portal-tile__desc';
    d.textContent = desc;
    body.append(k, t, d);
    const cta = document.createElement('span');
    cta.className = 'portal-tile__cta';
    cta.textContent = 'Ingresar →';
    b.append(iconWrap, body, cta);
    b.addEventListener('click', () => {
      if (typeof navigateToView === 'function') navigateToView(viewId);
    });
    return b;
  };

  portalGrid.append(
    mkPortalTile('clima', 'clima', ICON_CLIM, 'Línea HVAC', 'Clima operativo', 'OT, evidencias, economía, cierre.'),
    mkPortalTile('planificacion', 'plan', ICON_PLAN, 'Agenda', 'Planificación', 'Clientes, tiendas, AM/PM, mantenciones.'),
    mkPortalTile('flota', 'flota', ICON_FLOT, 'Movilidad', 'Flota', 'Solicitudes, pipeline, costos e ingresos.'),
    mkPortalTile(
      'oportunidades',
      'comercial',
      ICON_OPP,
      'Ingresos',
      'Oportunidades',
      'Desde informes técnicos aprobados: prioridad y montos estimados.'
    ),
    mkPortalTile('admin', 'admin', ICON_ADM, 'Corporativo', 'Administración', 'Respaldos JSON y datos maestros.'),
    mkPortalTile('asistente', 'ia', ICON_IA, 'Inteligencia', 'Asistente HNF', 'Diagnóstico sobre datos reales.')
  );

  opsStack.append(hero, portalGrid);

  const mesRef = monthLabelEs(new Date(monthStart + 'T12:00:00'));
  const cmd = document.createElement('section');
  cmd.className = 'ops-command';
  const cmdHead = document.createElement('div');
  cmdHead.className = 'ops-command__head';
  const cmdTitle = document.createElement('h2');
  cmdTitle.className = 'ops-command__title';
  cmdTitle.textContent = 'Panel de control operativo';
  const cmdSub = document.createElement('p');
  cmdSub.className = 'ops-command__sub muted';
  cmdSub.textContent = `Indicadores en vivo · ${mesRef} · ingreso real consolidado`;
  cmdHead.append(cmdTitle, cmdSub);

  const cmdGrid = document.createElement('div');
  cmdGrid.className = 'ops-command__grid';

  const donutDeg = pctTerm != null ? Math.min(360, (pctTerm / 100) * 360) : 0;
  const wDonut = document.createElement('article');
  wDonut.className = 'ops-widget ops-widget--donut';
  wDonut.innerHTML = `<h3 class="ops-widget__label">Cierre OT (mes)</h3>
    <div class="ops-donut" style="--donut-deg:${donutDeg}deg">
      <div class="ops-donut__hole"><span class="ops-donut__pct">${pctTerm != null ? `${pctTerm}%` : '—'}</span><span class="ops-donut__cap">cerradas / creadas</span></div>
    </div>
    <p class="ops-widget__foot muted">${terminadasMes} / ${creadasMes} OT</p>`;

  const openPct = ots.length ? Math.round((otAbiertas.length / ots.length) * 100) : 0;
  const wOt = document.createElement('article');
  wOt.className = 'ops-widget ops-widget--bars ops-widget--clima';
  wOt.innerHTML = `<h3 class="ops-widget__label">OT abiertas</h3>
    <p class="ops-widget__value"><strong>${otAbiertas.length}</strong> <span class="muted">/ ${ots.length} registro</span></p>
    <div class="ops-progress"><span class="ops-progress__fill ops-progress__fill--clima" style="width:${openPct}%"></span></div>
    <p class="ops-widget__foot muted">Pendientes ${otPend} · En proceso ${otProc}</p>`;

  const flMax = Math.max(1, flotaSolicitudes.length);
  const flPct = Math.round((flotaActivas.length / flMax) * 100);
  const wFl = document.createElement('article');
  wFl.className = 'ops-widget ops-widget--bars ops-widget--flota';
  wFl.innerHTML = `<h3 class="ops-widget__label">Flota en curso</h3>
    <p class="ops-widget__value"><strong>${flotaActivas.length}</strong> <span class="muted">activas en pipeline</span></p>
    <div class="ops-progress"><span class="ops-progress__fill ops-progress__fill--flota" style="width:${flPct}%"></span></div>
    <p class="ops-widget__foot muted">Ingreso mes ${formatMoney(ingresoRealTotalMes)}</p>`;

  const alertLevel =
    alerts.length > 4 ? 'ops-widget--alert-sev-high' : alerts.length > 0 ? 'ops-widget--alert-sev-mid' : 'ops-widget--alert-sev-ok';
  const wAl = document.createElement('article');
  wAl.className = `ops-widget ops-widget--alerts ${alertLevel}`;
  const alH = document.createElement('h3');
  alH.className = 'ops-widget__label';
  alH.textContent = 'Alertas operativas';
  const alVal = document.createElement('p');
  alVal.className = 'ops-widget__value';
  alVal.innerHTML = `<strong>${alerts.length}</strong> <span class="muted">condiciones</span>`;
  const alList = document.createElement('ul');
  alList.className = 'ops-alert-list';
  (alerts.length ? alerts.slice(0, 4) : ['Sin alertas en los criterios vigentes.']).forEach((txt) => {
    const li = document.createElement('li');
    li.textContent = txt;
    alList.append(li);
  });
  wAl.append(alH, alVal, alList);

  cmdGrid.append(wDonut, wOt, wFl, wAl);
  cmd.append(cmdHead, cmdGrid);

  const comSum = computeCommercialOpportunitySummary(data?.commercialOpportunities || [], monthStart, monthEnd);
  const cmdCommHead = document.createElement('div');
  cmdCommHead.className = 'ops-command__head ops-command__head--sub';
  const cti = document.createElement('h2');
  cti.className = 'ops-command__title';
  cti.textContent = 'Oportunidades comerciales (mes)';
  const cts = document.createElement('p');
  cts.className = 'ops-command__sub muted';
  cts.textContent = `Generadas al aprobar informes técnicos · ${mesRef}`;
  cmdCommHead.append(cti, cts);

  const commGrid = document.createElement('div');
  commGrid.className = 'ops-command__grid';

  const wOppMes = document.createElement('article');
  wOppMes.className = 'ops-widget ops-widget--commercial';
  wOppMes.innerHTML = `<h3 class="ops-widget__label">Oportunidades del mes</h3>
    <p class="ops-widget__value"><strong>${comSum.countMes}</strong> <span class="muted">registros</span></p>
    <p class="ops-widget__foot muted">Pipeline detectado por Jarvis / reglas</p>`;

  const wPot = document.createElement('article');
  wPot.className = 'ops-widget ops-widget--commercial';
  wPot.innerHTML = `<h3 class="ops-widget__label">Monto potencial (mes)</h3>
    <p class="ops-widget__value"><strong>$ ${formatMoney(comSum.potencialTotalMes)}</strong> <span class="muted">estimado</span></p>
    <p class="ops-widget__foot muted">Bases editables en config comercial</p>`;

  const wUrg = document.createElement('article');
  wUrg.className = `ops-widget ops-widget--commercial ${comSum.urgentesPendientesMes > 0 ? 'ops-widget--alert-sev-mid' : ''}`;
  wUrg.innerHTML = `<h3 class="ops-widget__label">Urgentes pendientes</h3>
    <p class="ops-widget__value"><strong>${comSum.urgentesPendientesMes}</strong> <span class="muted">prioridad alta</span></p>
    <p class="ops-widget__foot muted">Revisar en Oportunidades</p>`;

  const btnOpp = document.createElement('button');
  btnOpp.type = 'button';
  btnOpp.className = 'secondary-button ops-widget__foot';
  btnOpp.textContent = 'Abrir oportunidades →';
  btnOpp.addEventListener('click', () => typeof navigateToView === 'function' && navigateToView('oportunidades'));
  wUrg.append(btnOpp);

  commGrid.append(wOppMes, wPot, wUrg);
  cmd.append(cmdCommHead, commGrid);

  const intel = document.createElement('section');
  intel.className = 'hnf-intelligence-center';
  const ieHead = document.createElement('div');
  ieHead.className = 'hnf-ie-head';
  const ieTitle = document.createElement('h2');
  ieTitle.className = 'hnf-ie-title';
  ieTitle.textContent = 'Centro de inteligencia HNF';
  const ieSub = document.createElement('p');
  ieSub.className = 'muted hnf-ie-sub';
  ieSub.textContent = 'Reglas sobre datos vivos: prioriza, enlaza al módulo y guía el cierre (no es chat).';
  ieHead.append(ieTitle, ieSub);

  const ieRefresh = document.createElement('button');
  ieRefresh.type = 'button';
  ieRefresh.className = 'secondary-button hnf-ie-refresh';
  ieRefresh.textContent = 'Actualizar análisis';
  ieRefresh.title = 'Recarga datos del servidor y vuelve a evaluar el snapshot operativo.';
  ieRefresh.addEventListener('click', async () => {
    ieRefresh.disabled = true;
    ieRefresh.classList.add('is-loading');
    await (typeof reloadApp === 'function' ? reloadApp() : Promise.resolve(false));
    ieRefresh.classList.remove('is-loading');
    ieRefresh.disabled = false;
  });

  const ieTopRow = document.createElement('div');
  ieTopRow.className = 'hnf-ie-top';
  ieTopRow.append(ieHead, ieRefresh);

  const ieBody = document.createElement('div');
  ieBody.className = 'hnf-ie-body';

  if (integrationStatus !== 'conectado' || !data) {
    const off = document.createElement('p');
    off.className = 'hnf-ie-offline';
    off.textContent =
      integrationStatus === 'cargando'
        ? 'Conectando… El análisis inteligente se mostrará al obtener datos del API.'
        : 'Sin datos del servidor. Conectá el backend y sincronizá para activar el motor de detección.';
    ieBody.append(off);
  } else {
    const snap = getOperationalSnapshot(data);
    const issues = detectOperationalIssues(snap, data);
    const plan = generateActionPlan(issues);
    const proactive = getProactiveSignals(snap);
    const health = getOperationalHealthState(issues);
    const execQueue = buildIntelExecutionQueue(data);
    const todayPanel = buildTodayOperationsPanel(data);
    void runAIAnalysis(snap);

    const estadoLab =
      health === 'critico' ? 'Crítico' : health === 'atencion' ? 'Atención' : 'Óptimo';
    const status = document.createElement('div');
    status.className = `hnf-ie-status hnf-ie-status--${health}`;
    status.setAttribute('role', 'status');
    const stLabel = document.createElement('span');
    stLabel.className = 'hnf-ie-status__k';
    stLabel.textContent = 'Estado general';
    const stVal = document.createElement('span');
    stVal.className = 'hnf-ie-status__v';
    stVal.textContent = estadoLab;
    const stHint = document.createElement('span');
    stHint.className = 'hnf-ie-status__hint';
    stHint.textContent =
      health === 'optimo'
        ? 'Sin hallazgos críticos ni de atención con las reglas vigentes.'
        : `${issues.filter((i) => i.tipo === 'CRITICO').length} crítico(s) · ${issues.filter((i) => i.tipo === 'ATENCION').length} atención`;
    status.append(stLabel, stVal, stHint);

    const todayBox = document.createElement('div');
    todayBox.className = 'hnf-ie-today';
    const todayH = document.createElement('h3');
    todayH.className = 'hnf-ie-col__title';
    todayH.textContent = 'Qué hacer hoy';
    const todayGrid = document.createElement('div');
    todayGrid.className = 'hnf-ie-today-grid';

    const mkTodayMini = (title, items, emptyMsg) => {
      const col = document.createElement('div');
      col.className = 'hnf-ie-today-col';
      const h = document.createElement('h4');
      h.className = 'hnf-ie-today-col__h';
      h.textContent = title;
      const ul = document.createElement('ul');
      ul.className = 'hnf-ie-today-list';
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = emptyMsg;
        ul.append(li);
      } else {
        items.forEach((it) => {
          const li = document.createElement('li');
          li.className = `hnf-ie-today-li hnf-ie-today-li--${String(it.tipo || 'atencion').toLowerCase()}`;
          const t = document.createElement('span');
          t.className = 'hnf-ie-today-li__t';
          t.textContent = it.titulo;
          li.append(t);
          if (it.nav && typeof intelNavigate === 'function') {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'primary-button hnf-ie-today-li__go';
            b.textContent = 'Resolver ahora';
            b.addEventListener('click', () => intelNavigate(it.nav));
            li.append(b);
          }
        });
      }
      col.append(h, ul);
      return col;
    };

    todayGrid.append(
      mkTodayMini('Prioridades (crítico)', todayPanel.prioridades, 'Sin críticos detectados.'),
      mkTodayMini('Top pendientes', todayPanel.topPendientes, 'Sin OT pendientes.'),
      mkTodayMini('Cierres urgentes', todayPanel.topCierres, 'Ninguna lista para cierre inmediato.'),
      mkTodayMini('Riesgos operativos', todayPanel.topRiesgos, 'Sin riesgos de atención en cola.'),
      mkTodayMini('Seguimiento', todayPanel.seguimiento, 'Sin ítems de seguimiento.')
    );
    todayBox.append(todayH, todayGrid);

    const sigWrap = document.createElement('div');
    sigWrap.className = 'hnf-ie-col';
    const sigH = document.createElement('h3');
    sigH.className = 'hnf-ie-col__title';
    sigH.textContent = 'Señales automáticas';
    const sigUl = document.createElement('ul');
    sigUl.className = 'hnf-ie-syslist';
    (proactive.length ? proactive : ['Operación estable según umbrales actuales; seguí sincronizando datos.']).forEach(
      (line) => {
        const li = document.createElement('li');
        li.textContent = line;
        sigUl.append(li);
      }
    );
    sigWrap.append(sigH, sigUl);

    const execWrap = document.createElement('div');
    execWrap.className = 'hnf-ie-exec-wrap hnf-ie-exec-wrap--hero';
    const execH = document.createElement('h3');
    execH.className = 'hnf-ie-col__title hnf-ie-exec-wrap__title';
    execH.textContent = 'Resolver ahora';
    const execUl = document.createElement('ul');
    execUl.className = 'hnf-ie-exec-list';
    if (!execQueue.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Cola vacía con los datos actuales.';
      execUl.append(li);
    } else {
      execQueue.forEach((it) => {
        const li = document.createElement('li');
        li.className = `hnf-ie-exec hnf-ie-exec--${String(it.tipo).toLowerCase()}`;
        const top = document.createElement('div');
        top.className = 'hnf-ie-exec__top';
        const badge = document.createElement('span');
        badge.className = 'hnf-ie-exec__badge';
        badge.textContent = it.tipo;
        const mod = document.createElement('span');
        mod.className = 'hnf-ie-exec__mod';
        mod.textContent = it.modulo;
        top.append(badge, mod);
        const tit = document.createElement('div');
        tit.className = 'hnf-ie-exec__tit';
        tit.textContent = it.titulo;
        const desc = document.createElement('div');
        desc.className = 'muted hnf-ie-exec__desc';
        desc.textContent = it.descripcion;
        const row = document.createElement('div');
        row.className = 'hnf-ie-exec__row';
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'primary-button hnf-ie-exec__go hnf-ie-exec__go--now';
        go.textContent = 'Resolver ahora';
        go.title = it.accionCorta || 'Abrir módulo';
        go.addEventListener('click', () => intelNavigate?.(it.nav));
        row.append(go);
        if (it.automation?.kind) {
          const au = document.createElement('span');
          au.className = 'hnf-ie-exec__auto muted';
          au.textContent = `Automatización futura: ${it.automation.kind}`;
          row.append(au);
        }
        li.append(top, tit, desc, row);
        execUl.append(li);
      });
    }
    const rollup = document.createElement('div');
    rollup.className = 'hnf-ie-rollups';
    const mkRoll = (label, nav) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary-button hnf-ie-roll';
      b.textContent = label;
      b.addEventListener('click', () => intelNavigate?.(nav));
      return b;
    };
    rollup.append(
      mkRoll(
        'Clima · terminadas sin costo',
        attachGuidanceToIntelNav({ view: 'clima', climaFilter: { sinCostoTerminadas: true } }, 'FILTER_SIN_COSTO', '')
      ),
      mkRoll(
        'Clima · mes actual',
        attachGuidanceToIntelNav({ view: 'clima', climaFilter: { soloMesActual: true } }, 'FILTER_MES', '')
      ),
      mkRoll(
        'Planificación · atrasadas',
        attachGuidanceToIntelNav(
          { view: 'planificacion', plan: { tab: 'plan', mantFilter: 'atrasadas' } },
          'PLAN_ATRASADAS',
          ''
        )
      ),
      mkRoll(
        'Planificación · próximas 7 días',
        attachGuidanceToIntelNav(
          { view: 'planificacion', plan: { tab: 'plan', mantFilter: 'proximas' } },
          'PLAN_PROXIMAS',
          ''
        )
      )
    );
    execWrap.append(execH, execUl, rollup);

    const planWrap = document.createElement('div');
    planWrap.className = 'hnf-ie-plan-wrap';
    const planH = document.createElement('h3');
    planH.className = 'hnf-ie-col__title';
    planH.textContent = 'Plan de acción sugerido (resumen)';
    const planOl = document.createElement('ol');
    planOl.className = 'hnf-ie-plan';
    plan.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      planOl.append(li);
    });
    planWrap.append(planH, planOl);

    const rowSigPlan = document.createElement('div');
    rowSigPlan.className = 'hnf-ie-row2';
    rowSigPlan.append(sigWrap, planWrap);

    ieBody.append(status, execWrap, todayBox, rowSigPlan);
  }

  intel.append(ieTopRow, ieBody);

  const asst = document.createElement('section');
  asst.className = 'ops-assistant';
  const asH = document.createElement('div');
  asH.className = 'ops-assistant__head';
  const asTitle = document.createElement('h2');
  asTitle.className = 'ops-assistant__title';
  asTitle.textContent = 'Asistente HNF';
  const asBadge = document.createElement('span');
  asBadge.className = 'ops-assistant__badge';
  asBadge.textContent = 'Beta · UI';
  asH.append(asTitle, asBadge);
  const asSub = document.createElement('p');
  asSub.className = 'muted ops-assistant__sub';
  asSub.textContent =
    'Consultas preparadas; el motor completo está en el módulo Asistente IA. No se envía nada a servicios externos desde acá.';
  const asRow = document.createElement('div');
  asRow.className = 'ops-assistant__row';
  const asInp = document.createElement('input');
  asInp.type = 'text';
  asInp.className = 'ops-assistant__input';
  asInp.placeholder = 'Preguntá por pendientes, ingresos o alertas…';
  const asGo = document.createElement('button');
  asGo.type = 'button';
  asGo.className = 'ops-assistant__send';
  asGo.textContent = 'Abrir análisis';
  const openAsistente = () => navigateToView?.('asistente');
  asGo.addEventListener('click', openAsistente);
  asInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openAsistente();
  });
  asRow.append(asInp, asGo);
  const chips = document.createElement('div');
  chips.className = 'ops-assistant__chips';
  ['¿Qué falta cerrar hoy?', 'Resumen de ingresos', 'Alertas críticas'].forEach((label) => {
    const ch = document.createElement('button');
    ch.type = 'button';
    ch.className = 'ops-assistant__chip';
    ch.textContent = label;
    ch.addEventListener('click', openAsistente);
    chips.append(ch);
  });
  asst.append(asH, asSub, asRow, chips);

  const portalSection = opsStack;

  const activityBox = document.createElement('article');
  activityBox.className = 'activity-feed';
  const actH = document.createElement('h3');
  actH.className = 'activity-feed__title';
  actH.textContent = 'Actividad reciente (referencia)';
  const actSub = document.createElement('p');
  actSub.className = 'muted activity-feed__sub';
  actSub.textContent =
    'Últimos movimientos detectados por fecha de actualización o alta. Útil para ver qué tocó el equipo; no reemplaza auditoría completa.';
  activityBox.append(actH, actSub);

  const actItems = [];
  for (const o of ots) {
    const ts = parseActivityTs(o.updatedAt ?? o.creadoEn ?? o.createdAt);
    if (!Number.isFinite(ts)) continue;
    actItems.push({
      ts,
      line: `OT ${o.id} · ${clienteNorm(o.cliente)}`,
      meta: String(o.estado || '—'),
      tag: 'Clima',
    });
  }
  for (const s of flotaSolicitudes) {
    const ts = parseActivityTs(s.updatedAt ?? s.createdAt ?? s.fecha);
    if (!Number.isFinite(ts)) continue;
    actItems.push({
      ts,
      line: `Flota ${s.id} · ${clienteNorm(s.cliente)}`,
      meta: String(s.estado || '—'),
      tag: 'Flota',
    });
  }
  actItems.sort((a, b) => b.ts - a.ts);
  const topAct = actItems.slice(0, 10);

  if (!topAct.length) {
    const p = document.createElement('p');
    p.className = 'muted activity-feed__empty';
    p.textContent =
      'Sin marcas de tiempo recientes en los datos cargados. Creá o editá registros y sincronizá de nuevo.';
    activityBox.append(p);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'activity-feed__list';
    topAct.forEach((row) => {
      const li = document.createElement('li');
      li.className = 'activity-feed__item';
      const t = document.createElement('span');
      t.className = 'activity-feed__time';
      try {
        t.textContent = new Date(row.ts).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        t.textContent = '—';
      }
      const main = document.createElement('span');
      main.className = 'activity-feed__main';
      main.textContent = row.line;
      const badge = document.createElement('span');
      badge.className = 'activity-feed__badge';
      badge.textContent = `${row.tag} · ${row.meta}`;
      li.append(t, main, badge);
      ul.append(li);
    });
    activityBox.append(ul);
  }

  const diag = document.createElement('article');
  diag.className = 'diagnostico-panel';
  diag.innerHTML = `
    <h3 class="diagnostico-panel__title">Conexión y contadores rápidos</h3>
    <div class="${statusClass}">
      <strong class="diagnostico-status__head">${statusTitle}</strong>
      <p class="diagnostico-status__detail">${statusDetail}</p>
      <p class="diagnostico-status__meta muted"><strong>Backend:</strong> ${estadoRed(integrationStatus)} · <strong>API:</strong> ${apiBaseLabel || '—'}<br>
      <strong>Última actualización de datos:</strong> ${formatRefresh(lastDataRefreshAt)}</p>
    </div>
    <ul class="diagnostico-metrics">
      <li><strong>Total OT (Clima)</strong> · ${ots.length}</li>
      <li><strong>OT pendientes</strong> · ${otPend}</li>
      <li><strong>OT en proceso</strong> · ${otProc}</li>
      <li><strong>OT terminadas</strong> · ${otTerm}</li>
      <li><strong>Mantenciones próximas (7 días)</strong> · ${mantProx.length}</li>
      <li><strong>Mantenciones atrasadas</strong> · ${mantAtras.length}</li>
      <li><strong>Flota en etapa inicial (recibida)</strong> · ${flotaPendientes.length}</li>
      <li><strong>Flota aprobada sin ejecutar</strong> · ${flotaAprobadaNoEjecutada}</li>
      <li><strong>Flota completada sin cierre administrativo</strong> · ${flotaCompletadaNoCerrada}</li>
      <li><strong>OT terminadas sin costos</strong> · ${otSinCostos}</li>
      <li><strong>OT informadas no cobradas</strong> · ${otInformadasNoCobradas}</li>
      <li><strong>OT terminadas sin informe</strong> · ${otTerminadasNoInformadas}</li>
      <li><strong>Flota cerrada sin ingreso final</strong> · ${flotaCerradaSinIngresoFinal}</li>
      <li><strong>Tiendas sin mantención futura (tras realizada)</strong> · ${mantSinContinuidadTiendas}</li>
      <li><strong>Flota «recibida» &gt; 2 días</strong> · ${flotaRecibidaMas2Dias}</li>
    </ul>
    <p class="muted diagnostico-hint">El respaldo manual en JSON está en <strong>Administración → Respaldo</strong>.</p>
  `;

  const gerencial = document.createElement('article');
  gerencial.className = 'dashboard-gerencial';
  const mesTitulo = monthLabelEs(new Date(monthStart + 'T12:00:00'));
  gerencial.innerHTML = `
    <h2 class="dashboard-gerencial__title">Métricas mensuales y rentabilidad</h2>
    <p class="muted dashboard-gerencial__eyebrow">Control de números · ${mesTitulo}</p>
    <p class="dashboard-gerencial__criterio">
      <strong>Criterio financiero:</strong> Clima → ingreso real = <code>montoCobrado</code>, utilidad = <code>montoCobrado − costoTotal</code>.
      Flota (solicitudes) → ingreso real solo si <code>ingresoFinal &gt; 0</code>; utilidad real = <code>ingresoFinal − costoTotal</code> en esos casos.
      La columna «Referencia estimada» usa <code>ingresoEstimado</code> / <code>monto</code> <em>solo</em> cuando no hay ingreso final positivo — no se suma al ingreso real total.
      El <strong>margen %</strong> es <code>utilidad real ÷ ingreso real</code>; si el ingreso real es 0 se muestra «—» (no usa ingreso estimado).
    </p>
  `;

  const gerKpi = document.createElement('div');
  gerKpi.className = 'dashboard-gerencial-kpi';

  const gCard = (title, value, sub) => {
    const el = document.createElement('article');
    el.className = 'dashboard-gerencial-kpi-card';
    el.innerHTML = `<h3>${title}</h3><p class="dashboard-gerencial-kpi-card__value">${value}</p><p class="muted dashboard-gerencial-kpi-card__sub">${sub}</p>`;
    return el;
  };

  gerKpi.append(
    gCard('OT del mes (todas)', String(otMonth.length), 'Filtradas por fecha de visita en el mes'),
    gCard('Solicitudes flota del mes', String(flotaMonth.length), 'Pedidos con fecha en el mes'),
    gCard('Mantenciones del mes', String(mantMonth.length), 'Planificación con fecha en el mes'),
    gCard('Ingreso real del mes', formatMoney(ingresoRealTotalMes), 'Clima + flota con ingreso final + OT tipo flota'),
    gCard('Referencia estimada (flota)', formatMoney(flotaSolIngresoRefMes), 'Solo solicitudes sin ingreso final positivo'),
    gCard('Costos del mes', formatMoney(costoTotalMes), 'Suma de costo total registrado'),
    gCard('Utilidad real del mes', formatMoney(utilidadRealTotalMes), 'Según criterio de ingreso real por registro')
  );
  gerencial.append(gerKpi);

  const areaWrap = document.createElement('div');
  areaWrap.className = 'dashboard-gerencial-table-wrap';
  areaWrap.innerHTML = '<h3 class="dashboard-gerencial__h3">Por área</h3>';
  const areaTable = document.createElement('table');
  areaTable.className = 'plan-table dashboard-gerencial-table';
  areaTable.innerHTML =
    '<thead><tr><th>Área</th><th>Registros (mes)</th><th>Ingreso real</th><th>Ref. estimada</th><th>Costos</th><th>Utilidad real</th></tr></thead>';
  const areaTb = document.createElement('tbody');
  const flotaRegs = flotaMonth.length + otMonthFlotaTipo.length;
  const flotaIngReal = flotaSolIngresoRealMes + otFlotaTipoIngresoMes;
  const flotaCosto = flotaSolCostoMes + otFlotaTipoCostoMes;
  const flotaUtil = flotaSolUtilidadRealMes + otFlotaTipoUtilidadMes;

  const trArea = (cells) => {
    const tr = document.createElement('tr');
    cells.forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    });
    return tr;
  };

  areaTb.append(
    trArea([
      'Clima (OT HVAC)',
      String(otMonthClima.length),
      formatMoney(climaIngresoRealMes),
      '—',
      formatMoney(climaCostoMes),
      formatMoney(climaUtilidadMes),
    ]),
    trArea([
      'Flota (solicitudes + OT tipo flota)',
      String(flotaRegs),
      formatMoney(flotaIngReal),
      formatMoney(flotaSolIngresoRefMes),
      formatMoney(flotaCosto),
      formatMoney(flotaUtil),
    ])
  );
  areaTable.append(areaTb);
  areaWrap.append(areaTable);
  gerencial.append(areaWrap);

  const cliWrap = document.createElement('div');
  cliWrap.className = 'dashboard-gerencial-table-wrap';
  const cliHead = document.createElement('div');
  cliHead.className = 'dashboard-gerencial-table-head';
  const cliH = document.createElement('h3');
  cliH.className = 'dashboard-gerencial__h3';
  cliH.textContent = 'Rentabilidad por cliente';
  cliHead.append(cliH);
  const sortLab = document.createElement('label');
  sortLab.className = 'dashboard-gerencial-sort';
  sortLab.innerHTML = '<span class="muted">Ordenar por</span> ';
  const sortSel = document.createElement('select');
  sortSel.className = 'dashboard-gerencial-sort__select';
  sortSel.append(
    new Option('Mayor utilidad real', 'utilidadReal'),
    new Option('Mayor ingreso real', 'ingresoReal'),
    new Option('Mayor margen %', 'margen')
  );
  sortLab.append(sortSel);
  cliHead.append(sortLab);
  cliWrap.append(cliHead);

  const cliTable = document.createElement('table');
  cliTable.className = 'plan-table dashboard-gerencial-table';
  cliTable.innerHTML =
    '<thead><tr><th>Cliente</th><th>Registros</th><th>Ingreso real</th><th>Ref. estimada</th><th>Costos</th><th>Utilidad real</th><th>Margen %</th><th>Pendientes</th></tr></thead>';
  const cliTb = document.createElement('tbody');

  const clienteRows = [...clienteAgg.entries()].map(([cliente, v]) => ({ cliente, ...v }));

  const fillClienteBody = (key) => {
    if (!clienteRows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'muted';
      td.textContent = 'Sin OT ni solicitudes flota con fecha en este mes (o sin cliente asignado).';
      tr.append(td);
      cliTb.replaceChildren(tr);
      return;
    }
    const sorted = [...clienteRows].sort((a, b) => {
      if (key === 'margen') {
        return (
          margenSortValue(b.ingresoReal, b.utilidadReal) - margenSortValue(a.ingresoReal, a.utilidadReal)
        );
      }
      return roundMoney(b[key]) - roundMoney(a[key]);
    });
    cliTb.replaceChildren(
      ...sorted.map((row) => {
        const tr = document.createElement('tr');
        [
          row.cliente,
          String(row.registros),
          formatMoney(row.ingresoReal),
          formatMoney(row.ingresoRef),
          formatMoney(row.costo),
          formatMoney(row.utilidadReal),
          formatMargenPct(row.ingresoReal, row.utilidadReal),
          String(row.pendientes),
        ].forEach((text) => {
          const td = document.createElement('td');
          td.textContent = text;
          tr.append(td);
        });
        return tr;
      })
    );
  };

  sortSel.addEventListener('change', () => fillClienteBody(sortSel.value));
  fillClienteBody(sortSel.value);
  cliTable.append(cliTb);
  cliWrap.append(cliTable);
  gerencial.append(cliWrap);

  const prodWrap = document.createElement('div');
  prodWrap.className = 'dashboard-gerencial-table-wrap';
  const prodHead = document.createElement('div');
  prodHead.className = 'dashboard-gerencial-table-head';
  const prodH = document.createElement('h3');
  prodH.className = 'dashboard-gerencial__h3';
  prodH.textContent = 'Productividad por responsable';
  prodHead.append(prodH);
  const prodSortLab = document.createElement('label');
  prodSortLab.className = 'dashboard-gerencial-sort';
  prodSortLab.innerHTML = '<span class="muted">Ordenar por</span> ';
  const prodSortSel = document.createElement('select');
  prodSortSel.className = 'dashboard-gerencial-sort__select';
  prodSortSel.append(
    new Option('Mayor utilidad real', 'utilidadReal'),
    new Option('Mayor ingreso real', 'ingresoReal'),
    new Option('Más trabajos', 'trabajos')
  );
  prodSortLab.append(prodSortSel);
  prodHead.append(prodSortLab);
  prodWrap.append(prodHead);
  const prodHint = document.createElement('p');
  prodHint.className = 'muted dashboard-gerencial__hint';
  prodHint.innerHTML =
    'Clima y OT tipo flota: <strong>técnico asignado</strong>. Solicitudes flota: <strong>responsable</strong> o, si no hay, <strong>conductor</strong>. Fracciones: OT terminadas / total del mes; flota cerradas / total del mes; «comp.» = completadas operativas.';
  prodWrap.append(prodHint);

  const prodTable = document.createElement('table');
  prodTable.className = 'plan-table dashboard-gerencial-table';
  prodTable.innerHTML =
    '<thead><tr><th>Responsable</th><th>Trabajos</th><th>OT term. / total</th><th>Flota cerr. / total</th><th>Flota comp.</th><th>Pend.</th><th>Ingreso real</th><th>Utilidad real</th></tr></thead>';
  const prodTb = document.createElement('tbody');

  const prodRows = [...respAgg.entries()].map(([responsable, v]) => ({
    responsable,
    ...v,
    trabajos: v.otTotal + v.flotaTotal,
  }));

  const fillProdBody = (key) => {
    if (!prodRows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'muted';
      td.textContent = 'Sin asignaciones en el mes.';
      tr.append(td);
      prodTb.replaceChildren(tr);
      return;
    }
    const sorted = [...prodRows].sort((a, b) => roundMoney(b[key]) - roundMoney(a[key]));
    prodTb.replaceChildren(
      ...sorted.map((row) => {
        const tr = document.createElement('tr');
        const otCell = row.otTotal ? `${row.otTerm} / ${row.otTotal}` : '—';
        const flCell = row.flotaTotal ? `${row.flotaCerr} / ${row.flotaTotal}` : '—';
        [
          row.responsable,
          String(row.trabajos),
          otCell,
          flCell,
          String(row.flotaComp),
          String(row.pendientes),
          formatMoney(row.ingresoReal),
          formatMoney(row.utilidadReal),
        ].forEach((text) => {
          const td = document.createElement('td');
          td.textContent = text;
          tr.append(td);
        });
        return tr;
      })
    );
  };

  prodSortSel.addEventListener('change', () => fillProdBody(prodSortSel.value));
  fillProdBody(prodSortSel.value);
  prodTable.append(prodTb);
  prodWrap.append(prodTable);
  gerencial.append(prodWrap);

  const cierreGerencial = document.createElement('article');
  cierreGerencial.className = 'dashboard-cierre-gerencial';
  const cierreTitle = document.createElement('h3');
  cierreTitle.className = 'dashboard-cierre-gerencial__title';
  cierreTitle.textContent = 'Alertas de cierre gerencial';
  const cierreSub = document.createElement('p');
  cierreSub.className = 'muted dashboard-cierre-gerencial__sub';
  cierreSub.textContent =
    'Revisión administrativa: facturación, informes archivados, ingresos finales en flota y continuidad de mantenciones. No reemplaza el seguimiento operativo del día a día.';
  cierreGerencial.append(cierreTitle, cierreSub);

  const cierreList = [
    {
      count: otInformadasNoCobradas,
      text: 'OT con informe PDF guardado y monto cobrado en $0 (revisar facturación).',
    },
    {
      count: otTerminadasNoInformadas,
      text: 'OT terminadas sin informe PDF guardado.',
    },
    {
      count: flotaCerradaSinIngresoFinal,
      text: 'Solicitudes flota cerradas sin ingreso final registrado.',
    },
    {
      count: flotaCompletadaNoCerrada,
      text: 'Solicitudes en «completada»: falta cierre administrativo (estado «cerrada» con costos y observación).',
    },
    {
      count: mantSinContinuidadTiendas,
      text: 'Tiendas con al menos una mantención realizada y sin visita futura programada o pendiente.',
    },
  ].filter((x) => x.count > 0);

  if (!cierreList.length) {
    const ok = document.createElement('p');
    ok.className = 'muted dashboard-cierre-gerencial__ok';
    ok.textContent = 'Sin alertas en los criterios de cierre gerencial.';
    cierreGerencial.append(ok);
  } else {
    const ul = document.createElement('ul');
    ul.className = 'dashboard-cierre-gerencial__list';
    cierreList.forEach(({ count, text }) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${count}</strong> · ${text}`;
      ul.append(li);
    });
    cierreGerencial.append(ul);
  }

  const kpi = document.createElement('div');
  kpi.className = 'dashboard-kpi-grid';

  const kpiCard = (title, value, sub) => {
    const el = document.createElement('article');
    el.className = 'dashboard-kpi';
    el.innerHTML = `<h3>${title}</h3><p class="dashboard-kpi__value">${value}</p><p class="muted dashboard-kpi__sub">${sub}</p>`;
    return el;
  };

  kpi.append(
    kpiCard('OT hoy', String(otDay.length), `Semana ${weekStart} → ${weekEnd}: ${otWeek.length}`),
    kpiCard('OT este mes', String(otMonth.length), `Terminadas: ${terminadasMes}`),
    kpiCard('% terminadas / creadas (mes)', pctTerm == null ? '—' : `${pctTerm}%`, 'Sobre OT del mes calendario actual'),
    kpiCard('Tiempo promedio cierre', avgCloseLabel, 'Desde creadoEn hasta cerradoEn'),
    kpiCard('Flota en curso', String(flotaActivas.length), 'Hasta completada (sin cerrar)'),
    kpiCard('Mantención próx. 7 días', String(mantProx.length), 'Programadas o pendientes')
  );

  const estadoRow = document.createElement('div');
  estadoRow.className = 'dashboard-row';
  estadoRow.innerHTML = '<h3>OT del mes por estado</h3>';
  const estadoList = document.createElement('ul');
  estadoList.className = 'dashboard-list';
  ['pendiente', 'en proceso', 'terminado'].forEach((st) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${st}</strong> · ${estMonth.get(st) || 0}`;
    estadoList.append(li);
  });
  estadoRow.append(estadoList);

  const tecRow = document.createElement('div');
  tecRow.className = 'dashboard-row';
  tecRow.innerHTML = '<h3>Trabajos por técnico (mes · todas las OT)</h3>';
  const tecList = document.createElement('ul');
  tecList.className = 'dashboard-list';
  if (!tecTop.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin datos en el mes.';
    tecList.append(li);
  } else {
    tecTop.forEach(([name, n]) => {
      const li = document.createElement('li');
      const term = tecMonthTerm.get(name) || 0;
      li.innerHTML = `<strong>${name}</strong> · ${n} OT (${term} terminadas)`;
      tecList.append(li);
    });
  }
  tecRow.append(tecList);

  const alertBox = document.createElement('div');
  alertBox.className = 'dashboard-alerts ops-warning-panel';
  alertBox.innerHTML =
    '<h3>Alertas operativas</h3><p class="muted dashboard-alerts__sub">Ejecución en terreno, evidencias, plazos en flota y mantenciones vencidas. Para control administrativo y facturación usá el bloque <strong>Alertas de cierre gerencial</strong> (más abajo).</p>';
  if (!alerts.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Sin alertas críticas en los criterios configurados.';
    alertBox.append(p);
  } else {
    const ul = document.createElement('ul');
    alerts.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.append(li);
    });
    alertBox.append(ul);
  }

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    {
      title: 'Clientes (admin)',
      description: 'Registro general.',
      items: [`Total: ${clients.length}`],
    },
    {
      title: 'Vehículos',
      description: 'Flota interna.',
      items: [`Total: ${vehicles.length}`],
    },
    {
      title: 'Gastos',
      description: 'Control.',
      items: [`Registros: ${expenses.length}`],
    },
    {
      title: 'Salud API',
      description: 'Estado técnico.',
      items: [`Health: ${data?.health?.data?.status || estadoRed(integrationStatus)}`],
    },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(
    portalSection,
    cmd,
    intel,
    asst,
    activityBox,
    alertBox,
    diag,
    gerencial,
    cierreGerencial,
    kpi,
    estadoRow,
    tecRow,
    cards
  );
  return section;
};

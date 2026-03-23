import { createCard } from '../components/card.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

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

export const dashboardView = ({
  apiBaseLabel,
  integrationStatus,
  lastDataRefreshAt,
  data,
  reloadApp,
  navigateToView,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'dashboard-module dashboard-module--stack dashboard-portal-root';

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

  const flotaEjecucionSinCierre = flotaSolicitudes.filter(
    (s) => s.estado === 'en_ruta' || s.estado === 'completada'
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

  section.innerHTML = `
    <header class="module-header module-header--portal">
      <p class="dashboard-eyebrow">HNF · plataforma operativa</p>
      <h2>Portal principal</h2>
      <p class="muted">Estado de la operación en segundos: accesos directos, alertas, números del mes y rentabilidad. Criterio financiero: ingreso real en Clima (<code>montoCobrado</code>); en Flota solo con <code>ingresoFinal</code> positivo.</p>
    </header>
  `;

  const pilotBar = document.createElement('div');
  pilotBar.className = 'module-toolbar';
  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'secondary-button';
  refreshBtn.textContent = 'Actualizar datos';
  refreshBtn.title = 'Trae de nuevo OT, flota, planificación y clientes desde el servidor.';
  const refreshHint = document.createElement('span');
  refreshHint.className = 'muted module-toolbar__hint';
  refreshHint.textContent =
    'Sincroniza OT, flota y planificación. Al entrar en Inicio también se actualiza solo.';
  refreshBtn.addEventListener('click', async () => {
    const label = refreshBtn.textContent;
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Actualizando…';
    const ok = typeof reloadApp === 'function' ? await reloadApp() : false;
    refreshBtn.textContent = ok ? 'Listo' : 'Sin conexión';
    setTimeout(() => {
      refreshBtn.textContent = label;
      refreshBtn.disabled = false;
    }, 1800);
  });
  pilotBar.append(refreshBtn, refreshHint);
  section.append(pilotBar);

  const portalSection = document.createElement('div');
  portalSection.className = 'portal-stack';
  const portalHero = document.createElement('div');
  portalHero.className = 'portal-hero';
  const phInner = document.createElement('div');
  phInner.className = 'portal-hero__inner';
  const phEyebrow = document.createElement('p');
  phEyebrow.className = 'portal-hero__eyebrow';
  phEyebrow.textContent = 'Centro de comando';
  const phTitle = document.createElement('h3');
  phTitle.className = 'portal-hero__title';
  phTitle.textContent = 'Líneas de negocio';
  const phLead = document.createElement('p');
  phLead.className = 'portal-hero__lead muted';
  phLead.textContent =
    'Elegí un módulo para trabajar. La misma barra lateral está siempre disponible; acá tenés acceso ejecutivo rápido.';
  phInner.append(phEyebrow, phTitle, phLead);
  portalHero.append(phInner);

  const portalGrid = document.createElement('div');
  portalGrid.className = 'portal-grid';

  const mkPortalTile = (viewId, modClass, kicker, title, desc) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `portal-tile portal-tile--${modClass}`;
    const k = document.createElement('span');
    k.className = 'portal-tile__kicker';
    k.textContent = kicker;
    const t = document.createElement('span');
    t.className = 'portal-tile__title';
    t.textContent = title;
    const d = document.createElement('span');
    d.className = 'portal-tile__desc';
    d.textContent = desc;
    b.append(k, t, d);
    b.addEventListener('click', () => {
      if (typeof navigateToView === 'function') navigateToView(viewId);
    });
    return b;
  };

  portalGrid.append(
    mkPortalTile(
      'clima',
      'clima',
      'HVAC / Clima',
      'Gestión integral Clima',
      'OT, equipos, fotos, economía, cierre e informe PDF.'
    ),
    mkPortalTile(
      'planificacion',
      'plan',
      'Agenda',
      'Planificación y control',
      'Clientes, tiendas, comuna, AM/PM, técnico y mantenciones.'
    ),
    mkPortalTile(
      'flota',
      'flota',
      'Movilidad',
      'Gestión integral de flotas',
      'Solicitudes, pipeline, costos, ingreso y utilidad.'
    ),
    mkPortalTile(
      'admin',
      'admin',
      'Corporativo',
      'Administración y respaldos',
      'Clientes maestros, operador y exportación JSON.'
    ),
    mkPortalTile(
      'asistente',
      'ia',
      'Inteligencia',
      'Asistente IA HNF',
      'Pendientes, cierres y diagnóstico sobre datos reales.'
    )
  );

  portalSection.append(portalHero, portalGrid);

  const execStrip = document.createElement('div');
  execStrip.className = 'exec-strip';
  const mesRef = monthLabelEs(new Date(monthStart + 'T12:00:00'));
  const mkExecStat = (label, value, sub) => {
    const w = document.createElement('div');
    w.className = 'exec-strip__stat';
    const lb = document.createElement('span');
    lb.className = 'exec-strip__label';
    lb.textContent = label;
    const val = document.createElement('span');
    val.className = 'exec-strip__value';
    val.textContent = value;
    const su = document.createElement('span');
    su.className = 'exec-strip__sub';
    su.textContent = sub;
    w.append(lb, val, su);
    return w;
  };
  execStrip.append(
    mkExecStat('OT abiertas', String(otAbiertas.length), 'Sin cerrar (terminado)'),
    mkExecStat('Alertas operativas', String(alerts.length), 'Requieren seguimiento'),
    mkExecStat('Ingreso real del mes', formatMoney(ingresoRealTotalMes), mesRef),
    mkExecStat('Flota en curso', String(flotaActivas.length), 'Pipeline hasta completada'),
    mkExecStat('Mantenciones 7 días', String(mantProx.length), 'Programadas o pendientes')
  );

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
      <li><strong>Flota completada sin cerrar</strong> · ${flotaCompletadaNoCerrada}</li>
      <li><strong>Flota en ruta o completada (sin cierre adm.)</strong> · ${flotaEjecucionSinCierre}</li>
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
      count: flotaEjecucionSinCierre,
      text: 'Flota en «en ruta» o «completada» aún sin cierre administrativo (cerrada).',
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
  alertBox.className = 'dashboard-alerts';
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
    execStrip,
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

import { createControlDashboard } from '../components/control-center/ControlDashboard.js';
import { aggregateMandoFromEventos, buildFlujoOperativoUnificado } from '../domain/evento-operativo.js';
import { listIngresosOperativosDelDia } from '../domain/ingreso-operativo-storage.js';
import { otCanClose } from '../utils/ot-evidence.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { createHnfGerenciaOpsIdentityCard } from '../components/hnf-brand-ops-strip.js';
import { createHnfControlLynRegistroPanel } from '../components/hnf-control-lyn-registro.js';
import { createHnfDisciplinaTecnicosPanel } from '../components/hnf-disciplina-tecnicos.js';
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { createJarvisCopilot } from '../components/jarvis-copilot.js';
import { createJarvisExecutiveCopilotStrip } from '../components/jarvis-executive-copilot-strip.js';
import { createJarvisLiveOpsPanel } from '../components/jarvis-live-ops-panel.js';
import { createJarvisPresence, jarvisLineaDesdeIntegracion } from '../components/jarvis-presence.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

function appendKpi(host, label, value, mod) {
  const d = document.createElement('div');
  const v2mod =
    mod === 'bad' ? 'hnf-v2-metric--danger' : mod === 'warn' ? 'hnf-v2-metric--alert' : '';
  d.className = `hnf-v2-metric${v2mod ? ` ${v2mod}` : ''}`;
  const v = document.createElement('div');
  v.className = 'hnf-v2-metric__value';
  v.textContent = value;
  const k = document.createElement('div');
  k.className = 'hnf-v2-metric__label';
  k.textContent = label;
  d.append(v, k);
  host.append(d);
}

/**
 * Control gerencial — marco nuevo (.hnf-ccd), sin layout .hnf-cap-control legacy.
 */
export const controlGerencialView = ({
  data,
  navigateToView,
  intelNavigate: _intelNavigate,
  reloadApp,
  integrationStatus,
  lastDataRefreshAt,
  authLabel,
} = {}) => {
  const { root, hero, kpis, jarvisZone, body } = createControlDashboard();
  root.classList.add('hnf-cck-surface', 'hnf-op-view', 'hnf-op-view--control');
  kpis.classList.add('hnf-v2-metric-row');

  const raw = data?.planOts ?? data?.ots?.data ?? [];
  const list = Array.isArray(raw) ? raw : [];

  const abiertas = list.filter(
    (o) => !['terminado', 'cerrada', 'cerrado'].includes(String(o.estado || '').toLowerCase())
  );
  const pendientes = list.filter((o) => o.estado === 'pendiente');
  const enProceso = list.filter((o) => o.estado === 'en proceso');
  const listasCierre = list.filter(
    (o) =>
      !['terminado', 'cerrada', 'cerrado'].includes(String(o.estado || '').toLowerCase()) && otCanClose(o)
  );

  const wa = Array.isArray(data?.whatsappFeed?.messages) ? data.whatsappFeed.messages : [];
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const waHoy = wa.filter((m) => {
    const t = new Date(m.updatedAt || m.createdAt || 0).getTime();
    return Number.isFinite(t) && t >= dayStart.getTime();
  }).length;

  const eventos = buildFlujoOperativoUnificado(data || {});
  const agg = aggregateMandoFromEventos(eventos);

  const ingresosHoy = listIngresosOperativosDelDia();
  const byResp = new Map();
  for (const o of abiertas) {
    const r = String(o.tecnicoAsignado || 'Sin asignar').trim() || 'Sin asignar';
    byResp.set(r, (byResp.get(r) || 0) + 1);
  }

  const estadoDia =
    agg.estado_general === 'critico'
      ? 'Crítico'
      : agg.estado_general === 'atencion'
        ? 'Atención'
        : 'OK';

  const kpiMod = agg.estado_general === 'critico' ? 'bad' : agg.estado_general === 'atencion' ? 'warn' : 'ok';

  const h1 = document.createElement('h1');
  h1.className = 'hnf-ccd__title';
  h1.textContent = 'Control gerencial';
  const lead = document.createElement('p');
  lead.className = 'hnf-ccd__lead';
  lead.innerHTML =
    '<strong>Dashboard ejecutivo</strong> — lectura rápida de riesgo, carga y dinero. El mando vive en <em>Mando</em> y el núcleo Jarvis abajo.';
  hero.append(h1, lead, createHnfOperationalFlowStrip(4), createHnfGerenciaOpsIdentityCard());
  hero.append(createHnfControlLynRegistroPanel({ reloadApp }));

  appendKpi(kpis, 'Estado del día', estadoDia, kpiMod);
  appendKpi(kpis, 'OT abiertas', String(abiertas.length));
  appendKpi(kpis, 'Pendientes', String(pendientes.length));
  appendKpi(kpis, 'En proceso', String(enProceso.length));
  appendKpi(kpis, 'Listas para cierre', String(listasCierre.length));
  appendKpi(kpis, 'WhatsApp (hoy)', String(waHoy));
  appendKpi(kpis, 'Dinero en riesgo', `$${fmtMoney(agg.dinero_en_riesgo)}`);
  appendKpi(kpis, 'Ingresos locales hoy', String(ingresosHoy.length));

  const jSig = buildJarvisGerencialSignals(list);
  const jarvisBrandSub = 'Jarvis | Integridad Operativa HNF';

  const sectionHead = document.createElement('div');
  sectionHead.className = 'hnf-jarvis-nucleus__section-head';
  const secTitle = document.createElement('h2');
  secTitle.className = 'hnf-jarvis-nucleus__section-title';
  secTitle.textContent = 'Jarvis — núcleo operativo';
  const secHint = document.createElement('p');
  secHint.className = 'hnf-jarvis-nucleus__section-hint';
  secHint.textContent =
    'Presencia en tiempo real, copiloto de la OT foco, resumen ejecutivo y panel vivo. Sin ejecución automática en servidor.';
  sectionHead.append(secTitle, secHint);

  const mainRow = document.createElement('div');
  mainRow.className = 'hnf-jarvis-nucleus__main-row';
  mainRow.append(
    createJarvisPresence({
      linea: jarvisLineaDesdeIntegracion(integrationStatus),
      metrics: {
        nRiesgo: jSig.nRiesgo,
        nUrgentes: jSig.nUrgentes,
        nPendAprobacion: jSig.nPendAprobacion,
      },
      suggestion: jSig.suggestion,
      brandSubtitle: jarvisBrandSub,
    }),
    createJarvisCopilot({ focoOt: jSig.focoOt })
  );

  jarvisZone.append(
    sectionHead,
    mainRow,
    createJarvisExecutiveCopilotStrip({
      authLabel,
      integrationStatus,
      viewData: data,
      lastDataRefreshAt,
    }),
    createJarvisLiveOpsPanel({
      integrationStatus,
      viewData: data,
      lastDataRefreshAt,
      focoOt: jSig.focoOt,
    })
  );

  const colResp = document.createElement('div');
  const hResp = document.createElement('h2');
  hResp.className = 'hnf-ccd__col-title';
  hResp.textContent = 'Responsables (OT abiertas)';
  const ul = document.createElement('ul');
  ul.className = 'hnf-ccd__ul';
  colResp.append(hResp, ul);

  const sorted = [...byResp.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    const li = document.createElement('li');
    li.style.color = '#94a3b8';
    li.textContent = 'Sin OT abiertas con técnico asignado.';
    ul.append(li);
  } else {
    for (const [name, n] of sorted) {
      const li = document.createElement('li');
      li.textContent = `${name}: ${n} OT`;
      ul.append(li);
    }
  }

  const colAct = document.createElement('div');
  const hAct = document.createElement('h2');
  hAct.className = 'hnf-ccd__col-title';
  hAct.textContent = 'Accesos de mando';
  const act = document.createElement('div');
  act.className = 'hnf-ccd__actions';
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary-button hnf-ccd__btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  act.append(
    mkBtn('Mando (Kanban)', () => navigateToView?.('centro-control')),
    mkBtn('Ingesta universal', () => navigateToView?.('ingreso-operativo')),
    mkBtn('Cola Lyn (OT)', () => navigateToView?.('lyn-aprobacion')),
    mkBtn('Jarvis HQ', () => navigateToView?.('jarvis')),
    mkBtn('Clima / OT', () => navigateToView?.('clima')),
    mkBtn('Ingreso clásico', () => navigateToView?.('ingreso-clasico'))
  );
  colAct.append(hAct, act);

  const discHost = document.createElement('div');
  discHost.className = 'hnf-ccd__disciplina';
  discHost.append(createHnfDisciplinaTecnicosPanel(list, { navigateToView }));

  body.append(colResp, colAct, discHost);

  return root;
};

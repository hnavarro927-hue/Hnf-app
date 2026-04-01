import '../styles/hnf-control-center-layout.css';
import { aggregateMandoFromEventos, buildFlujoOperativoUnificado } from '../domain/evento-operativo.js';
import { listIngresosOperativosDelDia } from '../domain/ingreso-operativo-storage.js';
import { otCanClose } from '../utils/ot-evidence.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { createHnfControlLynRegistroPanel } from '../components/hnf-control-lyn-registro.js';
import { createHnfDisciplinaTecnicosPanel } from '../components/hnf-disciplina-tecnicos.js';
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { OT_ESTADO_FLUJO } from '../domain/hnf-ot-operational-model.js';
import { getEffectiveEstadoOperativo } from '../domain/hnf-ot-state-engine.js';
import { getAllOTs } from '../domain/repositories/operations-repository.js';
import { buildOperationalAnalytics } from '../domain/repositories/analytics-builder.js';
import { createJarvisCopilot } from '../components/jarvis-copilot.js';
import { createJarvisExecutiveCopilotStrip } from '../components/jarvis-executive-copilot-strip.js';
import { createJarvisLiveOpsPanel } from '../components/jarvis-live-ops-panel.js';
import { createJarvisPresence, jarvisLineaDesdeIntegracion } from '../components/jarvis-presence.js';
import {
  createHnfEnterpriseWorkspace,
  createHnfEwSplitControl,
  createHnfEwDetails,
} from '../components/hnf-enterprise-workspace.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

function appendKpi(host, label, value, mod, extraClass = '') {
  const d = document.createElement('div');
  const v2mod =
    mod === 'bad' ? 'hnf-v2-metric--danger' : mod === 'warn' ? 'hnf-v2-metric--alert' : '';
  d.className = `hnf-v2-metric${v2mod ? ` ${v2mod}` : ''}${extraClass ? ` ${extraClass}` : ''}`.trim();
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
 * Control gerencial — shell HNF Enterprise Workspace.
 * Señales primero, acción ejecutiva (Lyn), bandeja de accesos, detalle colapsable al final.
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
  const ew = createHnfEnterpriseWorkspace({
    variant: 'control',
    ariaLabel: 'Control gerencial',
  });
  ew.root.classList.add('hnf-cck-surface', 'hnf-op-view', 'hnf-op-view--control');

  const raw = data?.planOts ?? data?.ots?.data ?? [];
  const plan = Array.isArray(raw) ? raw : [];
  const list = getAllOTs(plan);
  const opKpi = buildOperationalAnalytics(plan);

  const abiertas = list.filter((o) => getEffectiveEstadoOperativo(o) !== 'cerrado');
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
    const r =
      String(o.responsable_actual || o.tecnicoAsignado || 'Sin asignar').trim() || 'Sin asignar';
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
  lead.textContent =
    'Señales en vivo y accesos de mando primero. Métricas extendidas y núcleo Jarvis van al final, colapsados.';
  ew.header.append(h1, lead);

  const jSig = buildJarvisGerencialSignals(list);
  const jarvisBrandSub = 'Jarvis | Integridad Operativa HNF';

  const signalsRow = document.createElement('div');
  signalsRow.className = 'hnf-ew-signals-row';
  const miniKpi = document.createElement('div');
  miniKpi.className = 'hnf-ew-kpi-compact-row';
  appendKpi(miniKpi, 'Estado del día', estadoDia, kpiMod, 'hnf-v2-metric--hero');
  appendKpi(miniKpi, 'OT abiertas', String(abiertas.length));
  appendKpi(miniKpi, 'Listas cierre', String(listasCierre.length));
  appendKpi(miniKpi, 'Dinero en riesgo', `$${fmtMoney(agg.dinero_en_riesgo)}`);
  signalsRow.append(
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
    miniKpi
  );
  ew.signals.append(signalsRow);

  ew.flow.append(createHnfOperationalFlowStrip(4));

  ew.quick.append(createHnfControlLynRegistroPanel({ reloadApp }));

  const { split, railNav, main } = createHnfEwSplitControl();

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
    mkBtn('Flota', () => navigateToView?.('flota')),
    mkBtn('Ingreso clásico', () => navigateToView?.('ingreso-clasico'))
  );
  colAct.append(hAct, act);
  railNav.append(colAct);

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

  const discHost = document.createElement('div');
  discHost.className = 'hnf-ccd__disciplina';
  discHost.append(createHnfDisciplinaTecnicosPanel(list, { navigateToView }));

  main.append(colResp, discHost);
  ew.body.append(split);

  const { details: dKpi, body: kpiExpanded } = createHnfEwDetails('Métricas operativas completas (desplegar)', false);
  const kpiBand = document.createElement('div');
  kpiBand.className = 'hnf-ccd__kpi-band-intro';
  kpiBand.innerHTML =
    '<p class="hnf-ccd__kpi-band-tag">Métricas</p><h2 class="hnf-ccd__kpi-band-title">Estado operativo y finanzas</h2><p class="hnf-ccd__kpi-band-lead muted">Desglose de carga, canal y riesgo. Datos desde OT en servidor.</p>';
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'hnf-ccd__kpi-grid hnf-v2-metric-row';
  kpiExpanded.append(kpiBand, kpiGrid);

  appendKpi(kpiGrid, 'Pendientes', String(pendientes.length));
  appendKpi(kpiGrid, 'En proceso', String(enProceso.length));
  appendKpi(kpiGrid, 'WhatsApp (hoy)', String(waHoy));
  appendKpi(kpiGrid, 'Ingresos locales hoy', String(ingresosHoy.length));
  appendKpi(kpiGrid, 'Activas (flujo OT)', String(opKpi.activas));
  appendKpi(kpiGrid, 'Cerradas (flujo)', String(opKpi.cerradas));
  appendKpi(kpiGrid, 'Riesgo operativo', String(opKpi.riesgoOperativo));
  appendKpi(kpiGrid, 'Prioridad alta', String(opKpi.prioridadAlta));

  const flowBreak = document.createElement('p');
  flowBreak.className = 'muted small';
  flowBreak.style.gridColumn = '1 / -1';
  flowBreak.style.marginTop = '4px';
  flowBreak.textContent = `OT por estado: ${OT_ESTADO_FLUJO.map((k) => `${k}=${opKpi.byEstado[k] ?? 0}`).join(' · ')}`;
  kpiGrid.append(flowBreak);

  const flowResp = document.createElement('p');
  flowResp.className = 'muted small';
  flowResp.style.gridColumn = '1 / -1';
  flowResp.textContent = `Por responsable: ${Object.entries(opKpi.byResponsable || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ')}`;
  kpiGrid.append(flowResp);

  ew.body.append(dKpi);

  const { details: dJarvis, body: jarvisBody } = createHnfEwDetails('Núcleo Jarvis — copiloto, ejecutivo y panel vivo (desplegar)', false);

  const sectionHead = document.createElement('div');
  sectionHead.className = 'hnf-jarvis-nucleus__section-head';
  const secTitle = document.createElement('h2');
  secTitle.className = 'hnf-jarvis-nucleus__section-title';
  secTitle.textContent = 'Jarvis — núcleo operativo';
  const secHint = document.createElement('p');
  secHint.className = 'hnf-jarvis-nucleus__section-hint';
  secHint.textContent =
    'Copiloto de la OT foco, resumen ejecutivo y panel vivo. Sin ejecución automática en servidor.';
  sectionHead.append(secTitle, secHint);

  const mainRow = document.createElement('div');
  mainRow.className = 'hnf-jarvis-nucleus__main-row';
  mainRow.append(
    createJarvisCopilot({ focoOt: jSig.focoOt })
  );

  const nucleusMega = document.createElement('div');
  nucleusMega.className = 'hnf-ccd__nucleus-mega';
  nucleusMega.append(
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
  jarvisBody.append(nucleusMega);
  ew.body.append(dJarvis);

  return ew.root;
};

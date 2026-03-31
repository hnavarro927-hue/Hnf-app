import { aggregateMandoFromEventos, buildFlujoOperativoUnificado } from '../domain/evento-operativo.js';
import { listIngresosOperativosDelDia } from '../domain/ingreso-operativo-storage.js';
import { otCanClose } from '../utils/ot-evidence.js';
import { createHnfOperationalFlowStrip } from '../components/hnf-operational-flow-strip.js';
import { createHnfGerenciaOpsIdentityCard } from '../components/hnf-brand-ops-strip.js';
import { createHnfControlLynRegistroPanel } from '../components/hnf-control-lyn-registro.js';
import { createHnfDisciplinaTecnicosPanel } from '../components/hnf-disciplina-tecnicos.js';
import { buildJarvisGerencialSignals } from '../domain/jarvis-gerencial-signals.js';
import { createJarvisCopilot } from '../components/jarvis-copilot.js';
import { createJarvisPresence, jarvisLineaDesdeIntegracion } from '../components/jarvis-presence.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

/**
 * Capa 4 — Control gerencial (Hernan). Resumen sin detalle de ejecución.
 */
export const controlGerencialView = ({
  data,
  navigateToView,
  intelNavigate,
  reloadApp,
  integrationStatus,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'hnf-cap-control hnf-op-view hnf-op-view--control';

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

  root.innerHTML = `
    <header class="hnf-cap-control__head">
      <h1 class="hnf-cap-control__title">Control gerencial</h1>
      <p class="muted">Vista <strong>ejecutiva y estratégica</strong>: visibilidad del negocio, cuellos de botella y alertas. El detalle operativo está en Jarvis, Ingreso, Clima y Flota.</p>
    </header>
    <div class="hnf-cap-control__kpis">
      <div class="hnf-cap-control__kpi hnf-cap-control__kpi--${agg.estado_general === 'critico' ? 'bad' : agg.estado_general === 'atencion' ? 'warn' : 'ok'}">
        <span class="hnf-cap-control__k">Estado del día</span>
        <strong class="hnf-cap-control__v">${estadoDia}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">OT abiertas</span>
        <strong class="hnf-cap-control__v">${abiertas.length}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">Pendientes</span>
        <strong class="hnf-cap-control__v">${pendientes.length}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">En proceso</span>
        <strong class="hnf-cap-control__v">${enProceso.length}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">Listas para cierre</span>
        <strong class="hnf-cap-control__v">${listasCierre.length}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">WhatsApp (hoy)</span>
        <strong class="hnf-cap-control__v">${waHoy}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">Dinero en riesgo (eventos)</span>
        <strong class="hnf-cap-control__v">$${fmtMoney(agg.dinero_en_riesgo)}</strong>
      </div>
      <div class="hnf-cap-control__kpi">
        <span class="hnf-cap-control__k">Ingresos locales hoy</span>
        <strong class="hnf-cap-control__v">${ingresosHoy.length}</strong>
      </div>
    </div>
    <div class="hnf-jarvis-nucleus" id="hnf-control-jarvis-nucleus"></div>
    <div class="hnf-cap-control__cols">
      <div class="hnf-cap-control__col">
        <h2 class="hnf-cap-control__h2">Responsables (OT abiertas)</h2>
        <ul class="hnf-cap-control__ul" id="hnf-control-resp"></ul>
      </div>
      <div class="hnf-cap-control__col">
        <h2 class="hnf-cap-control__h2">Accesos rápidos</h2>
        <div class="hnf-cap-control__actions" id="hnf-control-actions"></div>
      </div>
    </div>
    <div class="hnf-cap-control__disciplina" id="hnf-control-disciplina"></div>
  `;

  const jarvisHost = root.querySelector('#hnf-control-jarvis-nucleus');
  if (jarvisHost) {
    const jSig = buildJarvisGerencialSignals(list);
    jarvisHost.append(
      createJarvisPresence({
        linea: jarvisLineaDesdeIntegracion(integrationStatus),
        metrics: {
          nRiesgo: jSig.nRiesgo,
          nUrgentes: jSig.nUrgentes,
          nPendAprobacion: jSig.nPendAprobacion,
        },
        suggestion: jSig.suggestion,
      }),
      createJarvisCopilot({ focoOt: jSig.focoOt })
    );
  }

  const headEl = root.querySelector('.hnf-cap-control__head');
  if (headEl) {
    const strip = createHnfOperationalFlowStrip(4);
    headEl.after(strip);
    const idCard = createHnfGerenciaOpsIdentityCard();
    strip.after(idCard);
    idCard.after(createHnfControlLynRegistroPanel({ reloadApp }));
  }

  const ul = root.querySelector('#hnf-control-resp');
  const sorted = [...byResp.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Sin OT abiertas con técnico asignado.';
    ul.append(li);
  } else {
    for (const [name, n] of sorted) {
      const li = document.createElement('li');
      li.textContent = `${name}: ${n} OT`;
      ul.append(li);
    }
  }

  const act = root.querySelector('#hnf-control-actions');
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary-button hnf-cap-control__btn';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  };
  act.append(
    mkBtn('Cola Lyn (aprobación OT)', () => navigateToView?.('lyn-aprobacion')),
    mkBtn('Ver inteligencia (Jarvis)', () => intelNavigate?.({ view: 'jarvis' })),
    mkBtn('Ejecución OT (Clima)', () => navigateToView?.('clima')),
    mkBtn('Ingreso operativo', () => navigateToView?.('ingreso-operativo')),
    mkBtn('Mando principal (OT en vivo)', () => intelNavigate?.({ view: 'jarvis', focusMando: true }))
  );

  const discHost = root.querySelector('#hnf-control-disciplina');
  if (discHost) {
    discHost.append(createHnfDisciplinaTecnicosPanel(list, { navigateToView }));
  }

  return root;
};

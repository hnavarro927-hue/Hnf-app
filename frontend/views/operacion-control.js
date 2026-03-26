import {
  getDirectorOperationalBrief,
  getOperationalHealthState,
} from '../domain/hnf-intelligence-engine.js';
import * as hnfFlowControl from '../domain/hnf-flow-control.js';
import { createHnfAutopilotPanel } from '../components/hnf-autopilot-panel.js';

const semaforoLabel = (s) => {
  if (s === 'critico') return { text: 'Rojo · acción inmediata', className: 'flow-ctrl__signal flow-ctrl__signal--red' };
  if (s === 'atencion') return { text: 'Amarillo · priorizar hoy', className: 'flow-ctrl__signal flow-ctrl__signal--amber' };
  return { text: 'Verde · operación alineada', className: 'flow-ctrl__signal flow-ctrl__signal--green' };
};

function mergeSemaforo(healthFromIssues, risks) {
  const altas = (risks || []).filter((r) => r.criticidad === 'alta').length;
  if (healthFromIssues === 'critico' || altas >= 4) return 'critico';
  if (healthFromIssues === 'atencion' || altas >= 1) return 'atencion';
  return 'optimo';
}

function topProblemas(issues, decision) {
  const out = [];
  const seen = new Set();
  for (const a of decision.alertasCriticas || []) {
    const k = a.code || a.texto;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ tipo: a.fuente === 'intel' ? 'Motor IA' : 'Riesgo', texto: a.texto || a.accion, code: a.code });
    if (out.length >= 5) return out;
  }
  for (const i of issues || []) {
    if (i.tipo === 'INFO') continue;
    if (seen.has(i.code)) continue;
    seen.add(i.code);
    out.push({ tipo: i.tipo === 'CRITICO' ? 'Crítico' : 'Atención', texto: i.mensaje, code: i.code });
    if (out.length >= 5) break;
  }
  return out;
}

function topAcciones(decision) {
  return (decision.accionesPrioritarias || []).slice(0, 5);
}

export const operacionControlView = ({
  data,
  integrationStatus,
  reloadApp,
  intelNavigate,
} = {}) => {
  const root = document.createElement('section');
  root.className = 'flow-ctrl';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML = `
    <h2>Control de operación</h2>
    <p class="muted">Capa directiva HNF Flow Control: no es un tablero de datos, es la cola de lo que tenés que hacer. Ruta conceptual <code>/operacion-control</code>. Actualizá para recalcular eventos y riesgos desde ERP + WhatsApp.</p>
  `;

  if (integrationStatus === 'sin conexión') {
    const off = document.createElement('div');
    off.className = 'integration-banner integration-banner--offline';
    off.textContent = 'Sin conexión: no se puede calcular el estado operacional.';
    root.append(header, off);
    return root;
  }

  const brief = getDirectorOperationalBrief(data || {});
  const { snapshot, issues, flow } = brief;
  const healthBase = getOperationalHealthState(issues);
  const semKey = mergeSemaforo(healthBase, flow.risks);
  const sem = semaforoLabel(semKey);

  const toolbar = document.createElement('div');
  toolbar.className = 'module-toolbar';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'secondary-button';
  refresh.textContent = 'Recalcular ahora';
  refresh.addEventListener('click', () => reloadApp?.());
  toolbar.append(refresh);

  const hero = document.createElement('div');
  hero.className = 'flow-ctrl__hero';
  hero.innerHTML = `
    <div class="${sem.className}" role="status">
      <span class="flow-ctrl__signal-dot" aria-hidden="true"></span>
      <div>
        <p class="flow-ctrl__signal-title">Estado general</p>
        <p class="flow-ctrl__signal-copy">${sem.text}</p>
      </div>
    </div>
    <ul class="flow-ctrl__hero-metrics muted">
      <li>OT Clima abiertas: <strong>${snapshot.clima.pendientes + snapshot.clima.enProceso}</strong></li>
      <li>Flota en ruta: <strong>${snapshot.flota.enRuta}</strong></li>
      <li>Eventos derivados: <strong>${flow.events.length}</strong> · con acción: <strong>${flow.state.eventosQueRequierenAccion}</strong></li>
      <li>WhatsApp crítico: <strong>${snapshot.whatsapp?.impactoCritico ?? 0}</strong></li>
    </ul>
  `;

  const autopilotPanel = createHnfAutopilotPanel({
    brief,
    viewData: data,
    intelNavigate,
  });

  const grid = document.createElement('div');
  grid.className = 'flow-ctrl__grid';

  const mkPanel = (title, subtitle) => {
    const p = document.createElement('section');
    p.className = 'flow-ctrl__panel';
    const h = document.createElement('h3');
    h.className = 'flow-ctrl__panel-title';
    h.textContent = title;
    p.append(h);
    if (subtitle) {
      const s = document.createElement('p');
      s.className = 'flow-ctrl__panel-sub muted';
      s.textContent = subtitle;
      p.append(s);
    }
    return p;
  };

  const pProblemas = mkPanel('Top 5 problemas reales', 'Críticos del motor + riesgos Flow Control');
  const olP = document.createElement('ol');
  olP.className = 'flow-ctrl__list';
  const probItems = topProblemas(issues, flow.decision);
  if (!probItems.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin problemas destacados en este corte. Mantener ritmo de cierre y cobros.';
    olP.append(li);
  } else {
    probItems.forEach((x) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="flow-ctrl__li-tag">${x.tipo}</span> ${x.texto}`;
      olP.append(li);
    });
  }
  pProblemas.append(olP);

  const pAcc = mkPanel('Top 5 acciones a ejecutar', 'Cola alineada con buildIntelExecutionQueue + alertas');
  const olA = document.createElement('ol');
  olA.className = 'flow-ctrl__list';
  const acts = topAcciones(flow.decision);
  if (!acts.length) {
    const li = document.createElement('li');
    li.textContent = 'No hay acciones en cola: revisá módulos o cargá datos.';
    olA.append(li);
  } else {
    acts.forEach((a) => {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'flow-ctrl__action-row';
      const txt = document.createElement('span');
      txt.innerHTML = `<strong>${a.titulo}</strong> · ${a.detalle || ''}`;
      row.append(txt);
      if (a.nav && typeof intelNavigate === 'function') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'secondary-button flow-ctrl__mini-btn';
        b.textContent = 'Ir';
        b.addEventListener('click', () => intelNavigate(a.nav));
        row.append(b);
      }
      li.append(row);
      olA.append(li);
    });
  }
  pAcc.append(olA);

  const pTime = mkPanel('Tiempos críticos', 'Permisos, OT abiertas, flota en ruta, plan');
  const tbl = document.createElement('table');
  tbl.className = 'flow-ctrl__table';
  tbl.innerHTML = `<thead><tr><th>Tipo</th><th>Módulo</th><th>Ref.</th><th>Tiempo / detalle</th></tr></thead>`;
  const tb = document.createElement('tbody');
  const retrasos = flow.state.retrasos || [];
  if (!retrasos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" class="muted">Sin retrasos por encima de umbral en este corte.</td>';
    tb.append(tr);
  } else {
    retrasos.slice(0, 12).forEach((r) => {
      const tr = document.createElement('tr');
      const timeCell =
        r.horas != null ? `~${r.horas} h` : r.dias != null ? `${r.dias} días` : '—';
      tr.innerHTML = `<td>${r.tipo}</td><td>${r.modulo}</td><td>${r.referenciaId || '—'}</td><td>${r.descripcion || timeCell}</td>`;
      tb.append(tr);
    });
  }
  tbl.append(tb);
  pTime.append(tbl);

  const pBloq = mkPanel('Bloqueos operativos', 'Lo que frena cierre económico o avance');
  const ulB = document.createElement('ul');
  ulB.className = 'flow-ctrl__list flow-ctrl__list--flat';
  const bloqs = flow.decision.bloqueos || [];
  if (!bloqs.length) {
    const li = document.createElement('li');
    li.textContent = 'Sin bloqueos catalogados.';
    ulB.append(li);
  } else {
    bloqs.slice(0, 8).forEach((b) => {
      const li = document.createElement('li');
      li.textContent = `${b.texto || b.accion || b.code} ${b.count ? `(${b.count})` : ''}`;
      ulB.append(li);
    });
  }
  pBloq.append(ulB);

  const pCuellos = mkPanel('Cuellos de botella', 'Agregados desde volumen de eventos + snapshot');
  const ulC = document.createElement('ul');
  ulC.className = 'flow-ctrl__list flow-ctrl__list--flat';
  const cuellos = flow.state.cuellosDeBotella || [];
  if (!cuellos.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Ninguno detectado.';
    ulC.append(li);
  } else {
    cuellos.forEach((c) => {
      const li = document.createElement('li');
      li.textContent = c;
      ulC.append(li);
    });
  }
  pCuellos.append(ulC);

  grid.append(pProblemas, pAcc, pTime, pBloq, pCuellos);

  const foot = document.createElement('div');
  foot.className = 'flow-ctrl__foot muted';
  foot.innerHTML = `
    <p>Flow Control <code>${flow.version}</code> · 
    <button type="button" class="flow-ctrl__link" id="flow-ctrl-goto-wa">WhatsApp</button> · 
    <button type="button" class="flow-ctrl__link" id="flow-ctrl-goto-clima">Clima</button> · 
    <button type="button" class="flow-ctrl__link" id="flow-ctrl-goto-flota">Flota</button></p>
  `;

  root.append(header, toolbar, hero, autopilotPanel, grid, foot);

  if (typeof intelNavigate === 'function') {
    foot.querySelector('#flow-ctrl-goto-wa')?.addEventListener('click', () => intelNavigate({ view: 'whatsapp' }));
    foot.querySelector('#flow-ctrl-goto-clima')?.addEventListener('click', () => intelNavigate({ view: 'clima' }));
    foot.querySelector('#flow-ctrl-goto-flota')?.addEventListener('click', () => intelNavigate({ view: 'flota' }));
  }

  if (typeof window !== 'undefined') {
    window.HNFFlowControl = {
      ...hnfFlowControl,
      lastBrief: brief,
      getDirectorOperationalBrief,
    };
  }

  return root;
};

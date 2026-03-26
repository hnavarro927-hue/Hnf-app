import { fetchResponsibility, patchResponsibilityTask } from '../../services/responsibility.service.js';
import { attachEvidenceGapCounts, buildPressureTasksFromUnified } from '../modules/jarvis-pressure-engine.js';
import { rememberJarvisAction } from '../../domain/jarvis-memory.js';
import { formatLineWithContactIdentity } from '../../domain/jarvis-event-traceability.js';

const escHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const estadoLabel = (e) => {
  if (e === 'en_proceso') return 'En curso';
  if (e === 'resuelto') return 'Resuelto';
  return 'Pendiente';
};

function renderPanel(container, payload, localFallback, onPatch, reloadApp) {
  container.innerHTML = '';
  container.className = 'jarvis-exec-acc tarjeta';

  const h2 = document.createElement('h2');
  h2.className = 'jarvis-exec-acc__title';
  h2.textContent = 'RESPONSABLES Y EJECUCIÓN';
  container.append(h2);

  const ciclo = document.createElement('p');
  ciclo.className = 'jarvis-exec-acc__ciclo muted small';
  if (payload?.ciclo) {
    ciclo.textContent = `Ciclo automático activo · Última revisión: ${payload.ciclo.ultima_revision || '—'} · Próxima actualización: ${payload.ciclo.proxima_actualizacion || '—'}`;
  } else {
    ciclo.textContent = 'Ciclo automático: sin conexión al servidor — mostrando estimación local.';
  }
  container.append(ciclo);

  if (payload?.resumen) {
    const rs = document.createElement('p');
    rs.className = 'jarvis-exec-acc__resumen';
    rs.textContent = payload.resumen;
    container.append(rs);
  }

  const tareas = Array.isArray(payload?.tareas) && payload.tareas.length ? payload.tareas : localFallback;

  if (!tareas.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Sin pendientes inmediatos con los datos actuales.';
    container.append(p);
    return;
  }

  const table = document.createElement('table');
  table.className = 'jarvis-exec-acc__table';
  table.innerHTML = `<thead><tr><th>Responsable</th><th>Tarea actual</th><th>Estado</th><th>Tiempo sin acción</th><th>Impacto</th><th>Acción</th></tr></thead>`;
  const tb = document.createElement('tbody');

  for (const t of tareas) {
    const tr = document.createElement('tr');
    const min = t.tiempo_transcurrido_min != null ? `${t.tiempo_transcurrido_min} min` : '—';
    const id = t.id || '';
    const desc = formatLineWithContactIdentity(t.descripcion || t.tipo || '—');
    tr.innerHTML = `<td>${escHtml(t.responsable || '—')}</td><td>${escHtml(desc)}</td><td>${escHtml(estadoLabel(t.estado))}</td><td>${escHtml(min)}</td><td>${escHtml(t.impacto || '—')}</td>`;
    const tdAct = document.createElement('td');
    tdAct.className = 'jarvis-exec-acc__actions';
    if (id && t.estado !== 'resuelto') {
      const b1 = document.createElement('button');
      b1.type = 'button';
      b1.className = 'secondary-button jarvis-exec-acc__mini';
      b1.textContent = 'En curso';
      b1.addEventListener('click', () => onPatch(id, 'en_proceso'));
      const b2 = document.createElement('button');
      b2.type = 'button';
      b2.className = 'secondary-button jarvis-exec-acc__mini';
      b2.textContent = 'Hecho';
      b2.addEventListener('click', () => onPatch(id, 'resuelto'));
      const b3 = document.createElement('button');
      b3.type = 'button';
      b3.className = 'secondary-button jarvis-exec-acc__mini';
      b3.textContent = 'Escalar';
      b3.addEventListener('click', () => {
        rememberJarvisAction(`Escalar: ${t.descripcion || t.tipo || id}`, 'sugerida', 'sea_escalar');
        if (typeof reloadApp === 'function') reloadApp();
      });
      tdAct.append(b1, b2, b3);
    } else {
      tdAct.textContent = '—';
    }
    tr.append(tdAct);
    tb.append(tr);
  }
  table.append(tb);
  container.append(table);
}

/**
 * @param {HTMLElement} slot
 * @param {object} opts
 */
export function hydrateExecutionAccountability(slot, opts) {
  const { unified, integrationStatus, navigateToView, reloadApp, getEvidenceGaps } = opts;
  const u = attachEvidenceGapCounts(unified || {}, getEvidenceGaps);
  const localTasks = buildPressureTasksFromUnified(u, integrationStatus).map((t) => ({
    id: t.id,
    tipo: t.tipo,
    descripcion: t.descripcion,
    responsable: t.responsable,
    estado: t.estado,
    tiempo_transcurrido_min: 0,
    nivel_presion: t.nivel_presion,
    etiqueta_presion: t.nivel_presion >= 4 ? 'Bloqueo operativo' : t.nivel_presion >= 3 ? 'Crítico' : t.nivel_presion >= 2 ? 'Alto' : 'Normal',
    impacto: t.impacto,
  }));
  const mapSeaId = (id) => {
    const m = {
      cli_ot_evidencia: 'sea_ot_evidencia',
      cli_outlook: 'sea_outlook',
      cli_whatsapp: 'sea_whatsapp',
      cli_oportunidades: 'sea_oportunidades',
      cli_calendario: 'sea_calendario',
      cli_documentos: 'sea_documentos',
    };
    return m[id] || id;
  };

  const onPatch = async (id, estado) => {
    try {
      await patchResponsibilityTask(mapSeaId(id), estado);
    } catch {
      /* sin servidor: solo refrescar vista local */
    }
    if (typeof reloadApp === 'function') await reloadApp();
  };

  const paint = (payload) => {
    renderPanel(slot, payload, localTasks, onPatch, reloadApp);
  };

  fetchResponsibility()
    .then((data) => paint(data))
    .catch(() => paint(null));

  return slot;
}

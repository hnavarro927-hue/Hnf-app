import { mergeEquipoChecklist } from '../constants/hvacChecklist.js';
import { lynOtAprobacionService } from '../services/lyn-ot-aprobacion.service.js';
import { otService } from '../services/ot.service.js';
import { getEvidenceGaps } from '../utils/ot-evidence.js';

const ESTADO_LYN_LABEL = {
  pendiente_revision_lyn: 'Pendiente revisión',
  observado_lyn: 'Observado',
  aprobado_lyn: 'Aprobado',
  devuelto_operaciones: 'Devuelto ops.',
  rechazado_lyn: 'Rechazado',
};

const FILTROS = [
  ['activas_lyn', 'Activas (pendiente / observado / devuelto)'],
  ['pendientes', 'Pendiente revisión'],
  ['informes_pendientes', 'Informe PDF pendiente'],
  ['observados', 'Observados'],
  ['aprobados', 'Aprobados'],
  ['devueltos', 'Devueltos a operaciones'],
  ['rechazados', 'Rechazados'],
  ['todas', 'Todas en cola Lyn'],
];

function badgeClase(tipo) {
  return tipo === 'flota' ? 'hnf-lyn-cola__badge--flota' : 'hnf-lyn-cola__badge--clima';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export const lynAprobacionColaView = ({ navigateToView, reloadApp } = {}) => {
  const root = el('div', 'hnf-lyn-cola hnf-op-view');
  let filtroActual = 'activas_lyn';
  let filas = [];
  let detalleOt = null;
  let seleccionId = null;
  let enviandoInformeCliente = false;

  const toolbar = el('div', 'hnf-lyn-cola__toolbar');
  const sel = document.createElement('select');
  sel.className = 'hnf-lyn-cola__select';
  for (const [v, lab] of FILTROS) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = lab;
    sel.append(o);
  }
  sel.value = filtroActual;
  const refresh = el('button', 'secondary-button', 'Actualizar');
  refresh.type = 'button';
  toolbar.append(el('span', 'hnf-lyn-cola__toolbar-label', 'Filtro'), sel, refresh);

  const layout = el('div', 'hnf-lyn-cola__layout');
  const listaWrap = el('div', 'hnf-lyn-cola__lista');
  const tablaHost = el('div', 'hnf-lyn-cola__tabla-host');
  const empty = el('p', 'muted hnf-lyn-cola__empty', 'Cargando…');

  const panel = el('aside', 'hnf-lyn-cola__panel');
  panel.setAttribute('aria-label', 'Detalle OT');

  listaWrap.append(tablaHost, empty);
  layout.append(listaWrap, panel);
  root.append(el('header', 'hnf-lyn-cola__head'), toolbar, layout);

  const h1 = root.querySelector('.hnf-lyn-cola__head');
  h1.append(
    el('h1', 'hnf-lyn-cola__title', 'Cola Lyn — aprobación OT'),
    el(
      'p',
      'hnf-lyn-cola__intro muted',
      'Clima y Flota cerradas en revisión gerencial. Acciones auditadas. Sin datos inventados.'
    )
  );

  const renderTabla = () => {
    tablaHost.replaceChildren();
    empty.textContent = filas.length ? '' : 'No hay registros para este filtro.';
    empty.style.display = filas.length ? 'none' : 'block';
    if (!filas.length) return;

    const t = document.createElement('table');
    t.className = 'hnf-lyn-cola__table';
    t.innerHTML = `<thead><tr>
      <th>OT</th><th>Área</th><th>Cliente</th><th>Sucursal / ref.</th>
      <th>Estado OT</th><th>Aprobación Lyn</th><th>Último comentario</th><th></th>
    </tr></thead><tbody></tbody>`;
    const tb = t.querySelector('tbody');
    for (const r of filas) {
      const tr = document.createElement('tr');
      if (r.id === seleccionId) tr.classList.add('hnf-lyn-cola__row--sel');
      const area = el('span', `hnf-lyn-cola__badge ${badgeClase(r.tipoServicio)}`, r.tipoServicio);
      tr.innerHTML = `<td><strong>${escapeHtml(r.id)}</strong></td><td></td><td>${escapeHtml(r.cliente)}</td>
        <td>${escapeHtml(r.sucursalOPatente)}</td>
        <td>${escapeHtml(r.estadoOt || '—')}</td>
        <td>${escapeHtml(ESTADO_LYN_LABEL[r.aprobacionLynEstado] || r.aprobacionLynEstado || '—')}</td>
        <td class="hnf-lyn-cola__cell-comment">${escapeHtml(r.ultimoComentarioLyn || '—')}</td>
        <td></td>`;
      tr.children[1].append(area);
      const tdBtn = tr.lastElementChild;
      const b = el('button', 'secondary-button hnf-lyn-cola__btn-mini', 'Detalle');
      b.type = 'button';
      b.addEventListener('click', () => void abrirDetalle(r.id));
      tdBtn.append(b);
      tb.append(tr);
    }
    tablaHost.append(t);
  };

  const renderPanelVacio = () => {
    panel.replaceChildren(
      el('p', 'muted', 'Elegí una OT y abrí detalle para revisar evidencias y actuar.')
    );
  };

  const renderPanel = () => {
    if (!detalleOt) {
      renderPanelVacio();
      return;
    }
    const o = detalleOt;
    panel.replaceChildren();

    const ph = el('div', 'hnf-lyn-cola__panel-head');
    ph.append(
      el('h2', 'hnf-lyn-cola__panel-title', o.id),
      el('span', `hnf-lyn-cola__badge ${badgeClase(o.tipoServicio)}`, o.tipoServicio || '—')
    );
    panel.append(ph);

    const meta = el('dl', 'hnf-lyn-cola__dl');
    const add = (k, v) => {
      meta.append(el('dt', '', k), el('dd', '', v || 'sin dato'));
    };
    add('Cliente', o.cliente);
    add('Sucursal / ubicación / patente', o.tiendaNombre || o.direccion || o.vehiculoRelacionado);
    add('Fecha solicitud (creado)', fmtDate(o.creadoEn || o.createdAt));
    add('Fecha ejecución (visita)', `${o.fecha || 'sin dato'} ${o.hora || ''}`.trim());
    add('Responsable', o.responsableActual || o.tecnicoAsignado);
    add('Estado OT', o.estado);
    add('Aprobación Lyn', ESTADO_LYN_LABEL[o.aprobacionLynEstado] || o.aprobacionLynEstado || '—');
    add('Listo enviar cliente', o.listoEnviarCliente ? 'Sí' : 'No');
    add('PDF informe', o.pdfName || o.pdfUrl ? `${o.pdfName || ''} ${o.pdfUrl ? '· URL' : ''}` : 'pendiente');
    add('Enviado al cliente', o.enviadoCliente ? 'Sí' : 'No');
    if (o.fechaEnvio) add('Fecha envío (simulado)', fmtDate(o.fechaEnvio));
    if (o.enviadoPor) add('Enviado por', o.enviadoPor);
    panel.append(meta);

    const sec = (title) => el('h3', 'hnf-lyn-cola__sec', title);

    if (String(o.aprobacionLynEstado || '') === 'aprobado_lyn') {
      panel.append(sec('Envío al cliente'));
      const envWrap = el('div', 'hnf-lyn-cola__envio');
      const st = el('p', o.enviadoCliente ? 'hnf-lyn-cola__ok' : 'muted', '');
      st.textContent = o.enviadoCliente ? '✅ Enviado a cliente' : 'Estado envío: pendiente';
      envWrap.append(st);
      if (o.enviadoCliente && o.fechaEnvio) {
        envWrap.append(
          el('p', 'muted small', `Registrado: ${fmtDate(o.fechaEnvio)}${o.enviadoPor ? ` · ${o.enviadoPor}` : ''}`)
        );
      }
      const bSend = el(
        'button',
        'primary-button',
        enviandoInformeCliente ? 'Enviando…' : 'Enviar informe al cliente'
      );
      bSend.type = 'button';
      const pdfOk = Boolean(String(o.pdfUrl || '').trim());
      const puedeEnviar = Boolean(o.listoEnviarCliente) && pdfOk && !o.enviadoCliente;
      bSend.disabled = enviandoInformeCliente || !puedeEnviar;
      bSend.addEventListener('click', async () => {
        enviandoInformeCliente = true;
        renderPanel();
        try {
          await otService.enviarInformeCliente(o.id);
          await abrirDetalle(o.id);
          void reloadApp?.();
        } catch (e) {
          alert(e?.message || 'No se pudo registrar el envío al cliente.');
        } finally {
          enviandoInformeCliente = false;
          renderPanel();
        }
      });
      envWrap.append(bSend);
      panel.append(envWrap);
    }

    panel.append(sec('Resumen técnico'));
    panel.append(el('pre', 'hnf-lyn-cola__pre', String(o.resumenTrabajo || 'sin dato').slice(0, 4000)));
    panel.append(sec('Recomendaciones'));
    panel.append(el('pre', 'hnf-lyn-cola__pre', String(o.recomendaciones || 'sin dato').slice(0, 4000)));

    const gaps = getEvidenceGaps(o);
    panel.append(sec('Evidencia (antes / durante / después)'));
    panel.append(
      el(
        'p',
        gaps.length ? 'hnf-lyn-cola__warn' : 'hnf-lyn-cola__ok',
        gaps.length ? `Incompleta: ${gaps.length} falta(s).` : 'Completa según reglas de cierre.'
      )
    );

    panel.append(sec('Checklist (equipos)'));
    const eqs = Array.isArray(o.equipos) ? o.equipos : [];
    if (!eqs.length) {
      panel.append(el('p', 'muted small', 'Sin equipos en OT (evidencia a nivel visita).'));
    } else {
      const ul = el('ul', 'hnf-lyn-cola__checklist');
      for (const eq of eqs) {
        mergeEquipoChecklist(eq).forEach((it) => {
          const li = el('li', '', `${it.realizado ? '✓' : '○'} ${it.label}`);
          ul.append(li);
        });
      }
      panel.append(ul);
    }

    panel.append(sec('Historial Lyn'));
    const hist = Array.isArray(o.lynAprobacionHistorial) ? o.lynAprobacionHistorial : [];
    if (!hist.length) {
      panel.append(el('p', 'muted small', 'Sin movimientos Lyn aún.'));
    } else {
      const hul = el('ul', 'hnf-lyn-cola__hist');
      for (const h of hist.slice().reverse()) {
        const li = el('li', '');
        li.textContent = `${fmtDate(h.at)} · ${h.actor} · ${h.accion} · ${h.estadoAnterior ?? '—'} → ${h.estadoNuevo ?? '—'}${h.comentario ? ` — ${h.comentario}` : ''}`;
        hul.append(li);
      }
      panel.append(hul);
    }

    const act = el('div', 'hnf-lyn-cola__actions');
    const ta = document.createElement('textarea');
    ta.className = 'hnf-lyn-cola__textarea';
    ta.placeholder = 'Comentario (obligatorio observar / devolver / rechazar)';
    ta.rows = 3;

    const mk = (label, accion, primary) => {
      const b = el('button', primary ? 'primary-button' : 'secondary-button', label);
      b.type = 'button';
      b.addEventListener('click', () => void ejecutar(accion, ta.value));
      return b;
    };

    act.append(
      ta,
      el('div', 'hnf-lyn-cola__action-row', ''),
    );
    const row = act.querySelector('.hnf-lyn-cola__action-row');
    row.append(
      mk('Aprobar', 'aprobar', true),
      mk('Observar', 'observar', false),
      mk('Devolver a operaciones', 'devolver', false),
      mk('Rechazar', 'rechazar', false),
      mk('Solo comentario', 'comentar', false)
    );

    const nav = el('div', 'hnf-lyn-cola__nav-ot');
    const bClima = el('button', 'secondary-button', 'Abrir en Clima');
    bClima.type = 'button';
    bClima.disabled = String(o.tipoServicio).toLowerCase() !== 'clima';
    bClima.addEventListener('click', () => navigateToView?.('clima'));
    const bFlota = el('button', 'secondary-button', 'Abrir en Flota');
    bFlota.type = 'button';
    bFlota.disabled = String(o.tipoServicio).toLowerCase() !== 'flota';
    bFlota.addEventListener('click', () => navigateToView?.('flota'));
    nav.append(bClima, bFlota);
    panel.append(act, nav);
  };

  async function ejecutar(accion, comentario) {
    if (!detalleOt) return;
    try {
      await lynOtAprobacionService.aplicar(detalleOt.id, { accion, comentario: comentario.trim() });
      await cargar();
      seleccionId = detalleOt.id;
      await abrirDetalle(detalleOt.id);
      void reloadApp?.();
    } catch (e) {
      alert(e?.message || 'No se pudo registrar la acción.');
    }
  }

  async function abrirDetalle(id) {
    seleccionId = id;
    try {
      detalleOt = await otService.getById(id);
    } catch {
      detalleOt = null;
    }
    renderTabla();
    renderPanel();
  }

  async function cargar() {
    empty.style.display = 'block';
    empty.textContent = 'Cargando…';
    try {
      filas = await lynOtAprobacionService.cola(filtroActual);
      if (!Array.isArray(filas)) filas = [];
    } catch {
      filas = [];
      empty.textContent = 'No se pudo cargar la cola (revisá conexión y permisos).';
    }
    renderTabla();
  }

  sel.addEventListener('change', () => {
    filtroActual = sel.value;
    void cargar();
  });
  refresh.addEventListener('click', () => void cargar());

  renderPanelVacio();
  void cargar();

  return root;
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(x) {
  if (!x) return 'sin dato';
  try {
    return new Date(x).toLocaleString('es-CL');
  } catch {
    return String(x);
  }
}

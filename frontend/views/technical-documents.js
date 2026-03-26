import { isDocumentControlApprover } from '../config/document-control.config.js';
import { getStoredOperatorName } from '../config/operator.config.js';
import { analyzeTechnicalDocument } from '../domain/hnf-intelligence-engine.js';
import {
  buildClienteInformePremiumStructure,
  computeTechnicalDocumentMetrics,
  normalizeTechnicalReport,
  parseTechnicalReport,
  runJarvisDocumentReview,
  validateBeforeApproval,
} from '../domain/technical-document-intelligence.js';
import { rememberApprovalPattern } from '../domain/hnf-memory.js';
import { technicalDocumentsService } from '../services/technical-documents.service.js';

const ESTADOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'borrador', label: 'Borrador' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'observado', label: 'Observado' },
  { id: 'aprobado', label: 'Aprobado' },
  { id: 'enviado', label: 'Enviado' },
];

const TIPOS_COMENTARIO = ['tecnico', 'redaccion', 'riesgo', 'cliente', 'garantia'];

const actorName = () => getStoredOperatorName() || 'operador';

export const technicalDocumentsView = ({ data, reloadApp, intelNavigate } = {}) => {
  const section = document.createElement('section');
  section.className = 'docintel-module';

  const docs = Array.isArray(data?.technicalDocuments) ? data.technicalDocuments : [];
  const rawOts = data?.ots?.data ?? data?.ots ?? [];
  const ots = Array.isArray(rawOts) ? rawOts : [];
  const otsClima = ots.filter((o) => String(o?.tipoServicio || 'clima').toLowerCase() !== 'flota');

  const metrics = computeTechnicalDocumentMetrics(docs);

  const feedback = document.createElement('div');
  feedback.className = 'form-feedback';
  feedback.hidden = true;

  const showFb = (type, msg) => {
    if (!msg) {
      feedback.hidden = true;
      return;
    }
    feedback.className = `form-feedback form-feedback--${type}`;
    feedback.textContent = msg;
    feedback.hidden = false;
  };

  const runReload = async () => {
    if (typeof reloadApp === 'function') return await reloadApp();
    return false;
  };

  let filterEstado = 'todos';
  let selectedId = docs[0]?.id || null;

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Documentos técnicos</h2><p class="muted">Informes PDF/texto estructurados, revisión interna (Romina → Lyn) y aprobación formal vinculada a <strong>OT</strong> y activos. <strong>Jarvis</strong> audita calidad por reglas; la memoria guarda criterios de aprobación.</p>';

  const metricsRow = document.createElement('div');
  metricsRow.className = 'docintel-metrics';
  metricsRow.innerHTML = `
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.total}</span><span class="muted">total</span></div>
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.enRevision}</span><span class="muted">en revisión</span></div>
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.observado}</span><span class="muted">observados</span></div>
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.aprobado + metrics.enviado}</span><span class="muted">aprob. + enviados</span></div>
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.tiempoPromedioHorasAprobacion ?? '—'}</span><span class="muted">h prom. a aprobación</span></div>
    <div class="docintel-metric"><span class="docintel-metric__v">${metrics.tiempoAhorradoJarvisHorasEstimado}</span><span class="muted">h ahorro Jarvis (est.)</span></div>
  `;

  const layout = document.createElement('div');
  layout.className = 'docintel-layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'docintel-sidebar';

  const filt = document.createElement('div');
  filt.className = 'docintel-filters';
  ESTADOS.forEach(({ id, label }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'docintel-filter';
    b.textContent = label;
    b.dataset.estado = id;
    b.addEventListener('click', () => {
      filterEstado = id;
      filt.querySelectorAll('.docintel-filter').forEach((x) => x.classList.toggle('is-active', x.dataset.estado === id));
      renderList();
    });
    filt.append(b);
  });
  filt.querySelector('.docintel-filter')?.classList.add('is-active');

  const listEl = document.createElement('ul');
  listEl.className = 'docintel-list';

  const main = document.createElement('div');
  main.className = 'docintel-main';

  const renderList = () => {
    listEl.replaceChildren();
    let rows = [...docs];
    if (filterEstado !== 'todos') rows = rows.filter((d) => d.estadoDocumento === filterEstado);
    rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin documentos en este filtro.';
      listEl.append(li);
      return;
    }
    rows.forEach((d) => {
      const li = document.createElement('li');
      li.className = `docintel-list__item docintel-list__item--${d.estadoDocumento}`;
      if (d.id === selectedId) li.classList.add('is-selected');
      li.innerHTML = `<strong>${d.id}</strong><span class="muted">${d.cliente || '—'}</span><span class="docintel-badge docintel-badge--${d.estadoDocumento}">${d.estadoDocumento}</span>`;
      li.addEventListener('click', () => {
        selectedId = d.id;
        renderList();
        renderDetail();
      });
      listEl.append(li);
    });
  };

  const patchDoc = async (id, body, memento) => {
    try {
      await technicalDocumentsService.patch(id, body);
      if (memento) rememberApprovalPattern(memento);
      showFb('success', 'Guardado.');
      await runReload();
    } catch (e) {
      showFb('error', e.message || 'Error al guardar.');
    }
  };

  const renderDetail = () => {
    main.replaceChildren();
    const d = docs.find((x) => x.id === selectedId);
    if (!d) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Seleccioná un documento o creá uno nuevo.';
      main.append(p);
      return;
    }

    const ot = otsClima.find((o) => o.id === d.otId) || null;
    const jarvis = runJarvisDocumentReview(d, ot);
    const jarvisCentral = analyzeTechnicalDocument(d, ot);

    const top = document.createElement('div');
    top.className = 'docintel-detail-head';
    const h3 = document.createElement('h3');
    h3.textContent = d.tituloDocumento || d.id;
    const sub = document.createElement('p');
    sub.className = 'muted';
    sub.textContent = `${d.cliente || '—'} · ${d.tiendaNombre || ''} · OT ${d.otId || '—'}`;
    top.append(h3, sub);

    const puedeAprobar = isDocumentControlApprover(actorName());

    const controlPanel = document.createElement('div');
    controlPanel.className = 'docintel-control-panel';
    const metaLine = document.createElement('div');
    metaLine.className = 'docintel-control-panel__meta';
    metaLine.innerHTML = `
      <span class="docintel-badge docintel-badge--${escapeHtml(d.estadoDocumento)}">${escapeHtml(d.estadoDocumento)}</span>
      <span class="muted">Versión <strong>${escapeHtml(String(d.version ?? 1))}</strong></span>
      <span class="muted">Creado: <strong>${escapeHtml(d.creadoPor || d.createdBy || '—')}</strong></span>
      <span class="muted">Revisión: <strong>${escapeHtml(d.revisadoPor || '—')}</strong> ${d.fechaRevision ? `· ${escapeHtml(String(d.fechaRevision).slice(0, 16))}` : ''}</span>
      <span class="muted">Aprob.: <strong>${escapeHtml(d.aprobadoPor || '—')}</strong> ${d.fechaAprobacion || d.aprobadoEn ? `· ${escapeHtml(String(d.fechaAprobacion || d.aprobadoEn).slice(0, 16))}` : ''}</span>
      <span class="muted">Envío: <strong>${escapeHtml(d.enviadoClientePor || '—')}</strong> ${d.fechaEnvio || d.enviadoClienteEn ? `· ${escapeHtml(String(d.fechaEnvio || d.enviadoClienteEn).slice(0, 16))}` : ''}</span>
    `;
    const ctrlNote = document.createElement('p');
    ctrlNote.className = 'muted docintel-control-panel__note';
    ctrlNote.textContent = puedeAprobar
      ? 'Tenés permisos de control documental (observar / aprobar / enviar).'
      : 'Observar, aprobar y enviar al cliente requieren perfil Lyn / Hernán (nombre del operador).';
    controlPanel.append(metaLine, ctrlNote);

    const actions = document.createElement('div');
    actions.className = 'docintel-actions';

    const mkBtn = (label, fn, primary = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = primary ? 'primary-button' : 'secondary-button';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };

    const wfOk = async (fn, memento) => {
      try {
        await fn();
        if (memento) rememberApprovalPattern(memento);
        showFb('success', 'Registrado.');
        await runReload();
      } catch (e) {
        showFb('error', e.message || 'Error en flujo documental.');
      }
    };

    if (d.estadoDocumento === 'borrador') {
      actions.append(
        mkBtn(
          'Enviar a revisión',
          () => {
            const tx = window.prompt('Comentario opcional al pasar a revisión:', '') ?? '';
            if (tx == null) return;
            void wfOk(
              () => technicalDocumentsService.revisar(d.id, { comentario: tx.trim() }),
              {
                actor: actorName(),
                accion: 'envio_revision',
                documentoId: d.id,
                resumen: tx.trim() || 'Borrador → en revisión',
              }
            );
          },
          true
        )
      );
    }

    if (d.estadoDocumento === 'en_revision') {
      if (puedeAprobar) {
        actions.append(
          mkBtn('Observar', () => {
            const tx = window.prompt('Observación para el redactor (recomendado):', '');
            if (tx == null) return;
            void wfOk(
              () => technicalDocumentsService.observar(d.id, { comentario: (tx || '').trim() }),
              {
                actor: actorName(),
                accion: 'observacion',
                documentoId: d.id,
                resumen: (tx || '').slice(0, 200),
                patrones: tx ? [tx.slice(0, 120)] : [],
              }
            );
          }),
          mkBtn('Aprobar', () => {
            const tx =
              window.prompt(
                'Comentario de aprobación (obligatorio si hay riesgo crítico o inconsistencias Jarvis):',
                ''
              ) ?? '';
            if (tx == null) return;
            const v = validateBeforeApproval(d, {
              comentarioMitigacion: tx.trim(),
              comentario: tx.trim(),
              ot,
            });
            if (!v.ok) {
              showFb('error', v.errors.join(' '));
              return;
            }
            void wfOk(
              () =>
                technicalDocumentsService.aprobar(d.id, {
                  comentario: tx.trim(),
                  comentarioMitigacion: tx.trim(),
                }),
              {
                actor: actorName(),
                accion: 'aprobacion',
                documentoId: d.id,
                resumen: 'Aprobación formal',
              }
            );
          })
        );
      }
    }

    if (d.estadoDocumento === 'observado') {
      actions.append(
        mkBtn('Reenviar a revisión', () => {
          const tx = window.prompt('Comentario opcional (corrección recibida):', '') ?? '';
          if (tx == null) return;
          void wfOk(() => technicalDocumentsService.revisar(d.id, { comentario: tx.trim() }), null);
        })
      );
    }

    if (d.estadoDocumento === 'aprobado') {
      if (puedeAprobar) {
        actions.append(
          mkBtn(
            'Enviar a cliente',
            () => {
              const tx = window.prompt('Comentario opcional de envío:', '') ?? '';
              if (tx == null) return;
              void wfOk(
                () => technicalDocumentsService.enviar(d.id, { comentario: tx.trim() }),
                {
                  actor: actorName(),
                  accion: 'envio_cliente',
                  documentoId: d.id,
                  resumen: 'Envío formal',
                }
              );
            },
            true
          )
        );
      }
    }

    if (d.otId && typeof intelNavigate === 'function') {
      actions.append(mkBtn('Abrir OT en Clima', () => intelNavigate({ view: 'clima', otId: d.otId })));
    }

    const historial = document.createElement('div');
    historial.className = 'docintel-historial';
    historial.innerHTML = '<h4>Historial del documento</h4><p class="muted docintel-historial__sub">Auditoría de acciones (quién, cuándo, comentario).</p>';
    const histUl = document.createElement('ul');
    histUl.className = 'docintel-historial__ul';
    const histItems = [...(d.historialDocumental || [])].sort((a, b) =>
      String(b.fecha || '').localeCompare(String(a.fecha || ''))
    );
    if (!histItems.length) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin movimientos en auditoría (documentos previos a control formal muestran solo versiones abajo).';
      histUl.append(li);
    } else {
      histItems.forEach((h) => {
        const li = document.createElement('li');
        li.className = 'docintel-historial__li';
        li.innerHTML = `<span class="muted">${escapeHtml(String(h.fecha || '').slice(0, 19))}</span> · <strong>${escapeHtml(h.accion || '')}</strong> · ${escapeHtml(h.actor || '')} · ${escapeHtml(h.estadoAntes || '—')} → ${escapeHtml(h.estadoDespues || '—')}<br><span class="docintel-historial__com">${escapeHtml(h.comentario || '—')}</span>`;
        histUl.append(li);
      });
    }
    historial.append(histUl);

    const verH = document.createElement('h5');
    verH.className = 'docintel-historial__h5';
    verH.textContent = 'Versiones de estado (legacy / trazabilidad)';
    const verUl = document.createElement('ul');
    verUl.className = 'docintel-historial__ul docintel-historial__ul--compact';
    [...(d.versiones || [])]
      .slice()
      .reverse()
      .forEach((v) => {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = `${String(v.at || '').slice(0, 19)} · ${v.estadoDocumento || ''} · ${v.actor || ''} · ${v.nota || ''}`;
        verUl.append(li);
      });
    historial.append(verH, verUl);

    if ((d.comentariosRevision || []).length) {
      const crH = document.createElement('h5');
      crH.className = 'docintel-historial__h5';
      crH.textContent = 'Comentarios de revisión';
      const crUl = document.createElement('ul');
      crUl.className = 'docintel-historial__ul';
      (d.comentariosRevision || []).forEach((c) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="muted">${escapeHtml(String(c.fecha || '').slice(0, 16))}</span> · <strong>${escapeHtml(c.actor || '')}</strong> (${escapeHtml(c.accion || '')})<br>${escapeHtml(c.texto || '')}`;
        crUl.append(li);
      });
      historial.append(crH, crUl);
    }

    const jarvisBox = document.createElement('div');
    jarvisBox.className = 'docintel-jarvis';
    jarvisBox.innerHTML = `<h4>Jarvis · revisión documental</h4>
      <p class="docintel-jarvis__estado docintel-jarvis__estado--${jarvis.estadoCalidad}">Calidad: <strong>${jarvis.estadoCalidad}</strong></p>
      <p class="muted">${jarvis.recomendacionFinal}</p>`;
    const ul = document.createElement('ul');
    ul.className = 'docintel-jarvis__ul';
    [...jarvis.faltantes, ...jarvis.riesgosRedaccion, ...jarvis.riesgosTecnicos, ...jarvis.sugerencias].forEach(
      (t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.append(li);
      }
    );
    jarvisBox.append(ul);
    jarvisBox.append(
      (() => {
        const p = document.createElement('p');
        p.className = 'muted docintel-jarvis__meta';
        p.textContent = `Consistencia OT: ${jarvis.consistenciaConOT} · Activos: ${jarvis.consistenciaConActivo}`;
        return p;
      })()
    );

    if ((d.alertasIngesta || []).length) {
      const ingestAlerts = document.createElement('div');
      ingestAlerts.className = 'docintel-ingest-alerts';
      ingestAlerts.innerHTML = '<h4>Alertas de ingestión (PDF/texto)</h4>';
      const ial = document.createElement('ul');
      ial.className = 'docintel-ingest-alerts__ul';
      (d.alertasIngesta || []).forEach((a) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="docintel-badge docintel-badge--${String(a.nivel || 'info')}">${escapeHtml(
          a.nivel || '—'
        )}</span> <strong>${escapeHtml(a.code || '')}</strong> · ${escapeHtml(a.mensaje || '')}`;
        ial.append(li);
      });
      ingestAlerts.append(ial);
      jarvisBox.append(ingestAlerts);
    }

    if (d.ingestaResumen || d.analisisJarvis) {
      const metaIng = document.createElement('pre');
      metaIng.className = 'muted docintel-ingest-meta';
      metaIng.textContent = JSON.stringify(
        { ingestaResumen: d.ingestaResumen || null, analisisJarvis: d.analisisJarvis || null },
        null,
        2
      );
      jarvisBox.append(metaIng);
    }

    const centralBox = document.createElement('div');
    centralBox.className = 'docintel-jarvis docintel-jarvis--central';
    centralBox.innerHTML = '<h4>Jarvis · inteligencia operativa (documento)</h4>';
    const cul2 = document.createElement('ul');
    cul2.className = 'docintel-jarvis__ul';
    if (jarvisCentral.incoherencias?.length) {
      jarvisCentral.incoherencias.forEach((x) => {
        const li = document.createElement('li');
        li.textContent = `Incoherencia (${x.tipo}): ${x.texto}`;
        cul2.append(li);
      });
    }
    jarvisCentral.riesgosOcultos?.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = `Riesgo u oculto: ${t}`;
      cul2.append(li);
    });
    jarvisCentral.oportunidadesComerciales?.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = `Oportunidad: ${t}`;
      cul2.append(li);
    });
    if (!cul2.childElementCount) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Sin señales extra respecto a la revisión estándar.';
      cul2.append(li);
    }
    centralBox.append(cul2);

    const bodyGrid = document.createElement('div');
    bodyGrid.className = 'docintel-body-grid';

    const fields = document.createElement('div');
    fields.className = 'docintel-fields';
    fields.innerHTML = `
      <label class="docintel-label">Resumen ejecutivo<textarea data-k="resumenEjecutivo" rows="3">${escapeHtml(d.resumenEjecutivo || '')}</textarea></label>
      <label class="docintel-label">Trabajos realizados<textarea data-k="trabajosRealizados" rows="4">${escapeHtml(d.trabajosRealizados || '')}</textarea></label>
      <label class="docintel-label">Recomendaciones<textarea data-k="recomendaciones" rows="3">${escapeHtml(d.recomendaciones || '')}</textarea></label>
      <label class="docintel-label">Limitaciones<textarea data-k="limitacionesServicio" rows="2">${escapeHtml(d.limitacionesServicio || '')}</textarea></label>
      <label class="docintel-label">Garantía observada<textarea data-k="garantiaObservada" rows="2">${escapeHtml(d.garantiaObservada || '')}</textarea></label>
    `;
    const saveFields = mkBtn('Guardar campos', async () => {
      const patch = {};
      fields.querySelectorAll('textarea[data-k]').forEach((ta) => {
        patch[ta.dataset.k] = ta.value.trim();
      });
      try {
        await technicalDocumentsService.patch(d.id, patch);
        rememberApprovalPattern({
          actor: actorName(),
          accion: 'edicion_campos',
          documentoId: d.id,
          resumen: 'Actualización de cuerpo del informe',
        });
        showFb('success', 'Campos actualizados.');
        await runReload();
      } catch (e) {
        showFb('error', e.message || 'Error');
      }
    });

    const comments = document.createElement('div');
    comments.className = 'docintel-comments';
    comments.innerHTML = '<h4>Comentarios internos</h4>';
    const cul = document.createElement('ul');
    cul.className = 'docintel-comments__ul';
    (d.comentariosInternos || []).forEach((c) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${c.actor}</strong> · ${c.tipo} <span class="muted">${c.fecha?.slice(0, 16) || ''}</span><br>${escapeHtml(c.sugerencia || c.textoOriginal || '')}`;
      cul.append(li);
    });
    comments.append(cul);

    const addCom = document.createElement('div');
    addCom.className = 'docintel-add-com';
    const selTipo = document.createElement('select');
    TIPOS_COMENTARIO.forEach((t) => selTipo.append(new Option(t, t)));
    const taCom = document.createElement('textarea');
    taCom.rows = 2;
    taCom.placeholder = 'Sugerencia / observación interna';
    const btnCom = mkBtn('Registrar comentario', async () => {
      try {
        await technicalDocumentsService.addComment(d.id, {
          actor: actorName(),
          rol: 'interno',
          tipo: selTipo.value,
          textoOriginal: '',
          sugerencia: taCom.value.trim(),
          motivo: 'Comentario manual',
        });
        rememberApprovalPattern({
          actor: actorName(),
          accion: 'comentario_interno',
          documentoId: d.id,
          resumen: taCom.value.trim().slice(0, 160),
        });
        taCom.value = '';
        showFb('success', 'Comentario guardado.');
        await runReload();
      } catch (e) {
        showFb('error', e.message || 'Error');
      }
    });
    addCom.append(selTipo, taCom, btnCom);
    comments.append(addCom);

    const ingesta = document.createElement('div');
    ingesta.className = 'docintel-ingesta';
    ingesta.innerHTML = '<h4>Ingesta WhatsApp / operación</h4><p class="muted">Registrá frases tipo «está ok», «cambiar la parte final…», envío al cliente.</p>';
    const selEv = document.createElement('select');
    ['envio', 'observacion', 'aprobacion', 'correccion'].forEach((t) => selEv.append(new Option(t, t)));
    const taIng = document.createElement('textarea');
    taIng.rows = 2;
    taIng.placeholder = 'Texto del mensaje…';
    const btnIng = mkBtn('Registrar evento', async () => {
      try {
        await technicalDocumentsService.addIngesta(d.id, {
          tipo: selEv.value,
          texto: taIng.value.trim(),
          actor: actorName(),
          fuente: 'whatsapp',
        });
        taIng.value = '';
        showFb('success', 'Evento registrado.');
        await runReload();
      } catch (e) {
        showFb('error', e.message || 'Error');
      }
    });
    ingesta.append(selEv, taIng, btnIng);

    const evUl = document.createElement('ul');
    evUl.className = 'docintel-ingesta__ul';
    (d.eventosIngesta || []).slice(-12).reverse().forEach((e) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="muted">${e.at?.slice(0, 16)}</span> <strong>${e.tipo}</strong> · ${escapeHtml(e.texto || '')}`;
      evUl.append(li);
    });
    ingesta.append(evUl);

    const premium = document.createElement('div');
    premium.className = 'docintel-premium';
    const prem = buildClienteInformePremiumStructure(d);
    premium.innerHTML = '<h4>Informe cliente premium (estructura)</h4>';
    const pre = document.createElement('pre');
    pre.className = 'muted docintel-premium__pre';
    pre.textContent = JSON.stringify(prem, null, 2);
    premium.append(pre);

    fields.append(saveFields);
    bodyGrid.append(fields, comments, ingesta);
    main.append(top, controlPanel, actions, jarvisBox, centralBox, historial, bodyGrid, premium);
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const newCard = document.createElement('article');
  newCard.className = 'plan-card docintel-new';
  newCard.innerHTML =
    '<h3>Nuevo documento / pegar informe</h3><p class="muted">Creá un borrador vacío, pegá texto para parseo local, o <strong>ingestá en el servidor</strong> para dejar el documento en <code>en_revision</code> con alertas y vínculo OT por cliente + fecha.</p>';

  const row1 = document.createElement('div');
  row1.className = 'docintel-new-row';
  const selOt = document.createElement('select');
  selOt.append(new Option('— Vincular OT Clima —', ''));
  otsClima.forEach((o) => selOt.append(new Option(`${o.id} · ${o.cliente || ''}`, o.id)));

  const btnNew = document.createElement('button');
  btnNew.type = 'button';
  btnNew.className = 'primary-button';
  btnNew.textContent = 'Crear borrador';
  btnNew.addEventListener('click', async () => {
    try {
      const r = await technicalDocumentsService.create({
        otId: selOt.value,
        estadoDocumento: 'borrador',
        fuente: 'manual',
        tituloDocumento: 'Nuevo informe técnico',
      });
      const created = r?.data ?? r;
      showFb('success', `Creado ${created?.id || ''}.`);
      await runReload();
    } catch (e) {
      showFb('error', e.message || 'No se pudo crear.');
    }
  });
  row1.append(selOt, btnNew);

  const taPaste = document.createElement('textarea');
  taPaste.className = 'docintel-paste';
  taPaste.rows = 5;
  taPaste.placeholder = 'Pegá aquí el texto del informe…';

  const parseOut = document.createElement('pre');
  parseOut.className = 'muted docintel-parse-out';

  const row2 = document.createElement('div');
  row2.className = 'docintel-new-row';
  const btnParse = document.createElement('button');
  btnParse.type = 'button';
  btnParse.className = 'secondary-button';
  btnParse.textContent = 'Parsear y crear borrador';
  btnParse.addEventListener('click', async () => {
    const parsed = parseTechnicalReport(taPaste.value);
    parseOut.textContent = JSON.stringify(parsed, null, 2);
    const normBody = normalizeTechnicalReport(parsed);
    try {
      const r = await technicalDocumentsService.create({
        ...normBody,
        otId: selOt.value || normBody.otId,
        estadoDocumento: 'borrador',
        fuente: 'romina',
      });
      const created = r?.data ?? r;
      showFb('success', `Borrador ${created?.id || ''} desde texto parseado.`);
      taPaste.value = '';
      await runReload();
    } catch (e) {
      showFb('error', e.message || 'No se pudo crear.');
    }
  });

  const btnIngestSrv = document.createElement('button');
  btnIngestSrv.type = 'button';
  btnIngestSrv.className = 'primary-button';
  btnIngestSrv.textContent = 'Ingestar en servidor (en revisión)';
  btnIngestSrv.addEventListener('click', async () => {
    try {
      const r = await technicalDocumentsService.ingest({
        texto: taPaste.value,
        otId: selOt.value || undefined,
        pdfMetadata: {},
      });
      const payload = r?.data ?? r;
      const id = payload?.documento?.id || '';
      const nAlert = Array.isArray(payload?.alertas) ? payload.alertas.length : 0;
      parseOut.textContent = JSON.stringify(payload, null, 2);
      showFb('success', `Ingesta OK · ${id} · ${nAlert} alerta(s) · estado en_revision.`);
      rememberApprovalPattern({
        actor: actorName(),
        accion: 'ingesta_servidor',
        documentoId: id,
        resumen: `Ingesta con ${nAlert} alertas`,
      });
      taPaste.value = '';
      await runReload();
    } catch (e) {
      showFb('error', e.message || 'Ingesta falló.');
    }
  });

  row2.append(btnParse, btnIngestSrv);

  newCard.append(row1, taPaste, row2, parseOut);

  const toolBar = document.createElement('div');
  toolBar.className = 'plan-toolbar';
  const rel = document.createElement('button');
  rel.type = 'button';
  rel.className = 'secondary-button';
  rel.textContent = 'Actualizar lista';
  rel.addEventListener('click', async () => {
    showFb('neutral', 'Actualizando…');
    const ok = await runReload();
    showFb(ok ? 'success' : 'error', ok ? 'Listo.' : 'Error de conexión.');
  });
  toolBar.append(rel);

  sidebar.append(filt, listEl);
  layout.append(sidebar, main);

  section.append(header, feedback, metricsRow, toolBar, newCard, layout);

  renderList();
  renderDetail();

  return section;
};

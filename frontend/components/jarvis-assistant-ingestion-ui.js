/**
 * UI de revisión / confirmación de ingesta Jarvis (sin guardado implícito).
 */

import {
  downloadIngestionExportJson,
  saveIngestionToValidationQueue,
  saveOtDirectFromPipeline,
} from '../domain/jarvis-ingestion-execute.js';

function appendIngestionStructuredMessage(log, summary) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--assistant';
  const meta = document.createElement('span');
  meta.className = 'hnf-jarvis-assistant__msg-meta';
  meta.textContent = 'Jarvis · ingesta';

  const stack = document.createElement('div');
  stack.className = 'hnf-jarvis-assistant__copilot-stack';

  const mk = (kind, label, text) => {
    if (!text) return;
    const block = document.createElement('div');
    block.className = `hnf-jarvis-assistant__copilot-block hnf-jarvis-assistant__copilot-block--${kind}`;
    const lb = document.createElement('span');
    lb.className = 'hnf-jarvis-assistant__copilot-label';
    lb.textContent = label;
    const tx = document.createElement('div');
    tx.className = 'hnf-jarvis-assistant__copilot-text';
    tx.textContent = text;
    block.append(lb, tx);
    stack.append(block);
  };

  mk('datos', 'Datos detectados', summary.datosDetectados);
  mk('accion', 'Campos faltantes', summary.camposFaltantes);
  mk('accion', 'Posibles duplicados', summary.posiblesDuplicados);
  mk('accion', 'Acción sugerida', summary.accionSugerida);
  mk('mejora', 'Mejora sugerida', summary.mejoraSugerida);
  for (const line of summary.intelLines || []) {
    mk('mejora', 'Inteligencia operativa', line);
  }
  mk('datos', 'Confirmación', summary.confirmQuestion);

  wrap.append(meta, stack);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.log
 * @param {object|null} opts.pipelineResult
 * @param {object} opts.hooks
 * @param {() => void} [opts.onAfterSave]
 * @param {(msg: string) => void} [opts.onNotify]
 */
export function mountIngestionReviewBar(opts) {
  const { log, hooks, onAfterSave, onNotify } = opts;
  let pipelineResult = opts.pipelineResult;

  const bar = document.createElement('div');
  bar.className = 'hnf-jarvis-ingestion-review';
  bar.hidden = !pipelineResult;

  const title = document.createElement('h3');
  title.className = 'hnf-jarvis-ingestion-review__title';
  title.textContent = 'Revisión antes de guardar';

  const meta = document.createElement('p');
  meta.className = 'hnf-jarvis-ingestion-review__meta muted small';

  const actions = document.createElement('div');
  actions.className = 'hnf-jarvis-ingestion-review__actions';

  const mkBtn = (label, variant, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className =
      variant === 'primary'
        ? 'primary-button hnf-jarvis-ingestion-review__btn'
        : 'secondary-button hnf-jarvis-ingestion-review__btn';
    b.addEventListener('click', onClick);
    return b;
  };

  const notify = (msg) => {
    if (typeof onNotify === 'function') onNotify(msg);
    else appendSimpleToLog(log, msg);
  };

  const refresh = () => {
    bar.hidden = !pipelineResult;
    if (!pipelineResult) {
      meta.textContent = '';
      return;
    }
    const s = pipelineResult.stats;
    meta.textContent = `Resumen: ${s.totalRows} filas · ${s.validComplete} listas para flujo directo · ${s.duplicateCandidates} alerta(s) duplicado · ${s.missingFieldsCount} con campos faltantes. Nada se guarda hasta que elijas una acción.`;
  };

  const run = async (fn) => {
    try {
      const r = await fn();
      notify(typeof r === 'string' ? r : 'Operación completada. Revisá HNF Core o Clima según corresponda.');
      onAfterSave?.();
      pipelineResult = null;
      refresh();
    } catch (e) {
      notify(`No se pudo completar: ${e?.message || e}`);
    }
  };

  actions.append(
    mkBtn('Guardar en cola de validación', 'primary', () => {
      if (!pipelineResult) return;
      if (!hooks?.postCargaMasiva) {
        notify('No hay servicio de cola de validación disponible en esta vista.');
        return;
      }
      run(() => saveIngestionToValidationQueue(pipelineResult, hooks));
    }),
    mkBtn('Crear OT directas (solo filas válidas)', 'secondary', () => {
      if (!pipelineResult) return;
      if (!hooks?.createOt) {
        notify('No hay servicio de creación de OT disponible en esta vista.');
        return;
      }
      run(async () => {
        const r = await saveOtDirectFromPipeline(pipelineResult, hooks);
        return `OT: ${r.ok.length} creadas; fallos: ${r.fail.length}.`;
      });
    }),
    mkBtn('Exportar JSON (Excel/PDF más adelante)', 'secondary', () => {
      if (!pipelineResult) return;
      downloadIngestionExportJson(pipelineResult, 'jarvis_ingesta');
      notify('Archivo JSON descargado como base para exportaciones futuras.');
    }),
    mkBtn('Revisar duplicados', 'secondary', () => {
      if (!pipelineResult) return;
      const dups = (pipelineResult.records || []).filter(
        (x) => x.flags?.duplicateInFile || x.flags?.duplicateInSystem
      );
      notify(
        dups.length
          ? `${dups.length} filas marcadas como posibles duplicados. Revisá la planilla o el ID de OT.`
          : 'No hay duplicados detectados en este lote.'
      );
    }),
    mkBtn('Cancelar', 'secondary', () => {
      pipelineResult = null;
      refresh();
      notify('Ingesta cancelada; no se guardó nada.');
    })
  );

  bar.append(title, meta, actions);
  refresh();

  return {
    el: bar,
    setPipelineResult(pr) {
      pipelineResult = pr;
      if (pr) appendIngestionStructuredMessage(log, pr.summary);
      refresh();
    },
    getPipelineResult: () => pipelineResult,
  };
}

function appendSimpleToLog(log, text) {
  const wrap = document.createElement('div');
  wrap.className = 'hnf-jarvis-assistant__msg hnf-jarvis-assistant__msg--assistant';
  const meta = document.createElement('span');
  meta.className = 'hnf-jarvis-assistant__msg-meta';
  meta.textContent = 'Jarvis';
  const body = document.createElement('div');
  body.className = 'hnf-jarvis-assistant__msg-body';
  body.textContent = text;
  wrap.append(meta, body);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
}

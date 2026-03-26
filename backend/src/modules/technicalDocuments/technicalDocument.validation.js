const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Validación previa a aprobación (calidad + riesgo). Debe alinearse con reglas Jarvis del frontend.
 *
 * @param {object} doc - Documento normalizado
 * @param {object} ctx - { comentarioMitigacion?, comentario?, ot? }
 */
export function validateBeforeApproval(doc, ctx = {}) {
  const d = doc || {};
  const errors = [];
  const comMit = String(ctx.comentarioMitigacion ?? ctx.comentario ?? '').trim();

  const ingest = Array.isArray(d.alertasIngesta) ? d.alertasIngesta : [];
  const hasCrit = ingest.some((a) => String(a.nivel || '').toLowerCase() === 'critico');
  if (hasCrit && comMit.length < 15) {
    errors.push(
      'Hay riesgo crítico en ingestión: explicá mitigación o criterio de aprobación (comentario ≥ 15 caracteres).'
    );
  }

  if (String(d.recomendaciones || '').trim().length < 20) {
    errors.push('Recomendaciones vacías o demasiado breves para aprobar.');
  }

  const trab = norm(d.trabajosRealizados);
  const rec = norm(d.recomendaciones);
  if (trab && rec.length > 15) {
    const contradict =
      (trab.includes('no se interviene') || trab.includes('sin intervencion')) &&
      (rec.includes('reparar') || rec.includes('cambiar') || rec.includes('sustituir') || rec.includes('reemplazar'));
    if (contradict && comMit.length < 15) {
      errors.push(
        'Inconsistencia trabajos vs recomendaciones (tipo Jarvis): documentá criterio en el comentario de aprobación.'
      );
    }
  }

  const obs = norm(d.observacionesTecnicas);
  if ((obs.includes('fuga') || obs.includes('critico') || obs.includes('urgente')) && String(d.recomendaciones || '').trim().length < 40) {
    errors.push('Observaciones con riesgo fuerte requieren recomendaciones más completas antes de aprobar.');
  }

  const ot = ctx.ot;
  if (ot && String(d.cliente || '').trim() && String(ot.cliente || '').trim()) {
    const oc = norm(ot.cliente);
    const dc = norm(d.cliente);
    if (oc && dc && oc !== dc && !oc.includes(dc) && !dc.includes(oc)) {
      errors.push('Cliente del documento no coincide con la OT vinculada (control Jarvis).');
    }
  }
  if (ot && String(d.fechaServicio || '').slice(0, 10) && String(ot.fecha || '').slice(0, 10)) {
    if (String(d.fechaServicio).slice(0, 10) !== String(ot.fecha).slice(0, 10)) {
      errors.push('Fecha de servicio del documento distinta a la fecha de la OT vinculada.');
    }
  }

  return { ok: errors.length === 0, errors };
}

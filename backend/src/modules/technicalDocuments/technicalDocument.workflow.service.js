import { technicalDocumentRepository } from '../../repositories/technicalDocument.repository.js';
import { otRepository } from '../../repositories/ot.repository.js';
import { syncCommercialOpportunitiesOnApproval } from '../../services/commercialOpportunity.service.js';
import { DOC_CONTROL_ACCIONES, DOC_CONTROL_APROBADORES_PRIMARIOS } from './technicalDocument.model.js';
import { validateBeforeApproval } from './technicalDocument.validation.js';

const asArr = (x) => (Array.isArray(x) ? x : []);

const normActor = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function isAuthorizedDocumentController(actor) {
  const raw = normActor(actor);
  if (!raw) return false;
  const first = raw.split(/\s+/)[0] || raw;
  return DOC_CONTROL_APROBADORES_PRIMARIOS.some((p) => first === normActor(p) || raw.includes(normActor(p)));
}

const nextAudId = (hist) => {
  const n = asArr(hist).reduce((max, h) => {
    const m = String(h?.id || '').match(/^AUD-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `AUD-${String(n + 1).padStart(4, '0')}`;
};

const nextRevComId = (list) => {
  const n = asArr(list).reduce((max, h) => {
    const m = String(h?.id || '').match(/^REV-(\d+)$/i);
    const v = m ? Number.parseInt(m[1], 10) : 0;
    return Number.isFinite(v) ? Math.max(max, v) : max;
  }, 0);
  return `REV-${String(n + 1).padStart(4, '0')}`;
};

function buildSnapshot(doc) {
  const d = doc || {};
  return {
    id: d.id,
    estadoDocumento: d.estadoDocumento,
    cliente: d.cliente,
    tituloDocumento: d.tituloDocumento,
    resumenEjecutivo: String(d.resumenEjecutivo || '').slice(0, 2000),
    trabajosRealizados: String(d.trabajosRealizados || '').slice(0, 4000),
    observacionesTecnicas: String(d.observacionesTecnicas || '').slice(0, 4000),
    recomendaciones: String(d.recomendaciones || '').slice(0, 2000),
    alertasIngesta: asArr(d.alertasIngesta).slice(0, 30),
    hallazgosCriticos: asArr(d.hallazgosCriticos).slice(0, 20),
    otId: d.otId,
    fechaServicio: d.fechaServicio,
  };
}

function appendHistorial(cur, accion, actor, comentario, estadoAntes, estadoDespues) {
  const now = new Date().toISOString();
  const row = {
    id: nextAudId(cur.historialDocumental),
    accion,
    actor: String(actor || 'sistema').slice(0, 80),
    fecha: now,
    comentario: String(comentario || '').trim(),
    estadoAntes,
    estadoDespues,
  };
  return { row, now, list: [...asArr(cur.historialDocumental), row] };
}

export async function workflowRevisar(id, body, actor) {
  const cur = await technicalDocumentRepository.findById(String(id || '').trim());
  if (!cur) return { error: 'Documento no encontrado.' };
  const comentario = String(body?.comentario ?? '').trim();
  const st = cur.estadoDocumento;

  if (st === 'borrador' || st === 'observado') {
    const { list, now } = appendHistorial(
      cur,
      DOC_CONTROL_ACCIONES.REVISAR,
      actor,
      comentario,
      st,
      'en_revision'
    );
    const ver = (Number(cur.version) || 1) + 1;
    const snaps = [
      ...asArr(cur.documentSnapshots),
      { version: ver, at: now, actor, accion: DOC_CONTROL_ACCIONES.REVISAR, snapshot: buildSnapshot(cur) },
    ];
    const patch = {
      estadoDocumento: 'en_revision',
      estado: 'en_revision',
      historialDocumental: list,
      documentSnapshots: snaps,
      version: ver,
      revisadoPor: String(actor).slice(0, 80),
      fechaRevision: now,
      enviadoRevisionPor: cur.enviadoRevisionPor || String(actor).slice(0, 80),
      enviadoRevisionEn: cur.enviadoRevisionEn || now,
      versionNota: comentario || 'Paso a revisión formal',
    };
    const row = await technicalDocumentRepository.update(cur.id, patch, actor);
    return { entry: row };
  }

  if (st === 'en_revision') {
    const { list, now } = appendHistorial(
      cur,
      DOC_CONTROL_ACCIONES.REVISAR,
      actor,
      comentario,
      st,
      st
    );
    const patch = {
      historialDocumental: list,
      revisadoPor: String(actor).slice(0, 80),
      fechaRevision: now,
      versionNota: comentario || 'Nota de revisión',
    };
    const row = await technicalDocumentRepository.update(cur.id, patch, actor);
    return { entry: row };
  }

  return { error: `No se puede revisar desde estado "${st}".` };
}

export async function workflowObservar(id, body, actor) {
  if (!isAuthorizedDocumentController(actor)) {
    return { error: 'Usuario no autorizado para observar documentos.' };
  }
  const cur = await technicalDocumentRepository.findById(String(id || '').trim());
  if (!cur) return { error: 'Documento no encontrado.' };
  if (cur.estadoDocumento !== 'en_revision') {
    return { error: 'Solo documentos en revisión pueden pasar a observado.' };
  }
  const comentario = String(body?.comentario ?? '').trim();
  const { list, now } = appendHistorial(
    cur,
    DOC_CONTROL_ACCIONES.OBSERVAR,
    actor,
    comentario,
    cur.estadoDocumento,
    'observado'
  );
  const ver = (Number(cur.version) || 1) + 1;
  const snaps = [
    ...asArr(cur.documentSnapshots),
    { version: ver, at: now, actor, accion: DOC_CONTROL_ACCIONES.OBSERVAR, snapshot: buildSnapshot(cur) },
  ];
  let comentariosRevision = [...asArr(cur.comentariosRevision)];
  if (comentario) {
    comentariosRevision.push({
      id: nextRevComId(comentariosRevision),
      actor: String(actor).slice(0, 80),
      fecha: now,
      texto: comentario,
      accion: 'observar',
    });
  }
  const patch = {
    estadoDocumento: 'observado',
    estado: 'observado',
    historialDocumental: list,
    documentSnapshots: snaps,
    version: ver,
    observadoPor: String(actor).slice(0, 80),
    observadoEn: now,
    comentariosRevision,
    versionNota: comentario || 'Observación formal',
  };
  const row = await technicalDocumentRepository.update(cur.id, patch, actor);
  return { entry: row };
}

export async function workflowAprobar(id, body, actor) {
  if (!isAuthorizedDocumentController(actor)) {
    return { error: 'Usuario no autorizado para aprobar documentos.' };
  }
  const cur = await technicalDocumentRepository.findById(String(id || '').trim());
  if (!cur) return { error: 'Documento no encontrado.' };
  if (cur.estadoDocumento !== 'en_revision') {
    return { error: 'Solo documentos en revisión pueden aprobarse (observado debe reingresar a revisión).' };
  }

  let ot = null;
  if (String(cur.otId || '').trim()) {
    const ots = await otRepository.findAll();
    ot = ots.find((o) => o.id === cur.otId) || null;
  }

  const val = validateBeforeApproval(cur, {
    comentarioMitigacion: body?.comentarioMitigacion ?? body?.comentario,
    comentario: body?.comentario,
    ot,
  });
  if (!val.ok) {
    return { error: val.errors.join(' '), validationErrors: val.errors };
  }

  const comentario = String(body?.comentario ?? '').trim();
  const { list, now } = appendHistorial(
    cur,
    DOC_CONTROL_ACCIONES.APROBAR,
    actor,
    comentario,
    cur.estadoDocumento,
    'aprobado'
  );
  const ver = (Number(cur.version) || 1) + 1;
  const snaps = [
    ...asArr(cur.documentSnapshots),
    { version: ver, at: now, actor, accion: DOC_CONTROL_ACCIONES.APROBAR, snapshot: buildSnapshot(cur) },
  ];
  const patch = {
    estadoDocumento: 'aprobado',
    estado: 'aprobado',
    historialDocumental: list,
    documentSnapshots: snaps,
    version: ver,
    aprobadoPor: String(actor).slice(0, 80),
    aprobadoEn: now,
    fechaAprobacion: now,
    versionNota: comentario || 'Aprobado',
  };
  const row = await technicalDocumentRepository.update(cur.id, patch, actor);
  try {
    await syncCommercialOpportunitiesOnApproval(row, actor);
  } catch (e) {
    console.error('[HNF] commercial opportunities on approval:', e?.message || e);
  }
  return { entry: row };
}

export async function workflowEnviar(id, body, actor) {
  if (!isAuthorizedDocumentController(actor)) {
    return { error: 'Usuario no autorizado para marcar envío a cliente.' };
  }
  const cur = await technicalDocumentRepository.findById(String(id || '').trim());
  if (!cur) return { error: 'Documento no encontrado.' };
  if (cur.estadoDocumento !== 'aprobado') {
    return { error: 'Solo documentos aprobados pueden enviarse al cliente.' };
  }
  const comentario = String(body?.comentario ?? '').trim();
  const { list, now } = appendHistorial(
    cur,
    DOC_CONTROL_ACCIONES.ENVIAR,
    actor,
    comentario,
    cur.estadoDocumento,
    'enviado'
  );
  const ver = (Number(cur.version) || 1) + 1;
  const snaps = [
    ...asArr(cur.documentSnapshots),
    { version: ver, at: now, actor, accion: DOC_CONTROL_ACCIONES.ENVIAR, snapshot: buildSnapshot(cur) },
  ];
  const patch = {
    estadoDocumento: 'enviado',
    estado: 'enviado',
    historialDocumental: list,
    documentSnapshots: snaps,
    version: ver,
    enviadoClientePor: String(actor).slice(0, 80),
    enviadoClienteEn: now,
    fechaEnvio: now,
    versionNota: comentario || 'Enviado al cliente',
  };
  const row = await technicalDocumentRepository.update(cur.id, patch, actor);
  return { entry: row };
}

import {
  normalizeAprobacionLynEstado,
  otEnAmbitoLynAprobacion,
  resolverTransicionLyn,
} from '../domain/ot-lyn-aprobacion.engine.js';
import { otRepository } from '../repositories/ot.repository.js';
import { auditService } from './audit.service.js';
import { normalizeOtEstadoStored } from '../utils/otEstado.js';

const MAX_COLA = 500;

function toRow(ot) {
  const h = Array.isArray(ot.lynAprobacionHistorial) ? ot.lynAprobacionHistorial : [];
  const last = h.length ? h[h.length - 1] : null;
  const tipo = String(ot.tipoServicio || '').toLowerCase();
  const sucursalOPatente =
    tipo === 'flota'
      ? String(ot.vehiculoRelacionado || ot.subtipoServicio || '').trim() || 'sin dato'
      : String(ot.tiendaNombre || ot.direccion || ot.comuna || '').trim() || 'sin dato';
  const informePendiente = !String(ot.pdfUrl || '').trim() && !String(ot.pdfName || '').trim();

  return {
    id: ot.id,
    cliente: String(ot.cliente || '').trim() || 'sin dato',
    tipoServicio: tipo || 'sin dato',
    sucursalOPatente,
    fechaSolicitud: ot.creadoEn || ot.createdAt || null,
    fechaEjecucion: ot.fecha || null,
    responsable: String(ot.responsableActual || ot.tecnicoAsignado || '').trim() || 'sin dato',
    estadoOt: ot.estado,
    aprobacionLynEstado: ot.aprobacionLynEstado ?? null,
    listoEnviarCliente: Boolean(ot.listoEnviarCliente),
    ultimoComentarioLyn: last?.comentario ? String(last.comentario).slice(0, 500) : '',
    informePendiente,
    pdfName: ot.pdfName || null,
    pdfUrl: ot.pdfUrl || null,
  };
}

export async function listColaLyn({ filtro } = {}) {
  const all = await otRepository.findAll();
  const f = String(filtro || 'todas').toLowerCase();
  const rows = [];

  for (const ot of all) {
    if (!otEnAmbitoLynAprobacion(ot)) continue;
    const ap = normalizeAprobacionLynEstado(ot.aprobacionLynEstado);
    if (!ap) continue;
    const cerrada = normalizeOtEstadoStored(ot.estado) === 'cerrada';

    if (f === 'pendientes' && ap !== 'pendiente_revision_lyn') continue;
    if (f === 'observados' && ap !== 'observado_lyn') continue;
    if (f === 'aprobados' && ap !== 'aprobado_lyn') continue;
    if (f === 'devueltos' && ap !== 'devuelto_operaciones') continue;
    if (f === 'rechazados' && ap !== 'rechazado_lyn') continue;
    if (f === 'informes_pendientes') {
      if (ap !== 'pendiente_revision_lyn') continue;
      const sinPdf = !String(ot.pdfUrl || '').trim() && !String(ot.pdfName || '').trim();
      if (!sinPdf) continue;
    }
    if (f === 'activas_lyn') {
      if (!['pendiente_revision_lyn', 'observado_lyn', 'devuelto_operaciones'].includes(ap)) continue;
    }

    rows.push({ ot, row: toRow(ot), cerrada });
  }

  rows.sort((a, b) => {
    const ta = new Date(a.row.fechaSolicitud || 0).getTime();
    const tb = new Date(b.row.fechaSolicitud || 0).getTime();
    return tb - ta;
  });

  return rows.slice(0, MAX_COLA).map((x) => x.row);
}

export async function aplicarAccionLyn(otId, body, actorLabel) {
  const actor = String(actorLabel || 'sistema').slice(0, 120);
  const accion = String(body?.accion || '').toLowerCase().trim();
  const comentario = String(body?.comentario ?? '').trim().slice(0, 2000);

  const ot = await otRepository.findById(otId);
  if (!ot) return { error: 'OT no encontrada.' };
  if (!otEnAmbitoLynAprobacion(ot)) {
    return { error: 'Esta OT no aplica a revisión Lyn (solo Clima / Flota).' };
  }

  const estadoLyn = normalizeAprobacionLynEstado(ot.aprobacionLynEstado);
  if (!estadoLyn) {
    return { error: 'La OT no tiene estado de aprobación Lyn (debe estar cerrada y en cola).' };
  }

  const cerrada = normalizeOtEstadoStored(ot.estado) === 'cerrada';
  if (!cerrada && accion !== 'comentar') {
    return {
      error:
        'Solo se pueden ejecutar aprobar / observar / devolver / rechazar con la OT cerrada. Mientras está abierta, usá «comentar» si necesitás dejar nota.',
    };
  }

  const res = resolverTransicionLyn(estadoLyn, accion);
  if (!res.ok) return { error: res.error };

  if (!res.soloComentario && !comentario && ['observar', 'devolver', 'rechazar'].includes(accion)) {
    return { error: 'Comentario obligatorio para observar, devolver o rechazar.' };
  }

  const estadoAnterior = estadoLyn;
  const nuevoEstado = res.soloComentario ? estadoLyn : res.nuevoEstado;
  const listo = res.soloComentario ? Boolean(ot.listoEnviarCliente) : (res.listoEnviarCliente ?? false);

  const entradaHistorial = {
    at: new Date().toISOString(),
    actor,
    accion: `lyn_${accion}`,
    comentario,
    estadoAnterior,
    estadoNuevo: nuevoEstado,
  };

  let updated = await otRepository.applyLynAprobacion(
    otId,
    {
      nuevoEstado: res.soloComentario ? undefined : nuevoEstado,
      listoEnviarCliente: res.soloComentario ? undefined : listo,
      entradaHistorial,
    },
    actor
  );

  if (res.reabrirEnProceso && updated) {
    updated = await otRepository.updateStatus(otId, 'en_proceso', actor);
  }

  if (!updated) return { error: 'No se pudo actualizar la OT.' };

  await auditService.logCritical({
    actor,
    action: `lyn.ot.${accion}`,
    resource: 'ot',
    resourceId: String(otId),
    meta: {
      estadoAnterior,
      estadoNuevo: nuevoEstado,
      comentario: comentario ? comentario.slice(0, 400) : null,
    },
    result: 'ok',
  });

  return { ot: updated };
}

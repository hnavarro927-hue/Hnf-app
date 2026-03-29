/**
 * Acciones operativas desde bandeja Base Maestra: OT desde documento, asignación, estado operativo.
 */

import { normalizeDestinoModulo } from '../domain/maestro-document-destino.engine.js';
import { hnfExtendedClientRepository } from '../repositories/hnfExtendedClient.repository.js';
import { maestroContactoRepository } from '../repositories/maestroContacto.repository.js';
import { maestroDocumentoRepository } from '../repositories/maestroDocumento.repository.js';
import { otRepository } from '../repositories/ot.repository.js';
import { otService } from './ot.service.js';

const ESTADOS_OP = ['pendiente', 'en_proceso', 'gestionado', 'cerrado'];
const RESPONSABLES = ['romina', 'gery', 'lyn'];

function intakePrimeraGestionPatch(doc) {
  if (!doc?.intake_fecha_ingreso || doc.intake_fecha_primera_gestion) return {};
  return { intake_fecha_primera_gestion: new Date().toISOString() };
}

function appendHistorialRevision(cur, tipo, detalle, usuario) {
  const h = Array.isArray(cur?.historial_revision) ? [...cur.historial_revision] : [];
  h.push({
    at: new Date().toISOString(),
    tipo,
    detalle: String(detalle || '').slice(0, 2000),
    usuario: usuario || null,
  });
  return h.length > 250 ? h.slice(-250) : h;
}

function subtipoPorTipoServicio(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'flota') return 'Revisión / seguimiento flota';
  if (t === 'comercial') return 'Visita / gestión comercial';
  if (t === 'administrativo') return 'Gestión administrativa';
  return 'Visita técnica clima';
}

async function resolverContextoDesdeDocumento(doc) {
  const datos = doc.datos_detectados && typeof doc.datos_detectados === 'object' ? doc.datos_detectados : {};
  const telDatos = Array.isArray(datos.telefonos) && datos.telefonos.length ? String(datos.telefonos[0]).trim() : '';

  let clienteNombre = '';
  let direccion = '';
  let comuna = '';
  let telCliente = '';

  let clienteRelacionado = doc.cliente_id ? String(doc.cliente_id).trim() : null;
  if (doc.cliente_id) {
    const c = await hnfExtendedClientRepository.findById(doc.cliente_id);
    if (c) {
      clienteNombre = String(c.nombre || c.nombre_cliente || '').trim();
      direccion = String(c.direccion || c.direccion_fiscal || '').trim();
      comuna = String(c.comuna || '').trim();
      telCliente = String(c.telefono || c.telefono_principal || '').trim();
    } else if (!clienteNombre) {
      clienteNombre = `Cliente (${doc.cliente_id})`;
    }
  }
  if (!clienteNombre && doc.cliente_probable?.nombre) {
    clienteNombre = String(doc.cliente_probable.nombre).trim();
  }
  if (!clienteNombre && datos.nombre_cliente_inferido) {
    clienteNombre = String(datos.nombre_cliente_inferido).trim();
  }

  let contactoNombre = '';
  let telContacto = '';
  if (doc.contacto_id) {
    const co = await maestroContactoRepository.findById(doc.contacto_id);
    if (co) {
      contactoNombre = String(co.nombre_contacto || '').trim();
      telContacto = String(co.telefono || co.whatsapp || '').trim();
    }
  }
  if (!contactoNombre && doc.contacto_probable?.nombre) {
    contactoNombre = String(doc.contacto_probable.nombre).trim();
  }
  if (!contactoNombre) contactoNombre = clienteNombre || 'Contacto a confirmar';

  const telefonoContacto = [telContacto, telCliente, telDatos].find((x) => String(x || '').trim()) || '000000000';

  if (!direccion) direccion = 'A confirmar (desde documento Base Maestra)';
  if (!comuna) comuna = 'A confirmar';

  const vehiculoRelacionado = doc.vehiculo_id ? String(doc.vehiculo_id).trim() : null;
  if (vehiculoRelacionado && !vehiculoRelacionado.startsWith('VEH')) {
    /* allow raw id */
  }

  const payloadCliente = clienteNombre || null;

  return {
    payloadCliente,
    clienteRelacionado,
    vehiculoRelacionado,
    direccion,
    comuna,
    contactoTerreno: contactoNombre,
    telefonoContacto,
  };
}

export const hnfOperativoBandejaService = {
  async crearOtDesdeDocumento(documentoId, actor = 'sistema') {
    const id = String(documentoId || '').trim();
    if (!id) return { errors: ['documento_id obligatorio'] };

    const doc = await maestroDocumentoRepository.findById(id);
    if (!doc) return { error: 'Documento no encontrado' };

    if (doc.ot_id_vinculada) {
      return {
        errors: [`El documento ya tiene OT vinculada: ${doc.ot_id_vinculada}`],
        ot_id: doc.ot_id_vinculada,
      };
    }

    const ctx = await resolverContextoDesdeDocumento(doc);
    if (!ctx.payloadCliente && !ctx.clienteRelacionado) {
      return {
        errors: [
          'No hay cliente para la OT: vinculá o aprobá cliente_id, o asegurá nombre detectado en el documento.',
        ],
      };
    }

    const tipoServicio = normalizeDestinoModulo(doc.destino_final || doc.modulo_destino_sugerido);
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const obsLines = [
      `OT generada desde documento Base Maestra ${doc.id}.`,
      `Archivo: ${doc.nombre_archivo || '—'}`,
      doc.resumen_jarvis ? `Resumen Jarvis: ${String(doc.resumen_jarvis).slice(0, 500)}` : '',
    ].filter(Boolean);

    const otPayload = {
      cliente: ctx.payloadCliente,
      clienteRelacionado: ctx.clienteRelacionado,
      vehiculoRelacionado: ctx.vehiculoRelacionado,
      direccion: ctx.direccion,
      comuna: ctx.comuna,
      contactoTerreno: ctx.contactoTerreno,
      telefonoContacto: ctx.telefonoContacto,
      tipoServicio,
      subtipoServicio: subtipoPorTipoServicio(tipoServicio),
      origenSolicitud: 'interno',
      origenPedido: 'documento_maestro',
      prioridadOperativa: 'media',
      fecha,
      hora,
      observaciones: obsLines.join('\n'),
      operationMode: 'manual',
    };

    const created = await otService.create(otPayload, actor);
    if (created.errors) return { errors: created.errors };

    const otLinked = await otRepository.patchEstadoOperativoYDocumentoOrigen(
      created.id,
      { estadoOperativo: 'en_proceso', maestroDocumentoOrigenId: doc.id },
      actor
    );

    const historial_revision = appendHistorialRevision(
      doc,
      'ot_creada_desde_documento',
      JSON.stringify({ ot_id: created.id, actor }).slice(0, 1950),
      actor
    );

    const updatedDoc = await maestroDocumentoRepository.update(
      id,
      {
        ot_id_vinculada: created.id,
        estado_operativo: 'en_proceso',
        historial_revision,
        ...intakePrimeraGestionPatch(doc),
      },
      actor
    );

    return {
      ok: true,
      ot: otLinked || created,
      documento: updatedDoc,
    };
  },

  async asignarResponsableDocumento(body, actor = 'sistema') {
    const documento_id = String(body?.documento_id || '').trim();
    const responsable = String(body?.responsable || '').toLowerCase().trim();
    if (!documento_id) return { errors: ['documento_id obligatorio'] };
    if (!RESPONSABLES.includes(responsable)) {
      return { errors: ['responsable debe ser romina|gery|lyn'] };
    }

    const doc = await maestroDocumentoRepository.findById(documento_id);
    if (!doc) return { error: 'Documento no encontrado' };

    const historial_revision = appendHistorialRevision(
      doc,
      'asignacion_responsable_bandeja',
      JSON.stringify({ responsable, actor }).slice(0, 1950),
      actor
    );

    const patch = {
      responsable_asignado: responsable,
      historial_revision,
      ...intakePrimeraGestionPatch(doc),
    };
    const eo = String(doc.estado_operativo || 'pendiente').toLowerCase();
    if (eo === 'pendiente') patch.estado_operativo = 'en_proceso';

    const updated = await maestroDocumentoRepository.update(documento_id, patch, actor);
    return { ok: true, documento: updated };
  },

  async marcarEstadoOperativoDocumento(documentoId, estado_operativo, actor = 'sistema') {
    const id = String(documentoId || '').trim();
    const eo = String(estado_operativo || '').toLowerCase().trim();
    if (!id) return { errors: ['documento_id obligatorio'] };
    if (!ESTADOS_OP.includes(eo)) {
      return { errors: [`estado_operativo debe ser ${ESTADOS_OP.join('|')}`] };
    }

    const doc = await maestroDocumentoRepository.findById(id);
    if (!doc) return { error: 'Documento no encontrado' };

    const historial_revision = appendHistorialRevision(
      doc,
      'estado_operativo_bandeja',
      JSON.stringify({ estado_operativo: eo, actor }).slice(0, 1950),
      actor
    );

    const patchDoc = { estado_operativo: eo, historial_revision };
    if (eo === 'en_proceso' || eo === 'gestionado') {
      Object.assign(patchDoc, intakePrimeraGestionPatch(doc));
    }

    const updated = await maestroDocumentoRepository.update(id, patchDoc, actor);

    if (doc.ot_id_vinculada) {
      await otRepository.patchEstadoOperativoYDocumentoOrigen(
        doc.ot_id_vinculada,
        { estadoOperativo: eo },
        actor
      );
    }

    return { ok: true, documento: updated };
  },
};

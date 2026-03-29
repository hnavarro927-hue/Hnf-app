import { computeDestinoFieldsForDocument } from '../domain/maestro-document-destino.engine.js';
import { commercialLeadModel } from '../models/commercialLead.model.js';
import { commercialLeadRepository } from '../repositories/commercialLead.repository.js';
import { otService } from './ot.service.js';

const normEstado = (e) => {
  const s = String(e || '').toLowerCase().trim();
  return commercialLeadModel.estados.includes(s) ? s : null;
};

const inferOrigenFromDoc = (doc) => {
  const c = String(doc?.intake_canal || '').toLowerCase().trim();
  if (c === 'whatsapp') return 'whatsapp';
  if (c === 'correo') return 'correo';
  return 'manual';
};

const inferTipoServicioFromDoc = (doc) => {
  const t = String(doc?.tipo_solicitud_inferida || '').toLowerCase();
  if (t.includes('flota')) return 'flota';
  return 'clima';
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

const normalizeCreateBody = (body) => {
  const nombreContacto = String(body?.nombreContacto ?? body?.nombre_contacto ?? '').trim().slice(0, 200);
  const empresa = String(body?.empresa ?? '').trim().slice(0, 200);
  const telefono = String(body?.telefono ?? '').trim().slice(0, 80);
  const email = String(body?.email ?? '').trim().slice(0, 200);
  let origen = String(body?.origen ?? 'manual').toLowerCase().trim();
  if (!commercialLeadModel.origenes.includes(origen)) origen = 'manual';
  let tipoServicio = String(body?.tipoServicio ?? body?.tipo_servicio ?? 'clima').toLowerCase().trim();
  if (!commercialLeadModel.tiposServicio.includes(tipoServicio)) tipoServicio = 'clima';
  let estado = normEstado(body?.estado) || 'nuevo';
  const notas = String(body?.notas ?? '').trim().slice(0, 8000);
  const errores = [];
  if (!nombreContacto) errores.push('nombreContacto es obligatorio');
  if (!empresa) errores.push('empresa es obligatoria');
  return {
    ok: !errores.length,
    errors: errores,
    row: { nombreContacto, empresa, telefono, email, origen, tipoServicio, estado, notas },
  };
};

export const commercialLeadService = {
  async list() {
    const list = await commercialLeadRepository.findAll();
    return [...list].sort((a, b) =>
      String(b.fechaCreacion || b.createdAt || '').localeCompare(String(a.fechaCreacion || a.createdAt || ''))
    );
  },

  async getById(id) {
    return commercialLeadRepository.findById(String(id || '').trim());
  },

  async createManual(body, actor) {
    const n = normalizeCreateBody(body || {});
    if (!n.ok) return { errors: n.errors };
    const now = new Date().toISOString();
    const row = await commercialLeadRepository.create(
      {
        ...n.row,
        fechaCreacion: now,
        ultimaInteraccion: now,
        interacciones: [],
        maestroDocumentoOrigenId: null,
        otId: null,
      },
      actor
    );
    return { lead: row };
  },

  async patch(id, body, actor) {
    const cur = await commercialLeadRepository.findById(String(id || '').trim());
    if (!cur) return { error: 'Lead no encontrado' };
    const patch = {};
    if (body.nombreContacto != null) patch.nombreContacto = String(body.nombreContacto).trim().slice(0, 200);
    if (body.nombre_contacto != null) patch.nombreContacto = String(body.nombre_contacto).trim().slice(0, 200);
    if (body.empresa != null) patch.empresa = String(body.empresa).trim().slice(0, 200);
    if (body.telefono != null) patch.telefono = String(body.telefono).trim().slice(0, 80);
    if (body.email != null) patch.email = String(body.email).trim().slice(0, 200);
    if (body.origen != null) {
      const o = String(body.origen).toLowerCase().trim();
      if (commercialLeadModel.origenes.includes(o)) patch.origen = o;
    }
    if (body.tipoServicio != null || body.tipo_servicio != null) {
      const t = String(body.tipoServicio ?? body.tipo_servicio).toLowerCase().trim();
      if (commercialLeadModel.tiposServicio.includes(t)) patch.tipoServicio = t;
    }
    if (body.estado != null) {
      const e = normEstado(body.estado);
      if (e) patch.estado = e;
    }
    if (body.notas != null) patch.notas = String(body.notas).trim().slice(0, 8000);
    if (Object.keys(patch).length === 0) return { lead: cur };
    const updated = await commercialLeadRepository.update(cur.id, patch, actor, 'Edición lead');
    return { lead: updated };
  },

  async registrarInteraccion(id, body, actor) {
    const cur = await commercialLeadRepository.findById(String(id || '').trim());
    if (!cur) return { error: 'Lead no encontrado' };
    const nota = String(body?.nota ?? body?.notas ?? '').trim().slice(0, 4000);
    if (!nota) return { errors: ['nota obligatoria'] };
    const tipo = String(body?.tipo || 'nota').trim().slice(0, 64);
    const now = new Date().toISOString();
    const entry = { at: now, tipo, nota, actor: String(actor || 'sistema').slice(0, 120) };
    const interacciones = Array.isArray(cur.interacciones) ? [...cur.interacciones, entry] : [entry];
    const updated = await commercialLeadRepository.update(
      cur.id,
      { interacciones, ultimaInteraccion: now },
      actor,
      `Interacción: ${tipo}`
    );
    return { lead: updated };
  },

  async convertirAOt(id, actor) {
    const lead = await commercialLeadRepository.findById(String(id || '').trim());
    if (!lead) return { error: 'Lead no encontrado' };
    if (lead.otId) return { errors: ['Este lead ya tiene OT asociada'] };
    const tel = String(lead.telefono || '').trim() || '0';
    const waDigits = tel.replace(/\D/g, '');
    const origen =
      lead.origen === 'whatsapp' && waDigits.length >= 8
        ? 'whatsapp'
        : lead.origen === 'correo'
          ? 'email'
          : 'cliente_directo';
    const obs = [
      lead.notas ? `Notas lead:\n${lead.notas}` : '',
      `Origen CRM: ${lead.id}`,
      lead.maestroDocumentoOrigenId ? `Documento maestro: ${lead.maestroDocumentoOrigenId}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const otPayload = {
      cliente: lead.empresa || lead.nombreContacto,
      direccion: 'A confirmar con cliente',
      comuna: 'A confirmar',
      contactoTerreno: lead.nombreContacto,
      telefonoContacto: tel,
      tipoServicio: lead.tipoServicio,
      subtipoServicio: 'Alta desde CRM (lead)',
      fecha: todayYmd(),
      hora: '09:00',
      origenSolicitud: origen,
      prioridadOperativa: 'media',
      observaciones: obs.slice(0, 12000),
      whatsappContactoNumero: origen === 'whatsapp' ? waDigits : '',
      whatsappContactoNombre: origen === 'whatsapp' ? lead.nombreContacto.slice(0, 120) : '',
      maestroDocumentoOrigenId: lead.maestroDocumentoOrigenId || undefined,
    };

    const created = await otService.create(otPayload, actor);
    if (created?.errors) return { errors: created.errors };
    const now = new Date().toISOString();
    const updated = await commercialLeadRepository.update(
      lead.id,
      {
        estado: 'cerrado_ganado',
        otId: created.id,
        ultimaInteraccion: now,
        interacciones: [
          ...(Array.isArray(lead.interacciones) ? lead.interacciones : []),
          {
            at: now,
            tipo: 'conversion_ot',
            nota: `OT creada: ${created.id}`,
            actor: String(actor || 'sistema').slice(0, 120),
          },
        ],
      },
      actor,
      `Convertido a OT ${created.id}`
    );
    return { lead: updated, ot: created };
  },

  /**
   * Tras aprobar documento Base Maestra: si el destino efectivo es comercial (no operativo clima/flota/admin),
   * genera un lead para seguimiento Lyn / comercial.
   */
  async createFromMaestroDocumentIfComercial(doc, actor) {
    if (!doc?.id) return { skipped: true, reason: 'sin_id' };
    const { destino_final } = computeDestinoFieldsForDocument(doc);
    const dest = String(destino_final || '').toLowerCase().trim();
    if (dest !== 'comercial') return { skipped: true, reason: 'destino_no_comercial' };

    const existing = await commercialLeadRepository.findByMaestroDocumentoId(doc.id);
    if (existing) return { skipped: true, reason: 'ya_existe', lead: existing };

    const datos = doc.datos_detectados && typeof doc.datos_detectados === 'object' ? doc.datos_detectados : {};
    const nombreContacto = String(
      datos.nombre_contacto_inferido ||
        doc.contacto_probable?.nombre ||
        doc.intake_origen ||
        'Contacto'
    )
      .trim()
      .slice(0, 200);
    const empresa = String(
      datos.nombre_cliente_inferido || doc.cliente_probable?.nombre || 'Empresa a confirmar'
    )
      .trim()
      .slice(0, 200);
    const telefono = String(datos.telefonos?.[0] || '').trim().slice(0, 80);
    const email = String(datos.emails?.[0] || '').trim().slice(0, 200);
    const origen = inferOrigenFromDoc(doc);
    const tipoServicio = inferTipoServicioFromDoc(doc);
    const now = new Date().toISOString();
    const notas = [
      doc.resumen_jarvis ? `Resumen Jarvis: ${doc.resumen_jarvis}` : '',
      doc.mensaje_original ? `Mensaje: ${String(doc.mensaje_original).slice(0, 1500)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000);

    const row = await commercialLeadRepository.create(
      {
        nombreContacto: nombreContacto || 'Contacto',
        empresa: empresa || 'Empresa a confirmar',
        telefono,
        email,
        origen,
        tipoServicio,
        estado: 'nuevo',
        fechaCreacion: now,
        ultimaInteraccion: now,
        notas,
        interacciones: [
          {
            at: now,
            tipo: 'auto_jarvis',
            nota: `Lead generado desde documento ${doc.id} (destino comercial, post-aprobación).`,
            actor: String(actor || 'sistema').slice(0, 120),
          },
        ],
        maestroDocumentoOrigenId: doc.id,
        otId: null,
      },
      actor
    );
    return { skipped: false, lead: row };
  },
};

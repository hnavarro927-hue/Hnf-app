import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDocumentBuffer } from '../domain/jarvis-document-intake.engine.js';
import {
  normalizePatenteChile,
  normalizePhoneChile,
  resolveRelationalLinks,
} from '../domain/jarvis-relational-intake.engine.js';
import { hnfExtendedClientRepository } from '../repositories/hnfExtendedClient.repository.js';
import { hnfInternalDirectoryRepository } from '../repositories/hnfInternalDirectory.repository.js';
import { maestroConductorRepository } from '../repositories/maestroConductor.repository.js';
import { maestroContactoRepository } from '../repositories/maestroContacto.repository.js';
import { maestroDocumentoRepository } from '../repositories/maestroDocumento.repository.js';
import { maestroTecnicoRepository } from '../repositories/maestroTecnico.repository.js';
import { maestroVehiculoRepository } from '../repositories/maestroVehiculo.repository.js';
import { hnfOperativoIntegradoService } from './hnfOperativoIntegrado.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../../data');
const UPLOAD_REL = path.join('uploads', 'maestro');

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 15;

const safeName = (n) =>
  String(n || 'archivo')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160) || 'archivo';

/** Contexto Jarvis: clasificación en texto + resolución relacional (cliente/contacto/vehículo/técnico). */
async function buildMaestroJarvisContext() {
  const [clientesRaw, contactosRaw, personal, vehiculos, tecnicos] = await Promise.all([
    hnfExtendedClientRepository.findAll(),
    maestroContactoRepository.findAll(),
    hnfInternalDirectoryRepository.findAll(),
    maestroVehiculoRepository.findAll(),
    maestroTecnicoRepository.findAll(),
  ]);
  const clientes = clientesRaw.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    nombre_cliente: c.nombre || c.nombre_cliente,
    rut: c.rut,
    correo: c.correo || c.correo_principal,
    telefono: c.telefono || c.telefono_principal,
  }));
  const contactos = contactosRaw.map((c) => ({
    id: c.id,
    nombre_contacto: c.nombre_contacto,
    correo: c.correo,
    telefono: c.telefono,
    whatsapp: c.whatsapp,
    cliente_id: c.cliente_id,
  }));
  return {
    clientes,
    contactos,
    personal: personal.map((p) => ({ id: p.id, nombreCompleto: p.nombreCompleto, nombre: p.nombreCompleto })),
    vehiculos,
    tecnicos,
  };
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

/** Clasificación mínima desde fila persistida (sin releer archivo salvo opción explícita). */
function buildSyntheticClassifyFromStoredDoc(doc) {
  const datos =
    doc.datos_detectados && typeof doc.datos_detectados === 'object' ? { ...doc.datos_detectados } : {};
  const arr = (k) => {
    if (!Array.isArray(datos[k])) datos[k] = datos[k] != null && datos[k] !== '' ? [datos[k]] : [];
  };
  arr('ruts');
  arr('emails');
  arr('telefonos');
  arr('patentes');
  arr('ots');
  if (!datos.patentes?.length && doc.patente_probable) datos.patentes = [doc.patente_probable];
  if (!datos.ots?.length && doc.ot_probable) datos.ots = [doc.ot_probable];
  const fn = String(doc.nombre_archivo || '');
  const texto = `${fn}\n${doc.texto_match_sample || ''}\n${doc.resumen_jarvis || ''}`.slice(0, 50000);
  return {
    datos_detectados: datos,
    texto_match_sample: texto,
    resumen_breve: doc.resumen_jarvis || '',
    cliente_probable: doc.cliente_probable || null,
    contacto_probable: doc.contacto_probable || null,
    tecnico_probable: doc.tecnico_probable || null,
  };
}

/** Documentos candidatos a reparación (sin jarvis, sin versión o señales sin reflejar en bloques). */
function documentoNecesitaReparacionVinculos(doc) {
  const v = doc.jarvis_vinculacion;
  if (!v || typeof v !== 'object' || !v.version) return true;
  const datos = doc.datos_detectados || {};
  const hasRut = (datos.ruts && datos.ruts.length > 0) || false;
  const hasNom =
    String(datos.nombre_cliente_inferido || '').trim().length > 2 || !!doc.cliente_probable?.nombre;
  const hasMail = (datos.emails && datos.emails.length > 0) || false;
  const hasTel = (datos.telefonos && datos.telefonos.length > 0) || false;
  const hasPat =
    (datos.patentes && datos.patentes.length > 0) || !!String(doc.patente_probable || '').trim();
  if ((hasRut || hasNom) && (!v.cliente || v.cliente.estado === 'sin_datos')) return true;
  if ((hasMail || hasTel) && (!v.contacto || v.contacto.estado === 'sin_datos')) return true;
  if (hasPat && (!v.vehiculo || v.vehiculo.estado === 'sin_datos')) return true;
  return false;
}

/**
 * Aplica vínculos automáticos solo en FK vacíos; si ya hay FK no lo pisa.
 * Si Jarvis discrepa con un FK existente, marca revisión manual sugerida.
 */
function mergeRepairVinculosConservador(cur, vinc) {
  const before = {
    cliente_id: cur.cliente_id || null,
    contacto_id: cur.contacto_id || null,
    vehiculo_id: cur.vehiculo_id || null,
    tecnico_id: cur.tecnico_id || null,
    jarvis_vinculacion_version: cur.jarvis_vinculacion?.version || null,
  };

  const curC = String(cur.cliente_id || '').trim();
  const curCo = String(cur.contacto_id || '').trim();
  const curV = String(cur.vehiculo_id || '').trim();
  const curT = String(cur.tecnico_id || '').trim();

  let clienteBlock = vinc.cliente;
  if (curC) {
    const sug = vinc.autoClienteId;
    if (sug && sug !== curC) {
      clienteBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otra coincidencia — revisar.',
        vinculo_conservado_id: curC,
        sugerencia_jarvis: { ...vinc.cliente },
      };
    } else {
      clienteBlock = {
        ...vinc.cliente,
        estado: 'vinculado_manual',
        cliente_id: curC,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let contactoBlock = vinc.contacto;
  if (curCo) {
    const sug = vinc.autoContactoId;
    if (sug && sug !== curCo) {
      contactoBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro contacto — revisar.',
        vinculo_conservado_id: curCo,
        sugerencia_jarvis: { ...vinc.contacto },
      };
    } else {
      contactoBlock = {
        ...vinc.contacto,
        estado: 'vinculado_manual',
        contacto_id: curCo,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let vehBlock = vinc.vehiculo;
  if (curV) {
    const sug = vinc.autoVehiculoId;
    if (sug && sug !== curV) {
      vehBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro vehículo — revisar.',
        vinculo_conservado_id: curV,
        sugerencia_jarvis: { ...vinc.vehiculo },
      };
    } else {
      vehBlock = {
        ...vinc.vehiculo,
        estado: 'vinculado_manual',
        vehiculo_id: curV,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  let tecBlock = vinc.tecnico;
  if (curT) {
    const sug = vinc.autoTecnicoId;
    if (sug && sug !== curT) {
      tecBlock = {
        estado: 'revision_manual_sugerida',
        mensaje_ui: 'Vinculado manualmente; Jarvis sugiere otro técnico — revisar.',
        vinculo_conservado_id: curT,
        sugerencia_jarvis: { ...vinc.tecnico },
      };
    } else {
      tecBlock = {
        ...vinc.tecnico,
        estado: 'vinculado_manual',
        tecnico_id: curT,
        mensaje_ui: 'Vinculado (conservado; reparación histórica no modifica este ID).',
      };
    }
  }

  const nextFk = {
    cliente_id: curC || vinc.autoClienteId || null,
    contacto_id: curCo || vinc.autoContactoId || null,
    vehiculo_id: curV || vinc.autoVehiculoId || null,
    tecnico_id: curT || vinc.autoTecnicoId || null,
  };

  const jarvis_vinculacion = {
    ...vinc,
    cliente: clienteBlock,
    contacto: contactoBlock,
    vehiculo: vehBlock,
    tecnico: tecBlock,
  };

  const after = {
    cliente_id: nextFk.cliente_id,
    contacto_id: nextFk.contacto_id,
    vehiculo_id: nextFk.vehiculo_id,
    tecnico_id: nextFk.tecnico_id,
    jarvis_vinculacion_version: jarvis_vinculacion.version,
  };

  return { before, nextFk, jarvis_vinculacion, after };
}

async function createContactoWithChecks(body, actor) {
  const n = normContacto(body);
  if (!n.nombre_contacto) return { errors: ['nombre_contacto obligatorio'] };
  const all = await maestroContactoRepository.findAll();
  if (n.correo) {
    const em = n.correo.toLowerCase();
    if (all.some((c) => String(c.correo || '').toLowerCase() === em))
      return { errors: ['Ese correo ya está registrado en otro contacto'] };
  }
  const nt = n.telefono ? normalizePhoneChile(n.telefono) : '';
  const nw = n.whatsapp ? normalizePhoneChile(n.whatsapp) : '';
  const clash = all.some((c) => {
    if (nt.length >= 8 && (normalizePhoneChile(c.telefono) === nt || normalizePhoneChile(c.whatsapp) === nt))
      return true;
    if (nw.length >= 8 && (normalizePhoneChile(c.telefono) === nw || normalizePhoneChile(c.whatsapp) === nw))
      return true;
    return false;
  });
  if (clash) return { errors: ['Teléfono o WhatsApp ya registrado en otro contacto'] };
  return maestroContactoRepository.create(n, actor);
}

async function createVehiculoWithChecks(body, actor) {
  const n = normVehiculo(body);
  if (!n.patente) return { errors: ['patente obligatoria'] };
  const key = normalizePatenteChile(n.patente);
  const all = await maestroVehiculoRepository.findAll();
  if (all.some((v) => normalizePatenteChile(v.patente) === key))
    return { errors: ['Esa patente ya existe en el maestro de vehículos'] };
  return maestroVehiculoRepository.create(n, actor);
}

function normContacto(body, prev = {}) {
  return {
    nombre_contacto: String(body.nombre_contacto ?? prev.nombre_contacto ?? '').trim(),
    cargo: String(body.cargo ?? prev.cargo ?? '').trim(),
    cliente_id: String(body.cliente_id ?? prev.cliente_id ?? '').trim(),
    correo: String(body.correo ?? prev.correo ?? '').trim(),
    telefono: String(body.telefono ?? prev.telefono ?? '').trim(),
    whatsapp: String(body.whatsapp ?? prev.whatsapp ?? '').trim(),
    canal_preferido: String(body.canal_preferido ?? prev.canal_preferido ?? 'correo').toLowerCase(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
    activo: body.activo !== undefined ? Boolean(body.activo) : prev.activo !== false,
  };
}

function normTecnico(body, prev = {}) {
  return {
    persona_id: String(body.persona_id ?? prev.persona_id ?? '').trim(),
    especialidad: String(body.especialidad ?? prev.especialidad ?? '').trim(),
    zona: String(body.zona ?? prev.zona ?? '').trim(),
    disponibilidad: String(body.disponibilidad ?? prev.disponibilidad ?? 'disponible').trim(),
    habilidades: Array.isArray(body.habilidades)
      ? body.habilidades.map((x) => String(x).trim()).filter(Boolean)
      : prev.habilidades || [],
    certificaciones: Array.isArray(body.certificaciones)
      ? body.certificaciones.map((x) => String(x).trim()).filter(Boolean)
      : prev.certificaciones || [],
    documentos_asociados: Array.isArray(body.documentos_asociados)
      ? body.documentos_asociados
      : prev.documentos_asociados || [],
  };
}

function normConductor(body, prev = {}) {
  return {
    persona_id: String(body.persona_id ?? prev.persona_id ?? '').trim(),
    tipo_licencia: String(body.tipo_licencia ?? prev.tipo_licencia ?? '').trim(),
    vencimiento_licencia: String(body.vencimiento_licencia ?? prev.vencimiento_licencia ?? '').trim(),
    disponibilidad: String(body.disponibilidad ?? prev.disponibilidad ?? 'disponible').trim(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
  };
}

function normVehiculo(body, prev = {}) {
  return {
    patente: String(body.patente ?? prev.patente ?? '')
      .trim()
      .toUpperCase(),
    marca: String(body.marca ?? prev.marca ?? '').trim(),
    modelo: String(body.modelo ?? prev.modelo ?? '').trim(),
    ano: String(body.ano ?? prev.ano ?? '').trim(),
    tipo: String(body.tipo ?? prev.tipo ?? '').trim(),
    cliente_id: String(body.cliente_id ?? prev.cliente_id ?? '').trim(),
    responsable_actual: String(body.responsable_actual ?? prev.responsable_actual ?? '').trim(),
    kilometraje: String(body.kilometraje ?? prev.kilometraje ?? '').trim(),
    estado: String(body.estado ?? prev.estado ?? 'activo').trim(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
    documentos_asociados: Array.isArray(body.documentos_asociados)
      ? body.documentos_asociados
      : prev.documentos_asociados || [],
  };
}

const ESTADOS_DOC = [
  'borrador',
  'clasificado_jarvis',
  'pendiente_revision',
  'aprobado',
  'rechazado',
  'archivado',
];

export const maestroService = {
  /* —— Contactos —— */
  async listContactos() {
    const all = await maestroContactoRepository.findAll();
    return [...all].sort((a, b) => String(a.nombre_contacto).localeCompare(b.nombre_contacto));
  },
  async createContacto(body, actor) {
    return createContactoWithChecks(body, actor);
  },
  async patchContacto(id, body, actor) {
    const cur = await maestroContactoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroContactoRepository.update(id, normContacto(body, cur), actor);
  },

  /* —— Técnicos —— */
  async listTecnicos() {
    return maestroTecnicoRepository.findAll();
  },
  async createTecnico(body, actor) {
    const n = normTecnico(body);
    if (!n.persona_id) return { errors: ['persona_id obligatorio (persona del directorio interno)'] };
    return maestroTecnicoRepository.create(n, actor);
  },
  async patchTecnico(id, body, actor) {
    const cur = await maestroTecnicoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroTecnicoRepository.update(id, normTecnico(body, cur), actor);
  },

  /* —— Conductores —— */
  async listConductores() {
    return maestroConductorRepository.findAll();
  },
  async createConductor(body, actor) {
    const n = normConductor(body);
    if (!n.persona_id) return { errors: ['persona_id obligatorio'] };
    return maestroConductorRepository.create(n, actor);
  },
  async patchConductor(id, body, actor) {
    const cur = await maestroConductorRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroConductorRepository.update(id, normConductor(body, cur), actor);
  },

  /* —— Vehículos maestro —— */
  async listVehiculos() {
    return maestroVehiculoRepository.findAll();
  },
  async createVehiculo(body, actor) {
    return createVehiculoWithChecks(body, actor);
  },
  async patchVehiculo(id, body, actor) {
    const cur = await maestroVehiculoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    return maestroVehiculoRepository.update(id, normVehiculo(body, cur), actor);
  },

  /* —— Documentos —— */
  async listDocumentos() {
    const all = await maestroDocumentoRepository.findAll();
    return [...all].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  },
  async getDocumento(id) {
    return maestroDocumentoRepository.findById(id);
  },
  async getDocumentoAbsolutePath(doc) {
    if (!doc?.ruta_interna) return null;
    const abs = path.join(DATA_ROOT, doc.ruta_interna);
    return abs;
  },

  /**
   * Ingesta: base64 por archivo. Guarda en disco + fila pendiente de revisión (no escribe base maestra sola).
   */
  async ingestArchivosBase64(body, actor) {
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) return { errors: ['files[] vacío'] };
    if (files.length > MAX_FILES) return { errors: [`Máximo ${MAX_FILES} archivos por envío`] };

    const ctx = await buildMaestroJarvisContext();
    const creados = [];
    const uploadAbs = path.join(DATA_ROOT, UPLOAD_REL);
    await mkdir(uploadAbs, { recursive: true });

    for (const f of files) {
      const name = safeName(f.name || f.nombre_archivo);
      const mime = String(f.mimeType || f.tipo_archivo || 'application/octet-stream').slice(0, 120);
      const b64 = String(f.dataBase64 || f.base64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) {
        creados.push({ error: `Sin datos base64: ${name}` });
        continue;
      }
      let buffer;
      try {
        buffer = Buffer.from(b64, 'base64');
      } catch {
        creados.push({ error: `Base64 inválido: ${name}` });
        continue;
      }
      if (buffer.length > MAX_BYTES) {
        creados.push({ error: `Archivo demasiado grande: ${name}` });
        continue;
      }

      const hash = createHash('sha256').update(buffer).digest('hex');
      const fileRel = path.join(UPLOAD_REL, `${hash.slice(0, 16)}_${name}`).replace(/\\/g, '/');
      const abs = path.join(DATA_ROOT, fileRel);
      await writeFile(abs, buffer);

      const jarvis = classifyDocumentBuffer({ filename: name, mimeType: mime, buffer }, ctx);
      const vinc = resolveRelationalLinks(jarvis, ctx);
      const historial_revision = appendHistorialRevision(
        {},
        'deteccion_jarvis',
        `Clasificación documento ${jarvis.version} · vínculos ${vinc.version}`,
        actor
      );

      const row = {
        nombre_archivo: name,
        tipo_archivo: mime,
        categoria_detectada: jarvis.categoria_detectada,
        entidad_relacionada_tipo: body.entidad_relacionada_tipo || null,
        entidad_relacionada_id: body.entidad_relacionada_id || null,
        clasificado_por_jarvis: true,
        confianza_jarvis: jarvis.confianza_clasificacion,
        estado_revision: 'pendiente_revision',
        etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas : [],
        fecha_subida: new Date().toISOString(),
        subido_por: actor,
        url_storage: null,
        ruta_interna: fileRel,
        hash_archivo: hash,
        resumen_jarvis: jarvis.resumen_breve,
        datos_detectados: jarvis.datos_detectados,
        modulo_destino_sugerido: jarvis.modulo_destino_sugerido,
        cliente_probable: jarvis.cliente_probable,
        contacto_probable: jarvis.contacto_probable,
        tecnico_probable: jarvis.tecnico_probable,
        patente_probable: jarvis.patente_probable,
        ot_probable: jarvis.ot_probable,
        jarvis_advertencias: jarvis.advertencias,
        observacion_revision: '',
        actor_revision: null,
        engine_version: jarvis.version,
        relational_engine_version: vinc.version,
        jarvis_vinculacion: vinc,
        cliente_id: vinc.autoClienteId,
        contacto_id: vinc.autoContactoId,
        vehiculo_id: vinc.autoVehiculoId,
        tecnico_id: vinc.autoTecnicoId,
        historial_revision,
        texto_match_sample: String(jarvis.texto_match_sample || '').slice(0, 8000),
      };

      const created = await maestroDocumentoRepository.create(row, actor);
      created.url_descarga = `/maestro/documentos/${encodeURIComponent(created.id)}/descarga`;
      creados.push(created);
    }

    return { documentos: creados, total: creados.filter((x) => x.id).length };
  },

  async patchDocumento(id, body, actor) {
    const cur = await maestroDocumentoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    const patch = {};
    if (body.categoria_detectada !== undefined) patch.categoria_detectada = String(body.categoria_detectada).slice(0, 80);
    if (body.entidad_relacionada_tipo !== undefined)
      patch.entidad_relacionada_tipo = String(body.entidad_relacionada_tipo).slice(0, 64);
    if (body.entidad_relacionada_id !== undefined)
      patch.entidad_relacionada_id = String(body.entidad_relacionada_id).slice(0, 64);
    if (body.etiquetas !== undefined) patch.etiquetas = Array.isArray(body.etiquetas) ? body.etiquetas : [];
    if (body.observacion_revision !== undefined) patch.observacion_revision = String(body.observacion_revision).slice(0, 2000);
    if (body.estado_revision !== undefined) {
      const e = String(body.estado_revision).toLowerCase();
      if (!ESTADOS_DOC.includes(e)) return { errors: ['estado_revision inválido'] };
      patch.estado_revision = e;
      patch.actor_revision = actor;
    }
    if (body.resumen_jarvis_manual !== undefined) patch.resumen_jarvis = String(body.resumen_jarvis_manual).slice(0, 2000);

    const fkKeys = ['cliente_id', 'contacto_id', 'vehiculo_id', 'tecnico_id'];
    let fkChanged = false;
    for (const k of fkKeys) {
      if (body[k] !== undefined) {
        const v = String(body[k] ?? '').trim();
        patch[k] = v || null;
        if (String(cur[k] ?? '') !== (v || '')) fkChanged = true;
      }
    }
    if (fkChanged) {
      patch.historial_revision = appendHistorialRevision(
        cur,
        'correccion_manual',
        'Vínculos actualizados en revisión (cliente / contacto / vehículo / técnico).',
        actor
      );
    }

    return maestroDocumentoRepository.update(id, patch, actor);
  },

  /**
   * Crear cliente extendido, contacto maestro o vehículo maestro desde la revisión de un documento; enlaza IDs al documento.
   */
  async crearEntidadDesdeDocumento(docId, body, actor) {
    const cur = await maestroDocumentoRepository.findById(docId);
    if (!cur) return { error: 'No encontrado' };
    const tipo = String(body?.tipo || '').toLowerCase();
    const datos = body?.datos && typeof body.datos === 'object' ? body.datos : {};
    const vincBase = cur.jarvis_vinculacion && typeof cur.jarvis_vinculacion === 'object' ? { ...cur.jarvis_vinculacion } : {};

    if (tipo === 'cliente') {
      const r = await hnfOperativoIntegradoService.createExtendedClient(datos, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.cliente = {
        ...(vincBase.cliente || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: cliente recién creado desde revisión.',
        cliente_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Cliente ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { cliente_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    if (tipo === 'contacto') {
      const payload = { ...datos };
      if (!String(payload.cliente_id || '').trim() && cur.cliente_id) payload.cliente_id = cur.cliente_id;
      const r = await createContactoWithChecks(payload, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.contacto = {
        ...(vincBase.contacto || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: contacto creado desde revisión.',
        contacto_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Contacto ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { contacto_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    if (tipo === 'vehiculo') {
      const payload = { ...datos };
      if (!String(payload.cliente_id || '').trim() && cur.cliente_id) payload.cliente_id = cur.cliente_id;
      const r = await createVehiculoWithChecks(payload, actor);
      if (r.errors) return r;
      const entidad = r;
      vincBase.vehiculo = {
        ...(vincBase.vehiculo || {}),
        estado: 'vinculado_manual',
        mensaje_ui: 'Vincular existente: vehículo creado desde revisión.',
        vehiculo_id: entidad.id,
      };
      const historial_revision = appendHistorialRevision(
        cur,
        'creacion_asistida',
        `Vehículo ${entidad.id} creado desde documento ${docId}`,
        actor
      );
      await maestroDocumentoRepository.update(
        docId,
        { vehiculo_id: entidad.id, jarvis_vinculacion: vincBase, historial_revision },
        actor
      );
      return { ok: true, entidad, documento: await maestroDocumentoRepository.findById(docId) };
    }

    return { errors: ['tipo debe ser cliente, contacto o vehiculo'] };
  },

  /**
   * Reparación histórica masiva: reconstruye jarvis_vinculacion desde datos guardados (y opcionalmente relee archivo).
   * No sobrescribe FK ya existentes; completa vacíos y marca revisión manual si Jarvis discrepa.
   */
  async repararVinculosHistoricos(body, actor) {
    const alcance = String(body?.alcance || 'incompletos').toLowerCase();
    const origen =
      String(body?.origen || 'accion_usuario').toLowerCase() === 'job_manual' ? 'job_manual' : 'accion_usuario';
    const limite = Math.min(Math.max(Number(body?.limite) || 200, 1), 500);
    const offset = Math.max(Number(body?.offset) || 0, 0);
    const enriquecer = Boolean(body?.enriquecer_desde_archivo);

    const all = await maestroDocumentoRepository.findAll();
    let ids = [];

    if (alcance === 'id') {
      const id = String(body?.documento_id || body?.id || '').trim();
      if (!id) return { errors: ['documento_id (o id) obligatorio para alcance id'] };
      ids = [id];
    } else if (alcance === 'lote') {
      const raw = Array.isArray(body?.documento_ids) ? body.documento_ids : [];
      ids = raw.map((x) => String(x).trim()).filter(Boolean);
      if (!ids.length) return { errors: ['documento_ids[] obligatorio para alcance lote'] };
    } else if (alcance === 'todos') {
      ids = [...all]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(offset, offset + limite)
        .map((d) => d.id);
    } else if (alcance === 'incompletos') {
      ids = [...all]
        .filter((d) => documentoNecesitaReparacionVinculos(d))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .slice(offset, offset + limite)
        .map((d) => d.id);
    } else {
      return { errors: ['alcance inválido: usar todos, incompletos, id o lote'] };
    }

    const ctx = await buildMaestroJarvisContext();
    const resultados = [];

    for (const docId of ids) {
      const cur = all.find((x) => x.id === docId);
      if (!cur) {
        resultados.push({ id: docId, ok: false, error: 'no_encontrado' });
        continue;
      }

      let docForSynth = cur;
      if (enriquecer && cur.ruta_interna) {
        try {
          const abs = path.join(DATA_ROOT, cur.ruta_interna);
          const buffer = await readFile(abs);
          const jarvis = classifyDocumentBuffer(
            { filename: cur.nombre_archivo, mimeType: cur.tipo_archivo, buffer },
            ctx
          );
          docForSynth = {
            ...cur,
            datos_detectados: jarvis.datos_detectados,
            texto_match_sample: jarvis.texto_match_sample,
            resumen_jarvis: jarvis.resumen_breve,
            cliente_probable: jarvis.cliente_probable,
            contacto_probable: jarvis.contacto_probable,
            tecnico_probable: jarvis.tecnico_probable,
            patente_probable: jarvis.patente_probable,
            ot_probable: jarvis.ot_probable,
          };
        } catch {
          /* mantener fila tal cual */
        }
      }

      const synthetic = buildSyntheticClassifyFromStoredDoc(docForSynth);
      const vinc = resolveRelationalLinks(synthetic, ctx);
      const { before, nextFk, jarvis_vinculacion, after } = mergeRepairVinculosConservador(cur, vinc);

      const detalleHist = JSON.stringify({ origen, antes: before, despues: after }).slice(0, 1950);
      const historial_revision = appendHistorialRevision(cur, 'reparacion_historica_jarvis', detalleHist, actor);

      await maestroDocumentoRepository.update(
        docId,
        {
          ...nextFk,
          jarvis_vinculacion,
          relational_engine_version: vinc.version,
          historial_revision,
        },
        actor
      );
      resultados.push({ id: docId, ok: true, antes: before, despues: after });
    }

    return {
      alcance,
      origen,
      limite,
      offset,
      procesados: resultados.length,
      resultados,
    };
  },

  async reclasificarDocumento(id, actor) {
    const cur = await maestroDocumentoRepository.findById(id);
    if (!cur) return { error: 'No encontrado' };
    if (!cur.ruta_interna) return { error: 'Sin archivo en servidor' };
    const abs = path.join(DATA_ROOT, cur.ruta_interna);
    let buffer;
    try {
      buffer = await readFile(abs);
    } catch {
      return { error: 'Archivo no encontrado en disco' };
    }
    const ctx = await buildMaestroJarvisContext();
    const jarvis = classifyDocumentBuffer(
      { filename: cur.nombre_archivo, mimeType: cur.tipo_archivo, buffer },
      ctx
    );
    const vinc = resolveRelationalLinks(jarvis, ctx);
    const historial_revision = appendHistorialRevision(
      cur,
      'deteccion_jarvis',
      `Reclasificación ${jarvis.version} · vínculos ${vinc.version}`,
      actor
    );
    const next = {
      categoria_detectada: jarvis.categoria_detectada,
      confianza_jarvis: jarvis.confianza_clasificacion,
      resumen_jarvis: jarvis.resumen_breve,
      datos_detectados: jarvis.datos_detectados,
      modulo_destino_sugerido: jarvis.modulo_destino_sugerido,
      cliente_probable: jarvis.cliente_probable,
      contacto_probable: jarvis.contacto_probable,
      tecnico_probable: jarvis.tecnico_probable,
      patente_probable: jarvis.patente_probable,
      ot_probable: jarvis.ot_probable,
      jarvis_advertencias: jarvis.advertencias,
      estado_revision: 'pendiente_revision',
      clasificado_por_jarvis: true,
      engine_version: jarvis.version,
      relational_engine_version: vinc.version,
      jarvis_vinculacion: vinc,
      historial_revision,
      texto_match_sample: String(jarvis.texto_match_sample || '').slice(0, 8000),
    };
    if (vinc.autoClienteId) next.cliente_id = vinc.autoClienteId;
    if (vinc.autoContactoId) next.contacto_id = vinc.autoContactoId;
    if (vinc.autoVehiculoId) next.vehiculo_id = vinc.autoVehiculoId;
    if (vinc.autoTecnicoId) next.tecnico_id = vinc.autoTecnicoId;
    return maestroDocumentoRepository.update(id, next, actor);
  },
};

import { hnfExtendedClientRepository } from '../repositories/hnfExtendedClient.repository.js';
import { hnfInternalDirectoryRepository } from '../repositories/hnfInternalDirectory.repository.js';
import { hnfValidatedMemoryRepository } from '../repositories/hnfValidatedMemory.repository.js';
import { hnfValidationQueueRepository } from '../repositories/hnfValidationQueue.repository.js';

export const QUEUE_ESTADOS = [
  'detectado',
  'requiere_validacion',
  'corregido',
  'confirmado',
  'archivado',
];

export const FUENTES = ['whatsapp', 'correo', 'manual', 'masivo'];

export const DISTRIBUCION_JARVIS = {
  clima: { responsable: 'Romina', etiqueta: 'Clima operativo' },
  flota: { responsable: 'Gery', etiqueta: 'Flota' },
  comercial: { responsable: 'Lyn', etiqueta: 'Comercial' },
  control: { responsable: 'Lyn', etiqueta: 'Control y aprobación' },
  ejecutivo: { responsable: 'Hernán', etiqueta: 'Decisión ejecutiva' },
};

const sugerirDistribucion = (area, prioridadCritica) => {
  if (prioridadCritica) return { ...DISTRIBUCION_JARVIS.ejecutivo, area: 'ejecutivo' };
  const a = String(area || 'clima').toLowerCase();
  if (a === 'flota') return { ...DISTRIBUCION_JARVIS.flota, area: 'flota' };
  if (a === 'comercial') return { ...DISTRIBUCION_JARVIS.comercial, area: 'comercial' };
  if (a === 'control') return { ...DISTRIBUCION_JARVIS.control, area: 'control' };
  return { ...DISTRIBUCION_JARVIS.clima, area: 'clima' };
};

function normalizeQueueRow(body) {
  const fuente = FUENTES.includes(String(body.fuente || '').toLowerCase())
    ? String(body.fuente).toLowerCase()
    : 'manual';
  const tipoDato = String(body.tipoDato || 'generico').toLowerCase();
  const payloadPropuesto =
    body.payloadPropuesto && typeof body.payloadPropuesto === 'object' ? body.payloadPropuesto : {};
  const estadoInicial = QUEUE_ESTADOS.includes(String(body.estado || '').toLowerCase())
    ? String(body.estado).toLowerCase()
    : fuente === 'masivo'
      ? 'requiere_validacion'
      : 'detectado';
  const prioridadCritica = Boolean(body.prioridadCritica);
  const area = String(body.areaSugerida || payloadPropuesto.area || 'clima').toLowerCase();
  const dist = sugerirDistribucion(area, prioridadCritica);
  return {
    fuente,
    tipoDato,
    titulo: String(body.titulo || 'Elemento sin título').slice(0, 200),
    estado: estadoInicial,
    payloadPropuesto,
    payloadEditado:
      body.payloadEditado && typeof body.payloadEditado === 'object'
        ? { ...payloadPropuesto, ...body.payloadEditado }
        : { ...payloadPropuesto },
    sugerencias: {
      area: dist.area,
      responsable: body.sugerencias?.responsable || dist.responsable,
      etiqueta: dist.etiqueta,
      posibleDuplicadoDe: body.sugerencias?.posibleDuplicadoDe || null,
      clienteNombre: body.sugerencias?.clienteNombre || payloadPropuesto.cliente || null,
    },
  };
}

function normalizeExtendedClient(body, prev = {}) {
  const nombreCliente = String(
    body.nombre ?? body.nombre_cliente ?? prev.nombre ?? prev.nombre_cliente ?? ''
  ).trim();
  const correo = String(body.correo ?? body.correo_principal ?? prev.correo ?? prev.correo_principal ?? '').trim();
  const telefono = String(
    body.telefono ?? body.telefono_principal ?? prev.telefono ?? prev.telefono_principal ?? ''
  ).trim();
  return {
    nombre: nombreCliente,
    nombre_cliente: nombreCliente,
    razonSocial: String(body.razonSocial ?? body.razon_social ?? prev.razonSocial ?? prev.razon_social ?? '').trim(),
    rut: String(body.rut ?? prev.rut ?? '').trim(),
    giro: String(body.giro ?? prev.giro ?? '').trim(),
    direccion: String(body.direccion ?? prev.direccion ?? '').trim(),
    comuna: String(body.comuna ?? prev.comuna ?? '').trim(),
    ciudad: String(body.ciudad ?? prev.ciudad ?? '').trim(),
    region: String(body.region ?? prev.region ?? '').trim(),
    contactoPrincipal: String(body.contactoPrincipal ?? prev.contactoPrincipal ?? '').trim(),
    correo,
    correo_principal: correo,
    telefono,
    telefono_principal: telefono,
    whatsapp_principal: String(
      body.whatsapp_principal ?? prev.whatsapp_principal ?? ''
    ).trim(),
    estado: String(body.estado ?? prev.estado ?? 'activo').toLowerCase(),
    area: String(body.area ?? prev.area ?? 'clima').toLowerCase(),
    frecuenciaServicio: String(body.frecuenciaServicio ?? prev.frecuenciaServicio ?? '').trim(),
    observaciones: String(body.observaciones ?? prev.observaciones ?? '').trim(),
    etiquetas: Array.isArray(body.etiquetas)
      ? body.etiquetas.map((x) => String(x).trim()).filter(Boolean)
      : prev.etiquetas || [],
    responsableInterno: String(body.responsableInterno ?? prev.responsableInterno ?? '').trim(),
  };
}

function normalizeDirectory(body, prev = {}) {
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : prev.aliases || [];
  return {
    nombreCompleto: String(body.nombreCompleto ?? body.nombre ?? prev.nombreCompleto ?? '').trim(),
    rut: String(body.rut ?? prev.rut ?? '').trim(),
    rol: String(body.rol ?? prev.rol ?? '').trim(),
    area: String(body.area ?? prev.area ?? '').trim(),
    correo: String(body.correo ?? prev.correo ?? '').trim(),
    telefono: String(body.telefono ?? prev.telefono ?? '').trim(),
    whatsapp: String(body.whatsapp ?? prev.whatsapp ?? '').trim(),
    supervisor: String(body.supervisor ?? prev.supervisor ?? '').trim(),
    aliases,
    permisos: body.permisos && typeof body.permisos === 'object' ? body.permisos : prev.permisos || {},
    activo: body.activo !== undefined ? Boolean(body.activo) : prev.activo !== false,
  };
}

export const hnfOperativoIntegradoService = {
  async listValidationQueue() {
    return hnfValidationQueueRepository.findAll();
  },

  async createValidationItem(body, actor) {
    const row = normalizeQueueRow(body || {});
    if (!row.titulo || row.titulo === 'Elemento sin título') {
      if (!Object.keys(row.payloadPropuesto).length) {
        return { errors: ['titulo o payloadPropuesto requerido'] };
      }
    }
    return hnfValidationQueueRepository.create(
      row,
      actor,
      `Jarvis detectó (${row.fuente}) · ${row.titulo}`
    );
  },

  async patchValidationItem(id, body, actor) {
    const cur = await hnfValidationQueueRepository.findById(id);
    if (!cur) return { error: 'No encontrado', code: 'NOT_FOUND' };
    if (cur.estado === 'confirmado' || cur.estado === 'archivado') {
      return { error: 'No se puede editar un registro confirmado o archivado.', code: 'LOCKED' };
    }
    const patch = {};
    if (body.titulo !== undefined) patch.titulo = String(body.titulo).slice(0, 200);
    if (body.estado !== undefined) {
      const e = String(body.estado).toLowerCase();
      if (!QUEUE_ESTADOS.includes(e)) return { errors: ['estado inválido'] };
      if (e === 'confirmado') {
        return { error: 'Usá el endpoint confirmar para confirmar.', code: 'USE_CONFIRM' };
      }
      patch.estado = e;
    }
    if (body.payloadEditado !== undefined && typeof body.payloadEditado === 'object') {
      patch.payloadEditado = { ...cur.payloadEditado, ...body.payloadEditado };
      patch.estado = 'corregido';
    }
    if (body.sugerencias !== undefined && typeof body.sugerencias === 'object') {
      patch.sugerencias = { ...cur.sugerencias, ...body.sugerencias };
    }
    const hist = [];
    if (patch.estado) hist.push(`estado → ${patch.estado}`);
    if (body.payloadEditado) hist.push('datos corregidos por usuario');
    return hnfValidationQueueRepository.update(
      id,
      patch,
      { accion: 'validacion', detalle: hist.join(' · ') || 'Actualización' },
      actor
    );
  },

  async confirmValidationItem(id, actor) {
    const cur = await hnfValidationQueueRepository.findById(id);
    if (!cur) return { error: 'No encontrado', code: 'NOT_FOUND' };
    if (cur.estado === 'confirmado') return cur;
    if (cur.estado === 'archivado') {
      return { error: 'Archivado: no se confirma.', code: 'ARCHIVED' };
    }
    const datos = {
      ...(cur.payloadEditado && typeof cur.payloadEditado === 'object' ? cur.payloadEditado : {}),
    };
    if (!Object.keys(datos).length && cur.payloadPropuesto) {
      Object.assign(datos, cur.payloadPropuesto);
    }

    await hnfValidatedMemoryRepository.create(
      {
        tipoMemoria: cur.tipoDato || 'generico',
        datosValidados: datos,
        refValidacionId: cur.id,
        fuenteOriginal: cur.fuente,
        titulo: cur.titulo,
      },
      actor,
      `Confirmado desde ${cur.id} · ${cur.titulo}`
    );

    return hnfValidationQueueRepository.update(
      id,
      { estado: 'confirmado' },
      { accion: 'confirmado', detalle: 'Humano validó · Jarvis memoriza dato confirmado' },
      actor
    );
  },

  async bulkIngest(body, actor) {
    const tipo = String(body.tipo || 'generico').toLowerCase();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return { errors: ['rows[] vacío'] };
    const creados = [];
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const titulo = String(r.titulo || r.nombre || `${tipo} fila ${i + 1}`).slice(0, 200);
      const dupHint = r.posibleDuplicadoDe || r.duplicadoDe || null;
      const item = await hnfValidationQueueRepository.create(
        normalizeQueueRow({
          fuente: 'masivo',
          tipoDato: tipo,
          titulo,
          estado: 'requiere_validacion',
          payloadPropuesto: r.payload || r,
          prioridadCritica: Boolean(r.critico),
          areaSugerida: r.area,
          sugerencias: {
            posibleDuplicadoDe: dupHint,
            clienteNombre: r.cliente || r.clienteNombre,
          },
        }),
        actor,
        `Carga masiva (${tipo}) · ${titulo}`
      );
      creados.push(item);
    }
    return { creados, total: creados.length };
  },

  async listValidatedMemory() {
    const all = await hnfValidatedMemoryRepository.findAll();
    return [...all].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async listExtendedClients() {
    return hnfExtendedClientRepository.findAll();
  },

  async createExtendedClient(body, actor) {
    const n = normalizeExtendedClient(body);
    if (!n.nombre) return { errors: ['nombre es obligatorio'] };
    return hnfExtendedClientRepository.create(n, actor, `Cliente ${n.nombre}`);
  },

  async patchExtendedClient(id, body, actor) {
    const cur = await hnfExtendedClientRepository.findById(id);
    if (!cur) return { error: 'No encontrado', code: 'NOT_FOUND' };
    const next = normalizeExtendedClient(body, cur);
    const hist = [];
    for (const k of Object.keys(next)) {
      if (String(cur[k] ?? '') !== String(next[k] ?? '')) hist.push(`${k} actualizado`);
    }
    return hnfExtendedClientRepository.update(
      id,
      next,
      { accion: 'edicion_cliente', detalle: hist.join(' · ') || 'Edición' },
      actor
    );
  },

  async listInternalDirectory() {
    return hnfInternalDirectoryRepository.findAll();
  },

  async createInternalDirectory(body, actor) {
    const n = normalizeDirectory(body);
    if (!n.nombreCompleto) return { errors: ['nombreCompleto obligatorio'] };
    return hnfInternalDirectoryRepository.create(n, actor, `Alta ${n.nombreCompleto}`);
  },

  async patchInternalDirectory(id, body, actor) {
    const cur = await hnfInternalDirectoryRepository.findById(id);
    if (!cur) return { error: 'No encontrado', code: 'NOT_FOUND' };
    const next = normalizeDirectory(body, cur);
    return hnfInternalDirectoryRepository.update(
      id,
      next,
      { accion: 'edicion_equipo', detalle: 'Datos actualizados' },
      actor
    );
  },
};

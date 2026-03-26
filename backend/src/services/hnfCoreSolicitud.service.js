import {
  HNF_CORE_ETAPAS_CHECKLIST,
  HNF_CORE_ESTADOS,
} from '../models/hnfCoreSolicitud.model.js';
import { hnfCoreSolicitudRepository, normalizeHnfCoreSolicitud } from '../repositories/hnfCoreSolicitud.repository.js';

/** Clasificación Jarvis → responsable sugerido */
export const JARVIS_RESPONSABLE_BY_TIPO = {
  clima: 'Romina',
  flota: 'Gery',
  comercial: 'Gery',
  control: 'Lyn',
};

const ALLOWED = {
  recibido: ['en_proceso'],
  en_proceso: ['pendiente_aprobacion', 'observado'],
  pendiente_aprobacion: ['aprobado', 'observado'],
  observado: ['en_proceso'],
  aprobado: ['enviado'],
  enviado: ['cerrado'],
  cerrado: [],
};

const isTransitionAllowed = (from, to, force = false) => {
  if (force) return HNF_CORE_ESTADOS.includes(to);
  const next = ALLOWED[from] || [];
  return next.includes(to);
};

const checklistForEstado = (estado) => {
  const c = Object.fromEntries(HNF_CORE_ETAPAS_CHECKLIST.map((k) => [k, false]));
  switch (estado) {
    case 'recibido':
      c.ingreso = true;
      break;
    case 'en_proceso':
      c.ingreso = true;
      c.diagnostico = true;
      c.ejecucion = true;
      break;
    case 'pendiente_aprobacion':
      Object.assign(c, { ingreso: true, diagnostico: true, ejecucion: true, informe: true });
      break;
    case 'observado':
      Object.assign(c, { ingreso: true, diagnostico: true, ejecucion: true, informe: true });
      break;
    case 'aprobado':
      Object.assign(c, {
        ingreso: true,
        diagnostico: true,
        ejecucion: true,
        informe: true,
        aprobacion: true,
      });
      break;
    case 'enviado':
    case 'cerrado':
      for (const k of HNF_CORE_ETAPAS_CHECKLIST) c[k] = true;
      break;
    default:
      break;
  }
  return c;
};

const mergeChecklist = (current, estado) => {
  const auto = checklistForEstado(estado);
  const out = { ...current };
  for (const k of HNF_CORE_ETAPAS_CHECKLIST) {
    if (auto[k]) out[k] = true;
  }
  return out;
};

export const hnfCoreSolicitudService = {
  async list(filters = {}) {
    return hnfCoreSolicitudRepository.findAll(filters);
  },

  async getById(id) {
    return hnfCoreSolicitudRepository.findById(id);
  },

  /**
   * Crea solicitud; si no viene responsable, asigna según tipo (Jarvis).
   */
  async create(body, actor = 'sistema') {
    const tipo = String(body.tipo || 'clima').toLowerCase();
    const responsableIn = String(body.responsable || '').trim();
    const responsable =
      responsableIn || JARVIS_RESPONSABLE_BY_TIPO[tipo] || 'Coordinación';

    const row = normalizeHnfCoreSolicitud({
      cliente: body.cliente,
      tipo,
      origen: body.origen,
      fecha: body.fecha,
      responsable,
      estado: 'recibido',
      prioridad: body.prioridad,
      descripcion: body.descripcion,
      checklist: checklistForEstado('recibido'),
      metadata: body.metadata,
    });

    if (!row.cliente) {
      return { errors: ['cliente es obligatorio'] };
    }

    return hnfCoreSolicitudRepository.create(row, actor);
  },

  /**
   * @param {object} body
   * @param {boolean} [body.forceEstado] Hernán / admin: saltar reglas de transición
   */
  async patch(id, body, actor = 'sistema') {
    const current = await hnfCoreSolicitudRepository.findById(id);
    if (!current) return { error: 'Solicitud no encontrada.', code: 'NOT_FOUND' };

    const force = Boolean(body.forceEstado);
    const patch = {};
    const hist = [];

    if (body.cliente !== undefined) patch.cliente = String(body.cliente).trim();
    if (body.descripcion !== undefined) patch.descripcion = String(body.descripcion);
    if (body.prioridad !== undefined) patch.prioridad = body.prioridad;
    if (body.responsable !== undefined) {
      patch.responsable = String(body.responsable).trim();
      hist.push(`responsable → ${patch.responsable}`);
    }
    if (body.tipo !== undefined) {
      patch.tipo = String(body.tipo).toLowerCase();
      hist.push(`tipo → ${patch.tipo}`);
      if (body.responsable === undefined) {
        patch.responsable = JARVIS_RESPONSABLE_BY_TIPO[patch.tipo] || current.responsable;
        hist.push(`Jarvis: responsable → ${patch.responsable}`);
      }
    }
    if (body.origen !== undefined) patch.origen = body.origen;
    if (body.metadata !== undefined) patch.metadata = body.metadata;

    if (body.checklist && typeof body.checklist === 'object') {
      patch.checklist = { ...current.checklist };
      for (const k of HNF_CORE_ETAPAS_CHECKLIST) {
        if (k in body.checklist) patch.checklist[k] = Boolean(body.checklist[k]);
      }
    }

    let nextEstado = current.estado;
    if (body.estado !== undefined) {
      const to = String(body.estado).toLowerCase().replace(/\s+/g, '_');
      if (to === 'pendiente_aprobación' || to === 'pendienteaprobacion') {
        nextEstado = 'pendiente_aprobacion';
      } else if (HNF_CORE_ESTADOS.includes(to)) {
        nextEstado = to;
      } else {
        return { errors: [`estado inválido: ${body.estado}`] };
      }

      if (!isTransitionAllowed(current.estado, nextEstado, force)) {
        return {
          error: `Transición no permitida: ${current.estado} → ${nextEstado}`,
          code: 'INVALID_TRANSITION',
        };
      }

      patch.estado = nextEstado;
      patch.checklist = mergeChecklist(
        { ...current.checklist, ...(patch.checklist || {}) },
        nextEstado
      );
      hist.push(`estado → ${nextEstado}`);

      /** Cierre automático al marcar enviado (Jarvis) */
      if (nextEstado === 'enviado' && !force) {
        patch.estado = 'cerrado';
        patch.checklist = mergeChecklist(patch.checklist, 'cerrado');
        hist.push('Jarvis: cierre automático tras envío');
      }
    }

    if (Object.keys(patch).length === 0) {
      return current;
    }

    const detalle = hist.length ? hist.join(' · ') : 'Actualización';
    const accion = body.estado !== undefined ? 'cambio_estado' : 'edicion';

    return hnfCoreSolicitudRepository.update(id, patch, { accion, detalle }, actor);
  },
};

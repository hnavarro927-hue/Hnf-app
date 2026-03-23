import { planClienteRepository } from '../repositories/planCliente.repository.js';
import { planMantencionRepository } from '../repositories/planMantencion.repository.js';
import { planTiendaRepository } from '../repositories/planTienda.repository.js';
import { findScheduleConflicts } from '../utils/planSchedule.js';
import {
  validateMantencionSchedule,
  validatePlanClienteCreate,
  validatePlanMantencionCreate,
  validatePlanMantencionPatch,
  validatePlanTiendaCreate,
} from '../validators/plan.validator.js';

export const planificacionService = {
  async listClientes() {
    return planClienteRepository.findAll();
  },

  async createCliente(body) {
    const v = validatePlanClienteCreate(body);
    if (!v.valid) return { errors: v.errors };
    return planClienteRepository.create({ nombre: body.nombre });
  },

  async listTiendas(clienteId) {
    return planTiendaRepository.findAll(clienteId || null);
  },

  async createTienda(body) {
    const v = validatePlanTiendaCreate(body);
    if (!v.valid) return { errors: v.errors };
    const cliente = await planClienteRepository.findById(String(body.clienteId).trim());
    if (!cliente) return { error: 'Cliente no encontrado.' };
    return planTiendaRepository.create(body);
  },

  async listMantenciones(filters) {
    return planMantencionRepository.findAll(filters);
  },

  async createMantencion(body) {
    const v = validatePlanMantencionCreate(body);
    if (!v.valid) return { errors: v.errors };
    const tienda = await planTiendaRepository.findById(String(body.tiendaId).trim());
    if (!tienda) return { error: 'Tienda no encontrada.' };
    const candidate = {
      fecha: String(body.fecha || '').trim(),
      tecnico: String(body.tecnico || '').trim(),
      horaInicio: String(body.horaInicio ?? '').trim(),
      horaFin: String(body.horaFin ?? '').trim(),
    };
    const all = await planMantencionRepository.findAll({});
    const conflicts = findScheduleConflicts(all, candidate, null);
    if (conflicts.length) {
      return {
        error:
          'Ese técnico ya tiene una mantención asignada en esa fecha y el horario se superpone. Elegí otra franja u otro técnico.',
        code: 'SCHEDULE_CONFLICT',
      };
    }
    return planMantencionRepository.create(body);
  },

  async patchMantencion(id, body) {
    const v = validatePlanMantencionPatch(body);
    if (!v.valid) return { errors: v.errors };
    const current = await planMantencionRepository.findById(id);
    if (!current) return { error: 'Mantención no encontrada.' };
    if (body.tiendaId) {
      const tienda = await planTiendaRepository.findById(String(body.tiendaId).trim());
      if (!tienda) return { error: 'Tienda no encontrada.' };
    }
    const patch = {};
    if (body.fecha !== undefined) patch.fecha = body.fecha;
    if (body.tecnico !== undefined) patch.tecnico = body.tecnico;
    if (body.tipo !== undefined) patch.tipo = body.tipo;
    if (body.estado !== undefined) patch.estado = body.estado;
    if (body.tiendaId !== undefined) patch.tiendaId = body.tiendaId;
    if (body.horaInicio !== undefined) patch.horaInicio = body.horaInicio;
    if (body.horaFin !== undefined) patch.horaFin = body.horaFin;

    const merged = {
      ...current,
      fecha: patch.fecha !== undefined ? String(patch.fecha || '').trim() : current.fecha,
      tecnico: patch.tecnico !== undefined ? String(patch.tecnico || '').trim() : current.tecnico,
      horaInicio:
        patch.horaInicio !== undefined ? String(patch.horaInicio ?? '').trim() : current.horaInicio,
      horaFin: patch.horaFin !== undefined ? String(patch.horaFin ?? '').trim() : current.horaFin,
    };
    const sch = validateMantencionSchedule(merged);
    if (sch.length) return { errors: sch };

    if (Object.keys(patch).length) {
      const all = await planMantencionRepository.findAll({});
      const conflicts = findScheduleConflicts(all, merged, id);
      if (conflicts.length) {
        return {
          error:
            'Ese técnico ya tiene otra mantención en esa fecha y el horario se superpone. Ajustá horas o técnico.',
          code: 'SCHEDULE_CONFLICT',
        };
      }
    }

    if (!Object.keys(patch).length) {
      return current;
    }
    return planMantencionRepository.update(id, patch);
  },
};

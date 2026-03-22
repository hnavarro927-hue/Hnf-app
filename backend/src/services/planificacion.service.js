import { planClienteRepository } from '../repositories/planCliente.repository.js';
import { planMantencionRepository } from '../repositories/planMantencion.repository.js';
import { planTiendaRepository } from '../repositories/planTienda.repository.js';
import {
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
    return planMantencionRepository.update(id, patch);
  },
};

import { planMantencionModel } from '../models/planMantencion.model.js';

const HHMM = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;

/** Validar par de horas opcional (vacío = día completo en lógica de conflicto). */
export const validateMantencionSchedule = (m = {}) => {
  const errors = [];
  const hi = String(m.horaInicio ?? '').trim();
  const hf = String(m.horaFin ?? '').trim();
  if (!hi && !hf) return errors;
  if (!hi || !hf) {
    errors.push('Si informás horario, completá horaInicio y horaFin (HH:MM), o dejá ambos vacíos para la jornada completa.');
    return errors;
  }
  if (!HHMM.test(hi) || !HHMM.test(hf)) {
    errors.push('horaInicio y horaFin deben tener formato HH:MM.');
    return errors;
  }
  const [ah, am] = hi.split(':').map(Number);
  const [bh, bm] = hf.split(':').map(Number);
  if (ah * 60 + am >= bh * 60 + bm) {
    errors.push('horaInicio debe ser anterior a horaFin.');
  }
  return errors;
};

export const validatePlanClienteCreate = (body = {}) => {
  const errors = [];
  if (!String(body.nombre || '').trim()) {
    errors.push('nombre es obligatorio.');
  }
  return { valid: errors.length === 0, errors };
};

export const validatePlanTiendaCreate = (body = {}) => {
  const errors = [];
  if (!String(body.clienteId || '').trim()) {
    errors.push('clienteId es obligatorio.');
  }
  if (!String(body.nombre || '').trim()) {
    errors.push('nombre es obligatorio.');
  }
  if (!String(body.direccion || '').trim()) {
    errors.push('dirección es obligatoria.');
  }
  if (!String(body.comuna || '').trim()) {
    errors.push('comuna es obligatoria.');
  }
  return { valid: errors.length === 0, errors };
};

export const validatePlanMantencionCreate = (body = {}) => {
  const errors = [];
  if (!String(body.tiendaId || '').trim()) {
    errors.push('tiendaId es obligatorio.');
  }
  if (!String(body.fecha || '').trim()) {
    errors.push('fecha es obligatoria (YYYY-MM-DD).');
  }
  if (!String(body.tecnico || '').trim()) {
    errors.push('tecnico es obligatorio.');
  }
  const tipo = String(body.tipo || 'preventivo').trim();
  if (!planMantencionModel.tipos.includes(tipo)) {
    errors.push(`tipo inválido. Permitidos: ${planMantencionModel.tipos.join(', ')}.`);
  }
  const estado = String(body.estado || 'programado').trim();
  if (!planMantencionModel.estados.includes(estado)) {
    errors.push(`estado inválido. Permitidos: ${planMantencionModel.estados.join(', ')}.`);
  }
  errors.push(...validateMantencionSchedule(body));
  return { valid: errors.length === 0, errors };
};

export const validatePlanMantencionPatch = (body = {}) => {
  const errors = [];
  if (body.tipo !== undefined) {
    const tipo = String(body.tipo || '').trim();
    if (!planMantencionModel.tipos.includes(tipo)) {
      errors.push(`tipo inválido. Permitidos: ${planMantencionModel.tipos.join(', ')}.`);
    }
  }
  if (body.estado !== undefined) {
    const estado = String(body.estado || '').trim();
    if (!planMantencionModel.estados.includes(estado)) {
      errors.push(`estado inválido. Permitidos: ${planMantencionModel.estados.join(', ')}.`);
    }
  }
  return { valid: errors.length === 0, errors };
};

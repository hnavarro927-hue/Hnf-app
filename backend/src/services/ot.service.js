import { normalizeFiles } from '../middlewares/file-upload.middleware.js';
import { otRepository } from '../repositories/ot.repository.js';
import {
  validateEvidencePatchBody,
  validateOTPayload,
  validateReportPayload,
} from '../validators/ot.validator.js';

export const OT_CLOSE_EVIDENCE_ERROR_MESSAGE =
  'Debes cargar evidencias (antes, durante y después) antes de cerrar la OT';

const hasFullEvidence = (ot) =>
  (ot.fotografiasAntes?.length || 0) >= 1 &&
  (ot.fotografiasDurante?.length || 0) >= 1 &&
  (ot.fotografiasDespues?.length || 0) >= 1;

export const otService = {
  repositoryMode: otRepository.mode,

  async getAll() {
    return otRepository.findAll();
  },

  async create(data) {
    const validation = validateOTPayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    return otRepository.create({
      cliente: data.cliente || null,
      direccion: data.direccion || '',
      comuna: data.comuna || '',
      contactoTerreno: data.contactoTerreno || '',
      telefonoContacto: data.telefonoContacto || '',
      clienteRelacionado: data.clienteRelacionado || null,
      vehiculoRelacionado: data.vehiculoRelacionado || null,
      tipoServicio: data.tipoServicio || '',
      subtipoServicio: data.subtipoServicio || '',
      tecnicoAsignado: data.tecnicoAsignado || 'Por asignar',
      estado: 'pendiente',
      fecha: data.fecha,
      hora: data.hora || '',
      observaciones: data.observaciones || '',
      resumenTrabajo: data.resumenTrabajo || '',
      recomendaciones: data.recomendaciones || '',
      pdfName: null,
      pdfUrl: null,
      fotografiasAntes: normalizeFiles(data, 'fotografiasAntes'),
      fotografiasDurante: normalizeFiles(data, 'fotografiasDurante'),
      fotografiasDespues: normalizeFiles(data, 'fotografiasDespues'),
    });
  },

  async updateStatus(id, estado, statusOptions) {
    if (!statusOptions.includes(estado)) {
      return { error: 'Estado inválido.' };
    }

    if (estado === 'terminado') {
      const current = await otRepository.findById(id);
      if (!current) {
        return { error: 'OT no encontrada.' };
      }
      if (!hasFullEvidence(current)) {
        return { error: OT_CLOSE_EVIDENCE_ERROR_MESSAGE };
      }
    }

    const item = await otRepository.updateStatus(id, estado);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async appendEvidences(id, body) {
    const validation = validateEvidencePatchBody(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const patch = {};
    if (Array.isArray(body.fotografiasAntes)) {
      patch.fotografiasAntes = normalizeFiles(body, 'fotografiasAntes');
    }
    if (Array.isArray(body.fotografiasDurante)) {
      patch.fotografiasDurante = normalizeFiles(body, 'fotografiasDurante');
    }
    if (Array.isArray(body.fotografiasDespues)) {
      patch.fotografiasDespues = normalizeFiles(body, 'fotografiasDespues');
    }

    const item = await otRepository.appendEvidences(id, patch);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async updateReport(id, body) {
    const validation = validateReportPayload(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const item = await otRepository.updateReport(id, {
      pdfName: body.pdfName.trim(),
      pdfUrl: body.pdfUrl.trim(),
    });

    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },
};

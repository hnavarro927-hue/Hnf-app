import { HVAC_CHECKLIST_TEMPLATE } from '../constants/hvacChecklist.js';
import {
  normalizeEvidenceItem,
  normalizeFiles,
} from '../middlewares/file-upload.middleware.js';
import { otModel } from '../models/ot.model.js';
import { otRepository } from '../repositories/ot.repository.js';
import {
  validateEconomicsPatch,
  validateEquiposPatchBody,
  validateEvidencePatchBody,
  validateOTPayload,
  validateReportPayload,
  validateVisitFieldsPatch,
} from '../validators/ot.validator.js';

export const OT_CLOSE_EVIDENCE_ERROR_MESSAGE =
  'Debes cargar evidencias (antes, durante y después) antes de cerrar la OT';

const roundMoney = (v) => {
  const n = Number.parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
};

const blockHasPhoto = (arr) =>
  Array.isArray(arr) &&
  arr.some((e) => typeof e?.url === 'string' && e.url.trim().length > 0);

const getEquipoBlock = (eq, phase) => {
  const ev = eq?.evidencias;
  if (ev && typeof ev === 'object' && Array.isArray(ev[phase])) {
    return ev[phase];
  }
  if (phase === 'antes') return eq?.fotografiasAntes;
  if (phase === 'durante') return eq?.fotografiasDurante;
  return eq?.fotografiasDespues;
};

const getEvidenceGapsForOt = (ot) => {
  const gaps = [];
  const eqs = ot?.equipos || [];
  if (eqs.length > 0) {
    eqs.forEach((eq, idx) => {
      const name = String(eq?.nombreEquipo || '').trim() || `Equipo ${idx + 1}`;
      if (!blockHasPhoto(getEquipoBlock(eq, 'antes'))) {
        gaps.push({ equipo: name, blockLabel: 'ANTES' });
      }
      if (!blockHasPhoto(getEquipoBlock(eq, 'durante'))) {
        gaps.push({ equipo: name, blockLabel: 'DURANTE' });
      }
      if (!blockHasPhoto(getEquipoBlock(eq, 'despues'))) {
        gaps.push({ equipo: name, blockLabel: 'DESPUÉS' });
      }
    });
    return gaps;
  }
  if (!blockHasPhoto(ot?.fotografiasAntes)) {
    gaps.push({ scope: 'OT', blockLabel: 'ANTES' });
  }
  if (!blockHasPhoto(ot?.fotografiasDurante)) {
    gaps.push({ scope: 'OT', blockLabel: 'DURANTE' });
  }
  if (!blockHasPhoto(ot?.fotografiasDespues)) {
    gaps.push({ scope: 'OT', blockLabel: 'DESPUÉS' });
  }
  return gaps;
};

const formatCloseEvidenceMessage = (gaps) => {
  if (!gaps.length) {
    return OT_CLOSE_EVIDENCE_ERROR_MESSAGE;
  }
  return gaps
    .map((g) =>
      g.scope === 'OT'
        ? `En la visita general falta al menos una foto en el bloque ${g.blockLabel}.`
        : `En «${g.equipo}» falta al menos una foto en el bloque ${g.blockLabel}.`
    )
    .join(' ');
};

const mergeEquipoChecklist = (raw) => {
  const rawList = Array.isArray(raw?.checklist) ? raw.checklist : [];
  const byId = Object.fromEntries(rawList.map((c) => [c.id, c]));
  return HVAC_CHECKLIST_TEMPLATE.map((t) => ({
    id: t.id,
    label: t.label,
    realizado: Boolean(byId[t.id]?.realizado),
  }));
};

const getQualityGapsForOt = (ot) => {
  const gaps = [];
  if (!String(ot?.resumenTrabajo || '').trim()) {
    gaps.push({ kind: 'ot', detail: 'Falta el resumen del trabajo en la OT.' });
  }
  if (!String(ot?.recomendaciones || '').trim()) {
    gaps.push({ kind: 'ot', detail: 'Faltan las recomendaciones generales de la OT.' });
  }
  const eqs = ot?.equipos || [];
  if (eqs.length > 0) {
    eqs.forEach((eq, idx) => {
      const name = String(eq?.nombreEquipo || '').trim() || `Equipo ${idx + 1}`;
      const list = mergeEquipoChecklist(eq);
      list.forEach((it) => {
        if (!it.realizado) {
          gaps.push({ kind: 'checklist', equipo: name, detail: `Checklist: «${it.label}» no marcado como realizado.` });
        }
      });
    });
  }
  return gaps;
};

const formatQualityCloseMessage = (gaps) =>
  gaps.map((g) => (g.kind === 'ot' ? g.detail : `En «${g.equipo}»: ${g.detail}`)).join(' ');

const hasQualityForClose = (ot) => getQualityGapsForOt(ot).length === 0;

const normalizeEvidenceList = (arr, prefix) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((file, index) => normalizeEvidenceItem(file, prefix, index));
};

const normalizeEquipoEvidencias = (raw, index) => {
  const nested = raw?.evidencias;
  const hasNested =
    nested &&
    typeof nested === 'object' &&
    ['antes', 'durante', 'despues'].some((k) => Array.isArray(nested[k]));

  if (hasNested) {
    return {
      antes: normalizeEvidenceList(nested.antes, `eq${index}-ev-antes`),
      durante: normalizeEvidenceList(nested.durante, `eq${index}-ev-durante`),
      despues: normalizeEvidenceList(nested.despues, `eq${index}-ev-despues`),
    };
  }

  return {
    antes: normalizeEvidenceList(raw?.fotografiasAntes, `eq${index}-antes`),
    durante: normalizeEvidenceList(raw?.fotografiasDurante, `eq${index}-durante`),
    despues: normalizeEvidenceList(raw?.fotografiasDespues, `eq${index}-despues`),
  };
};

const normalizeEquipo = (raw, index) => {
  const estados = otModel.equipoEstadoOptions;
  const estado = estados.includes(raw?.estadoEquipo) ? raw.estadoEquipo : 'operativo';
  const evidencias = normalizeEquipoEvidencias(raw, index);

  return {
    id:
      raw?.id && String(raw.id).trim()
        ? String(raw.id).trim()
        : `eq-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    nombreEquipo: String(raw?.nombreEquipo || '').trim() || `Equipo ${index + 1}`,
    estadoEquipo: estado,
    observaciones: String(raw?.observaciones || '').trim(),
    accionesRealizadas: String(raw?.accionesRealizadas || '').trim(),
    recomendaciones: String(raw?.recomendaciones || '').trim(),
    checklist: mergeEquipoChecklist(raw),
    evidencias,
    fotografiasAntes: evidencias.antes,
    fotografiasDurante: evidencias.durante,
    fotografiasDespues: evidencias.despues,
  };
};

const normalizeEquiposList = (list) => {
  if (!Array.isArray(list)) return [];
  return list.slice(0, otModel.maxEquipos).map((e, i) => normalizeEquipo(e, i));
};

const equipoHasFullEvidence = (e) =>
  blockHasPhoto(getEquipoBlock(e, 'antes')) &&
  blockHasPhoto(getEquipoBlock(e, 'durante')) &&
  blockHasPhoto(getEquipoBlock(e, 'despues'));

const hasFullEvidence = (ot) => {
  const equipos = ot.equipos || [];
  if (equipos.length > 0) {
    return equipos.every(equipoHasFullEvidence);
  }
  return (
    blockHasPhoto(ot.fotografiasAntes) &&
    blockHasPhoto(ot.fotografiasDurante) &&
    blockHasPhoto(ot.fotografiasDespues)
  );
};

export const otService = {
  repositoryMode: otRepository.mode,

  async getAll() {
    return otRepository.findAll();
  },

  async create(data, actor = 'sistema') {
    const validation = validateOTPayload(data);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const equipos = normalizeEquiposList(data.equipos);

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
      creadoEn: new Date().toISOString(),
      cerradoEn: null,
      pdfName: null,
      pdfUrl: null,
      equipos,
      fotografiasAntes: normalizeFiles(data, 'fotografiasAntes'),
      fotografiasDurante: normalizeFiles(data, 'fotografiasDurante'),
      fotografiasDespues: normalizeFiles(data, 'fotografiasDespues'),
    }, actor);
  },

  async updateStatus(id, estado, statusOptions, actor = 'sistema') {
    if (!statusOptions.includes(estado)) {
      return { error: 'Estado inválido.' };
    }

    if (estado === 'terminado') {
      const current = await otRepository.findById(id);
      if (!current) {
        return { error: 'OT no encontrada.' };
      }
      if (!hasFullEvidence(current)) {
        return {
          error: formatCloseEvidenceMessage(getEvidenceGapsForOt(current)),
          code: 'EVIDENCE_INCOMPLETE',
        };
      }
      if (!hasQualityForClose(current)) {
        return {
          error: formatQualityCloseMessage(getQualityGapsForOt(current)),
          code: 'QUALITY_INCOMPLETE',
        };
      }
      if (roundMoney(current.montoCobrado) <= 0 || roundMoney(current.costoTotal) <= 0) {
        return {
          error:
            'No se puede cerrar: el monto cobrado y el costo total guardados en la OT deben ser mayores que cero.',
          code: 'ECONOMICS_INCOMPLETE',
        };
      }
    }

    const item = await otRepository.updateStatus(id, estado, actor);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async appendEvidences(id, body, actor = 'sistema') {
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

    const item = await otRepository.appendEvidences(id, patch, actor);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async updateEquipos(id, body, actor = 'sistema') {
    const validation = validateEquiposPatchBody(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const equipos = normalizeEquiposList(body.equipos);
    const item = await otRepository.updateEquipos(id, equipos, actor);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async updateReport(id, body, actor = 'sistema') {
    const validation = validateReportPayload(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }

    const item = await otRepository.updateReport(
      id,
      {
        pdfName: body.pdfName.trim(),
        pdfUrl: body.pdfUrl.trim(),
      },
      actor
    );

    if (!item) {
      return { error: 'OT no encontrada.' };
    }

    return item;
  },

  async patchVisitFields(id, body, actor = 'sistema') {
    const validation = validateVisitFieldsPatch(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }
    const patch = {};
    for (const k of ['resumenTrabajo', 'recomendaciones', 'observaciones']) {
      if (k in body) patch[k] = body[k];
    }
    const item = await otRepository.updateVisitFields(id, patch, actor);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }
    return item;
  },

  async patchEconomics(id, body, actor = 'sistema') {
    const validation = validateEconomicsPatch(body);
    if (!validation.valid) {
      return { errors: validation.errors };
    }
    const patch = {};
    for (const k of ['costoMateriales', 'costoManoObra', 'costoTraslado', 'costoOtros', 'montoCobrado']) {
      if (k in body) patch[k] = body[k];
    }
    const item = await otRepository.updateEconomics(id, patch, actor);
    if (!item) {
      return { error: 'OT no encontrada.' };
    }
    return item;
  },
};

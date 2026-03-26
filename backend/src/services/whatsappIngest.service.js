import {
  generateContentHashFromParts,
  normalizeWhatsAppInput,
  parseWhatsAppMessage,
} from '../domain/whatsapp-ingestion.js';
import {
  buildWhatsappOperationalSummary,
  calculateOperationalImpact,
  computeEstadoOperacional,
  findMatchingOtsAmbiguous,
  loadTecnicosRoster,
  nivelImpacto,
  resolveTechnician,
} from '../domain/whatsapp-operational.js';
import { otModel } from '../models/ot.model.js';
import { otRepository } from '../repositories/ot.repository.js';
import { whatsappFeedRepository } from '../repositories/whatsappFeed.repository.js';
import { operationalEventService } from './operationalEvent.service.js';
import { otService } from './ot.service.js';

const actor = 'whatsapp-ingest';

async function syncOperationalEventSafe(record, parsed) {
  try {
    await operationalEventService.syncFromWhatsappRecord(record, parsed, actor);
  } catch (e) {
    console.warn('[HNF] sync evento operativo (WhatsApp)', e?.message || e);
  }
}

function humanTecnicoNombre(nombre) {
  if (!nombre) return 'Por asignar';
  return String(nombre).slice(0, 120);
}

function buildSubtipo(parsed) {
  if (parsed.tipoTrabajo === 'limpieza') return 'Limpieza (WhatsApp)';
  if (parsed.tipoTrabajo === 'revision') return 'Revisión (WhatsApp)';
  if (parsed.tipoTrabajo === 'instalacion') return 'Instalación (WhatsApp)';
  if (parsed.tipo === 'flota') return parsed.patente ? `Flota · ${parsed.patente}` : 'Ingesta WhatsApp · flota';
  return 'Ingesta WhatsApp · clima';
}

function buildObservaciones(parsed, waId) {
  const parts = [`[Fuente: WhatsApp · ${waId}]`];
  if (parsed.patente) parts.push(`Patente: ${parsed.patente}.`);
  if (parsed.descripcion) parts.push(parsed.descripcion.slice(0, 600));
  return parts.join(' ').slice(0, 1800);
}

function mapArchivosToEvidencias(normalized, tecnicoNombre) {
  const tech = humanTecnicoNombre(tecnicoNombre);
  const ts = new Date(normalized.timestamp).toISOString();
  return (normalized.archivos || [])
    .filter((a) => a.url && String(a.url).trim())
    .map((a, i) => ({
      tipo: a.kind === 'foto' ? 'foto' : a.kind === 'ubicacion' ? 'ubicacion' : 'documento',
      url: a.url,
      timestamp: ts,
      tecnicoOrigen: tech,
      name: a.name || `wa-${i + 1}`,
    }));
}

function toOtEvidenceItems(evidencias) {
  return evidencias.map((e, i) => ({
    id: `wa-ev-${Date.now()}-${i}`,
    name: e.name || `whatsapp-${i + 1}`,
    url: e.url,
    createdAt: e.timestamp || new Date().toISOString(),
  }));
}

async function tryTerminado(otId, record) {
  const st = await otService.updateStatus(otId, 'terminado', otModel.statusOptions, actor);
  if (st?.error) {
    record.errores = [...(record.errores || []), `cierre_pendiente:${st.code || 'reglas_ot'}`];
  }
}

function enrichOperationalFields(record, parsed, ot) {
  const evidenciasCount = (record.evidencias || []).length;
  const estadoOperacional = computeEstadoOperacional(parsed, ot, evidenciasCount);
  const impacto = calculateOperationalImpact(record, ot);
  let impactoNivel = nivelImpacto(impacto, { mensajeCierre: parsed.estado === 'terminado' });
  if (record.cliente === 'desconocido' || record.tecnicoId === 'tecnico_no_identificado') {
    impactoNivel = 'critico';
  }
  return {
    ...record,
    estadoOperacional,
    impactoOperacional: impacto,
    impactoNivel,
  };
}

async function emitOperationalAlerts(record, parsed, ot) {
  const impacto = record.impactoOperacional || calculateOperationalImpact(record, ot);
  const push = (type, detalle) =>
    whatsappFeedRepository.appendFeedError({
      type,
      messageId: record.id,
      detalle,
      cliente: record.cliente,
      tecnicoId: record.tecnicoId,
      otId: record.otIdRelacionado || null,
    });

  if (record.tecnicoId === 'tecnico_no_identificado') {
    await push('tecnico_desconocido', 'Sin coincidencia en roster (teléfono, nombre o alias).');
  }
  if (record.cliente === 'desconocido') {
    await push('cliente_desconocido', 'Texto no matcheó al diccionario de clientes.');
  }
  const msgTerminado =
    parsed.estado === 'terminado' || record.estadoOperacional === 'terminado_tecnico';
  if (msgTerminado && !impacto.tieneEvidencia) {
    await push('terminado_sin_evidencia', 'Cierre declarado en mensaje sin evidencia adjunta ni en OT.');
  }
  if (ot && ot.estado === 'terminado' && !impacto.tieneCosto) {
    await push('terminado_sin_costo', 'OT en estado terminado sin costo > 0.');
  }
  if (ot && ot.estado === 'terminado' && impacto.tieneCosto && impacto.tienePdf && !impacto.tieneIngreso) {
    await push('terminado_sin_cobro', 'OT terminada con PDF e informada sin cobro registrado.');
  }
}

export async function ingestWhatsAppData(rawMessage, clientList = [], tecnicoRoster = null) {
  const roster = Array.isArray(tecnicoRoster) ? tecnicoRoster : loadTecnicosRoster();
  const normalized = normalizeWhatsAppInput(rawMessage);
  const parsed = parseWhatsAppMessage(normalized, clientList);
  const tech = resolveTechnician(normalized, normalized.texto || '', roster);
  const erroresParseo = [...(parsed.erroresParseo || []), ...(tech.errors || [])];

  const hashContenido = generateContentHashFromParts({
    textoNormalizado: normalized.textoNormalizado,
    fechaAproximada: normalized.fechaAproximada,
    tecnicoId: tech.tecnicoId,
    tecnicoNombre: tech.nombre,
  });

  const evidencias = mapArchivosToEvidencias(normalized, tech.nombre);
  const store = await whatsappFeedRepository.getAll();

  const existingByHash = await whatsappFeedRepository.findByHash(hashContenido);
  if (existingByHash) {
    const mergedEvid = [...(existingByHash.evidencias || []), ...evidencias];
    let ot = null;
    if (existingByHash.otIdRelacionado) {
      ot = await otRepository.findById(existingByHash.otIdRelacionado);
    }
    let updatedWa = {
      ...existingByHash,
      evidencias: mergedEvid,
      errores: [...new Set([...(existingByHash.errores || []), ...erroresParseo])],
      tecnicoId: tech.tecnicoId,
      tecnico: tech.nombre,
      updatedAt: new Date().toISOString(),
      procesado: true,
      resultadoIngesta: 'actualizado',
    };
    updatedWa = enrichOperationalFields(updatedWa, parsed, ot);
    await whatsappFeedRepository.saveMessage(updatedWa);

    const otId = existingByHash.otIdRelacionado;
    if (otId && evidencias.length) {
      const items = toOtEvidenceItems(evidencias);
      await otRepository.appendEvidences(otId, { fotografiasDurante: items }, actor);
    }

    await whatsappFeedRepository.appendLog({
      messageId: updatedWa.id,
      parsedData: parsed,
      resultado: 'ignorado',
      detalle: 'duplicado_hash',
      otId: otId || null,
    });

    await emitOperationalAlerts(updatedWa, parsed, ot);

    await syncOperationalEventSafe(updatedWa, parsed);
    return { record: updatedWa, otId: otId || null, resultado: 'ignorado', hashContenido };
  }

  const waId = whatsappFeedRepository.nextId(store.messages);
  let record = waRecordBase({
    id: waId,
    externalId: normalized.externalId,
    hashContenido,
    parsed,
    normalized,
    evidencias,
    rawOriginal: rawMessage,
    erroresParseo,
    tecnicoId: tech.tecnicoId,
    tecnico: tech.nombre,
  });

  const ots = await otRepository.findAll();
  const { ot: otMatch, code: matchCode } = findMatchingOtsAmbiguous(ots, parsed, normalized, tech.nombre);
  let ot = null;
  let resultado = 'creado';

  if (matchCode === 'multiple_match') {
    record.errores = [...(record.errores || []), 'multiple_match'];
    record.procesado = true;
    record.resultadoIngesta = 'sin_ot_ambiguo';
    record = enrichOperationalFields(record, parsed, null);
    await whatsappFeedRepository.createMessage(record);
    await whatsappFeedRepository.appendFeedError({
      type: 'multiple_match',
      messageId: waId,
      detalle: 'Varias OT coinciden; no se vinculó automáticamente.',
      cliente: record.cliente,
      tecnicoId: record.tecnicoId,
      otId: null,
    });
    await whatsappFeedRepository.appendLog({
      messageId: waId,
      parsedData: parsed,
      resultado: 'sin_ot_ambiguo',
      detalle: 'multiple_match',
      otId: null,
    });
    await emitOperationalAlerts(record, parsed, null);
    await syncOperationalEventSafe(record, parsed);
    return { record, otId: null, resultado: 'sin_ot_ambiguo', hashContenido };
  }

  if (otMatch) {
    resultado = 'actualizado';
    record.otIdRelacionado = otMatch.id;
    const extraObs = `\n[${waId}] ${parsed.descripcion?.slice(0, 400) || ''}`.trim();
    const newObs = `${String(otMatch.observaciones || '').slice(0, 1400)}${extraObs}`.slice(0, 1800);
    await otRepository.updateVisitFields(otMatch.id, { observaciones: newObs }, actor);

    if (evidencias.length) {
      const items = toOtEvidenceItems(evidencias);
      await otRepository.appendEvidences(otMatch.id, { fotografiasDurante: items }, actor);
    }

    if (parsed.estado === 'terminado') {
      await tryTerminado(otMatch.id, record);
    }
    ot = await otRepository.findById(otMatch.id);
  } else {
    const payload = {
      cliente: parsed.cliente && parsed.cliente !== 'desconocido' ? parsed.cliente : 'Cliente WhatsApp (sin nombre)',
      direccion: parsed.ubicacion || 'Pendiente — confirma dirección en panel',
      comuna: 'Pendiente',
      contactoTerreno: humanTecnicoNombre(tech.nombre),
      telefonoContacto: '000000000',
      tipoServicio: parsed.tipo === 'flota' ? 'flota' : 'clima',
      subtipoServicio: buildSubtipo(parsed),
      tecnicoAsignado: humanTecnicoNombre(tech.nombre),
      fecha: parsed.fecha,
      hora: parsed.hora || '09:00',
      observaciones: buildObservaciones(parsed, waId),
      resumenTrabajo: (parsed.descripcion || 'Registro vía WhatsApp.').slice(0, 400),
      recomendaciones: '—',
      equipos: [],
    };

    const created = await otService.create(payload, actor);
    if (created.errors) {
      record.errores = [...(record.errores || []), ...created.errors.map((e) => `ot_create:${e}`)];
      record.procesado = true;
      record.resultadoIngesta = 'error';
      record = enrichOperationalFields(record, parsed, null);
      await whatsappFeedRepository.createMessage(record);
      await whatsappFeedRepository.appendLog({
        messageId: waId,
        parsedData: parsed,
        resultado: 'error',
        detalle: created.errors.join('; '),
        otId: null,
      });
      await emitOperationalAlerts(record, parsed, null);
      return { record, otId: null, resultado: 'error', hashContenido };
    }

    record.otIdRelacionado = created.id;
    if (evidencias.length) {
      const items = toOtEvidenceItems(evidencias);
      await otRepository.appendEvidences(created.id, { fotografiasDurante: items }, actor);
    }

    if (parsed.estado === 'terminado') {
      await tryTerminado(created.id, record);
    }
    ot = await otRepository.findById(created.id);
  }

  record.procesado = true;
  record.resultadoIngesta = resultado;
  record = enrichOperationalFields(record, parsed, ot);
  await whatsappFeedRepository.createMessage(record);

  await whatsappFeedRepository.appendLog({
    messageId: record.id,
    parsedData: parsed,
    resultado,
    detalle: ot?.id || null,
    otId: ot?.id || null,
  });

  await emitOperationalAlerts(record, parsed, ot);

  await syncOperationalEventSafe(record, parsed);
  return { record, otId: ot?.id || null, resultado, hashContenido };
}

function waRecordBase({
  id,
  externalId,
  hashContenido,
  parsed,
  normalized,
  evidencias,
  rawOriginal,
  erroresParseo,
  tecnicoId,
  tecnico,
}) {
  const errores = [...(erroresParseo || [])];
  if (!evidencias.length && !(parsed.descripcion || '').trim()) {
    errores.push('sin_evidencia_ni_texto');
  }
  return {
    id,
    externalId: externalId || '',
    tipo: parsed.tipo,
    cliente: parsed.cliente,
    tecnicoId,
    tecnico,
    fecha: parsed.fecha,
    ubicacion: parsed.ubicacion,
    patente: parsed.patente,
    descripcion: parsed.descripcion,
    tipoTrabajo: parsed.tipoTrabajo,
    evidencias,
    estado: parsed.estado === 'terminado' ? 'terminado' : parsed.estado === 'pendiente' ? 'pendiente' : 'en_proceso',
    observaciones: parsed.descripcion?.slice(0, 500) || '',
    fuente: 'whatsapp',
    hashContenido,
    procesado: false,
    errores,
    otIdRelacionado: null,
    rawOriginal,
    parsedData: parsed,
    resultadoIngesta: null,
    estadoOperacional: 'capturado',
    impactoOperacional: null,
    impactoNivel: 'atencion',
  };
}

export async function listFeed() {
  const data = await whatsappFeedRepository.getAll();
  const messages = data.messages || [];
  return {
    messages,
    ingestLogs: data.ingestLogs || [],
    errors: data.errors || [],
    operationalSummary: buildWhatsappOperationalSummary(messages),
  };
}

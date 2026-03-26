import { technicalDocumentRepository } from '../repositories/technicalDocument.repository.js';
import { otRepository } from '../repositories/ot.repository.js';

const ESTADOS = ['borrador', 'en_revision', 'observado', 'aprobado', 'enviado'];

const validEstado = (e) => ESTADOS.includes(String(e || '').trim());

export async function listTechnicalDocuments() {
  const list = await technicalDocumentRepository.findAll();
  return list.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getTechnicalDocument(id) {
  return technicalDocumentRepository.findById(String(id || '').trim());
}

async function applyOtDefaults(body) {
  const otId = String(body.otId || '').trim();
  if (!otId) return body;
  const ots = await otRepository.findAll();
  const o = ots.find((x) => x.id === otId);
  if (!o) return body;
  const next = { ...body };
  if (!next.cliente) next.cliente = o.cliente || '';
  if (!next.fechaServicio && o.fecha) next.fechaServicio = String(o.fecha).slice(0, 10);
  if (!next.tecnicos?.length && o.tecnicoAsignado) next.tecnicos = [String(o.tecnicoAsignado)];
  if (!next.tituloDocumento) next.tituloDocumento = `Informe técnico · ${o.cliente || otId}`;
  return next;
}

export async function createTechnicalDocument(body, actor) {
  const estado = validEstado(body.estadoDocumento) ? body.estadoDocumento : 'borrador';
  let payload = {
    otId: body.otId != null ? String(body.otId).trim() : '',
    cliente: String(body.cliente ?? '').trim(),
    tiendaNombre: String(body.tiendaNombre ?? '').trim(),
    sucursal: String(body.sucursal ?? '').trim(),
    fechaServicio: String(body.fechaServicio ?? '').slice(0, 10),
    horaIngreso: String(body.horaIngreso ?? '').trim(),
    horaSalida: String(body.horaSalida ?? '').trim(),
    tecnicos: Array.isArray(body.tecnicos) ? body.tecnicos : [],
    tipoMantencion: String(body.tipoMantencion ?? '').trim(),
    estadoDocumento: estado,
    fuente: String(body.fuente || 'manual').trim(),
    numeroDocumento: String(body.numeroDocumento ?? '').trim(),
    tituloDocumento: String(body.tituloDocumento ?? '').trim(),
    resumenEjecutivo: String(body.resumenEjecutivo ?? '').trim(),
    inspeccionInicial: String(body.inspeccionInicial ?? '').trim(),
    trabajosRealizados: String(body.trabajosRealizados ?? '').trim(),
    materialesHerramientas: String(body.materialesHerramientas ?? '').trim(),
    epp: String(body.epp ?? '').trim(),
    observacionesTecnicas: String(body.observacionesTecnicas ?? '').trim(),
    recomendaciones: String(body.recomendaciones ?? '').trim(),
    recepcionTrabajo: String(body.recepcionTrabajo ?? '').trim(),
    limitacionesServicio: String(body.limitacionesServicio ?? '').trim(),
    garantiaObservada: String(body.garantiaObservada ?? '').trim(),
    hallazgosCriticos: Array.isArray(body.hallazgosCriticos) ? body.hallazgosCriticos : [],
    mediciones: Array.isArray(body.mediciones) ? body.mediciones : [],
    evidencias: Array.isArray(body.evidencias) ? body.evidencias : [],
    activosRelacionados: Array.isArray(body.activosRelacionados) ? body.activosRelacionados : [],
    eventosIngesta: Array.isArray(body.eventosIngesta) ? body.eventosIngesta : [],
    clienteInformePremium: body.clienteInformePremium && typeof body.clienteInformePremium === 'object' ? body.clienteInformePremium : null,
    alertasIngesta: Array.isArray(body.alertasIngesta) ? body.alertasIngesta : [],
    ingestaResumen: body.ingestaResumen && typeof body.ingestaResumen === 'object' ? body.ingestaResumen : null,
    analisisJarvis: body.analisisJarvis && typeof body.analisisJarvis === 'object' ? body.analisisJarvis : null,
  };
  payload = await applyOtDefaults(payload);
  const row = await technicalDocumentRepository.create(payload, actor);
  return { entry: row };
}

export async function patchTechnicalDocument(id, body, actor) {
  const cur = await technicalDocumentRepository.findById(id);
  if (!cur) return { error: 'Documento no encontrado.' };

  const allowed = [
    'otId',
    'cliente',
    'tiendaNombre',
    'sucursal',
    'fechaServicio',
    'horaIngreso',
    'horaSalida',
    'tecnicos',
    'tipoMantencion',
    'estadoDocumento',
    'fuente',
    'numeroDocumento',
    'tituloDocumento',
    'resumenEjecutivo',
    'inspeccionInicial',
    'trabajosRealizados',
    'materialesHerramientas',
    'epp',
    'observacionesTecnicas',
    'recomendaciones',
    'recepcionTrabajo',
    'limitacionesServicio',
    'garantiaObservada',
    'hallazgosCriticos',
    'mediciones',
    'evidencias',
    'activosRelacionados',
    'clienteInformePremium',
    'enviadoRevisionPor',
    'enviadoRevisionEn',
    'observadoPor',
    'observadoEn',
    'aprobadoPor',
    'aprobadoEn',
    'enviadoClientePor',
    'enviadoClienteEn',
    'alertasIngesta',
    'ingestaResumen',
    'analisisJarvis',
  ];

  const patch = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }
  if (patch.estadoDocumento != null && !validEstado(patch.estadoDocumento)) {
    return { error: `estadoDocumento inválido (${ESTADOS.join(', ')}).` };
  }

  const est = patch.estadoDocumento;
  const now = new Date().toISOString();
  if (est === 'en_revision') {
    patch.enviadoRevisionPor = patch.enviadoRevisionPor ?? actor;
    patch.enviadoRevisionEn = patch.enviadoRevisionEn ?? now;
  }
  if (est === 'observado') {
    patch.observadoPor = patch.observadoPor ?? actor;
    patch.observadoEn = patch.observadoEn ?? now;
  }
  if (est === 'aprobado') {
    patch.aprobadoPor = patch.aprobadoPor ?? actor;
    patch.aprobadoEn = patch.aprobadoEn ?? now;
  }
  if (est === 'enviado') {
    patch.enviadoClientePor = patch.enviadoClientePor ?? actor;
    patch.enviadoClienteEn = patch.enviadoClienteEn ?? now;
  }

  const versionNota = String(body.versionNota || '').trim();

  const row = await technicalDocumentRepository.update(
    id,
    { ...patch, ...(versionNota ? { versionNota } : {}) },
    actor
  );
  return { entry: row };
}

export async function addDocumentComment(id, body, actor) {
  const cur = await technicalDocumentRepository.findById(id);
  if (!cur) return { error: 'Documento no encontrado.' };
  const row = await technicalDocumentRepository.appendComment(id, body, actor);
  return { entry: row };
}

export async function addDocumentIngesta(id, body, actor) {
  const cur = await technicalDocumentRepository.findById(id);
  if (!cur) return { error: 'Documento no encontrado.' };
  const row = await technicalDocumentRepository.appendIngestaEvent(id, body, actor);
  return { entry: row };
}

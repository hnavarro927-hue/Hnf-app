import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { maestroService } from '../services/maestro.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

const qParam = (request) => {
  try {
    const u = new URL(request.url || '/', 'http://localhost');
    return String(u.searchParams.get('q') || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const filterByQ = (list, q, pick) => {
  if (!q) return list;
  return list.filter((x) => pick(x).some((s) => String(s || '').toLowerCase().includes(q)));
};

export const getMaestroContactos = async (request, response) => {
  const all = await maestroService.listContactos();
  const q = qParam(request);
  const data = filterByQ(all, q, (x) => [x.nombre_contacto, x.correo, x.cliente_id]);
  sendSuccess(response, 200, data, { resource: 'maestro/contactos' });
};

export const postMaestroContacto = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.createContacto(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'maestro/contactos', action: 'create' });
};

export const patchMaestroContacto = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.patchContacto(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/contactos', action: 'patch' });
};

export const getMaestroTecnicos = async (_request, response) => {
  sendSuccess(response, 200, await maestroService.listTecnicos(), { resource: 'maestro/tecnicos' });
};

export const postMaestroTecnico = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.createTecnico(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'maestro/tecnicos', action: 'create' });
};

export const patchMaestroTecnico = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.patchTecnico(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/tecnicos', action: 'patch' });
};

export const getMaestroConductores = async (_request, response) => {
  sendSuccess(response, 200, await maestroService.listConductores(), { resource: 'maestro/conductores' });
};

export const postMaestroConductor = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.createConductor(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'maestro/conductores', action: 'create' });
};

export const patchMaestroConductor = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.patchConductor(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/conductores', action: 'patch' });
};

export const getMaestroVehiculos = async (request, response) => {
  const all = await maestroService.listVehiculos();
  const q = qParam(request);
  const data = filterByQ(all, q, (x) => [x.patente, x.marca, x.modelo, x.cliente_id]);
  sendSuccess(response, 200, data, { resource: 'maestro/vehiculos' });
};

export const postMaestroVehiculo = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.createVehiculo(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'maestro/vehiculos', action: 'create' });
};

export const patchMaestroVehiculo = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.patchVehiculo(request.params?.id, request.body || {}, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/vehiculos', action: 'patch' });
};

export const getMaestroDocumentos = async (request, response) => {
  const all = await maestroService.listDocumentos();
  const q = qParam(request);
  const data = filterByQ(all, q, (x) => [
    x.nombre_archivo,
    x.resumen_jarvis,
    x.estado_revision,
    x.modulo_destino_sugerido,
  ]).map((d) => {
    const { ruta_interna, texto_match_sample, ...rest } = d;
    return { ...rest, tiene_archivo: Boolean(ruta_interna) };
  });
  sendSuccess(response, 200, data, { resource: 'maestro/documentos' });
};

export const postMaestroDocumentosIngesta = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.ingestArchivosBase64(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 201, r, { resource: 'maestro/documentos', action: 'ingesta' });
};

export const postMaestroDocumentosRepararVinculos = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.repararVinculosHistoricos(request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  sendSuccess(response, 200, r, { resource: 'maestro/documentos', action: 'reparar_vinculos' });
};

export const patchMaestroDocumento = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.patchDocumento(request.params?.id, request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/documentos', action: 'patch' });
};

export const postMaestroDocumentoReclasificar = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.reclasificarDocumento(request.params?.id, actor);
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 200, r, { resource: 'maestro/documentos', action: 'reclasificar' });
};

export const postMaestroDocumentoCrearEntidad = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.crearEntidadDesdeDocumento(request.params?.id, request.body || {}, actor);
  if (r.errors) return sendError(response, 400, 'Inválido', { validations: r.errors });
  if (r.error) return sendError(response, 404, r.error);
  sendSuccess(response, 201, r, { resource: 'maestro/documentos', action: 'crear_entidad' });
};

/** Descarga binaria (no JSON). */
export const getMaestroDocumentoDescarga = async (request, response) => {
  const doc = await maestroService.getDocumento(request.params?.id);
  if (!doc?.ruta_interna) return sendError(response, 404, 'Archivo no encontrado');
  const abs = await maestroService.getDocumentoAbsolutePath(doc);
  if (!abs) return sendError(response, 404, 'Ruta inválida');
  try {
    await access(abs);
  } catch {
    return sendError(response, 404, 'Archivo no disponible en disco');
  }
  const mime = String(doc.tipo_archivo || 'application/octet-stream');
  const name = String(doc.nombre_archivo || 'archivo').replace(/"/g, '');
  response.writeHead(200, {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="${name}"`,
  });
  createReadStream(abs).pipe(response);
};

/**
 * Ejecución de guardado SOLO tras confirmación explícita del operador.
 */

import { JARVIS_DOCUMENT_TYPE } from './jarvis-knowledge-layers.js';

/**
 * @param {object} hooks
 * @param {(body: object) => Promise<any>} hooks.postCargaMasiva
 * @param {(body: object) => Promise<any>} hooks.postExtendedClient
 * @param {(body: object) => Promise<any>} hooks.postInternalDirectory
 * @param {(payload: object) => Promise<any>} hooks.createOt
 */
export async function saveIngestionToValidationQueue(pipelineResult, hooks) {
  const tipo =
    pipelineResult.docType === JARVIS_DOCUMENT_TYPE.LISTADO_CLIENTES
      ? 'cliente'
      : pipelineResult.docType === JARVIS_DOCUMENT_TYPE.OT_HISTORICA
        ? 'ot_historica'
        : pipelineResult.docType === JARVIS_DOCUMENT_TYPE.PROPUESTA_COMERCIAL
          ? 'propuesta_comercial'
          : 'generico';

  const rows = (pipelineResult.records || []).map((r, i) => {
    const payload = r.record;
    const titulo =
      payload.titulo ||
      payload.nombre ||
      payload.nombreCompleto ||
      payload.cliente ||
      `Fila ${i + 1} · ${tipo}`;
    const area =
      payload.tipoServicio === 'flota' || payload.area === 'flota'
        ? 'flota'
        : payload.area === 'comercial'
          ? 'comercial'
          : 'clima';
    return {
      titulo: String(titulo).slice(0, 200),
      cliente: payload.cliente || payload.nombre,
      area,
      critico: Boolean(r.flags?.duplicateInSystem),
      posibleDuplicadoDe: r.flags?.duplicateInSystem ? String(payload.id || '') : null,
      payload,
    };
  });

  return hooks.postCargaMasiva({ tipo, rows });
}

function otPayloadFromRecord(r) {
  const p = r.record || r;
  return {
    ...(p.id ? { id: String(p.id).trim() } : {}),
    cliente: String(p.cliente || '').trim(),
    direccion: String(p.direccion || '').trim(),
    comuna: String(p.comuna || '').trim(),
    contactoTerreno: String(p.contactoTerreno || '').trim(),
    telefonoContacto: String(p.telefonoContacto || '').trim(),
    tipoServicio: p.tipoServicio === 'flota' ? 'flota' : 'clima',
    subtipoServicio: String(p.subtipoServicio || 'Importación histórica').trim(),
    fecha: String(p.fecha || '').trim(),
    hora: String(p.hora || '09:00').trim(),
    observaciones: `[Jarvis ingesta] ${String(p.estado || '')} ${String(p.origenPedido || '')}`.trim(),
    resumenTrabajo: '',
    recomendaciones: '',
    tecnicoAsignado: String(p.tecnicoAsignado || 'Por asignar').trim(),
    equipos: [],
    operationMode: 'manual',
    origenPedido: String(p.origenPedido || 'manual').slice(0, 120),
  };
}

/** Solo filas OT sin campos faltantes ni duplicados en archivo. */
export async function saveOtDirectFromPipeline(pipelineResult, hooks) {
  const eligible = (pipelineResult.records || []).filter(
    (r) =>
      (!r.missing || r.missing.length === 0) &&
      !r.flags?.duplicateInFile &&
      !r.flags?.duplicateInSystem &&
      r.record?.cliente
  );
  const results = { ok: [], fail: [] };
  for (const r of eligible) {
    try {
      const payload = otPayloadFromRecord(r);
      const res = await hooks.createOt(payload);
      results.ok.push({ id: payload.id || res?.data?.id, cliente: payload.cliente });
    } catch (e) {
      results.fail.push({
        cliente: r.record?.cliente,
        error: e?.message || String(e),
      });
    }
  }
  return results;
}

export async function saveGuidedClient(session, hooks) {
  const d = session.data;
  const body = {
    nombre: d.nombre,
    contactoPrincipal: d.contactoPrincipal || d.nombre,
    telefono: d.telefono,
    correo: d.correo,
    direccion: d.direccion,
    comuna: d.comuna,
    observaciones: d.region ? `Zona: ${d.region}` : '',
    area: String(d.area || 'clima').toLowerCase().includes('flota') ? 'flota' : 'clima',
  };
  return hooks.postExtendedClient(body);
}

export async function saveGuidedDirectory(session, hooks) {
  const d = session.data;
  const body = {
    nombreCompleto: d.nombreCompleto,
    rol: d.rol || 'Equipo operativo',
    area: d.area || d.comuna || 'General',
    telefono: d.telefono,
    correo: d.correo,
    permisos: d.permisos || { jarvisIngesta: true },
    activo: true,
  };
  return hooks.postInternalDirectory(body);
}

/**
 * Exportación estructurada (base para PDF/Word/Excel futuros).
 */
export function downloadIngestionExportJson(pipelineResult, fileStem = 'jarvis_export') {
  const blob = new Blob([JSON.stringify(pipelineResult.exportReady, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileStem.replace(/[^a-z0-9-_]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

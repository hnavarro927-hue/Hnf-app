import { buildOpportunityRowsForDocument } from './commercialOpportunity.generator.js';
import { commercialOpportunityRepository } from '../repositories/commercialOpportunity.repository.js';

export async function listCommercialOpportunities() {
  const list = await commercialOpportunityRepository.findAll();
  return list.sort((a, b) => String(b.fechaCreacion).localeCompare(String(a.fechaCreacion)));
}

export async function getCommercialOpportunity(id) {
  return commercialOpportunityRepository.findById(String(id || '').trim());
}

export async function patchCommercialOpportunityStatus(id, body, actor) {
  const estado = String(body?.estado ?? '').trim();
  const row = await commercialOpportunityRepository.updateEstado(String(id || '').trim(), estado, actor);
  if (!row) return { error: 'Oportunidad no encontrada o estado inválido.' };
  return { entry: row };
}

export async function syncCommercialOpportunitiesOnApproval(documentRow, actor) {
  const doc = documentRow || {};
  if (String(doc.estadoDocumento || '') !== 'aprobado') return { created: [] };
  await commercialOpportunityRepository.deleteAutomaticByTechnicalDocumentId(doc.id);
  const rows = buildOpportunityRowsForDocument(doc, actor);
  if (!rows.length) return { created: [] };
  const created = await commercialOpportunityRepository.insertMany(rows, actor);
  return { created };
}

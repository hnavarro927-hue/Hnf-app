/**
 * Capas de conocimiento Jarvis + tipología documental para ingesta.
 * (A) Sistema estructurado (B) Inteligencia de negocio (C) Documentos (D) Tabular
 */

export const JARVIS_KNOWLEDGE_ENGINE_VERSION = '2026-03-27-ingest';

/** @readonly */
export const KNOWLEDGE_LAYER_ID = {
  STRUCTURED: 'structured_system',
  BUSINESS: 'hnf_business_intelligence',
  DOCUMENTS: 'document_knowledge',
  TABULAR: 'spreadsheet_tabular',
};

/**
 * Tipos de documento que la ingesta intenta clasificar (UI + motor).
 * @readonly
 */
export const JARVIS_DOCUMENT_TYPE = {
  PROPUESTA_COMERCIAL: 'propuesta_comercial',
  COTIZACION: 'cotizacion',
  CONTRATO: 'contrato',
  MANUAL: 'manual',
  PROCEDIMIENTO_INTERNO: 'procedimiento_interno',
  OT_HISTORICA: 'ot_historica',
  PLANILLA_MANTENCIONES: 'planilla_mantenciones',
  LISTADO_CLIENTES: 'listado_clientes',
  LISTADO_TECNICOS: 'listado_tecnicos',
  LISTADO_CONDUCTORES: 'listado_conductores',
  SUCURSALES_LOCALES: 'sucursales_locales',
  INFORME_TECNICO: 'informe_tecnico',
  DESCONOCIDO: 'documento_desconocido',
};

export const JARVIS_DOCUMENT_TYPE_LABEL = {
  [JARVIS_DOCUMENT_TYPE.PROPUESTA_COMERCIAL]: 'Propuesta comercial',
  [JARVIS_DOCUMENT_TYPE.COTIZACION]: 'Cotización',
  [JARVIS_DOCUMENT_TYPE.CONTRATO]: 'Contrato',
  [JARVIS_DOCUMENT_TYPE.MANUAL]: 'Manual',
  [JARVIS_DOCUMENT_TYPE.PROCEDIMIENTO_INTERNO]: 'Procedimiento interno',
  [JARVIS_DOCUMENT_TYPE.OT_HISTORICA]: 'OT histórica (lote)',
  [JARVIS_DOCUMENT_TYPE.PLANILLA_MANTENCIONES]: 'Planilla de mantenciones',
  [JARVIS_DOCUMENT_TYPE.LISTADO_CLIENTES]: 'Listado de clientes',
  [JARVIS_DOCUMENT_TYPE.LISTADO_TECNICOS]: 'Listado de técnicos',
  [JARVIS_DOCUMENT_TYPE.LISTADO_CONDUCTORES]: 'Listado de conductores',
  [JARVIS_DOCUMENT_TYPE.SUCURSALES_LOCALES]: 'Sucursales / locales',
  [JARVIS_DOCUMENT_TYPE.INFORME_TECNICO]: 'Informe técnico',
  [JARVIS_DOCUMENT_TYPE.DESCONOCIDO]: 'Documento desconocido · requiere revisión',
};

/**
 * Arquitectura de proveedores (extensible: API, RAG, conectores).
 * Cada proveedor declara capas que alimenta.
 */
export const JARVIS_KNOWLEDGE_PROVIDER_ARCH = {
  version: 1,
  providers: [
    { id: 'view_data', layers: [KNOWLEDGE_LAYER_ID.STRUCTURED], source: 'frontend_session' },
    { id: 'hnf_process_rules', layers: [KNOWLEDGE_LAYER_ID.BUSINESS], source: 'jarvis-copilot-knowledge' },
    { id: 'upload_ingest', layers: [KNOWLEDGE_LAYER_ID.TABULAR, KNOWLEDGE_LAYER_ID.DOCUMENTS], source: 'jarvis-ingestion-engine' },
    { id: 'documents_rag', layers: [KNOWLEDGE_LAYER_ID.DOCUMENTS], source: 'future_connector', available: false },
    {
      id: 'hnf_intelligence_base_v1',
      layers: [KNOWLEDGE_LAYER_ID.STRUCTURED, KNOWLEDGE_LAYER_ID.BUSINESS],
      source: 'domain/hnf-intelligence-base-v1',
      available: true,
    },
  ],
};

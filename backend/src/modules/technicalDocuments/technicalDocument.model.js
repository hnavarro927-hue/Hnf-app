export const TECH_DOC_ESTADOS = ['borrador', 'en_revision', 'observado', 'aprobado', 'enviado'];

export const INGEST_ALERT_CODES = {
  FUGA_REF: 'RISK_FUGA_REF',
  FILTRACION: 'ALERT_FILTRACION',
  AISLAMIENTO: 'ALERT_EFICIENCIA_AISLAMIENTO',
  REDACCION_CONTRAD: 'ALERT_REDACCION_CONTRADIC',
};

export const HNF_TECH_DOC_PARSER_VERSION = '2026-03-22';

/** Acciones registradas en historial documental (auditoría). */
export const DOC_CONTROL_ACCIONES = {
  CREAR: 'crear',
  INGESTA: 'ingesta',
  REVISAR: 'revisar',
  OBSERVAR: 'observar',
  APROBAR: 'aprobar',
  ENVIAR: 'enviar',
  PATCH: 'patch_generico',
};

/**
 * Aprobadores / controladores formales (nombre operador, primer token o coincidencia).
 * Ampliar según política HNF.
 */
export const DOC_CONTROL_APROBADORES_PRIMARIOS = ['lyn', 'hernan', 'hernán'];

export const DOC_CONTROL_VERSION_INICIAL = 1;

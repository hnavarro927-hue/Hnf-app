/**
 * Mapea destinos internos del router (`jarvis-document-router.js`) a claves API Stark / UI.
 */

export function mapDestinationToStarkApi(internal) {
  const m = {
    documentos_cliente: 'cliente_documentos',
    bandeja_revision: 'bandeja_revision_jarvis',
    ot: 'OT',
    compras: 'compras',
    finanzas: 'finanzas',
    evidencia: 'evidencia',
  };
  return m[internal] || internal;
}

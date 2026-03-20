// Base inicial para evidencias y comprobantes.
// Normaliza referencias de archivos, pero todavía no implementa almacenamiento final.
export const normalizeFiles = (payload = {}, fieldName = 'files') => {
  const files = payload[fieldName] || payload.archivos || payload.fotografias || [];

  return Array.isArray(files)
    ? files.map((file, index) => ({
        id: `${fieldName}-${index + 1}`,
        name: typeof file === 'string' ? file : file.name || `archivo-${index + 1}`,
        url: typeof file === 'string' ? file : file.url || '',
      }))
    : [];
};

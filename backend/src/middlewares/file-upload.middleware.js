const makeEvidenceId = (prefix, index) =>
  `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;

export const normalizeEvidenceItem = (file, fieldName, index) => {
  const name =
    typeof file === 'string'
      ? file
      : file?.name || `archivo-${index + 1}`;
  const url = typeof file === 'string' ? '' : file?.url || '';
  const createdAt =
    typeof file === 'object' && file?.createdAt
      ? file.createdAt
      : new Date().toISOString();
  const id =
    typeof file === 'object' && file?.id
      ? file.id
      : makeEvidenceId(fieldName, index);

  return { id, name, url, createdAt };
};

// Normaliza referencias de archivos para crear OT o anexar evidencias.
export const normalizeFiles = (payload = {}, fieldName = 'files') => {
  const files = payload[fieldName] || payload.archivos || payload.fotografias || [];

  return Array.isArray(files)
    ? files.map((file, index) => normalizeEvidenceItem(file, fieldName, index))
    : [];
};

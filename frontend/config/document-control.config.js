const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** Alineado con backend `DOC_CONTROL_APROBADORES_PRIMARIOS` */
const PRIMARIOS = ['lyn', 'hernan', 'hernán'];

export function isDocumentControlApprover(rawName) {
  const raw = norm(rawName);
  if (!raw) return false;
  const first = raw.split(/\s+/)[0] || raw;
  return PRIMARIOS.some((p) => first === norm(p) || raw.includes(norm(p)));
}

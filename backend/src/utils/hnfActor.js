/** Hasta login formal: admin por nombre en X-HNF-Actor (alineado a resolveOperatorRole en frontend). */
export const isAdminActor = (actor) => {
  const a = String(actor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!a.trim()) return false;
  return a.includes('admin') || a.includes('hernan');
};

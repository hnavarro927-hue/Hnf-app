export const HVAC_CHECKLIST_TEMPLATE = [
  { id: 'filtros', label: 'Filtros revisados o reemplazados' },
  { id: 'drenaje', label: 'Línea de drenaje despejada' },
  { id: 'presiones', label: 'Presiones / temperaturas de trabajo verificadas' },
  { id: 'limpieza', label: 'Limpieza de serpentín / unidad según corresponda' },
  { id: 'electrico', label: 'Revisión eléctrica básica (conexiones visibles)' },
  { id: 'funcionamiento', label: 'Prueba de funcionamiento en frío/calor' },
];

export const mergeEquipoChecklist = (equipo = {}) => {
  const raw = Array.isArray(equipo.checklist) ? equipo.checklist : [];
  const byId = Object.fromEntries(raw.map((c) => [c.id, c]));
  return HVAC_CHECKLIST_TEMPLATE.map((t) => ({
    id: t.id,
    label: t.label,
    realizado: Boolean(byId[t.id]?.realizado),
  }));
};

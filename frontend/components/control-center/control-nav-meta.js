/**
 * Metadatos de navegación — Centro de Control HNF (cockpit).
 */

export const NAV_TECH_ACCENT = {
  'matriz-hnf': 'matrix',
  'centro-control': 'matrix',
  jarvis: 'jarvis',
  'ingreso-operativo': 'matrix',
  'bandeja-canal': 'matrix',
  clima: 'clima',
  planificacion: 'clima',
  flota: 'flota',
  oportunidades: 'flota',
  'ordenes-compra': 'matrix',
  'control-gerencial': 'matrix',
  finanzas: 'matrix',
  equipo: 'matrix',
  'hnf-core': 'neutral',
  'base-maestra': 'neutral',
  'documentos-tecnicos': 'jarvis',
};

/** Grupos del rail cockpit — A Gerencia, B Operaciones, C Base maestra, Sistema. */
export const COCKPIT_GROUP_ORDER = ['gerencia', 'operaciones', 'base_maestra', 'sistema'];

export const COCKPIT_GROUP_LABEL = {
  gerencia: 'Matriz / Gerencia',
  operaciones: 'Operaciones',
  base_maestra: 'Base maestra',
  sistema: 'Sistema',
};

/** Vista → grupo del menú lateral (colapsable por grupo, sin afectar el panel principal). */
export const COCKPIT_NAV_GROUP = {
  'matriz-hnf': 'gerencia',
  'control-gerencial': 'gerencia',
  finanzas: 'gerencia',
  jarvis: 'gerencia',
  'centro-control': 'operaciones',
  'ingreso-operativo': 'operaciones',
  'ingreso-clasico': 'operaciones',
  'bandeja-canal': 'operaciones',
  'bandeja-romina': 'operaciones',
  'bandeja-gery': 'operaciones',
  'lyn-aprobacion': 'operaciones',
  clima: 'operaciones',
  planificacion: 'operaciones',
  flota: 'operaciones',
  oportunidades: 'operaciones',
  'ordenes-compra': 'operaciones',
  'jarvis-intake': 'operaciones',
  'jarvis-intake-hub': 'operaciones',
  'jarvis-universal-intake': 'operaciones',
  'hnf-core': 'base_maestra',
  'base-maestra': 'base_maestra',
  'documentos-tecnicos': 'base_maestra',
  'technical-documents': 'base_maestra',
  equipo: 'base_maestra',
  auditoria: 'sistema',
  usuarios: 'sistema',
  'jarvis-vault': 'sistema',
  asistente: 'sistema',
  'operacion-control': 'sistema',
  'panel-operativo-vivo': 'sistema',
  whatsapp: 'sistema',
};

/** @deprecated Usar COCKPIT_NAV_GROUP */
export const VIEW_NAV_SECTION = COCKPIT_NAV_GROUP;

/** @deprecated compat; usar COCKPIT_GROUP_LABEL */
export const NAV_SECTION_LABEL = { ...COCKPIT_GROUP_LABEL, otros: 'Otros' };

/** Subtítulo operativo por vista — contexto en topbar cockpit */
export const VIEW_CONTEXT_SUBTITLE = {
  'matriz-hnf': 'Agregados ejecutivos · decisiones Lyn / HNF',
  'centro-control': 'Kanban en vivo · núcleo Jarvis · OT en flujo',
  jarvis: 'Inteligencia operativa · HQ unificado',
  'ingreso-operativo': 'Altas y canal · trazabilidad de ingesta',
  'bandeja-canal': 'Canal unificado · priorización',
  'bandeja-romina': 'Cola clima · asignación y seguimiento',
  'bandeja-gery': 'Cola flota · pipeline operativo',
  'lyn-aprobacion': 'Aprobaciones Lyn · control de cierre',
  clima: 'OT HVAC · visitas y evidencia',
  planificacion: 'Planificación · mantenciones y ventanas',
  flota: 'Solicitudes y ejecución flota',
  oportunidades: 'Pipeline comercial · oportunidades',
  'ordenes-compra': 'OC y documentos comerciales',
  'documentos-tecnicos': 'Biblioteca técnica · lectura operativa',
  'technical-documents': 'Biblioteca técnica · lectura operativa',
  'control-gerencial': 'KPIs · riesgo · estado del negocio en tiempo real',
  finanzas: 'Economía operativa HNF',
  equipo: 'Personas · roles y disciplina',
  'hnf-core': 'Núcleo datos HNF · solicitudes',
  'base-maestra': 'Maestros · consistencia de datos',
  auditoria: 'Trazabilidad · registros y cumplimiento',
  usuarios: 'Accesos · perfiles y permisos',
  'jarvis-intake-hub': 'Ingesta Stark · clasificación y destino',
  'jarvis-universal-intake': 'Consola de ingesta · documentos y rutas',
};

export function subtitleForView(activeView, navItems) {
  if (VIEW_CONTEXT_SUBTITLE[activeView]) return VIEW_CONTEXT_SUBTITLE[activeView];
  const items = Array.isArray(navItems) ? navItems : [];
  const hit = items.find((x) => x.id === activeView);
  return hit?.label ? `Módulo · ${hit.label}` : 'Centro de Control Operativo HNF';
}

/**
 * Acciones del mando HNF — desacoplado de main.js; navegación por viewId existente.
 * Orden = frecuencia operativa típica.
 */

/**
 * intelKey (opcional): el componente Day Command resuelve `navigateToView(view, intel)` con datos del modelo.
 */
export const HNF_MANDO_ACTIONS = [
  { id: 'evid', label: 'Subir evidencia', view: 'clima', band: 'clima', icon: '◆' },
  { id: 'ing', label: 'Revisar ingresos', view: 'jarvis-intake', band: 'ops', icon: '◇' },
  { id: 'aprob', label: 'Aprobar pendientes', view: 'panel-operativo-vivo', band: 'ops', icon: '✓' },
  { id: 'asign', label: 'Asignar', view: 'panel-operativo-vivo', band: 'ops', icon: '⌁' },
  { id: 'cerrar', label: 'Cerrar OT', view: 'clima', band: 'clima', icon: '●' },
  { id: 'ver_cli', label: 'Ver cliente', view: 'clima', band: 'clima', icon: '◉', intelKey: 'climaCliente' },
  { id: 'wa', label: 'WhatsApp', view: 'whatsapp', band: 'clima', icon: '◎' },
  { id: 'clima', label: 'Clima / OT', view: 'clima', band: 'clima', icon: '▣' },
  { id: 'flota', label: 'Flota', view: 'flota', band: 'flota', icon: '▸' },
  { id: 'gen_prop', label: 'Generar propuesta', view: 'oportunidades', band: 'comercial', icon: '✦', intelKey: 'commercialDraft' },
  { id: 'opp', label: 'Oportunidades', view: 'oportunidades', band: 'comercial', icon: '☆' },
  { id: 'riesgo', label: 'Riesgo · caja', view: 'operacion-control', band: 'ops', icon: '⚡' },
  { id: 'escala', label: 'Escalar', view: 'operacion-control', band: 'ops', icon: '▲' },
  { id: 'sync', label: 'Sincronizar', action: 'refresh', band: 'ops', icon: '↻' },
];

import { buildJarvisGerencialSignals } from './jarvis-gerencial-signals.js';

/**
 * Texto de contexto operativo Jarvis para la franja bajo el topbar (datos reales cuando existen).
 * @param {string} activeView
 * @param {object|null|undefined} viewData
 */
export function buildOperationalJarvisLine(activeView, viewData) {
  const d = viewData ?? null;
  switch (activeView) {
    case 'control-gerencial': {
      const raw = d?.planOts ?? d?.ots?.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const sig = buildJarvisGerencialSignals(list);
      if (!sig.nTotal) return 'Sin muestra de OT en memoria · sincronizá datos para señales.';
      return sig.suggestion;
    }
    case 'centro-control':
      return 'Mando · el núcleo Jarvis lateral sigue la tarjeta activa del Kanban.';
    case 'ingreso-operativo':
    case 'ingreso-clasico':
      return 'Ingesta · Jarvis enruta y clasifica hacia el destino operativo correcto.';
    case 'jarvis':
      return 'HQ Jarvis · inteligencia, brief y acciones centralizadas.';
    case 'matriz-hnf':
      return 'Matriz · lectura ejecutiva y disciplina según datos cargados.';
    case 'finanzas':
    case 'equipo':
      return 'Módulo de gestión · Jarvis enlazado al estado global de OT y datos.';
    case 'hnf-core':
      return 'Clientes y solicitudes · contexto alineado al núcleo HNF.';
    case 'documentos-tecnicos':
    case 'technical-documents':
      return 'Documentos técnicos · lectura y trazabilidad operativa.';
    case 'auditoria':
    case 'usuarios':
      return 'Sistema · gobierno y accesos bajo control operativo HNF.';
    default:
      return 'Jarvis activo · el foco cambia según el módulo abierto.';
  }
}

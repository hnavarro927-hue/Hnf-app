import { useCallback, useMemo, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { deriveOtAlert } from './deriveOtAlert.js';
import { ExecutiveStrip } from './ExecutiveStrip.jsx';
import { KanbanBoard } from './KanbanBoard.jsx';
import { OtSidePanel } from './OtSidePanel.jsx';

/**
 * Shell principal: viewport sin scroll vertical (h-screen + overflow-hidden).
 * Scroll solo: horizontal en fila de columnas Kanban, vertical dentro de cada columna y del panel lateral.
 *
 * Props:
 * - ots: lista desde GET /ots (misma forma que el backend).
 * - kpis: { ingresosMonto?, margenRatio? } opcionales; otRiesgo se puede derivar o pasar explícito.
 * - kpis.otRiesgoCount: si no viene, se calcula contando OT con alerta derivada (hechos del payload).
 * - onRefresh: callback botón actualizar (ej. refetch API).
 */
export function ControlCenterAlien({
  ots = [],
  kpis = {},
  onRefresh,
  /** Umbrales explícitos (días) para alerta amarilla de atraso; sin esto solo hay alertas rojas de riesgo. */
  alertaAtrasoOpts,
  /** Rol backend (getSessionBackendRole) para filtrar OT por Romina/Gery/Lyn… */
  rolBackend,
}) {
  const [selectedId, setSelectedId] = useState(null);

  const otsVista = useMemo(
    () => (rolBackend ? filtrarOtsPorRolBackend(ots, rolBackend) : ots),
    [ots, rolBackend]
  );

  const selectedOt = useMemo(
    () => otsVista.find((o) => String(o?.id) === String(selectedId)) || null,
    [otsVista, selectedId]
  );

  const riesgoDerived = useMemo(
    () => otsVista.reduce((n, o) => (deriveOtAlert(o, alertaAtrasoOpts)?.level === 'risk' ? n + 1 : n), 0),
    [otsVista, alertaAtrasoOpts]
  );

  const mergedKpis = useMemo(
    () => ({
      ...kpis,
      otRiesgoCount: kpis.otRiesgoCount != null ? kpis.otRiesgoCount : riesgoDerived,
    }),
    [kpis, riesgoDerived]
  );

  const handleSelect = useCallback((ot) => {
    setSelectedId(ot?.id != null ? String(ot.id) : null);
  }, []);

  const closePanel = useCallback(() => setSelectedId(null), []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#05060b] font-tech text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-35"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 15% 0%, rgba(0,242,255,0.1), transparent), radial-gradient(ellipse 55% 40% at 95% 100%, rgba(168,85,247,0.09), transparent)',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ExecutiveStrip kpis={mergedKpis} />

        <div className="flex min-h-0 flex-1 items-stretch">
          <div className="relative flex min-w-0 min-h-0 flex-1 flex-col border-r border-white/[0.06] bg-black/20">
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-neonCyan/25 bg-neonCyan/10">
                  <Cpu className="h-4 w-4 text-neonCyan" strokeWidth={1.5} />
                </div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                  Kanban unificado
                </p>
              </div>
              {typeof onRefresh === 'function' ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-slate-400 hover:border-neonCyan/30 hover:text-neonCyan"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Actualizar
                </button>
              ) : null}
            </div>

            <KanbanBoard
              ots={otsVista}
              selectedId={selectedId}
              onSelectOt={handleSelect}
              alertaOpts={alertaAtrasoOpts}
            />
          </div>

          {selectedOt ? <OtSidePanel ot={selectedOt} onClose={closePanel} /> : null}
        </div>
      </div>
    </div>
  );
}

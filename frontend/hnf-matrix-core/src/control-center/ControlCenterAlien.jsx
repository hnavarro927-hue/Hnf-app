import { useCallback, useMemo, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { filtrarOtsPorRolBackend } from '../../../domain/hnf-operativa-reglas.js';
import { deriveOtAlert } from './deriveOtAlert.js';
import { ExecutiveStrip } from './ExecutiveStrip.jsx';
import { KanbanBoard } from './KanbanBoard.jsx';
import { OtSidePanel } from './OtSidePanel.jsx';
import { UxFlowStrip } from './UxFlowStrip.jsx';

/**
 * Shell: sin scroll vertical global. Tema zinc oscuro, Kanban responsive.
 */
export function ControlCenterAlien({
  ots = [],
  kpis = {},
  onRefresh,
  alertaAtrasoOpts,
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
    <div className="hnf-cc-root flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 antialiased">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6,182,212,0.07), transparent), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(139,92,246,0.06), transparent)',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ExecutiveStrip kpis={mergedKpis} />
        <UxFlowStrip />

        <div className="relative flex min-h-0 flex-1 items-stretch">
          {selectedOt ? (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
              aria-label="Cerrar panel"
              onClick={closePanel}
            />
          ) : null}

          <div className="relative z-10 flex min-w-0 min-h-0 flex-1 flex-col border-zinc-800 bg-zinc-950/40 md:border-r">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/90 px-2 py-1.5 sm:px-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                  <Cpu className="h-4 w-4 text-cyan-400" strokeWidth={1.75} />
                </div>
                <p className="truncate text-[0.58rem] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[0.62rem]">
                  Tablero
                </p>
              </div>
              {typeof onRefresh === 'function' ? (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[0.58rem] font-bold uppercase tracking-wide text-zinc-300 hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                  <span className="hidden sm:inline">Sync</span>
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

          {selectedOt ? (
            <div className="relative z-50 md:z-auto md:flex md:shrink-0">
              <OtSidePanel ot={selectedOt} onClose={closePanel} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

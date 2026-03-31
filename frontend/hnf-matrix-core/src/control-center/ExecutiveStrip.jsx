import { AlertTriangle, TrendingUp, Wallet } from 'lucide-react';

function fmtMoneyCLP(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return String(n);
  }
}

function fmtRatio(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function KpiChip({ icon: Icon, label, value, accent }) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-800/90 bg-zinc-900/80 px-2 py-1.5 sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-2 ${accent}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">
        <p className="text-[0.5rem] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[0.52rem]">
          {label}
        </p>
        <p className="truncate text-xs font-semibold tabular-nums text-zinc-100 sm:text-sm">{value ?? '—'}</p>
      </div>
    </div>
  );
}

/** KPIs compactos — prioridad al número, etiquetas mínimas. */
export function ExecutiveStrip({ kpis = {} }) {
  const ing = fmtMoneyCLP(kpis.ingresosMonto);
  const margen = fmtRatio(kpis.margenRatio);
  const riesgo =
    kpis.otRiesgoCount != null && Number.isFinite(Number(kpis.otRiesgoCount))
      ? String(kpis.otRiesgoCount)
      : null;

  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/95 px-2 py-2 backdrop-blur-md sm:px-3 sm:py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:block sm:min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
            Control
          </h1>
          <p className="text-[0.5rem] uppercase tracking-[0.2em] text-zinc-600 sm:mt-0.5 sm:text-[0.55rem]">
            HNF
          </p>
        </div>

        <div className="flex gap-1.5 sm:max-w-[70%] sm:gap-2 lg:max-w-none">
          <KpiChip icon={Wallet} label="Ing." value={ing} accent="text-cyan-400/90" />
          <KpiChip icon={TrendingUp} label="Mg." value={margen} accent="text-emerald-400/90" />
          <KpiChip icon={AlertTriangle} label="Riesgo" value={riesgo} accent="text-amber-400/90" />
        </div>
      </div>
    </header>
  );
}

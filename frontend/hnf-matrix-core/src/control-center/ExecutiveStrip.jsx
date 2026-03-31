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

/**
 * KPIs gerenciales — valores vienen del padre (API / agregados). Sin datos: em dash.
 */
export function ExecutiveStrip({ kpis = {} }) {
  const ing = fmtMoneyCLP(kpis.ingresosMonto);
  const margen = fmtRatio(kpis.margenRatio);
  const riesgo =
    kpis.otRiesgoCount != null && Number.isFinite(Number(kpis.otRiesgoCount))
      ? String(kpis.otRiesgoCount)
      : null;

  return (
    <header className="shrink-0 border-b border-white/[0.08] bg-black/40 px-4 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-stretch justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[0.28em] text-neonCyan/80">
            HNF · Centro de control
          </p>
          <h1 className="text-lg font-bold tracking-tight text-white">Modo Alien</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex min-w-[140px] items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
            <Wallet className="h-4 w-4 shrink-0 text-neonCyan/90" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-500">Ingresos</p>
              <p className="truncate text-sm font-semibold tabular-nums text-white">{ing ?? '—'}</p>
            </div>
          </div>

          <div className="flex min-w-[120px] items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-neonEmerald/90" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-500">Margen</p>
              <p className="truncate text-sm font-semibold tabular-nums text-neonEmerald/90">
                {margen ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex min-w-[120px] items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400/90" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-500">OT riesgo</p>
              <p className="truncate text-sm font-semibold tabular-nums text-amber-200">{riesgo ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

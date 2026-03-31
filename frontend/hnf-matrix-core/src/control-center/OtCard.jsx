import { deriveOtAlert } from './deriveOtAlert.js';

const TIPO_ACCENT = {
  clima: 'border-neonCyan/25 bg-neonCyan/[0.04] text-neonCyan',
  flota: 'border-neonEmerald/25 bg-neonEmerald/[0.04] text-neonEmerald',
  comercial: 'border-violet-400/25 bg-violet-500/[0.06] text-violet-300',
  administrativo: 'border-slate-500/30 bg-slate-500/[0.06] text-slate-300',
};

function tipoClass(tipo) {
  const k = String(tipo || '')
    .trim()
    .toLowerCase();
  return TIPO_ACCENT[k] || 'border-white/10 bg-white/[0.03] text-slate-300';
}

export function OtCard({ ot, active, onSelect, alertaOpts }) {
  const id = String(ot?.id ?? '');
  const cliente = String(ot?.cliente ?? '').trim() || '—';
  const tipo = String(ot?.tipoServicio ?? '').trim() || '—';
  const responsable = String(ot?.responsableActual ?? ot?.tecnicoAsignado ?? '').trim() || '—';
  const alert = deriveOtAlert(ot, alertaOpts);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ot)}
      className={[
        'w-full rounded-xl border px-2.5 py-2 text-left transition-all duration-200',
        'hover:border-white/20 hover:bg-white/[0.06]',
        active ? 'ring-1 ring-neonPurple/60 border-neonPurple/40' : '',
        tipoClass(tipo),
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[0.65rem] font-bold text-white/90">{id}</span>
        <span className="text-[0.6rem] font-black uppercase tracking-wide opacity-80">{tipo}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[0.72rem] font-medium leading-snug text-slate-100">{cliente}</p>
      <p className="mt-1 text-[0.62rem] text-slate-500">
        <span className="text-slate-400">Resp.</span> {responsable}
      </p>
      {alert ? (
        <p
          className={[
            'mt-1.5 rounded-md px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide',
            alert.level === 'risk' ? 'bg-red-500/20 text-red-200 ring-1 ring-red-500/35' : '',
            alert.level === 'delay' ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/35' : '',
          ].join(' ')}
        >
          {alert.text}
        </p>
      ) : null}
    </button>
  );
}

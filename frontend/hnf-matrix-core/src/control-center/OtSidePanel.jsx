import { useState } from 'react';
import { Camera, FileText, GitBranch, History, Receipt, X } from 'lucide-react';
import { OtLifecycleTimeline } from './OtLifecycleTimeline.jsx';

const TABS = [
  { id: 'linea', label: 'Línea', Icon: GitBranch },
  { id: 'detalle', label: 'Info', Icon: FileText },
  { id: 'costos', label: '$', Icon: Receipt },
  { id: 'evidencia', label: 'Fotos', Icon: Camera },
  { id: 'historial', label: 'Log', Icon: History },
];

function Row({ k, v }) {
  return (
    <div className="grid grid-cols-[minmax(0,34%)_1fr] gap-x-2 border-b border-zinc-800/80 py-1 text-[0.65rem]">
      <span className="font-medium uppercase tracking-wide text-zinc-500">{k}</span>
      <span className="break-words text-zinc-200">{v ?? '—'}</span>
    </div>
  );
}

function TabDetalle({ ot }) {
  return (
    <div className="px-0.5">
      <Row k="ID" v={ot.id} />
      <Row k="Cliente" v={ot.cliente} />
      <Row k="Tipo" v={ot.tipoServicio} />
      <Row k="Estado" v={ot.estado} />
      <Row k="Resp." v={ot.responsableActual || ot.tecnicoAsignado} />
      <Row k="Lyn" v={ot.aprobacionLynEstado} />
      <Row k="PDF" v={ot.pdfName ? String(ot.pdfName).slice(0, 40) : null} />
    </div>
  );
}

function TabCostos({ ot }) {
  const fmt = (n) => (n == null || n === '' ? '—' : String(n));
  return (
    <div className="px-0.5">
      <Row k="Total" v={fmt(ot.costoTotal)} />
      <Row k="Cobro" v={fmt(ot.montoCobrado)} />
      <Row k="Util." v={fmt(ot.utilidad)} />
    </div>
  );
}

function TabEvidencia({ ot }) {
  const equipos = Array.isArray(ot.equipos) ? ot.equipos : [];
  if (equipos.length) {
    return (
      <ul className="space-y-1 px-0.5 text-[0.65rem] text-zinc-400">
        {equipos.map((eq, i) => (
          <li key={i} className="rounded border border-zinc-800/80 bg-zinc-900/50 px-2 py-1">
            {String(eq?.nombreEquipo || `Eq. ${i + 1}`)}
          </li>
        ))}
      </ul>
    );
  }
  const n =
    (Array.isArray(ot.fotografiasAntes) ? ot.fotografiasAntes.length : 0) +
    (Array.isArray(ot.fotografiasDurante) ? ot.fotografiasDurante.length : 0) +
    (Array.isArray(ot.fotografiasDespues) ? ot.fotografiasDespues.length : 0);
  return <p className="px-0.5 text-[0.65rem] text-zinc-500">{n ? `${n} archivos` : '—'}</p>;
}

function TabHistorial({ ot }) {
  const h = Array.isArray(ot.historial) ? ot.historial : [];
  if (!h.length) return <p className="text-[0.65rem] text-zinc-500">—</p>;
  return (
    <ul className="hnf-panel-scroll max-h-[40vh] space-y-1.5 overflow-y-auto pr-1 md:max-h-[min(50vh,22rem)]">
      {[...h].reverse().map((entry, i) => (
        <li
          key={i}
          className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2 py-1 text-[0.62rem] text-zinc-300"
        >
          <span className="font-mono text-[0.55rem] text-zinc-500">{String(entry?.at ?? '').slice(0, 16)}</span>
          <span className="mx-1 text-zinc-600">·</span>
          <span className="text-violet-400/90">{String(entry?.accion ?? '')}</span>
          {entry?.detalle ? <p className="mt-0.5 line-clamp-2 text-zinc-500">{String(entry.detalle)}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function TabLinea({ ot }) {
  return (
    <div className="px-0.5">
      <p className="mb-2 text-[0.55rem] uppercase tracking-wide text-zinc-600">Ciclo</p>
      <OtLifecycleTimeline ot={ot} />
    </div>
  );
}

/**
 * Mobile: pantalla completa, scroll solo en cuerpo. Desktop: columna lateral.
 */
export function OtSidePanel({ ot, onClose }) {
  const [tab, setTab] = useState('linea');

  if (!ot) return null;

  return (
    <aside
      className="fixed inset-0 z-50 flex flex-col border-zinc-800 bg-zinc-950 shadow-2xl md:relative md:inset-auto md:z-auto md:h-full md:max-h-full md:w-[min(100%,360px)] md:shrink-0 md:border-l"
      aria-label="Detalle OT"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-2 py-2 sm:px-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.72rem] font-bold text-cyan-400/90">{String(ot.id)}</p>
          <p className="truncate text-[0.62rem] text-zinc-500">{String(ot.cliente || '').trim() || '—'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-zinc-800 px-1 py-1.5 sm:gap-1 sm:px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            title={t.label}
            className={[
              'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[0.6rem] font-bold uppercase tracking-wide transition-colors sm:px-2.5',
              tab === t.id
                ? 'bg-violet-950/80 text-violet-200 ring-1 ring-violet-500/40'
                : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300',
            ].join(' ')}
          >
            <t.Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="hnf-panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3 sm:py-3">
        {tab === 'linea' ? <TabLinea ot={ot} /> : null}
        {tab === 'detalle' ? <TabDetalle ot={ot} /> : null}
        {tab === 'costos' ? <TabCostos ot={ot} /> : null}
        {tab === 'evidencia' ? <TabEvidencia ot={ot} /> : null}
        {tab === 'historial' ? <TabHistorial ot={ot} /> : null}
      </div>

      <div className="shrink-0 border-t border-zinc-800 px-2 py-1.5 text-center text-[0.55rem] text-zinc-600">
        Lectura · API
      </div>
    </aside>
  );
}

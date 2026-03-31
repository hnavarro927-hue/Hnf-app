import { useState } from 'react';
import { PanelRightClose, X } from 'lucide-react';

const TABS = [
  { id: 'detalle', label: 'Detalle' },
  { id: 'costos', label: 'Costos' },
  { id: 'evidencia', label: 'Evidencia' },
  { id: 'historial', label: 'Historial' },
];

function Row({ k, v }) {
  return (
    <div className="grid grid-cols-[minmax(0,38%)_1fr] gap-x-2 gap-y-1 border-b border-white/[0.05] py-1.5 text-[0.7rem]">
      <span className="font-semibold uppercase tracking-wide text-slate-500">{k}</span>
      <span className="break-words text-slate-200">{v ?? '—'}</span>
    </div>
  );
}

function TabDetalle({ ot }) {
  return (
    <div className="px-1">
      <Row k="ID" v={ot.id} />
      <Row k="Cliente" v={ot.cliente} />
      <Row k="Dirección" v={ot.direccion} />
      <Row k="Comuna" v={ot.comuna} />
      <Row k="Tipo" v={ot.tipoServicio} />
      <Row k="Subtipo" v={ot.subtipoServicio} />
      <Row k="Estado OT" v={ot.estado} />
      <Row k="Fecha" v={ot.fecha} />
      <Row k="Hora" v={ot.hora} />
      <Row k="Técnico" v={ot.tecnicoAsignado} />
      <Row k="Responsable" v={ot.responsableActual} />
      <Row k="Lyn" v={ot.aprobacionLynEstado} />
      <Row k="Listo enviar" v={ot.listoEnviarCliente != null ? (ot.listoEnviarCliente ? 'Sí' : 'No') : null} />
      <Row k="Enviado cliente" v={ot.enviadoCliente != null ? (ot.enviadoCliente ? 'Sí' : 'No') : null} />
      <Row k="Fecha envío" v={ot.fechaEnvio} />
      <Row k="PDF" v={ot.pdfName || ot.pdfUrl} />
    </div>
  );
}

function TabCostos({ ot }) {
  const fmt = (n) => (n == null || n === '' ? '—' : String(n));
  return (
    <div className="px-1">
      <Row k="Costo materiales" v={fmt(ot.costoMateriales)} />
      <Row k="Mano de obra" v={fmt(ot.costoManoObra)} />
      <Row k="Traslado" v={fmt(ot.costoTraslado)} />
      <Row k="Otros" v={fmt(ot.costoOtros)} />
      <Row k="Costo total" v={fmt(ot.costoTotal)} />
      <Row k="Monto cobrado" v={fmt(ot.montoCobrado)} />
      <Row k="Utilidad" v={fmt(ot.utilidad)} />
      <Row k="Tipo facturación" v={ot.tipoFacturacion} />
    </div>
  );
}

function TabEvidencia({ ot }) {
  const equipos = Array.isArray(ot.equipos) ? ot.equipos : [];
  const blocks = [];

  if (equipos.length) {
    equipos.forEach((eq, i) => {
      const name = String(eq?.nombreEquipo || `Equipo ${i + 1}`);
      blocks.push(
        <div key={`eq-${i}`} className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
          <p className="text-[0.65rem] font-bold text-neonCyan/90">{name}</p>
          <p className="mt-1 text-[0.62rem] text-slate-500">
            Evidencias en objeto equipo (antes/durante/después según payload del servidor).
          </p>
        </div>
      );
    });
  } else {
    ['fotografiasAntes', 'fotografiasDurante', 'fotografiasDespues'].forEach((key) => {
      const arr = Array.isArray(ot[key]) ? ot[key] : [];
      blocks.push(
        <div key={key} className="mb-2">
          <p className="text-[0.6rem] font-bold uppercase text-slate-500">{key}</p>
          <p className="text-[0.65rem] text-slate-400">{arr.length ? `${arr.length} ítem(ns)` : '—'}</p>
        </div>
      );
    });
  }

  return <div className="px-1">{blocks.length ? blocks : <p className="text-[0.7rem] text-slate-500">—</p>}</div>;
}

function TabHistorial({ ot }) {
  const h = Array.isArray(ot.historial) ? ot.historial : [];
  if (!h.length) {
    return <p className="px-1 text-[0.7rem] text-slate-500">Sin historial en el objeto OT.</p>;
  }
  return (
    <ul className="space-y-2 px-1">
      {[...h].reverse().map((entry, i) => (
        <li
          key={i}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-[0.65rem] leading-snug text-slate-300"
        >
          <span className="font-mono text-[0.6rem] text-slate-500">{String(entry?.at ?? '')}</span>
          <span className="mx-1 text-slate-600">·</span>
          <span className="text-neonPurple/90">{String(entry?.actor ?? '')}</span>
          <p className="mt-1 text-slate-400">
            <span className="font-semibold text-slate-300">{String(entry?.accion ?? '')}</span>
            {entry?.detalle ? ` — ${String(entry.detalle)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Panel lateral fijo (no modal): pestañas con scroll interno únicamente.
 */
export function OtSidePanel({ ot, onClose }) {
  const [tab, setTab] = useState('detalle');

  if (!ot) return null;

  return (
    <aside
      className="flex w-[min(100%,380px)] shrink-0 flex-col border-l border-white/[0.08] bg-black/50 backdrop-blur-md"
      aria-label="Detalle OT"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold text-neonCyan/90">{String(ot.id)}</p>
          <p className="truncate text-[0.65rem] text-slate-500">{String(ot.cliente || '').trim() || '—'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
          title="Cerrar panel"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'shrink-0 rounded-lg px-2.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-wide transition-colors',
              tab === t.id
                ? 'bg-neonPurple/25 text-white ring-1 ring-neonPurple/40'
                : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {tab === 'detalle' ? <TabDetalle ot={ot} /> : null}
        {tab === 'costos' ? <TabCostos ot={ot} /> : null}
        {tab === 'evidencia' ? <TabEvidencia ot={ot} /> : null}
        {tab === 'historial' ? <TabHistorial ot={ot} /> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-[0.6rem] text-slate-600">
        <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Vista lectura · datos del servidor</span>
      </div>
    </aside>
  );
}

/**
 * HNF — Centro de Operaciones v1.0 (Cyber-Industrial)
 * Archivo único React + Tailwind. Requiere: react, react-dom, tailwindcss.
 *
 * Uso rápido (proyecto Vite + React + TS):
 *   npx tailwindcss init -p
 *   content: ["./prototypes/HnfCentroOperacionesV1.tsx", "./src/**/*.{tsx,jsx}"]
 *   import CentroOperacionesHNF from '../prototypes/HnfCentroOperacionesV1'
 */

import React, { useMemo, useState } from 'react';

type EstadoTicket = 'abierto' | 'en_proceso' | 'cerrado';
type Canal = 'telefono' | 'whatsapp' | 'correo';
type ModuloDestino = 'clima' | 'flota' | 'gerencia';

export type TicketEntrada = {
  id: string;
  cliente: string;
  estado: EstadoTicket;
  canal: Canal;
  modulo: ModuloDestino;
  logoUrl?: string;
};

const MOCK_TICKETS: TicketEntrada[] = [
  {
    id: 'HNF-9921',
    cliente: 'Entel',
    estado: 'abierto',
    canal: 'whatsapp',
    modulo: 'clima',
  },
  {
    id: 'HNF-9914',
    cliente: 'Walmart',
    estado: 'en_proceso',
    canal: 'correo',
    modulo: 'flota',
  },
  {
    id: 'HNF-9902',
    cliente: 'Agrosuper',
    estado: 'cerrado',
    canal: 'telefono',
    modulo: 'gerencia',
  },
  {
    id: 'HNF-9930',
    cliente: 'Codelco',
    estado: 'en_proceso',
    canal: 'whatsapp',
    modulo: 'flota',
  },
  {
    id: 'HNF-9888',
    cliente: 'LATAM',
    estado: 'abierto',
    canal: 'correo',
    modulo: 'clima',
  },
];

const ESTADO_META: Record<
  EstadoTicket,
  { label: string; dot: string; ring: string; text: string }
> = {
  abierto: {
    label: 'ABIERTO',
    dot: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]',
    ring: 'ring-red-500/40',
    text: 'text-red-300',
  },
  en_proceso: {
    label: 'EN PROCESO',
    dot: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.75)]',
    ring: 'ring-amber-400/40',
    text: 'text-amber-200',
  },
  cerrado: {
    label: 'CERRADO',
    dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.65)]',
    ring: 'ring-emerald-400/35',
    text: 'text-emerald-300',
  },
};

const CANAL_LABEL: Record<Canal, string> = {
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
  correo: 'Correo',
};

const MODULO_LABEL: Record<ModuloDestino, string> = {
  clima: 'Clima (Romina)',
  flota: 'Flota (Gery)',
  gerencia: 'Gerencia / Control',
};

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

function IconPhone(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 006 6l1.5-2L21 14.5V18a2 2 0 01-2.2 2 19 19 0 01-8.6-3.3 19 19 0 01-6-6A2 2 0 014.5 5h2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWhatsApp(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconMail(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 6h16v12H4V6zm0 0l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CentroOperacionesHNF() {
  const [filtroCanal, setFiltroCanal] = useState<Canal | 'todos'>('todos');
  const [tickets] = useState<TicketEntrada[]>(MOCK_TICKETS);

  const visibles = useMemo(() => {
    if (filtroCanal === 'todos') return tickets;
    return tickets.filter((t) => t.canal === filtroCanal);
  }, [tickets, filtroCanal]);

  return (
    <div
      className="min-h-dvh w-full text-white antialiased selection:bg-cyan-500/30 selection:text-white"
      style={{ backgroundColor: '#020617' }}
    >
      <style>{`
        @keyframes hnf-chroma-shift {
          0% { text-shadow: 0.5px 0 0 rgba(34,211,238,0.22), -0.5px 0 0 rgba(244,63,94,0.14); transform: translate(0,0); }
          25% { text-shadow: -0.5px 0 0 rgba(34,211,238,0.18), 1px 0 0 rgba(250,204,21,0.12); transform: translate(0.35px,-0.35px); }
          50% { text-shadow: 1px 0 0 rgba(244,63,94,0.16), -1px 0 0 rgba(34,211,238,0.14); transform: translate(-0.35px,0.35px); }
          75% { text-shadow: -1px 0 0 rgba(250,204,21,0.12), 0.5px 0 0 rgba(34,211,238,0.18); transform: translate(0.35px,0.35px); }
          100% { text-shadow: 0.5px 0 0 rgba(34,211,238,0.22), -0.5px 0 0 rgba(244,63,94,0.14); transform: translate(0,0); }
        }
        @keyframes hnf-noise-flicker {
          0%, 100% { opacity: 0.035; }
          50% { opacity: 0.055; }
        }
        .hnf-glitch-title {
          animation: hnf-chroma-shift 5.5s ease-in-out infinite;
        }
        .hnf-noise-layer {
          animation: hnf-noise-flicker 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hnf-glitch-title { animation: none; text-shadow: none; transform: none; }
          .hnf-noise-layer { animation: none; opacity: 0.045 !important; }
        }
        .hnf-dot-grid {
          background-color: #020617;
          background-image:
            radial-gradient(circle at 1px 1px, rgba(148,163,184,0.11) 1px, transparent 0),
            linear-gradient(rgba(15,23,42,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.4) 1px, transparent 1px);
          background-size: 28px 28px, 100% 48px, 48px 100%;
        }
      `}</style>

      <div className="hnf-dot-grid relative min-h-dvh overflow-x-hidden">
        <div
          className="hnf-noise-layer pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-screen"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
            backgroundSize: '180px 180px',
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-10 text-center sm:mb-12">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.35em] text-slate-400 sm:text-xs">
              HNF Sistemas · Gestión de activos
            </p>
            <h1 className="hnf-glitch-title font-black italic tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              CENTRO DE OPERACIONES
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white sm:text-base">
              Panel cyber-industrial: trazabilidad omnicanal, activos críticos y control gerencial en tiempo
              real. Optimizado para iPad y terreno móvil.
            </p>
          </header>

          {/* Módulos CORE */}
          <section
            aria-label="Módulos principales"
            className="mb-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          >
            {/* Clima — Cian */}
            <article className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(34,211,238,0.08)_inset,0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-300 hover:border-cyan-400/45 hover:shadow-[0_0_60px_rgba(34,211,238,0.12)]">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/90">
                  Módulo Clima
                </p>
                <h2 className="mt-1 font-black italic text-2xl text-white sm:text-3xl">Operación: Romina</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  Mantención de equipos de climatización y ejecución técnica en campo.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(['AIRE', 'TÉCNICO', 'PREVENTIVO'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-400/20 active:scale-[0.98]"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </article>

            {/* Flota — Azul real */}
            <article className="group relative overflow-hidden rounded-2xl border border-blue-600/35 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(37,99,235,0.1)_inset,0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-300 hover:border-blue-500/55 hover:shadow-[0_0_60px_rgba(37,99,235,0.15)]">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-600/20 blur-2xl" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                  Módulo Flota
                </p>
                <h2 className="mt-1 font-black italic text-2xl text-white sm:text-3xl">Operación: Gery</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  Mantenciones, traslados, revisiones técnicas y trazabilidad 360°.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(['LOGÍSTICA', 'LEGAL', 'TRACKING'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-blue-100 transition hover:bg-blue-500/25 active:scale-[0.98]"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </article>

            {/* Gerencia — Esmeralda */}
            <article className="group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.1)_inset,0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl transition duration-300 hover:border-emerald-400/50 hover:shadow-[0_0_60px_rgba(16,185,129,0.12)] sm:col-span-2 lg:col-span-1">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/15 blur-2xl" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Módulo Gerencia
                </p>
                <h2 className="mt-1 font-black italic text-2xl text-white sm:text-3xl">Operación: Control</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  Supervisión total Romina + Gery. Control de solicitudes entrantes y decisión ejecutiva.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(['OMNICANAL', 'KPIs', 'FINANZAS'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-400/20 active:scale-[0.98]"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          </section>

          {/* Omnicanal */}
          <section
            aria-label="Canales de entrada"
            className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-black italic text-xl text-white sm:text-2xl">Canales de entrada</h3>
                <p className="mt-1 max-w-xl text-sm text-slate-300">
                  Filtrá la tabla por canal. Cada ícono representa un punto de contacto omnicanal.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { id: 'telefono' as const, label: 'Teléfono', Icon: IconPhone },
                    { id: 'whatsapp' as const, label: 'WhatsApp', Icon: IconWhatsApp },
                    { id: 'correo' as const, label: 'Correo', Icon: IconMail },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const active = filtroCanal === id || filtroCanal === 'todos';
                  const pressed = filtroCanal === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltroCanal((c) => (c === id ? 'todos' : id))}
                      className={[
                        'flex min-h-[48px] min-w-[48px] items-center gap-3 rounded-xl border px-4 py-3 transition active:scale-[0.98]',
                        pressed
                          ? 'border-white/40 bg-white/15 text-white shadow-[0_0_24px_rgba(255,255,255,0.08)]'
                          : active
                            ? 'border-white/15 bg-white/[0.06] text-slate-100 hover:border-white/25 hover:bg-white/10'
                            : 'border-white/10 bg-white/[0.04] text-slate-400',
                      ].join(' ')}
                      aria-pressed={pressed}
                      aria-label={`Filtrar por ${label}`}
                    >
                      <Icon className="h-6 w-6 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Tabla dinámica */}
          <section
            aria-label="Solicitudes y trazabilidad"
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <h3 className="font-black italic text-lg text-white sm:text-xl">Trazabilidad de solicitudes</h3>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {visibles.length} registro{visibles.length === 1 ? '' : 's'}
                {filtroCanal !== 'todos' ? ` · filtro: ${CANAL_LABEL[filtroCanal]}` : ''}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-black/20 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    <th className="px-4 py-3 sm:px-6">ID Ticket</th>
                    <th className="px-4 py-3 sm:px-6">Cliente</th>
                    <th className="px-4 py-3 sm:px-6">Estado</th>
                    <th className="px-4 py-3 sm:px-6">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((t) => {
                    const meta = ESTADO_META[t.estado];
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-white/[0.06] transition hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-4 font-mono text-xs font-semibold tracking-wide text-cyan-200 sm:px-6 sm:text-sm">
                          {t.id}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-slate-600 to-slate-900 text-xs font-black text-white shadow-inner"
                              aria-hidden
                            >
                              {t.logoUrl ? (
                                <img
                                  src={t.logoUrl}
                                  alt=""
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                initials(t.cliente)
                              )}
                            </div>
                            <span className="font-semibold text-white">{t.cliente}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <span
                            className={[
                              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1',
                              meta.ring,
                              meta.text,
                              'bg-black/30',
                            ].join(' ')}
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-200 sm:px-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-white">
                              {CANAL_LABEL[t.canal]}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Módulo: <span className="text-slate-300">{MODULO_LABEL[t.modulo]}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {visibles.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-400">Sin solicitudes para este canal.</p>
            )}
          </section>

          <footer className="mt-12 text-center text-[10px] uppercase tracking-[0.25em] text-slate-600">
            HNF · Centro de operaciones v1.0 · Cyber-industrial
          </footer>
        </div>
      </div>
    </div>
  );
}

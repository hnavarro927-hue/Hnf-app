import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Cpu,
  LayoutDashboard,
  RefreshCw,
  Send,
  Truck,
  Wind,
  Zap,
} from 'lucide-react';

const CLIMA_CAPACITY = 4;
const INITIAL_TICKETS = [
  {
    id: 'HV-2041',
    dept: 'CLIMA',
    status: 'En despacho',
    priority: 'Alta',
    tech: 'Unidad A',
    updatedAt: '14:22',
  },
  {
    id: 'HV-2042',
    dept: 'CLIMA',
    status: 'Cola',
    priority: 'Media',
    tech: '—',
    updatedAt: '14:18',
  },
  {
    id: 'HV-2043',
    dept: 'CLIMA',
    status: 'Cola',
    priority: 'Alta',
    tech: '—',
    updatedAt: '14:15',
  },
  {
    id: 'HV-2044',
    dept: 'CLIMA',
    status: 'Cola',
    priority: 'Baja',
    tech: '—',
    updatedAt: '14:10',
  },
  {
    id: 'FL-881',
    dept: 'FLOTA',
    status: 'En ruta',
    priority: 'Alta',
    tech: 'Convoy 12',
    updatedAt: '14:20',
  },
];

const INITIAL_FLEET = [
  { id: 'V-01', driver: 'Disponible', status: 'idle', linkedClima: null },
  { id: 'V-02', driver: 'En servicio', status: 'busy', linkedClima: 'HV-2041' },
  { id: 'V-03', driver: 'Disponible', status: 'idle', linkedClima: null },
];

function glassCardClass(extra = '') {
  return [
    'relative overflow-hidden rounded-[3rem] border border-white/[0.08]',
    'bg-gradient-to-br from-white/[0.07] to-white/[0.02]',
    'backdrop-blur-xl shadow-[0_25px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]',
    extra,
  ].join(' ');
}

export default function App() {
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [fleet, setFleet] = useState(INITIAL_FLEET);
  const [matrixSignal, setMatrixSignal] = useState(null);
  const [jarvisFeed, setJarvisFeed] = useState([]);
  const [sidebar, setSidebar] = useState('matrix');
  const wasSaturatedRef = useRef(false);

  const climaOpen = useMemo(
    () =>
      tickets.filter(
        (t) =>
          t.dept === 'CLIMA' &&
          t.status !== 'Reenviado' &&
          t.status !== 'En Proceso Externo'
      ).length,
    [tickets]
  );

  const flotaActive = useMemo(() => fleet.filter((f) => f.status === 'busy').length, [fleet]);

  const matrixKpis = useMemo(
    () => ({
      throughput: Math.max(0, 100 - climaOpen * 12),
      saturation: Math.min(100, Math.round((climaOpen / CLIMA_CAPACITY) * 100)),
      fleetUtil: Math.round((flotaActive / Math.max(fleet.length, 1)) * 100),
    }),
    [climaOpen, flotaActive, fleet.length]
  );

  const pushJarvis = useCallback((entry) => {
    setJarvisFeed((prev) => [
      {
        id: `jv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...entry,
        ts: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    const saturated = climaOpen > CLIMA_CAPACITY;
    if (saturated) {
      setMatrixSignal({
        level: 'CRITICAL',
        source: 'HEAD OF OPERATIONS',
        text: `Carga HVAC supera umbral (${climaOpen}/${CLIMA_CAPACITY}). Se requiere autorización MATRIX o reenvío.`,
      });
      if (!wasSaturatedRef.current) {
        wasSaturatedRef.current = true;
        pushJarvis({
          type: 'bottleneck',
          title: 'Cuello detectado · Cola Clima',
          body: 'La CENTRAL MATRIX debe redistribuir o aprobar reenvío a proveedor externo.',
        });
      }
    } else {
      wasSaturatedRef.current = false;
      setMatrixSignal(null);
    }
  }, [climaOpen, pushJarvis]);

  const simulateClimaTicket = () => {
    const n = tickets.filter((t) => t.dept === 'CLIMA').length + 1;
    setTickets((prev) => [
      {
        id: `HV-${2100 + n}`,
        dept: 'CLIMA',
        status: 'Cola',
        priority: n % 2 ? 'Alta' : 'Media',
        tech: '—',
        updatedAt: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    pushJarvis({
      type: 'ticket',
      title: 'Nuevo ticket técnico',
      body: 'HEAD OF OPERATIONS generó ingreso a cola HVAC. Verificando capacidad vs FLOTA.',
    });
  };

  const dispatchFleetToClima = () => {
    const idle = fleet.find((f) => f.status === 'idle');
    const nextClima = tickets.find((t) => t.dept === 'CLIMA' && t.status === 'Cola');
    if (!idle || !nextClima) return;
    setFleet((prev) =>
      prev.map((f) =>
        f.id === idle.id
          ? { ...f, status: 'busy', linkedClima: nextClima.id, driver: 'Despachado' }
          : f
      )
    );
    setTickets((prev) =>
      prev.map((t) =>
        t.id === nextClima.id ? { ...t, status: 'En despacho', tech: idle.id, updatedAt: 'ahora' } : t
      )
    );
    pushJarvis({
      type: 'link',
      title: 'Enlace CLIMA ↔ FLOTA',
      body: `${idle.id} asignado a ${nextClima.id}. COMMAND CENTRAL notificada.`,
    });
  };

  const matrixAuthorizePriority = () => {
    setTickets((prev) =>
      prev.map((t) =>
        t.dept === 'CLIMA' && t.status === 'Cola' && t.priority !== 'Crítica MATRIX'
          ? { ...t, priority: 'Crítica MATRIX', updatedAt: 'MATRIX' }
          : t
      )
    );
    pushJarvis({
      type: 'auth',
      title: 'Prioridad autorizada',
      body: 'COMMAND CENTRAL elevó prioridad en cola HVAC pendiente.',
    });
  };

  const reenviarTickets = () => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.dept !== 'CLIMA') return t;
        if (t.status === 'Reenviado' || t.status === 'En Proceso Externo') return t;
        if (t.status === 'Cola' || t.status === 'En despacho') {
          return {
            ...t,
            status: 'En Proceso Externo',
            tech: 'Proveedor externo',
            updatedAt: 'REENVÍO',
          };
        }
        return t;
      })
    );
    setMatrixSignal(null);
    pushJarvis({
      type: 'reenvio',
      title: 'Traspaso simulado',
      body: 'Carga saturada derivada. Monitor actualizado: tickets en proceso externo.',
    });
  };

  const reenviarSingle = (id) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === id && t.dept === 'CLIMA'
          ? {
              ...t,
              status: 'Reenviado',
              tech: 'Pool externo',
              updatedAt: 'REENVÍO',
            }
          : t
      )
    );
  };

  const nav = [
    { id: 'matrix', icon: LayoutDashboard, label: 'Matrix' },
    { id: 'clima', icon: Wind, label: 'HVAC' },
    { id: 'flota', icon: Truck, label: 'Fleet' },
    { id: 'jarvis', icon: Brain, label: 'Jarvis' },
  ];

  return (
    <div className="min-h-screen bg-[#05060b] text-slate-100 flex">
      {/* Ambient */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(0,242,255,0.12), transparent), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(168,85,247,0.1), transparent), radial-gradient(ellipse 50% 30% at 50% 50%, rgba(0,255,204,0.06), transparent)',
        }}
      />

      {/* Sidebar */}
      <aside className="relative z-10 w-[88px] shrink-0 flex flex-col items-center py-10 gap-6 border-r border-white/[0.06] bg-black/30 backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neonCyan/30 to-neonPurple/40 flex items-center justify-center border border-neonCyan/30 shadow-[0_0_30px_rgba(0,242,255,0.25)]">
          <Cpu className="w-6 h-6 text-neonCyan" strokeWidth={1.5} />
        </div>
        {nav.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSidebar(id)}
            title={label}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              sidebar === id
                ? 'bg-neonPurple/25 text-neonPurple shadow-[0_0_24px_rgba(168,85,247,0.45)] border border-neonPurple/50'
                : 'text-slate-500 hover:text-neonCyan border border-transparent hover:border-neonCyan/20'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={1.5} />
          </button>
        ))}
        <div className="flex-1" />
        <Activity className="w-5 h-5 text-neonEmerald animate-pulse" />
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 flex min-h-screen">
        <div className="flex-1 p-8 lg:p-12 pb-24 overflow-auto">
          <header className="mb-12 max-w-5xl">
            <p className="text-[0.65rem] font-black italic tracking-[0.35em] uppercase text-neonCyan/80 mb-3">
              HNF · Matrix Core
            </p>
            <h1 className="text-4xl lg:text-5xl font-black italic tracking-tight text-white drop-shadow-[0_0_40px_rgba(0,242,255,0.15)]">
              Command Center
            </h1>
            <p className="mt-4 text-slate-400 text-sm max-w-xl leading-relaxed tracking-wide">
              Flujo bidireccional CLIMA · FLOTA · CENTRAL MATRIX. IA Jarvis orquesta señales y reenvío de
              carga.
            </p>
          </header>

          {/* Three glass cards */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-14">
            <div className={glassCardClass('p-8 xl:p-10')}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-neonCyan/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-start justify-between gap-4 relative">
                <div>
                  <p className="text-[0.65rem] font-black italic tracking-[0.25em] uppercase text-neonCyan mb-2">
                    Head of Operations
                  </p>
                  <p className="text-3xl font-light text-white tabular-nums">{climaOpen}</p>
                  <p className="text-xs text-slate-500 mt-1">Tickets HVAC activos (no reenviados)</p>
                </div>
                <Wind className="w-10 h-10 text-neonCyan/90 shrink-0" strokeWidth={1.2} />
              </div>
              <div className="mt-8 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neonCyan to-neonEmerald transition-all duration-700"
                  style={{ width: `${Math.min(100, matrixKpis.saturation)}%` }}
                />
              </div>
              <p className="mt-2 text-[0.65rem] text-slate-500 tracking-widest uppercase">
                Saturación {matrixKpis.saturation}% · Umbral {CLIMA_CAPACITY}
              </p>
              <button
                type="button"
                onClick={simulateClimaTicket}
                className="mt-6 w-full py-3 rounded-2xl border border-neonCyan/30 text-neonCyan text-xs font-bold tracking-widest uppercase hover:bg-neonCyan/10 transition-colors"
              >
                + Simular ticket
              </button>
            </div>

            <div className={glassCardClass('p-8 xl:p-10')}>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-neonEmerald/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              <div className="flex items-start justify-between gap-4 relative">
                <div>
                  <p className="text-[0.65rem] font-black italic tracking-[0.25em] uppercase text-neonEmerald mb-2">
                    Fleet Lead
                  </p>
                  <p className="text-3xl font-light text-white tabular-nums">
                    {flotaActive}/{fleet.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Unidades en servicio · enlace a despacho HVAC</p>
                </div>
                <Truck className="w-10 h-10 text-neonEmerald/90 shrink-0" strokeWidth={1.2} />
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-400">
                {fleet.map((f) => (
                  <li key={f.id} className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-slate-300">{f.id}</span>
                    <span className={f.status === 'busy' ? 'text-neonEmerald' : 'text-slate-600'}>
                      {f.linkedClima || f.driver}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={dispatchFleetToClima}
                className="mt-6 w-full py-3 rounded-2xl border border-neonEmerald/30 text-neonEmerald text-xs font-bold tracking-widest uppercase hover:bg-neonEmerald/10 transition-colors"
              >
                Despachar técnico (CLIMA)
              </button>
            </div>

            <div className={glassCardClass('p-8 xl:p-10 ring-1 ring-neonPurple/20')}>
              <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-neonPurple/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="flex items-start justify-between gap-4 relative">
                <div>
                  <p className="text-[0.65rem] font-black italic tracking-[0.25em] uppercase text-neonPurple mb-2">
                    Command Central
                  </p>
                  <p className="text-3xl font-light text-white tabular-nums">{matrixKpis.throughput}%</p>
                  <p className="text-xs text-slate-500 mt-1">Índice de flujo · KPIs agregados</p>
                </div>
                <LayoutDashboard className="w-10 h-10 text-neonPurple/90 shrink-0" strokeWidth={1.2} />
              </div>
              {matrixSignal ? (
                <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-300 tracking-wide">{matrixSignal.source}</p>
                    <p className="text-sm text-red-200/90 mt-1">{matrixSignal.text}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-sm text-slate-500">Sin alertas de saturación. Nodo autorizador en modo
                  vigilancia.</p>
              )}
              <button
                type="button"
                onClick={matrixAuthorizePriority}
                className="mt-6 w-full py-3 rounded-2xl border border-neonPurple/40 text-neonPurple text-xs font-bold tracking-widest uppercase hover:bg-neonPurple/15 transition-colors"
              >
                Autorizar prioridad MATRIX
              </button>
            </div>
          </div>

          {/* Connector hint */}
          <div className="flex items-center justify-center gap-4 mb-10 text-[0.6rem] font-black italic tracking-[0.4em] uppercase text-slate-600">
            <span className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent to-neonCyan/40" />
            <Zap className="w-4 h-4 text-neonCyan" />
            <span>Interconexión activa</span>
            <Zap className="w-4 h-4 text-neonPurple" />
            <span className="h-px flex-1 max-w-[120px] bg-gradient-to-l from-transparent to-neonPurple/40" />
          </div>

          {/* Table */}
          <section className={glassCardClass('p-0')}>
            <div className="px-10 py-8 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black italic text-white tracking-wide">Operaciones activas</h2>
                <p className="text-xs text-slate-500 mt-1">Monitor unificado · estados en vivo</p>
              </div>
              <button
                type="button"
                onClick={() => setTickets(INITIAL_TICKETS)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-xs text-slate-400 hover:text-neonCyan transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset demo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[0.65rem] font-black italic tracking-[0.2em] uppercase text-slate-500 border-b border-white/[0.06]">
                    <th className="px-10 py-4">ID</th>
                    <th className="px-4 py-4">Módulo</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4">Prioridad</th>
                    <th className="px-4 py-4">Recurso</th>
                    <th className="px-10 py-4 text-right">Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-10 py-4 font-mono text-neonCyan/90">{t.id}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`text-xs font-bold tracking-wider uppercase ${
                            t.dept === 'CLIMA' ? 'text-neonCyan' : 'text-neonEmerald'
                          }`}
                        >
                          {t.dept}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            t.status === 'En Proceso Externo' || t.status === 'Reenviado'
                              ? 'bg-neonPurple/20 text-neonPurple border border-neonPurple/40'
                              : t.status === 'En despacho' || t.status === 'En ruta'
                                ? 'bg-neonEmerald/15 text-neonEmerald border border-neonEmerald/25'
                                : 'bg-white/5 text-slate-300 border border-white/10'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-300">{t.priority}</td>
                      <td className="px-4 py-4 text-slate-500">{t.tech}</td>
                      <td className="px-10 py-4 text-right text-slate-500 text-xs">{t.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Jarvis panel */}
        <aside className="relative z-10 w-full max-w-[400px] shrink-0 border-l border-white/[0.06] bg-black/40 backdrop-blur-xl p-8 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-neonPurple to-violet-900 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.5)]">
              <Brain className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[0.65rem] font-black italic tracking-[0.2em] uppercase text-neonPurple">
                Jarvis AI
              </p>
              <p className="text-sm text-slate-400">Motor de acción · control de tráfico</p>
            </div>
          </div>

          <button
            type="button"
            onClick={reenviarTickets}
            className="group relative w-full py-5 px-6 rounded-[3rem] font-black text-base tracking-[0.15em] uppercase text-white bg-gradient-to-r from-neonPurple via-violet-600 to-neonPurple bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] border-2 border-neonPurple shadow-[0_0_50px_rgba(168,85,247,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
          >
            <Send className="w-6 h-6" strokeWidth={2.5} />
            Reenviar tickets
          </button>
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>

          <p className="text-[0.65rem] text-slate-500 leading-relaxed px-1">
            Simula traspaso de carga desde HVAC saturado hacia pool externo o nodo disponible. El monitor
            refleja <strong className="text-neonPurple">En Proceso Externo</strong> o{' '}
            <strong className="text-neonPurple">Reenviado</strong>.
          </p>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[200px] max-h-[calc(100vh-320px)]">
            {jarvisFeed.length === 0 && (
              <p className="text-sm text-slate-600 italic">Esperando señales de CLIMA / FLOTA…</p>
            )}
            {jarvisFeed.map((j) => (
              <div
                key={j.id}
                className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-5 space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-bold text-white leading-snug">{j.title}</p>
                  <span className="text-[0.6rem] text-slate-500 shrink-0">{j.ts}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{j.body}</p>
                {(j.type === 'bottleneck' || j.type === 'ticket') && (
                  <button
                    type="button"
                    onClick={reenviarTickets}
                    className="w-full py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider bg-neonPurple/30 text-neonPurple border border-neonPurple/50 hover:bg-neonPurple/45"
                  >
                    Reenviar cola
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/[0.06] text-[0.6rem] text-slate-600 text-center font-mono">
            MATRIX · sync {new Date().toLocaleTimeString('es-CL')}
          </div>
        </aside>
      </main>
    </div>
  );
}

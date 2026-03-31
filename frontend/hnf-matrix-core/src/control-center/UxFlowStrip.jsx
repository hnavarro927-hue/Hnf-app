import { Eye, Lightbulb, Zap } from 'lucide-react';

/** VER → ENTENDER → ACT — micro-guía sin párrafos. */
export function UxFlowStrip() {
  const steps = [
    { Icon: Eye, label: 'Ver', hint: 'Columna · card' },
    { Icon: Lightbulb, label: 'Entender', hint: 'Línea · datos' },
    { Icon: Zap, label: 'Actuar', hint: 'Módulo origen' },
  ];
  return (
    <div className="flex shrink-0 items-center justify-center gap-1 border-b border-zinc-800/90 bg-zinc-950/80 px-2 py-1.5 md:justify-start md:px-3">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          {i > 0 ? <span className="text-[0.5rem] text-zinc-600">→</span> : null}
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/90 px-1.5 py-0.5 ring-1 ring-zinc-800">
            <s.Icon className="h-3 w-3 text-cyan-400/90" strokeWidth={2} aria-hidden />
            <span className="text-[0.58rem] font-bold uppercase tracking-wide text-zinc-300">{s.label}</span>
          </span>
        </div>
      ))}
      <span className="ml-auto hidden text-[0.55rem] text-zinc-600 sm:inline">{steps[2].hint}</span>
    </div>
  );
}

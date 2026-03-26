const memory = [];

export function generarSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días Hernan. Sistema en vigilancia activa.';
  if (hora < 19) return 'Hernan, sistema operando en tiempo real.';
  return 'Hernan, monitoreo nocturno activo.';
}

export function buildJarvisPresence(state) {
  let saludo = generarSaludo();

  let estado = 'NORMAL';
  let mensaje = 'Sistema estable. Flujo en observación.';

  if (state?.bloqueos > 0) {
    estado = 'CRITICO';
    mensaje = 'Detecto impacto económico. Acción obligatoria en curso.';
  }

  return {
    saludo,
    estado,
    mensaje,
    mantra: getJarvisMantra(),
    timestamp: new Date().toISOString(),
  };
}

function getJarvisMantra() {
  const frases = [
    'OBSERVO. INTERPRETO. DECIDO.',
    'TODO ES DINERO, RIESGO U OPORTUNIDAD.',
    'EL SISTEMA NO REACCIONA, SE ANTICIPA.',
  ];
  return frases[Math.floor(Math.random() * frases.length)];
}

export function buildJarvisDecisionEngine(state) {
  let prioridad = 'NORMAL';
  let accion = 'Monitoreo activo';

  if (state?.bloqueos > 200000) {
    prioridad = 'CRITICO';
    accion = 'Desbloquear ingresos hoy';
  }

  if (state?.oportunidades > 0) {
    accion = 'Activar cierre comercial inmediato';
  }

  return {
    prioridad,
    accion,
    impacto: state?.bloqueos || 0,
  };
}

export function startJarvisAutonomousLoop(getState, setUI) {
  setInterval(() => {
    const s = getState();
    const presence = buildJarvisPresence(s);
    const decision = buildJarvisDecisionEngine(s);
    setUI({ presence, decision });
  }, 20000);
}

export function registerJarvisMemory(event) {
  memory.push({
    ...event,
    time: new Date().toISOString(),
  });
}

export function getJarvisMemory() {
  return memory.slice(-10);
}

export function processJarvisInput(texto) {
  const t = String(texto ?? '');
  let prioridad = 'NORMAL';

  if (t.includes('urgente')) prioridad = 'CRITICO';
  if (t.includes('cotización')) prioridad = 'OPORTUNIDAD';

  return {
    input: t,
    prioridad,
    accion: prioridad === 'CRITICO' ? 'Responder inmediato' : 'Seguimiento',
  };
}

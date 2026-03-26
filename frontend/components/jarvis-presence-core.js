/**
 * JarvisPresenceCore — presencia viva al iniciar + superficie del ciclo autónomo (30s).
 */

/**
 * @param {object} opts
 * @param {object} opts.presence - buildJarvisPresence
 * @param {object} opts.startup - jarvisStartupSequence desde unified
 */
export function createJarvisPresenceCore({ presence = {}, startup = {} } = {}) {
  const section = document.createElement('section');
  section.className = 'jarvis-presence-core';
  section.setAttribute('data-jarvis-presence-core', '');

  const voiceMode = presence.voiceMode;
  const systemMood = presence.systemMood;
  const presionVisible =
    voiceMode === 'presion' || voiceMode === 'alerta' || systemMood === 'critico' || systemMood === 'tension';

  const greet = document.createElement('div');
  greet.className = 'jarvis-presence-core__greet';
  greet.hidden = presionVisible;

  const saludo = document.createElement('p');
  saludo.className = 'jarvis-presence-core__saludo';
  saludo.textContent =
    presence.saludoDominante ||
    `${presence.greeting || 'Jarvis operando.'} Sistema operativo activo. Estoy observando, interpretando y priorizando.`;

  const mantra = document.createElement('p');
  mantra.className = 'jarvis-presence-core__mantra';
  mantra.textContent = presence.mantraOperativo || '';

  greet.append(saludo, mantra);

  const pressure = document.createElement('div');
  pressure.className = 'jarvis-presence-core__pressure';
  pressure.hidden = !presionVisible;
  const p1 = document.createElement('p');
  p1.className = 'jarvis-presence-core__pressure-line jarvis-presence-core__pressure-line--1';
  p1.textContent = 'Hernan, detecto presión operativa.';
  const p2 = document.createElement('p');
  p2.className = 'jarvis-presence-core__pressure-line';
  p2.textContent = 'Acción prioritaria en curso.';
  pressure.append(p1, p2);

  const autonomic = document.createElement('div');
  autonomic.className = 'jarvis-presence-core__autonomic';
  autonomic.setAttribute('data-jarvis-autonomic-root', '');
  autonomic.innerHTML = `
    <div class="jarvis-presence-core__autonomic-head">
      <span class="jarvis-presence-core__autonomic-kicker">NÚCLEO AUTÓNOMO · lectura cada 30s</span>
      <span class="jarvis-presence-core__autonomic-time muted small" data-jarvis-autonomic-time>—</span>
    </div>
    <div class="jarvis-presence-core__autonomic-grid">
      <div><span class="jarvis-presence-core__ak">Estado</span> <strong data-jarvis-autonomic-estado>—</strong></div>
      <div><span class="jarvis-presence-core__ak">Impacto caja</span> <strong data-jarvis-autonomic-impacto>—</strong></div>
      <div><span class="jarvis-presence-core__ak">Prioridad temporal</span> <strong data-jarvis-autonomic-prioridad>—</strong></div>
    </div>
    <p class="jarvis-presence-core__autonomic-accion" data-jarvis-autonomic-line>—</p>
  `;

  const startupP = document.createElement('p');
  startupP.className = 'jarvis-presence-core__startup muted small';
  startupP.textContent = startup.startupLine || presence.startupLine || '';

  section.append(greet, pressure, autonomic, startupP);
  return section;
}

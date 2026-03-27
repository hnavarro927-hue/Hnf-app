/**
 * Ingesta conversacional guiada (conductor, cliente, técnico) — sin guardar hasta confirmación.
 */

export const GUIDED_KIND = {
  CONDUCTOR: 'conductor',
  CLIENTE: 'cliente',
  TECNICO: 'tecnico',
};

const RE =
  /^(?:ingres[aá]|agregar|alta|dar de alta|nuevo|nueva)\s+(?:un |una )?(conductor|conductora|cliente|t[eé]cnico|tecnico)\s+(.+)$/i;

export function parseGuidedIngestIntent(text) {
  const t = String(text || '').trim();
  const m = t.match(RE);
  if (!m) return null;
  const kindRaw = m[1].toLowerCase();
  const name = m[2].replace(/\s+/g, ' ').trim();
  let kind = GUIDED_KIND.CLIENTE;
  if (kindRaw.includes('conductor')) kind = GUIDED_KIND.CONDUCTOR;
  else if (kindRaw.includes('técnico') || kindRaw.includes('tecnico')) kind = GUIDED_KIND.TECNICO;

  return { kind, name };
}

const FIELDS = {
  [GUIDED_KIND.CONDUCTOR]: [
    { key: 'telefono', ask: 'Indicá el teléfono del conductor (con código de país si podés).' },
    { key: 'correo', ask: 'Indicá el correo electrónico.' },
    { key: 'licencia', ask: '¿Tipo o clase de licencia de conducir?' },
    { key: 'comuna', ask: '¿Comuna o zona habitual de operación?' },
  ],
  [GUIDED_KIND.CLIENTE]: [
    { key: 'contactoPrincipal', ask: '¿Nombre del contacto principal en la empresa?' },
    { key: 'telefono', ask: 'Teléfono principal del contacto o empresa.' },
    { key: 'correo', ask: 'Correo de contacto.' },
    { key: 'direccion', ask: 'Dirección (calle y número).' },
    { key: 'comuna', ask: 'Comuna o ciudad.' },
    { key: 'region', ask: 'Región o zona (opcional pero recomendado).' },
  ],
  [GUIDED_KIND.TECNICO]: [
    { key: 'telefono', ask: 'Teléfono del técnico.' },
    { key: 'correo', ask: 'Correo del técnico.' },
    { key: 'area', ask: '¿Línea Clima o Flota (u otra zona)?' },
    { key: 'disponibilidad', ask: 'Disponibilidad u observación breve (opcional; escribí «-» si no aplica).', optional: true },
  ],
};

export function startGuidedSession(intent) {
  const { kind, name } = intent;
  const base =
    kind === GUIDED_KIND.CLIENTE
      ? { nombre: name }
      : { nombreCompleto: name, rol: kind === GUIDED_KIND.CONDUCTOR ? 'Conductor' : 'Técnico' };
  return {
    kind,
    step: 0,
    data: base,
    fields: FIELDS[kind],
    done: false,
  };
}

/** Interpret free-text answer for current field (simple). */
export function applyGuidedAnswer(session, answer) {
  if (!session || session.done) return session;
  const field = session.fields[session.step];
  if (!field) {
    session.done = true;
    return session;
  }
  let v = String(answer || '').trim();
  if (!v && field.optional) v = '—';
  if (!v) return session;
  if (session.kind === GUIDED_KIND.CLIENTE) {
    session.data[field.key] = v;
  } else {
    if (field.key === 'licencia') {
      session.data.permisos = { ...(session.data.permisos || {}), licenciaConducir: v, jarvisIngesta: true };
    } else if (field.key === 'disponibilidad') {
      session.data.permisos = { ...(session.data.permisos || {}), disponibilidad: v, jarvisIngesta: true };
    } else {
      session.data[field.key] = v;
    }
  }
  session.step += 1;
  if (session.step >= session.fields.length) session.done = true;
  return session;
}

export function getGuidedPrompt(session) {
  if (!session || session.done) return null;
  const field = session.fields[session.step];
  return field ? field.ask : null;
}

export function buildGuidedSummary(session) {
  if (!session) return '';
  if (session.kind === GUIDED_KIND.CLIENTE) {
    const d = session.data;
    return [
      `Cliente: ${d.nombre || '—'}`,
      `Contacto: ${d.contactoPrincipal || '—'}`,
      `Teléfono: ${d.telefono || '—'}`,
      `Correo: ${d.correo || '—'}`,
      `Dirección: ${d.direccion || '—'}`,
      `Comuna: ${d.comuna || '—'}`,
      d.region ? `Región/zona: ${d.region}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const d = session.data;
  const lic = d.permisos?.licenciaConducir;
  return [
    `Nombre: ${d.nombreCompleto || '—'}`,
    `Rol: ${d.rol || '—'}`,
    `Teléfono: ${d.telefono || '—'}`,
    `Correo: ${d.correo || '—'}`,
    d.area ? `Área/zona: ${d.area}` : null,
    lic ? `Licencia: ${lic}` : null,
    d.comuna ? `Comuna: ${d.comuna}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function guidedSessionMissingRequired(session) {
  if (!session) return [];
  const miss = [];
  if (session.kind === GUIDED_KIND.CLIENTE) {
    const d = session.data;
    if (!d.nombre) miss.push('nombre');
    if (!d.telefono) miss.push('telefono');
    if (!d.correo) miss.push('correo');
    if (!d.direccion) miss.push('direccion');
    if (!d.comuna) miss.push('comuna');
  } else {
    const d = session.data;
    if (!d.nombreCompleto) miss.push('nombreCompleto');
    if (!d.telefono) miss.push('telefono');
    if (!d.correo) miss.push('correo');
    if (session.kind === GUIDED_KIND.CONDUCTOR && !d.permisos?.licenciaConducir) miss.push('licencia');
    if (session.kind === GUIDED_KIND.CONDUCTOR && !d.comuna) miss.push('comuna');
  }
  return miss;
}

/**
 * Identidad visual contextual HNF — cliente, área, canal, criticidad.
 * Escalable: nuevos clientes/departamentos = entradas en CLIENT_ACCENTS / AREA_BANDS.
 */

/** Acentos por nombre de cliente detectado en datos (sin romper tema global). */
export const CLIENT_ACCENTS = [
  { match: /\bpuma\b/i, key: 'client-puma', label: 'PUMA' },
  { match: /arauco|mall|jumbo|lider/i, key: 'client-retail', label: 'Retail' },
  { match: /walmart|lider\b/i, key: 'client-mass', label: 'Mass' },
];

export const AREA_BAND_CLASS = {
  clima: 'jdc-band--clima',
  flota: 'jdc-band--flota',
  comercial: 'jdc-band--comercial',
  ops: 'jdc-band--ops',
};

export const CATEGORY_TO_BAND = {
  whatsapp: 'clima',
  ot: 'clima',
  evidencia: 'clima',
  aprobacion: 'ops',
  cierre: 'ops',
  traslado: 'flota',
  incidencia: 'ops',
  operativo: 'ops',
};

export const CHANNEL_ABBR = {
  whatsapp: 'WA',
  ot: 'OT',
  traslado: 'TR',
  aprobacion: 'APR',
  cierre: 'CIE',
  evidencia: 'EV',
  incidencia: 'INC',
  operativo: 'OP',
};

export function clipText(s, max = 96) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * @param {string[]} samples - nombres clientes / textos recientes
 */
export function resolveContextAccent(samples = []) {
  const blob = samples.filter(Boolean).join(' · ');
  for (const c of CLIENT_ACCENTS) {
    if (c.match.test(blob)) {
      return { rootClass: `jdc-root--${c.key}`, label: c.label, key: c.key };
    }
  }
  return { rootClass: '', label: '', key: null };
}

export function bandForCategory(category) {
  return CATEGORY_TO_BAND[String(category || '').toLowerCase()] || 'ops';
}

export function quickViewForRow(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'whatsapp') return 'whatsapp';
  if (c === 'traslado') return 'flota';
  if (c === 'aprobacion' || c === 'operativo') return 'panel-operativo-vivo';
  if (c === 'cierre' || c === 'ot' || c === 'evidencia') return 'clima';
  return 'jarvis';
}

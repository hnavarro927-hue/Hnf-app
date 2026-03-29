/**
 * Semáforo SLA solo presentación (RM 4h · regiones 12h). Sin API ni payloads.
 */

const RM_COMUNA_HINTS = [
  'santiago',
  'maipu',
  'puente alto',
  'las condes',
  'providencia',
  'vitacura',
  'lo barnechea',
  'nunoa',
  'penalolen',
  'la reina',
  'macul',
  'cerrillos',
  'estacion central',
  'independencia',
  'recoleta',
  'quilicura',
  'renca',
  'cerro navia',
  'lo prado',
  'quinta normal',
  'pudahuel',
  'la florida',
  'san miguel',
  'san joaquin',
  'la cisterna',
  'el bosque',
  'san ramon',
  'pedro aguirre cerda',
  'lo espejo',
  'san bernardo',
  'calera de tango',
  'buin',
  'paine',
  'melipilla',
  'talagante',
  'penaflor',
  'curacavi',
  'alhue',
  'maria pinto',
  'colina',
  'lampa',
  'tiltil',
];

function stripDiacritics(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isRmMetroComunaForSla(comuna) {
  const c = stripDiacritics(comuna);
  if (!c.trim()) return false;
  if (c.includes('region metropolitana') || /\brm\b/.test(c)) return true;
  return RM_COMUNA_HINTS.some((h) => c.includes(h));
}

function isOtClosedForSla(estado) {
  const e = String(estado || '').toLowerCase();
  return ['terminado', 'cerrada', 'cerrado', 'cancelado'].includes(e);
}

function parseClimaItemOpenedMs(item) {
  const fd = String(item?.fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(fd)) return null;
  const hm = String(item?.hora || '09:00').trim();
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  const tStr = m ? `${m[1].padStart(2, '0')}:${m[2]}` : '09:00';
  const t = new Date(`${fd.slice(0, 10)}T${tStr}:00`);
  return Number.isFinite(t.getTime()) ? t.getTime() : null;
}

/**
 * @returns {'' | 'breach_rm' | 'breach_region' | 'warn'}
 */
export function computeOtSlaPresentationTier({ openedMs, nowMs = Date.now(), comuna }) {
  if (openedMs == null || !Number.isFinite(openedMs)) return '';
  const mins = Math.floor((nowMs - openedMs) / 60000);
  if (mins < 0) return '';
  const rm = isRmMetroComunaForSla(comuna);
  const limit = rm ? 240 : 720;
  if (mins >= limit) return rm ? 'breach_rm' : 'breach_region';
  if (mins >= Math.floor(limit * 0.75)) return 'warn';
  return '';
}

export function computeOtSlaTierForClimaListItem(item, nowMs = Date.now()) {
  if (isOtClosedForSla(item?.estado)) return '';
  const openedMs = parseClimaItemOpenedMs(item);
  if (openedMs == null) return '';
  return computeOtSlaPresentationTier({ openedMs, nowMs, comuna: item?.comuna });
}

export function computeOtSlaTierForOperativeOt(ot, openedMs, nowMs = Date.now()) {
  if (isOtClosedForSla(ot?.estado)) return '';
  if (openedMs == null || !Number.isFinite(openedMs)) return '';
  return computeOtSlaPresentationTier({ openedMs, nowMs, comuna: ot?.comuna });
}

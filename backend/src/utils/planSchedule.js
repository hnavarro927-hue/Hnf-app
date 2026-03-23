const TIME_RE = /^([0-1]?\d|2[0-3]):([0-5]\d)$/;

const parseHm = (s) => {
  const t = String(s ?? '').trim();
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Ventana en minutos desde medianoche; día completo si no hay horas. */
export const getMantencionWindow = (m) => {
  const a = parseHm(m.horaInicio);
  const b = parseHm(m.horaFin);
  if (a == null && b == null) {
    return { start: 0, end: 24 * 60, allDay: true };
  }
  if (a != null && b != null) {
    if (a >= b) return null;
    return { start: a, end: b, allDay: false };
  }
  return { start: 0, end: 24 * 60, allDay: true };
};

const windowsOverlap = (w1, w2) => w1.start < w2.end && w2.start < w1.end;

const sameTecnico = (a, b) =>
  String(a.tecnico || '')
    .trim()
    .toLowerCase() ===
  String(b.tecnico || '')
    .trim()
    .toLowerCase();

export const mantencionesConflict = (m1, m2) => {
  if (String(m1.fecha || '') !== String(m2.fecha || '')) return false;
  if (!sameTecnico(m1, m2)) return false;
  const w1 = getMantencionWindow(m1);
  const w2 = getMantencionWindow(m2);
  if (!w1 || !w2) return true;
  return windowsOverlap(w1, w2);
};

/**
 * @param {Array<object>} list todas las mantenciones persistidas
 * @param {object} candidate { fecha, tecnico, horaInicio?, horaFin? }
 * @param {string|null} excludeId id a ignorar (PATCH)
 */
export const findScheduleConflicts = (list, candidate, excludeId = null) =>
  list.filter((m) => m.id !== excludeId && mantencionesConflict(m, candidate));

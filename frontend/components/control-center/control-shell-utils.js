export const statusCopy = (integrationStatus) => {
  const map = {
    conectado: 'En línea',
    'sin conexión': 'Sin conexión',
    cargando: 'Actualizando…',
    pendiente: 'Esperando datos',
  };
  return map[integrationStatus] || integrationStatus || '—';
};

export const statusModifiers = (integrationStatus) => {
  if (integrationStatus === 'conectado') return 'hnf-cc-sidebar__status--ok';
  if (integrationStatus === 'sin conexión') return 'hnf-cc-sidebar__status--bad';
  if (integrationStatus === 'cargando') return 'hnf-cc-sidebar__status--pending';
  return 'hnf-cc-sidebar__status--idle';
};

export const formatLastSyncLabel = (lastDataRefreshAt) => {
  if (lastDataRefreshAt == null || lastDataRefreshAt === '') return 'Sin sincronizar aún';
  const t = Number(lastDataRefreshAt);
  const d = Number.isFinite(t) ? new Date(t) : new Date(lastDataRefreshAt);
  const ms = d.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'Sin sincronizar aún';
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

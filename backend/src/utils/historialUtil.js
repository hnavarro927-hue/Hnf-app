const MAX = 100;

export const appendHistorial = (item, accion, detalle, actor = 'sistema') => {
  const prev = Array.isArray(item?.historial) ? item.historial : [];
  const actorSafe =
    actor && String(actor).trim() ? String(actor).trim().slice(0, 80) : 'sistema';
  const next = [
    ...prev,
    {
      at: new Date().toISOString(),
      accion: String(accion || 'cambio').slice(0, 120),
      detalle: String(detalle ?? '').slice(0, 500),
      actor: actorSafe,
    },
  ];
  if (next.length > MAX) next.splice(0, next.length - MAX);
  return next;
};

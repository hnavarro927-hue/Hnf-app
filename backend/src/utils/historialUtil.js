const MAX = 100;

export const appendHistorial = (item, accion, detalle) => {
  const prev = Array.isArray(item?.historial) ? item.historial : [];
  const next = [
    ...prev,
    {
      at: new Date().toISOString(),
      accion: String(accion || 'cambio').slice(0, 120),
      detalle: String(detalle ?? '').slice(0, 500),
    },
  ];
  if (next.length > MAX) next.splice(0, next.length - MAX);
  return next;
};

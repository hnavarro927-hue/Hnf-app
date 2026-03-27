/**
 * Reglas por cliente — trazabilidad, informes, aprobaciones previas a visita.
 */

export const HNF_CLIENT_RULES_VERSION = '2026-03-27-v1';

/** Catálogo extensible; en producción puede hidratarse desde config/backend. */
export const HNF_CLIENT_POLICIES = {
  puma: {
    id: 'puma',
    match: /\bpuma\b/i,
    operationalWeight: 'muy_alta',
    fullReportBeforeClose: true,
    approvalBeforeVisit: true,
    schedulingConfirmation: true,
    notes: 'Alta exigencia de permisos por tienda y trazabilidad de informe.',
  },
  default: {
    id: 'default',
    match: /.*/,
    operationalWeight: 'estandar',
    fullReportBeforeClose: false,
    approvalBeforeVisit: false,
    schedulingConfirmation: false,
    notes: 'Flujo estándar HNF.',
  },
};

export function resolveClientPolicy(otOrCliente) {
  const name = String(otOrCliente?.cliente ?? otOrCliente ?? '');
  for (const key of Object.keys(HNF_CLIENT_POLICIES)) {
    if (key === 'default') continue;
    const p = HNF_CLIENT_POLICIES[key];
    if (p.match.test(name)) return p;
  }
  return HNF_CLIENT_POLICIES.default;
}

export function clientPolicyRecommendations(ot) {
  const p = resolveClientPolicy(ot);
  const lines = [];
  if (p.fullReportBeforeClose) {
    lines.push('Este cliente suele exigir informe completo antes de cierre comercial.');
  }
  if (p.approvalBeforeVisit) {
    lines.push('Verificar aprobación / permiso por correo antes de confirmar visita en terreno.');
  }
  if (p.schedulingConfirmation) {
    lines.push('Conviene dejar confirmación explícita de fecha/ventana con la tienda.');
  }
  return { policy: p, lines };
}

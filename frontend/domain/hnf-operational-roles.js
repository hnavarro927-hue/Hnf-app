/**
 * Base de permisos operativos (vista). La autorización real debe replicarse en backend cuando exista auth.
 * Rol efectivo: localStorage `hnf_operational_role`.
 */

export const HNF_OPERATIONAL_ROLES = {
  EJECUTIVO: 'ejecutivo',
  REVISION_OPERATIVA: 'revision_operativa',
  CAMPO: 'campo',
};

export function getEffectiveOperationalRole() {
  try {
    const r = localStorage.getItem('hnf_operational_role');
    if (r && Object.values(HNF_OPERATIONAL_ROLES).includes(r)) return r;
  } catch {
    /* ignore */
  }
  return HNF_OPERATIONAL_ROLES.EJECUTIVO;
}

export function setOperationalRole(role) {
  try {
    if (Object.values(HNF_OPERATIONAL_ROLES).includes(role)) {
      localStorage.setItem('hnf_operational_role', role);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Recorta agregados sensibles para rol de campo (técnicos/conductores).
 */
export function filterPanelDatasetForRole(panel, role) {
  if (!panel || typeof panel !== 'object') return panel;
  if (role === HNF_OPERATIONAL_ROLES.EJECUTIVO || role === HNF_OPERATIONAL_ROLES.REVISION_OPERATIVA) {
    return panel;
  }
  if (role === HNF_OPERATIONAL_ROLES.CAMPO) {
    return {
      ...panel,
      autorizaciones_pendientes: [],
      cuellos_de_botella: [],
      responsables_criticos: [],
    };
  }
  return panel;
}

export const roleLabel = (r) => {
  const m = {
    [HNF_OPERATIONAL_ROLES.EJECUTIVO]: 'Ejecutivo / aprobación',
    [HNF_OPERATIONAL_ROLES.REVISION_OPERATIVA]: 'Revisión / registro',
    [HNF_OPERATIONAL_ROLES.CAMPO]: 'Campo (reporte)',
  };
  return m[r] || r;
};

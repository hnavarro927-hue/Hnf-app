/** Rol canónico del backend en sesión (p. ej. hernan, romina). */
let backendRole = '';

export const setSessionBackendRole = (role) => {
  backendRole = String(role || '').trim().toLowerCase();
};

export const getSessionBackendRole = () => backendRole;

export const clearSessionBackendRole = () => {
  backendRole = '';
};

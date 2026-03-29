import { maestroService } from '../services/maestro.service.js';
import { sendError, sendSuccess } from '../utils/http.js';
import { getRequestActor } from '../utils/requestActor.js';

/**
 * Ingesta automática desde canales externos (WhatsApp / correo).
 * Persistencia y Jarvis en Base Maestra; la respuesta al usuario es solo texto sugerido (fase 1).
 */
export const postIntakeExterno = async (request, response) => {
  const actor = getRequestActor(request);
  const r = await maestroService.ingestExternoCanal(request.body || {}, actor);
  if (r.errors) {
    return sendError(response, 400, 'Ingesta externa inválida.', {
      validations: r.errors,
      adjuntos_errores: r.adjuntos_errores,
    });
  }
  sendSuccess(response, 201, r, { resource: 'intake/externo', action: 'ingesta' });
};

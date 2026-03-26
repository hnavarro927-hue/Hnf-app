import { buildResponsibilityApiPayload, updateTaskState } from '../modules/responsibility-tracker.js';
import { sendError, sendSuccess } from '../utils/http.js';

export const getResponsibility = async (request, response) => {
  sendSuccess(response, 200, buildResponsibilityApiPayload(), { resource: 'responsibility' });
};

export const patchResponsibilityTask = async (request, response) => {
  const id = request.params?.id;
  const estado = request.body?.estado;
  if (!id) {
    return sendError(response, 400, 'Falta identificador de tarea.', {});
  }
  const next = updateTaskState(id, estado);
  if (!next) {
    return sendError(response, 404, 'Tarea no encontrada o estado inválido.', { id });
  }
  sendSuccess(response, 200, { tarea: next }, { resource: 'responsibility' });
};

import { matrizModel } from '../models/matriz.model.js';
import { matrizService } from '../services/matriz.service.js';
import { sendSuccess } from '../utils/http.js';

export const getAllMatriz = async (request, response) => {
  sendSuccess(response, 200, matrizService.getAll(), {
    resource: 'matriz',
    model: matrizModel,
    repositoryMode: matrizService.repositoryMode,
  });
};

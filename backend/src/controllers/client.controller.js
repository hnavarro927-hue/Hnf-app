import { clientModel } from '../models/client.model.js';
import { sendSuccess } from '../utils/http.js';

export const listClients = async (request, response) => {
  sendSuccess(
    response,
    200,
    [
      { id: 'CLI-001', name: 'Cliente Demo', contactName: 'Contacto Demo', email: 'demo@hnf.cl' },
    ],
    {
      resource: 'clients',
      model: clientModel,
    },
  );
};

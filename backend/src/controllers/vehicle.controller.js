import { vehicleModel } from '../models/vehicle.model.js';
import { sendSuccess } from '../utils/http.js';

export const listVehicles = async (request, response) => {
  sendSuccess(
    response,
    200,
    [
      { id: 'VEH-001', plate: 'AA-BB-10', brand: 'Toyota', model: 'Hilux', status: 'activo' },
    ],
    {
      resource: 'vehicles',
      model: vehicleModel,
    },
  );
};

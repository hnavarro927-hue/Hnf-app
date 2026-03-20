import { listVehicles } from '../controllers/vehicle.controller.js';

export const vehicleRoutes = [
  {
    method: 'GET',
    path: '/vehicles',
    handler: listVehicles,
  },
];

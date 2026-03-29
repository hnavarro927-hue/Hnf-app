import { httpClient } from './http-client.js';

const data = (r) => (r && r.data !== undefined ? r.data : r);

export const usersService = {
  list: () => httpClient.get('/usuarios').then(data),
  create: (body) => httpClient.post('/usuarios', body).then(data),
  patch: (id, body) => httpClient.patch(`/usuarios/${id}`, body).then(data),
  setEstado: (id, activo) => httpClient.patch(`/usuarios/${id}/estado`, { activo }).then(data),
  resetPassword: (id, password) =>
    httpClient.patch(`/usuarios/${id}/password-reset`, { password }).then(data),
};

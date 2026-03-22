import { createCard } from '../components/card.js';

export const dashboardView = ({ apiBaseLabel, integrationStatus, data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = `
    <p class="muted">Vista inicial</p>
    <h2>Dashboard</h2>
    <p class="muted">Resumen general de los módulos principales del sistema.</p>
  `;

  const cards = document.createElement('div');
  cards.className = 'cards';

  const ots = data?.ots?.data || [];
  const clients = data?.clients?.data || [];
  const vehicles = data?.vehicles?.data || [];
  const expenses = data?.expenses?.data || [];

  [
    { title: 'Clima / OT', description: 'Operación técnica.', items: [`OT registradas: ${ots.length}`, `Estado integración: ${integrationStatus}`] },
    { title: 'Flota', description: 'Gestión vehicular.', items: [`Vehículos: ${vehicles.length}`, `Gastos asociados: ${expenses.length}`] },
    { title: 'Administración', description: 'Gestión comercial.', items: [`Clientes: ${clients.length}`, `Gastos: ${expenses.length}`] },
    { title: 'Gastos', description: 'Control operacional.', items: ['Categorías', 'Comprobantes', 'Centro de costo'] },
    { title: 'Integración API', description: 'Configuración centralizada.', items: [`Base: ${apiBaseLabel || '—'}`, `Health: ${data?.health?.data?.status || integrationStatus}`] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

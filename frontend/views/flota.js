import { createCard } from '../components/card.js';

export const flotaView = ({ data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = '<h2>Módulo Flota</h2><p class="muted">Vista conectada a vehículos y gastos.</p>';

  const vehicles = data?.vehicles?.data || [];
  const expenses = data?.expenses?.data || [];
  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    { title: 'Vehículos', description: 'Registro general.', items: [`Vehículos: ${vehicles.length}`, 'Patente', 'Estado'] },
    { title: 'Servicios', description: 'Historial básico.', items: ['Fecha', 'Detalle', 'Observación'] },
    { title: 'Gastos', description: 'Control operacional.', items: [`Gastos: ${expenses.length}`, 'Combustible', 'Mantención'] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

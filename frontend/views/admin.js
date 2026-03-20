import { createCard } from '../components/card.js';

export const adminView = ({ data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = '<h2>Administración</h2><p class="muted">Vista conectada a clientes, OT y gastos.</p>';

  const clients = data?.clients?.data || [];
  const ots = data?.ots?.data || [];
  const expenses = data?.expenses?.data || [];
  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    { title: 'Clientes', description: 'Registro base.', items: [`Clientes: ${clients.length}`, 'Nombre', 'Contacto'] },
    { title: 'OT', description: 'Relación operativa.', items: [`OT: ${ots.length}`, 'Cliente relacionado', 'Estado'] },
    { title: 'Gastos', description: 'Control inicial.', items: [`Gastos: ${expenses.length}`, 'Centro de costo', 'Comprobante'] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

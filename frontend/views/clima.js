import { createCard } from '../components/card.js';

export const climaView = ({ data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = '<h2>Módulo Clima</h2><p class="muted">Vista conectada al flujo de OT.</p>';

  const ots = data?.data || [];
  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    { title: 'OT', description: 'Registro y seguimiento.', items: [`Cantidad OT: ${ots.length}`, 'Alta de OT', 'Estado y prioridad'] },
    { title: 'Técnicos', description: 'Asignación inicial.', items: ['Responsables', 'Agenda', 'Terreno'] },
    { title: 'Evidencias', description: 'Documentación base.', items: ['Fotos', 'Checklist', 'PDF futuro'] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

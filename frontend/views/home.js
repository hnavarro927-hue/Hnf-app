import { createCard } from '../components/card.js';

export const homeView = ({ data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = '<h2>Centralized Workflow</h2><p class="muted">message → reviewed_by_gery → approved_by_lyn → gestion → OT → en_proceso → terminado → cerrado</p>';

  const cards = document.createElement('div');
  cards.className = 'cards';
  const messages = data?.messages?.data || [];
  const approvals = data?.approvals?.data || [];

  [
    { title: 'Inbox (Gery)', description: 'Clasificación central', items: [`Mensajes: ${messages.length}`, 'WhatsApp + Email', 'Sin creación directa de OT'] },
    { title: 'Approval (Lyn)', description: 'Aprobación obligatoria', items: ['Ninguna OT sin Lyn', `Solicitudes: ${approvals.length}`, 'Acciones sensibles protegidas'] },
    { title: 'Manager (Hernan)', description: 'Control total', items: ['Override y edición', 'Matriz consolidada', 'Trazabilidad de acciones'] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

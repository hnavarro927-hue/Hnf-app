import { createCard } from '../components/card.js';

export const dashboardView = ({ apiBaseUrl, integrationStatus, data } = {}) => {
  const section = document.createElement('section');
  section.innerHTML = `
    <p class="muted">Vista inicial</p>
    <h2>Dashboard ERP</h2>
    <p class="muted">Resumen operativo de mensajería, gestión diaria, órdenes de trabajo y matriz.</p>
  `;

  const cards = document.createElement('div');
  cards.className = 'cards';

  const ots = data?.ots?.data || [];
  const messages = data?.messages?.data || [];
  const gestiones = data?.gestiones?.data || [];
  const matriz = data?.matriz?.data || [];

  [
    { title: 'Inbox', description: 'Mensajes entrantes.', items: [`Mensajes recibidos: ${messages.length}`, 'WhatsApp + Email', 'Sin auto crear OT'] },
    { title: 'Gestión diaria', description: 'Control tipo Excel.', items: [`Registros: ${gestiones.length}`, 'RT / Traslado / Mantención', 'Seguimiento por técnico'] },
    { title: 'OT Core', description: 'Operación estructurada.', items: [`OT registradas: ${ots.length}`, 'Cliente + técnico + tiempo + costo', 'Formato listo para PDF'] },
    { title: 'Matriz general', description: 'Control ejecutivo.', items: [`Filas de matriz: ${matriz.length}`, 'Origen manual/mensaje/gestión', 'Estado consolidado'] },
    { title: 'Integración API', description: 'Configuración centralizada.', items: [`Base URL: ${apiBaseUrl || 'No configurada'}`, `Health: ${data?.health?.data?.status || integrationStatus}`] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(cards);
  return section;
};

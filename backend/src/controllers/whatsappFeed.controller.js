/**
 * WhatsApp es origen principal de ingesta: cada mensaje persiste en el feed (`GET /whatsapp/feed`).
 * El frontend convierte esos registros en filas de "Ingreso operativo" (sin UI de chat).
 */
import { ingestWhatsAppData, listFeed } from '../services/whatsappIngest.service.js';
import { sendSuccess } from '../utils/http.js';

const defaultClientList = () => [
  {
    name: 'Arauco Chillán',
    aliases: ['arauco ch', 'mall arauco chillan', 'arauco chillan', 'arauco chillán'],
  },
  { name: 'Cliente Demo' },
];

export const getWhatsappFeed = async (_request, response) => {
  const data = await listFeed();
  sendSuccess(response, 200, data, { resource: 'whatsapp_feed' });
};

/**
 * Body: { message: { body, attachments, timestamp, ... }, clientList?: string[] }
 */
export const postWhatsappIngest = async (request, response) => {
  const body = request.body || {};
  const raw = body.message ?? body;
  const list = Array.isArray(body.clientList)
    ? body.clientList.map((n) => (typeof n === 'string' ? { name: n } : n))
    : defaultClientList();
  const roster = Array.isArray(body.tecnicoRoster) ? body.tecnicoRoster : null;

  const out = await ingestWhatsAppData(raw, list, roster);
  sendSuccess(response, 200, out, { resource: 'whatsapp_ingest' });
};

/**
 * Normaliza payloads típicos de WhatsApp Cloud API / webhooks Meta → forma interna HNF.
 * Compatible con n8n que reenvíe el mismo JSON.
 * No valida firma X-Hub — eso va en capa HTTP/middleware en fase posterior.
 *
 * Referencia conceptual: entry[].changes[].value.messages[]
 */

function pickText(body) {
  if (!body || typeof body !== 'object') return '';
  if (body.text?.body) return String(body.text.body);
  if (body.body) return String(body.body);
  return '';
}

/**
 * @param {object} webhookBody - cuerpo completo del webhook o un solo mensaje
 * @returns {object} shape esperado por normalizeWhatsAppInput
 */
export function mapWhatsAppCloudToInternal(webhookBody) {
  const root = webhookBody && typeof webhookBody === 'object' ? webhookBody : {};
  let msg = root;

  if (Array.isArray(root.entry) && root.entry[0]?.changes?.[0]?.value?.messages?.[0]) {
    const v = root.entry[0].changes[0].value;
    msg = v.messages[0];
    const meta = {
      phone_number_id: v.metadata?.phone_number_id,
      display_phone_number: v.metadata?.display_phone_number,
      contacts: v.contacts,
    };
    return {
      id: msg.id,
      messageId: msg.id,
      from: msg.from,
      timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
      body: pickText(msg),
      caption: msg.image?.caption || msg.video?.caption || msg.document?.caption || '',
      chatId: msg.from ? `wa:${msg.from}` : null,
      attachments: extractAttachments(msg),
      _source: 'whatsapp_cloud_api',
      _meta: meta,
    };
  }

  if (root.object === 'whatsapp_business_account' && root.entry) {
    return mapWhatsAppCloudToInternal(root);
  }

  return {
    id: msg.id || msg.messageId || `ext-${Date.now()}`,
    messageId: msg.messageId || msg.id,
    from: msg.from || msg.wa_id || msg.sender,
    timestamp: msg.timestamp || msg.ts || Date.now(),
    body: pickText(msg) || String(root.body || root.text || ''),
    caption: msg.caption || '',
    chatId: msg.chatId || (msg.from ? `wa:${msg.from}` : null),
    attachments: extractAttachments(msg),
    _source: 'whatsapp_webhook_generic',
  };
}

function extractAttachments(msg) {
  const out = [];
  if (!msg || typeof msg !== 'object') return out;
  if (msg.image?.id) {
    out.push({ type: 'image/jpeg', name: 'image', id: msg.image.id, url: msg.image.link || '' });
  }
  if (msg.document) {
    out.push({
      type: msg.document.mime_type || 'application/pdf',
      name: msg.document.filename || 'document',
      id: msg.document.id,
      url: msg.document.link || '',
    });
  }
  if (msg.video?.id) {
    out.push({ type: 'video/mp4', name: 'video', id: msg.video.id, url: msg.video.link || '' });
  }
  return out;
}

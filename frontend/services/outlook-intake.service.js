import { httpClient } from './http-client.js';

const emptyFeed = () => ({
  version: '2026-03-23',
  messages: [],
  historicalImports: [],
  ingestErrors: [],
  lastIngestAt: null,
  futureOutlookHooks: {
    inboxSync: false,
    replyDraft: false,
    threadSync: false,
    sendMail: false,
    autoReply: false,
    outboundSync: false,
    note: 'MODO RECEPCIÓN — sin envío de correo, auto-respuesta ni sincronización de salida.',
  },
  outlookIntakeMode: 'recepcion_solo_lectura',
});

export const outlookIntakeService = {
  getFeed: async () => {
    try {
      const r = await httpClient.get('/outlook/feed');
      const d = r?.data ?? r;
      if (!d || typeof d !== 'object') return emptyFeed();
      return {
        ...emptyFeed(),
        ...d,
        messages: Array.isArray(d.messages) ? d.messages : [],
        historicalImports: Array.isArray(d.historicalImports) ? d.historicalImports : [],
        ingestErrors: Array.isArray(d.ingestErrors) ? d.ingestErrors : [],
        outlookIntakeMode: d.outlookIntakeMode || 'recepcion_solo_lectura',
        futureOutlookHooks: {
          ...emptyFeed().futureOutlookHooks,
          ...(d.futureOutlookHooks && typeof d.futureOutlookHooks === 'object' ? d.futureOutlookHooks : {}),
          inboxSync: false,
          replyDraft: false,
          threadSync: false,
          sendMail: false,
          autoReply: false,
          outboundSync: false,
          note:
            (d.futureOutlookHooks && d.futureOutlookHooks.note) ||
            emptyFeed().futureOutlookHooks.note,
        },
      };
    } catch {
      return emptyFeed();
    }
  },

  ingestMessage: async (message, clientNames) => {
    const r = await httpClient.post('/outlook/ingest/message', {
      message,
      clientNames,
    });
    return r?.data ?? r;
  },

  ingestBatch: async (messages, clientNames) => {
    const r = await httpClient.post('/outlook/ingest/batch', {
      messages,
      clientNames,
    });
    return r?.data ?? r;
  },

  ingestFolder: async (payload) => {
    const r = await httpClient.post('/outlook/ingest/folder', { payload });
    return r?.data ?? r;
  },
};

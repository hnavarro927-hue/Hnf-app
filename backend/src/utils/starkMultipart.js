import busboy from 'busboy';

const DEFAULT_MAX = 15 * 1024 * 1024;

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {{ maxBytes?: number }} opts
 * @returns {Promise<{ fields: Record<string, string>, file: { filename: string, mimeType: string, buffer: Buffer } | null }>}
 */
export function parseStarkMultipart(request, opts = {}) {
  const maxBytes =
    Number(process.env.HNF_STARK_MAX_UPLOAD_BYTES) > 0
      ? Number(process.env.HNF_STARK_MAX_UPLOAD_BYTES)
      : opts.maxBytes || DEFAULT_MAX;

  return new Promise((resolve, reject) => {
    const fields = {};
    /** @type {Buffer[]} */
    const chunks = [];
    let fileMeta = null;
    let gotFile = false;

    const bb = busboy({
      headers: request.headers,
      limits: { fileSize: maxBytes, files: 1 },
    });

    bb.on('field', (name, val) => {
      fields[name] = String(val ?? '').slice(0, 4000);
    });

    bb.on('file', (name, file, info) => {
      if (name !== 'file' || gotFile) {
        file.resume();
        return;
      }
      gotFile = true;
      const filename = String(info.filename || 'upload').slice(0, 240);
      const mimeType = String(info.mimeType || 'application/octet-stream').slice(0, 120);
      fileMeta = { filename, mimeType };
      file.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
      file.on('limit', () => {
        reject(new Error('FILE_TOO_LARGE'));
      });
    });

    bb.on('finish', () => {
      if (!fileMeta || !chunks.length) {
        resolve({ fields, file: null });
        return;
      }
      resolve({
        fields,
        file: {
          filename: fileMeta.filename,
          mimeType: fileMeta.mimeType,
          buffer: Buffer.concat(chunks),
        },
      });
    });

    bb.on('error', (err) => reject(err));
    request.pipe(bb);
  });
}

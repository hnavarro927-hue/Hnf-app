/**
 * Memoria viva de contactos — localStorage JARVIS_CONTACT_MEMORY
 * @typedef {{ phone?: string, email?: string, name: string, company?: string, note?: string }} JarvisContact
 */

const LS_KEY = 'JARVIS_CONTACT_MEMORY';

const readAll = () => {
  try {
    const r = localStorage.getItem(LS_KEY);
    const a = r ? JSON.parse(r) : [];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const writeAll = (arr) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
};

/** Normaliza a dígitos con prefijo +56 para móvil chileno típico */
export function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('56') && d.length >= 10) return `+${d}`;
  if (d.length === 9 && d.startsWith('9')) return `+56${d}`;
  if (d.length === 8 && /^9/.test(d)) return `+569${d}`;
  if (d.length >= 10 && d.startsWith('569')) return `+${d}`;
  return d.length >= 8 ? `+${d}` : '';
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

export function getContactByPhone(phone) {
  const n = normalizePhone(phone);
  if (!n) return null;
  return readAll().find((c) => normalizePhone(c.phone) === n) || null;
}

export function getContactByEmail(email) {
  const ne = normEmail(email);
  if (!ne) return null;
  return readAll().find((c) => normEmail(c.email) === ne) || null;
}

/**
 * @param {JarvisContact} contact
 */
export function saveContact(contact) {
  const phone = normalizePhone(contact.phone || '');
  const email = normEmail(contact.email || '');
  const name = String(contact.name || '').trim();
  if (!name && !phone && !email) return null;
  const arr = readAll();
  const idx = arr.findIndex(
    (c) => (phone && normalizePhone(c.phone) === phone) || (email && normEmail(c.email) === email)
  );
  const row = {
    phone: phone || '',
    email: email || '',
    name: name || '—',
    company: String(contact.company || '').trim(),
    note: String(contact.note || '').trim(),
  };
  if (idx >= 0) arr[idx] = { ...arr[idx], ...row };
  else arr.unshift(row);
  writeAll(arr);
  try {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-contact-saved', { detail: row }));
  } catch {
    /* ignore */
  }
  return row;
}

/**
 * @param {string} phone
 * @param {Partial<JarvisContact>} data
 */
export function updateContact(phone, data) {
  const n = normalizePhone(phone);
  if (!n) return null;
  const arr = readAll();
  const idx = arr.findIndex((c) => normalizePhone(c.phone) === n);
  if (idx < 0) return saveContact({ phone: n, ...data });
  arr[idx] = { ...arr[idx], ...data, phone: n };
  writeAll(arr);
  try {
    window.dispatchEvent(new CustomEvent('hnf-jarvis-contact-saved', { detail: arr[idx] }));
  } catch {
    /* ignore */
  }
  return arr[idx];
}

export function listContacts() {
  return readAll();
}

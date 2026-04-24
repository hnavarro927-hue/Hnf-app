const logs = [];

const createId = () => `LOG-${String(logs.length + 1).padStart(5, '0')}`;

export const auditRepository = {
  mode: 'memory-fallback',
  findAll() {
    return logs;
  },
  create(entry) {
    const item = { id: createId(), timestamp: new Date().toISOString(), ...entry };
    logs.push(item);
    return item;
  },
};

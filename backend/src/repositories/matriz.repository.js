const matrizCollection = [];

const createId = () => `MTZ-${String(matrizCollection.length + 1).padStart(3, '0')}`;

export const matrizRepository = {
  mode: 'memory-fallback',
  findAll() {
    return matrizCollection;
  },
  create(data) {
    const item = { id: createId(), ...data };
    matrizCollection.push(item);
    return item;
  },
};

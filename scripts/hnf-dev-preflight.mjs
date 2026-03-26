/**
 * Evita levantar un segundo stack si los puertos por defecto ya están en uso.
 * Puertos: BACKEND_PORT / PORT (default 4000) y HNF_DEV_FRONTEND_PORT (default 5173).
 */
import net from 'node:net';
import process from 'node:process';

const backendPort = Number(process.env.BACKEND_PORT || process.env.PORT || 4000);
const frontendPort = Number(process.env.HNF_DEV_FRONTEND_PORT || 5173);

function portInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

async function main() {
  const be = await portInUse(backendPort);
  const fe = await portInUse(frontendPort);
  if (be || fe) {
    console.error('[HNF dev] Ya hay algo escuchando en el puerto esperado.');
    if (be) console.error(`  · Backend (${backendPort}): ocupado`);
    if (fe) console.error(`  · Frontend/Vite (${frontendPort}): ocupado`);
    console.error('  Cerrá el otro proceso (o usá otra terminal con un solo `npm run dev`).');
    process.exit(1);
  }
}

main();

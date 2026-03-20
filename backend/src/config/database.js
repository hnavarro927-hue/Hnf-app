// Variables mínimas esperadas:
// - DB_PROVIDER: proveedor esperado (mongodb, etc.).
// - DB_URI: cadena de conexión principal.
// - DB_NAME: nombre de la base.
// - DB_FALLBACK_MODE: fallback de desarrollo si la conexión real no está disponible.
//
// Esta base deja preparada la conexión real a MongoDB,
// pero todavía usa fallback simple de desarrollo mientras no exista persistencia final.
const runtime = process.env;

export const databaseConfig = {
  provider: runtime.DB_PROVIDER || 'mongodb',
  uri: runtime.DB_URI || 'mongodb://localhost:27017/hnf-servicios',
  dbName: runtime.DB_NAME || 'hnf-servicios',
  fallbackMode: runtime.DB_FALLBACK_MODE || 'memory',
};

export const getDatabaseConnectionInfo = () => ({
  provider: databaseConfig.provider,
  uri: databaseConfig.uri,
  dbName: databaseConfig.dbName,
  fallbackMode: databaseConfig.fallbackMode,
});

export const connectDatabase = async () => ({
  status: 'pending',
  message: 'Conexión MongoDB preparada. Actualmente se usa fallback para desarrollo.',
  connection: getDatabaseConnectionInfo(),
});

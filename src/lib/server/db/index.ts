import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
	process.env.DATABASE_URL || 'postgresql://noselus:noselus@localhost:5432/noselus';

// Client pour les requêtes
const client = postgres(connectionString);

// Instance Drizzle avec schéma pour les relations
export const db = drizzle(client, { schema });

// Export du client raw pour les cas spéciaux
export { client };

// Export du schéma pour un accès facile
export * from './schema';

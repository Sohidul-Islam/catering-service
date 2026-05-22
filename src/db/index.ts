import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as relations from './relations';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/premium_catering';

// Disable prefetch as it is not supported on Neon/Supabase/PgBouncer pools
export const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { 
  schema: { ...schema, ...relations } 
});

export * from './schema';
export * from './relations';

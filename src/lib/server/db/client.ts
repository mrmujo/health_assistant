import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

// Always use libSQL - it supports both remote (Turso) and local file databases
const useTurso = TURSO_DATABASE_URL && TURSO_AUTH_TOKEN;

// Configure libSQL client
const client = createClient(
	useTurso
		? {
				url: TURSO_DATABASE_URL!,
				authToken: TURSO_AUTH_TOKEN
			}
		: {
				// Use local file in development
				url: 'file:./data/health.db'
			}
);

export const db = drizzleLibsql(client, { schema });
export const isTurso = useTurso;

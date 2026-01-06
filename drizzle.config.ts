import { defineConfig } from 'drizzle-kit';

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const useTurso = TURSO_DATABASE_URL && TURSO_AUTH_TOKEN;

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	// Use turso dialect for remote, sqlite for local
	dialect: useTurso ? 'turso' : 'sqlite',
	dbCredentials: useTurso
		? {
				url: TURSO_DATABASE_URL!,
				authToken: TURSO_AUTH_TOKEN
			}
		: {
				url: './data/health.db'
			}
});

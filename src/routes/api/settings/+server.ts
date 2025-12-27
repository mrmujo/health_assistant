import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const allSettings = await db.select().from(settings);

	const settingsMap: Record<string, string> = {};
	for (const s of allSettings) {
		// Don't expose API keys
		if (s.key.includes('Key')) {
			settingsMap[s.key] = s.value ? '[SET]' : '';
		} else {
			settingsMap[s.key] = s.value || '';
		}
	}

	return json(settingsMap);
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		const updates: { key: string; value: string }[] = [];

		if (data.aiProvider) {
			updates.push({ key: 'aiProvider', value: data.aiProvider });
		}

		if (data.openaiKey && !data.openaiKey.includes('•')) {
			updates.push({ key: 'openaiKey', value: data.openaiKey });
		}

		if (data.anthropicKey && !data.anthropicKey.includes('•')) {
			updates.push({ key: 'anthropicKey', value: data.anthropicKey });
		}

		// Handle Ollama settings - these can be empty strings to clear them
		if (data.ollamaEndpoint !== undefined) {
			updates.push({ key: 'ollamaEndpoint', value: data.ollamaEndpoint });
		}

		if (data.ollamaModel !== undefined) {
			updates.push({ key: 'ollamaModel', value: data.ollamaModel });
		}

		for (const update of updates) {
			await db
				.insert(settings)
				.values({ key: update.key, value: update.value })
				.onConflictDoUpdate({
					target: settings.key,
					set: { value: update.value, updatedAt: new Date() }
				});
		}

		return json({ success: true });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to save settings' },
			{ status: 500 }
		);
	}
};

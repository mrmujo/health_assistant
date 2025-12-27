import type { PageServerLoad } from './$types';
import { garminClient } from '$lib/server/garmin/client';
import { db } from '$lib/server/db/client';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Check Garmin auth status
	let garminConnected = false;
	try {
		const authStatus = await garminClient.checkAuth();
		garminConnected = authStatus.authenticated;
	} catch {
		garminConnected = false;
	}

	// Get settings
	const [aiProviderSetting, openaiKeySetting, anthropicKeySetting, ollamaEndpointSetting, ollamaModelSetting] = await Promise.all([
		db.select().from(settings).where(eq(settings.key, 'aiProvider')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'openaiKey')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'anthropicKey')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'ollamaEndpoint')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'ollamaModel')).limit(1)
	]);

	return {
		garminConnected,
		settings: {
			aiProvider: aiProviderSetting[0]?.value || 'anthropic',
			openaiKeySet: !!openaiKeySetting[0]?.value,
			anthropicKeySet: !!anthropicKeySetting[0]?.value,
			ollamaEndpoint: ollamaEndpointSetting[0]?.value || '',
			ollamaModel: ollamaModelSetting[0]?.value || ''
		}
	};
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { seedRpeData } from '$lib/server/rpe/seed';

export const POST: RequestHandler = async () => {
	try {
		await seedRpeData();
		return json({ success: true, message: 'RPE data seeded successfully' });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to seed RPE data' },
			{ status: 500 }
		);
	}
};

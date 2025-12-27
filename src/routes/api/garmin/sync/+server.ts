import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGarminData } from '$lib/server/garmin/sync';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { days = 7 } = await request.json();

		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const startStr = startDate.toISOString().split('T')[0];
		const endStr = endDate.toISOString().split('T')[0];

		const result = await syncGarminData(startStr, endStr);
		return json(result);
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Sync failed' },
			{ status: 500 }
		);
	}
};

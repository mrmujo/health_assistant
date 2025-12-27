import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garminClient } from '$lib/server/garmin/client';

export const GET: RequestHandler = async ({ url }) => {
	const date = url.searchParams.get('date');

	if (!date) {
		return json({ success: false, error: 'Date required' }, { status: 400 });
	}

	try {
		const result = await garminClient.fetchActivities(date);
		return json(result);
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch activities' },
			{ status: 500 }
		);
	}
};

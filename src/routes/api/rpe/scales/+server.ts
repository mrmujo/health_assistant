import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRpeScale, getSupportedActivityTypes, normalizeActivityType } from '$lib/server/rpe/calculator';

export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type');

	try {
		if (type) {
			const normalizedType = normalizeActivityType(type);
			const scales = await getRpeScale(normalizedType);
			return json({ success: true, data: scales });
		}

		// Return all supported activity types
		const types = getSupportedActivityTypes();
		return json({ success: true, data: types });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch RPE scales' },
			{ status: 500 }
		);
	}
};

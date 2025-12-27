import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garminClient } from '$lib/server/garmin/client';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ success: false, error: 'Email and password required' }, { status: 400 });
		}

		const result = await garminClient.authenticate(email, password);
		return json(result);
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Authentication failed' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async () => {
	try {
		const status = await garminClient.checkAuth();
		return json(status);
	} catch {
		return json({ authenticated: false });
	}
};

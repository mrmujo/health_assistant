import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garminClient } from '$lib/server/garmin/client';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ success: false, error: 'Email and password required' }, { status: 400 });
		}

		const result = await garminClient.authenticate(email, password, user.id);
		return json(result);
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Authentication failed' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return json({ authenticated: false });
		}

		const status = await garminClient.checkAuth(user.id);
		return json(status);
	} catch {
		return json({ authenticated: false });
	}
};

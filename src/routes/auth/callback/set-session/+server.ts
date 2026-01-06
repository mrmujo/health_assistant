import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { access_token, refresh_token } = await request.json();

	if (!access_token) {
		return json({ error: 'No access token provided' }, { status: 400 });
	}

	try {
		const { data, error } = await locals.supabase.auth.setSession({
			access_token,
			refresh_token: refresh_token || ''
		});

		if (error) {
			console.error('Set session error:', error.message);
			return json({ error: error.message }, { status: 400 });
		}

		if (data.session) {
			return json({ success: true, redirect: '/setup' });
		}

		return json({ error: 'Failed to establish session' }, { status: 400 });
	} catch (e) {
		console.error('Set session exception:', e);
		return json({ error: 'Server error' }, { status: 500 });
	}
};

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			// Check if user needs to set up encryption key
			// For now, redirect to setup page for new users
			const { user } = await locals.safeGetSession();

			if (user) {
				// TODO: Check if user has encryption key set up
				// For now, redirect to setup to generate key
				throw redirect(303, '/setup');
			}

			throw redirect(303, next);
		}
	}

	// Something went wrong, redirect to login with error
	throw redirect(303, '/login?error=auth_callback_error');
};

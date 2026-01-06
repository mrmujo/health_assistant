import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const error_param = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');
	const next = url.searchParams.get('next') ?? '/';

	// Handle OAuth errors from Supabase
	if (error_param) {
		console.error('Auth callback error:', error_param, error_description);
		throw redirect(303, `/login?error=${error_param}&message=${encodeURIComponent(error_description || '')}`);
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error('Exchange code error:', error.message);
			throw redirect(303, `/login?error=exchange_failed&message=${encodeURIComponent(error.message)}`);
		}

		// Check if user needs to set up encryption key
		const { user } = await locals.safeGetSession();

		if (user) {
			throw redirect(303, '/setup');
		}

		throw redirect(303, next);
	}

	// No code provided
	throw redirect(303, '/login?error=no_code');
};

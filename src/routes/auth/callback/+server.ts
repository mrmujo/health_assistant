import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const error_param = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');
	const next = url.searchParams.get('next') ?? '/';

	// Handle OAuth errors from Supabase
	if (error_param) {
		console.error('Auth callback error:', error_param, error_description);
		throw redirect(303, `/login?error=${error_param}&message=${encodeURIComponent(error_description || '')}`);
	}

	// Handle PKCE flow (code parameter)
	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (error) {
			console.error('Exchange code error:', error.message);
			throw redirect(303, `/login?error=exchange_failed&message=${encodeURIComponent(error.message)}`);
		}

		const { user } = await locals.safeGetSession();
		if (user) {
			throw redirect(303, '/setup');
		}

		throw redirect(303, next);
	}

	// Handle token hash flow (for mobile/cross-browser magic links)
	if (token_hash && type) {
		const { error } = await locals.supabase.auth.verifyOtp({
			token_hash,
			type: type as 'email' | 'magiclink'
		});

		if (error) {
			console.error('Verify OTP error:', error.message);
			throw redirect(303, `/login?error=verify_failed&message=${encodeURIComponent(error.message)}`);
		}

		const { user } = await locals.safeGetSession();
		if (user) {
			throw redirect(303, '/setup');
		}

		throw redirect(303, next);
	}

	// No valid auth parameters provided
	throw redirect(303, '/login?error=no_code');
};

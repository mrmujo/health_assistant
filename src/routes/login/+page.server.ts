import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();

	// If already logged in, redirect to home
	if (session) {
		throw redirect(303, '/');
	}

	return {
		turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY || null
	};
};

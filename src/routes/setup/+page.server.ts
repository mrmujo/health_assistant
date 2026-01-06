import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	// Must be logged in to access setup
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	return {
		user: {
			id: user.id,
			email: user.email
		}
	};
};

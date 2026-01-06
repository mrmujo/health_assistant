import type { LayoutServerLoad } from './$types';
import { LOCAL_MODE } from '$env/static/private';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	const isLocalMode = LOCAL_MODE === 'true';

	return {
		session,
		user,
		isLocalMode
	};
};

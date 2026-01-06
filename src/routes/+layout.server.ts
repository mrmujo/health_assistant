import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	const isLocalMode = env.LOCAL_MODE === 'true';

	return {
		session,
		user,
		isLocalMode
	};
};

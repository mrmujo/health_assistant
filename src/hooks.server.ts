import { createServerClient } from '@supabase/ssr';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';
import { type Handle, redirect } from '@sveltejs/kit';

// Local mode user for offline usage
const LOCAL_USER = {
	id: 'local-user',
	email: 'local@localhost'
};

export const handle: Handle = async ({ event, resolve }) => {
	const isLocalMode = env.LOCAL_MODE === 'true';

	if (isLocalMode) {
		// Local mode: skip Supabase, use local user
		event.locals.supabase = null as any;
		event.locals.safeGetSession = async () => ({
			session: { user: LOCAL_USER } as any,
			user: LOCAL_USER as any
		});
	} else {
		// Production mode: use Supabase auth
		event.locals.supabase = createServerClient(
			publicEnv.PUBLIC_SUPABASE_URL!,
			publicEnv.PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return event.cookies.getAll();
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) => {
							event.cookies.set(name, value, { ...options, path: '/' });
						});
					}
				}
			}
		);

		// Get session safely
		event.locals.safeGetSession = async () => {
			const {
				data: { session }
			} = await event.locals.supabase.auth.getSession();

			if (!session) {
				return { session: null, user: null };
			}

			// Verify the JWT
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();

			if (error) {
				return { session: null, user: null };
			}

			return { session, user };
		};

		// Public routes that don't require authentication
		const publicRoutes = ['/login', '/auth/callback', '/auth/confirm', '/setup', '/recover', '/api/verify-turnstile'];
		const isPublicRoute = publicRoutes.some((route) => event.url.pathname.startsWith(route));

		// Check auth for protected routes
		if (!isPublicRoute) {
			const { session } = await event.locals.safeGetSession();
			if (!session) {
				throw redirect(303, '/login');
			}
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

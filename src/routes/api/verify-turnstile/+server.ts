import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	// If no secret key configured, skip verification
	if (!env.TURNSTILE_SECRET_KEY) {
		return json({ success: true });
	}

	try {
		const { token } = await request.json();

		if (!token) {
			return json({ success: false, error: 'No token provided' }, { status: 400 });
		}

		// Verify with Cloudflare
		const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				secret: env.TURNSTILE_SECRET_KEY!,
				response: token
			})
		});

		const result = await response.json();

		if (result.success) {
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Verification failed' }, { status: 400 });
		}
	} catch (error) {
		console.error('Turnstile verification error:', error);
		return json({ success: false, error: 'Verification error' }, { status: 500 });
	}
};

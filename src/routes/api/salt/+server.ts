import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { userSalts } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET - Get user's salt (for recovery on new device)
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const salts = await db
			.select()
			.from(userSalts)
			.where(eq(userSalts.userId, user.id))
			.limit(1);

		if (salts.length === 0) {
			return json({ success: false, error: 'No salt found' }, { status: 404 });
		}

		return json({
			success: true,
			data: { salt: salts[0].salt }
		});
	} catch (error) {
		console.error('Error fetching user salt:', error);
		return json({ success: false, error: 'Database error' }, { status: 500 });
	}
};

// POST - Store user's salt (during initial setup)
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { salt } = body;

		if (!salt) {
			return json({ success: false, error: 'Salt required' }, { status: 400 });
		}

		// Upsert salt
		const existing = await db
			.select()
			.from(userSalts)
			.where(eq(userSalts.userId, user.id))
			.limit(1);

		if (existing.length > 0) {
			// Update existing
			await db
				.update(userSalts)
				.set({ salt })
				.where(eq(userSalts.userId, user.id));
		} else {
			// Insert new
			await db.insert(userSalts).values({
				userId: user.id,
				salt,
				createdAt: new Date()
			});
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error storing user salt:', error);
		return json({ success: false, error: 'Database error' }, { status: 500 });
	}
};

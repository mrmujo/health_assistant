import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { sleepData } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { date, note } = await request.json();

		if (!date) {
			return json({ success: false, error: 'Date required' }, { status: 400 });
		}

		// Update the note for the given date
		const result = await db
			.update(sleepData)
			.set({ note: note || null })
			.where(eq(sleepData.date, date))
			.returning();

		if (result.length === 0) {
			return json({ success: false, error: 'Sleep record not found' }, { status: 404 });
		}

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to save note' },
			{ status: 500 }
		);
	}
};

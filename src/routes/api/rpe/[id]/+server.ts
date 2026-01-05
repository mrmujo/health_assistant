import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { activityRpe } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { calculateFatigue, normalizeActivityType } from '$lib/server/rpe/calculator';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);

	try {
		const entry = await db.select().from(activityRpe).where(eq(activityRpe.id, id)).limit(1);

		if (entry.length === 0) {
			return json({ success: false, error: 'RPE entry not found' }, { status: 404 });
		}

		return json({ success: true, data: entry[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch RPE entry' },
			{ status: 500 }
		);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id, 10);

	try {
		const body = await request.json();
		const { activityType, rpe, note, duration } = body;

		// Get existing entry
		const existing = await db.select().from(activityRpe).where(eq(activityRpe.id, id)).limit(1);

		if (existing.length === 0) {
			return json({ success: false, error: 'RPE entry not found' }, { status: 404 });
		}

		const currentEntry = existing[0];
		const newRpe = rpe !== undefined ? rpe : currentEntry.rpe;
		const newType = activityType
			? normalizeActivityType(activityType)
			: currentEntry.activityType;
		const newDuration = duration !== undefined ? duration : currentEntry.duration;

		if (newRpe < 0 || newRpe > 10) {
			return json({ success: false, error: 'RPE must be between 0 and 10' }, { status: 400 });
		}

		const fatigue = await calculateFatigue(newType, newRpe, newDuration || 0);

		const result = await db
			.update(activityRpe)
			.set({
				activityType: newType,
				rpe: newRpe,
				note: note !== undefined ? note : currentEntry.note,
				duration: newDuration,
				fatigue
			})
			.where(eq(activityRpe.id, id))
			.returning();

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to update RPE entry' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);

	try {
		const result = await db.delete(activityRpe).where(eq(activityRpe.id, id)).returning();

		if (result.length === 0) {
			return json({ success: false, error: 'RPE entry not found' }, { status: 404 });
		}

		return json({ success: true, message: 'RPE entry deleted' });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to delete RPE entry' },
			{ status: 500 }
		);
	}
};

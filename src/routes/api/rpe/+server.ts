import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { activityRpe } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { calculateFatigue, normalizeActivityType } from '$lib/server/rpe/calculator';

export const GET: RequestHandler = async ({ url }) => {
	const date = url.searchParams.get('date');
	const activityId = url.searchParams.get('activityId');

	try {
		let query = db.select().from(activityRpe);

		if (date) {
			query = query.where(eq(activityRpe.date, date));
		}

		if (activityId) {
			query = query.where(
				date
					? and(eq(activityRpe.date, date), eq(activityRpe.activityId, activityId))
					: eq(activityRpe.activityId, activityId)
			);
		}

		const entries = await query.orderBy(desc(activityRpe.createdAt));

		return json({ success: true, data: entries });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch RPE entries' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { date, activityId, activityType, activityName, duration, distance, rpe, note } = body;

		if (!date || !activityType || rpe === undefined) {
			return json(
				{ success: false, error: 'date, activityType, and rpe are required' },
				{ status: 400 }
			);
		}

		if (rpe < 0 || rpe > 10) {
			return json({ success: false, error: 'RPE must be between 0 and 10' }, { status: 400 });
		}

		const normalizedType = normalizeActivityType(activityType);
		const fatigue = await calculateFatigue(normalizedType, rpe, duration || 0);

		const result = await db
			.insert(activityRpe)
			.values({
				date,
				activityId: activityId || null,
				activityType: normalizedType,
				activityName: activityName || null,
				duration: duration || null,
				distance: distance || null,
				rpe,
				note: note || null,
				fatigue
			})
			.returning();

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to create RPE entry' },
			{ status: 500 }
		);
	}
};

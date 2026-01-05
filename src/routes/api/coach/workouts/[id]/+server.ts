import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { plannedWorkouts } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET - Get workout by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ success: false, error: 'Invalid workout ID' }, { status: 400 });
		}

		const workout = await db
			.select()
			.from(plannedWorkouts)
			.where(eq(plannedWorkouts.id, id))
			.limit(1);

		if (workout.length === 0) {
			return json({ success: false, error: 'Workout not found' }, { status: 404 });
		}

		return json({ success: true, data: workout[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch workout' },
			{ status: 500 }
		);
	}
};

// PUT - Update workout (complete/skip/link activity)
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ success: false, error: 'Invalid workout ID' }, { status: 400 });
		}

		const body = await request.json();
		const { action, completedActivityId } = body;

		const updateData: Record<string, unknown> = {};

		if (action === 'complete') {
			updateData.completed = 1;
			updateData.skipped = 0;
			if (completedActivityId) {
				updateData.completedActivityId = completedActivityId;
			}
		} else if (action === 'skip') {
			updateData.skipped = 1;
			updateData.completed = 0;
			updateData.completedActivityId = null;
		} else if (action === 'reset') {
			updateData.completed = 0;
			updateData.skipped = 0;
			updateData.completedActivityId = null;
		} else if (completedActivityId !== undefined) {
			// Just linking an activity
			updateData.completedActivityId = completedActivityId;
			if (completedActivityId) {
				updateData.completed = 1;
				updateData.skipped = 0;
			}
		} else {
			return json(
				{ success: false, error: 'Action must be one of: complete, skip, reset' },
				{ status: 400 }
			);
		}

		const result = await db
			.update(plannedWorkouts)
			.set(updateData)
			.where(eq(plannedWorkouts.id, id))
			.returning();

		if (result.length === 0) {
			return json({ success: false, error: 'Workout not found' }, { status: 404 });
		}

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to update workout' },
			{ status: 500 }
		);
	}
};

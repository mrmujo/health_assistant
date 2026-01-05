import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals, trainingPlans, plannedWorkouts } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET - Get single goal by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ success: false, error: 'Invalid goal ID' }, { status: 400 });
		}

		const goal = await db.select().from(trainingGoals).where(eq(trainingGoals.id, id)).limit(1);

		if (goal.length === 0) {
			return json({ success: false, error: 'Goal not found' }, { status: 404 });
		}

		return json({ success: true, data: goal[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch goal' },
			{ status: 500 }
		);
	}
};

// PUT - Update goal
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ success: false, error: 'Invalid goal ID' }, { status: 400 });
		}

		const body = await request.json();
		const { name, eventDate, eventType, distance, targetTime, notes, status } = body;

		// Validate event type if provided
		if (eventType) {
			const validTypes = ['running', 'cycling', 'swimming', 'triathlon'];
			if (!validTypes.includes(eventType)) {
				return json(
					{ success: false, error: `Event type must be one of: ${validTypes.join(', ')}` },
					{ status: 400 }
				);
			}
		}

		// Validate status if provided
		if (status) {
			const validStatuses = ['active', 'completed', 'cancelled'];
			if (!validStatuses.includes(status)) {
				return json(
					{ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` },
					{ status: 400 }
				);
			}
		}

		// Build update object with only provided fields
		const updateData: Record<string, unknown> = {};
		if (name !== undefined) updateData.name = name;
		if (eventDate !== undefined) updateData.eventDate = eventDate;
		if (eventType !== undefined) updateData.eventType = eventType;
		if (distance !== undefined) updateData.distance = distance;
		if (targetTime !== undefined) updateData.targetTime = targetTime;
		if (notes !== undefined) updateData.notes = notes;
		if (status !== undefined) updateData.status = status;

		if (Object.keys(updateData).length === 0) {
			return json({ success: false, error: 'No fields to update' }, { status: 400 });
		}

		const result = await db
			.update(trainingGoals)
			.set(updateData)
			.where(eq(trainingGoals.id, id))
			.returning();

		if (result.length === 0) {
			return json({ success: false, error: 'Goal not found' }, { status: 404 });
		}

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to update goal' },
			{ status: 500 }
		);
	}
};

// DELETE - Delete goal and associated plans/workouts
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ success: false, error: 'Invalid goal ID' }, { status: 400 });
		}

		// Get all plans for this goal
		const plans = await db
			.select({ id: trainingPlans.id })
			.from(trainingPlans)
			.where(eq(trainingPlans.goalId, id));

		// Delete workouts for each plan
		for (const plan of plans) {
			await db.delete(plannedWorkouts).where(eq(plannedWorkouts.planId, plan.id));
		}

		// Delete all plans for this goal
		await db.delete(trainingPlans).where(eq(trainingPlans.goalId, id));

		// Delete the goal
		const result = await db.delete(trainingGoals).where(eq(trainingGoals.id, id)).returning();

		if (result.length === 0) {
			return json({ success: false, error: 'Goal not found' }, { status: 404 });
		}

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to delete goal' },
			{ status: 500 }
		);
	}
};

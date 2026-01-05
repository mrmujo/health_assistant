import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { plannedWorkouts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, workoutId, planId, data } = body;

		switch (action) {
			case 'update': {
				// Update a specific workout
				if (!workoutId) {
					return json({ success: false, error: 'Workout ID required' }, { status: 400 });
				}
				const updates: Record<string, unknown> = {};
				if (data.workoutType !== undefined) updates.workoutType = data.workoutType;
				if (data.duration !== undefined) updates.duration = data.duration;
				if (data.distance !== undefined) updates.distance = data.distance;
				if (data.targetRpe !== undefined) updates.targetRpe = data.targetRpe;
				if (data.description !== undefined) updates.description = data.description;
				if (data.notes !== undefined) updates.notes = data.notes;

				if (Object.keys(updates).length === 0) {
					return json({ success: false, error: 'No updates provided' }, { status: 400 });
				}

				await db.update(plannedWorkouts).set(updates).where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: 'Workout updated' });
			}

			case 'swap': {
				// Swap two workouts
				const { workoutId1, workoutId2 } = data;
				if (!workoutId1 || !workoutId2) {
					return json({ success: false, error: 'Two workout IDs required' }, { status: 400 });
				}

				const [workout1] = await db
					.select()
					.from(plannedWorkouts)
					.where(eq(plannedWorkouts.id, workoutId1));
				const [workout2] = await db
					.select()
					.from(plannedWorkouts)
					.where(eq(plannedWorkouts.id, workoutId2));

				if (!workout1 || !workout2) {
					return json({ success: false, error: 'Workouts not found' }, { status: 404 });
				}

				// Swap the dates
				await db
					.update(plannedWorkouts)
					.set({ date: workout2.date })
					.where(eq(plannedWorkouts.id, workoutId1));
				await db
					.update(plannedWorkouts)
					.set({ date: workout1.date })
					.where(eq(plannedWorkouts.id, workoutId2));

				return json({ success: true, message: 'Workouts swapped' });
			}

			case 'makeRest': {
				// Convert a workout to a rest day
				if (!workoutId) {
					return json({ success: false, error: 'Workout ID required' }, { status: 400 });
				}
				await db
					.update(plannedWorkouts)
					.set({
						workoutType: 'rest',
						duration: 0,
						distance: null,
						targetRpe: 1,
						description: 'Rest day',
						notes: 'Modified via coach chat'
					})
					.where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: 'Workout converted to rest day' });
			}

			case 'reduceDuration': {
				// Reduce workout duration by a percentage
				if (!workoutId) {
					return json({ success: false, error: 'Workout ID required' }, { status: 400 });
				}
				const percentage = data.percentage || 25;
				const [workout] = await db
					.select()
					.from(plannedWorkouts)
					.where(eq(plannedWorkouts.id, workoutId));

				if (!workout || !workout.duration) {
					return json({ success: false, error: 'Workout not found or has no duration' }, { status: 404 });
				}

				const newDuration = Math.round(workout.duration * (1 - percentage / 100));
				await db
					.update(plannedWorkouts)
					.set({
						duration: newDuration,
						notes: `Reduced by ${percentage}% via coach chat`
					})
					.where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: `Duration reduced by ${percentage}%` });
			}

			case 'increaseDuration': {
				// Increase workout duration by a percentage
				if (!workoutId) {
					return json({ success: false, error: 'Workout ID required' }, { status: 400 });
				}
				const percentage = data.percentage || 10;
				const [workout] = await db
					.select()
					.from(plannedWorkouts)
					.where(eq(plannedWorkouts.id, workoutId));

				if (!workout || !workout.duration) {
					return json({ success: false, error: 'Workout not found or has no duration' }, { status: 404 });
				}

				const newDuration = Math.round(workout.duration * (1 + percentage / 100));
				await db
					.update(plannedWorkouts)
					.set({
						duration: newDuration,
						notes: `Increased by ${percentage}% via coach chat`
					})
					.where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: `Duration increased by ${percentage}%` });
			}

			case 'changeType': {
				// Change workout type
				if (!workoutId || !data.newType) {
					return json({ success: false, error: 'Workout ID and new type required' }, { status: 400 });
				}
				await db
					.update(plannedWorkouts)
					.set({
						workoutType: data.newType,
						notes: `Changed from ${data.oldType || 'unknown'} via coach chat`
					})
					.where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: `Workout type changed to ${data.newType}` });
			}

			case 'adjustRpe': {
				// Adjust RPE
				if (!workoutId || data.newRpe === undefined) {
					return json({ success: false, error: 'Workout ID and new RPE required' }, { status: 400 });
				}
				await db
					.update(plannedWorkouts)
					.set({
						targetRpe: Math.min(10, Math.max(1, data.newRpe)),
						notes: `RPE adjusted via coach chat`
					})
					.where(eq(plannedWorkouts.id, workoutId));
				return json({ success: true, message: `RPE adjusted to ${data.newRpe}` });
			}

			default:
				return json({ success: false, error: 'Unknown action' }, { status: 400 });
		}
	} catch (e) {
		console.error('Workout modify error:', e);
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to modify workout' },
			{ status: 500 }
		);
	}
};

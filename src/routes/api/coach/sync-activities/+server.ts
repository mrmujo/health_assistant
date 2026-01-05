import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import {
	trainingGoals,
	trainingPlans,
	plannedWorkouts,
	activities
} from '$lib/server/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { garminClient } from '$lib/server/garmin/client';

// Map Garmin activity types to our activity types
const activityTypeMap: Record<string, string> = {
	running: 'running',
	trail_running: 'running',
	treadmill_running: 'running',
	cycling: 'cycling',
	indoor_cycling: 'cycling',
	virtual_ride: 'cycling',
	mountain_biking: 'cycling',
	swimming: 'swimming',
	open_water_swimming: 'swimming',
	lap_swimming: 'swimming',
	pool_swimming: 'swimming'
};

function normalizeActivityType(garminType: string | null): string | null {
	if (!garminType) return null;
	const lower = garminType.toLowerCase().replace(/[_-]/g, '_');
	return activityTypeMap[lower] || lower;
}

export const POST: RequestHandler = async () => {
	try {
		// Get all active goals
		const activeGoals = await db
			.select()
			.from(trainingGoals)
			.where(eq(trainingGoals.status, 'active'));

		if (activeGoals.length === 0) {
			return json({ success: true, data: { matched: 0, message: 'No active goals' } });
		}

		// Get active plans for active goals
		const goalIds = activeGoals.map((g) => g.id);
		const activePlans = await db
			.select()
			.from(trainingPlans)
			.where(eq(trainingPlans.status, 'active'));

		const relevantPlans = activePlans.filter((p) => goalIds.includes(p.goalId));

		if (relevantPlans.length === 0) {
			return json({ success: true, data: { matched: 0, message: 'No active plans' } });
		}

		// Get all incomplete workouts from the past 7 days
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
		const today = new Date().toISOString().split('T')[0];

		const planIds = relevantPlans.map((p) => p.id);
		let incompleteWorkouts: (typeof plannedWorkouts.$inferSelect)[] = [];

		for (const planId of planIds) {
			const workouts = await db
				.select()
				.from(plannedWorkouts)
				.where(
					and(
						eq(plannedWorkouts.planId, planId),
						eq(plannedWorkouts.completed, 0),
						eq(plannedWorkouts.skipped, 0),
						gte(plannedWorkouts.date, sevenDaysAgoStr)
					)
				);
			incompleteWorkouts.push(...workouts);
		}

		if (incompleteWorkouts.length === 0) {
			return json({ success: true, data: { matched: 0, message: 'No incomplete workouts to sync' } });
		}

		// Get unique dates we need to check
		const datesToCheck = [...new Set(incompleteWorkouts.map((w) => w.date))];

		// Fetch activities for these dates from cache or Garmin
		const cachedActivities = await db
			.select()
			.from(activities)
			.where(inArray(activities.date, datesToCheck));

		// Group cached by date
		const activitiesByDate: Record<string, (typeof activities.$inferSelect)[]> = {};
		for (const act of cachedActivities) {
			if (!activitiesByDate[act.date]) {
				activitiesByDate[act.date] = [];
			}
			activitiesByDate[act.date].push(act);
		}

		// Fetch uncached dates from Garmin
		const uncachedDates = datesToCheck.filter((d) => !activitiesByDate[d]);

		if (uncachedDates.length > 0) {
			try {
				const result = await garminClient.fetchActivitiesBatch(
					uncachedDates[uncachedDates.length - 1],
					uncachedDates[0]
				);

				if (result.success && result.data) {
					for (const [date, acts] of Object.entries(result.data)) {
						for (const activity of acts) {
							// Cache the activity
							await db
								.insert(activities)
								.values({
									date,
									activityId: String(activity.activityId),
									activityType: activity.activityType || null,
									activityName: activity.activityName || null,
									duration: activity.duration || null,
									distance: activity.distance || null,
									calories: activity.calories || null,
									averageHR: activity.averageHR || null,
									maxHR: activity.maxHR || null,
									averageSpeed: activity.averageSpeed || null,
									rawData: JSON.stringify(activity)
								})
								.onConflictDoNothing();
						}

						// Add to our working data
						activitiesByDate[date] = acts.map((a) => ({
							id: 0,
							date,
							activityId: String(a.activityId),
							activityType: a.activityType || null,
							activityName: a.activityName || null,
							duration: a.duration || null,
							distance: a.distance || null,
							calories: a.calories || null,
							averageHR: a.averageHR || null,
							maxHR: a.maxHR || null,
							averageSpeed: a.averageSpeed || null,
							rawData: JSON.stringify(a),
							createdAt: new Date()
						}));
					}

					// Mark dates with no activities
					for (const date of uncachedDates) {
						if (!activitiesByDate[date]) {
							activitiesByDate[date] = [];
						}
					}
				}
			} catch (e) {
				console.error('Failed to fetch activities from Garmin:', e);
				// Continue with cached data only
			}
		}

		// Match workouts to activities
		let matchedCount = 0;

		for (const workout of incompleteWorkouts) {
			const dayActivities = activitiesByDate[workout.date] || [];

			// Find a matching activity
			const matchingActivity = dayActivities.find((act) => {
				const normalizedType = normalizeActivityType(act.activityType);

				// Match by activity type
				if (normalizedType !== workout.activityType) {
					return false;
				}

				// Already matched to another workout
				// (We'll track this by checking completedActivityId on other workouts)
				return true;
			});

			if (matchingActivity) {
				// Mark workout as completed
				await db
					.update(plannedWorkouts)
					.set({
						completed: 1,
						completedActivityId: matchingActivity.activityId
					})
					.where(eq(plannedWorkouts.id, workout.id));

				matchedCount++;

				// Remove from available activities for this date (prevent double-matching)
				const idx = dayActivities.findIndex((a) => a.activityId === matchingActivity.activityId);
				if (idx >= 0) {
					dayActivities.splice(idx, 1);
				}
			}
		}

		return json({
			success: true,
			data: {
				matched: matchedCount,
				total: incompleteWorkouts.length
			}
		});
	} catch (e) {
		console.error('Sync activities error:', e);
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to sync activities' },
			{ status: 500 }
		);
	}
};

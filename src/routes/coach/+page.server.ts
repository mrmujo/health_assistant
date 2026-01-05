import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals, trainingPlans, plannedWorkouts } from '$lib/server/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const today = new Date().toISOString().split('T')[0];

	// Get start of week (Monday)
	const startOfWeek = new Date();
	const day = startOfWeek.getDay();
	const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
	startOfWeek.setDate(diff);
	const weekStart = startOfWeek.toISOString().split('T')[0];

	// Get end of week (Sunday)
	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(endOfWeek.getDate() + 6);
	const weekEnd = endOfWeek.toISOString().split('T')[0];

	// Get active goals
	const activeGoals = await db
		.select()
		.from(trainingGoals)
		.where(eq(trainingGoals.status, 'active'))
		.orderBy(trainingGoals.eventDate);

	// Get active plans for active goals
	const goalIds = activeGoals.map((g) => g.id);
	let activePlans: (typeof trainingPlans.$inferSelect)[] = [];

	if (goalIds.length > 0) {
		activePlans = await db
			.select()
			.from(trainingPlans)
			.where(eq(trainingPlans.status, 'active'));

		// Filter to plans for active goals
		activePlans = activePlans.filter((p) => goalIds.includes(p.goalId));
	}

	// Get today's workouts
	let todayWorkouts: (typeof plannedWorkouts.$inferSelect & { goal?: typeof trainingGoals.$inferSelect })[] = [];
	let weekWorkouts: (typeof plannedWorkouts.$inferSelect)[] = [];

	if (activePlans.length > 0) {
		const planIds = activePlans.map((p) => p.id);

		// Get today's workouts
		for (const planId of planIds) {
			const workouts = await db
				.select()
				.from(plannedWorkouts)
				.where(and(eq(plannedWorkouts.planId, planId), eq(plannedWorkouts.date, today)));

			const plan = activePlans.find((p) => p.id === planId);
			const goal = activeGoals.find((g) => g.id === plan?.goalId);

			for (const workout of workouts) {
				todayWorkouts.push({ ...workout, goal });
			}
		}

		// Get this week's workouts
		for (const planId of planIds) {
			const workouts = await db
				.select()
				.from(plannedWorkouts)
				.where(
					and(
						eq(plannedWorkouts.planId, planId),
						gte(plannedWorkouts.date, weekStart),
						lte(plannedWorkouts.date, weekEnd)
					)
				)
				.orderBy(plannedWorkouts.date);

			weekWorkouts.push(...workouts);
		}
	}

	// Sort week workouts by date
	weekWorkouts.sort((a, b) => a.date.localeCompare(b.date));

	return {
		today,
		weekStart,
		weekEnd,
		activeGoals,
		activePlans,
		todayWorkouts,
		weekWorkouts
	};
};

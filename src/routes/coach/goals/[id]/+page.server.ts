import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals, trainingPlans, plannedWorkouts } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid goal ID');
	}

	const goals = await db.select().from(trainingGoals).where(eq(trainingGoals.id, id)).limit(1);

	if (goals.length === 0) {
		throw error(404, 'Goal not found');
	}

	const goal = goals[0];

	// Get all plans for this goal
	const plans = await db
		.select()
		.from(trainingPlans)
		.where(eq(trainingPlans.goalId, id))
		.orderBy(desc(trainingPlans.version));

	// Get workouts for the active plan
	const activePlan = plans.find((p) => p.status === 'active');
	let workouts: (typeof plannedWorkouts.$inferSelect)[] = [];

	if (activePlan) {
		workouts = await db
			.select()
			.from(plannedWorkouts)
			.where(eq(plannedWorkouts.planId, activePlan.id))
			.orderBy(plannedWorkouts.date);
	}

	// Calculate adherence stats
	const completed = workouts.filter((w) => w.completed).length;
	const skipped = workouts.filter((w) => w.skipped).length;
	const total = workouts.length;
	const remaining = total - completed - skipped;

	return {
		goal,
		plans,
		activePlan: activePlan || null,
		workouts,
		adherence: {
			completed,
			skipped,
			total,
			remaining,
			percentage: total > 0 ? Math.round((completed / total) * 100) : 0
		}
	};
};

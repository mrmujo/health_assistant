import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals, trainingPlans, plannedWorkouts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const goalId = url.searchParams.get('goal');

	// Get active goals
	const activeGoals = await db
		.select()
		.from(trainingGoals)
		.where(eq(trainingGoals.status, 'active'))
		.orderBy(trainingGoals.eventDate);

	if (activeGoals.length === 0) {
		throw redirect(302, '/coach/goals');
	}

	// Use specified goal or first active goal
	const selectedGoalId = goalId ? parseInt(goalId) : activeGoals[0].id;
	const selectedGoal = activeGoals.find((g) => g.id === selectedGoalId) || activeGoals[0];

	// Get active plan for this goal
	const plans = await db
		.select()
		.from(trainingPlans)
		.where(and(eq(trainingPlans.goalId, selectedGoal.id), eq(trainingPlans.status, 'active')));

	const activePlan = plans[0] || null;

	// Get today's workout
	const today = new Date().toISOString().split('T')[0];
	let todayWorkout = null;

	if (activePlan) {
		const workouts = await db
			.select()
			.from(plannedWorkouts)
			.where(and(eq(plannedWorkouts.planId, activePlan.id), eq(plannedWorkouts.date, today)));

		todayWorkout = workouts[0] || null;
	}

	return {
		activeGoals,
		selectedGoal,
		activePlan,
		todayWorkout
	};
};

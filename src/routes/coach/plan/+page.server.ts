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

	// Get all workouts for this plan
	let workouts: (typeof plannedWorkouts.$inferSelect)[] = [];
	if (activePlan) {
		workouts = await db
			.select()
			.from(plannedWorkouts)
			.where(eq(plannedWorkouts.planId, activePlan.id))
			.orderBy(plannedWorkouts.date);
	}

	// Group workouts by week
	const workoutsByWeek: Record<string, (typeof plannedWorkouts.$inferSelect)[]> = {};
	for (const workout of workouts) {
		const date = new Date(workout.date);
		// Get Monday of the week
		const day = date.getDay();
		const diff = date.getDate() - day + (day === 0 ? -6 : 1);
		const monday = new Date(date);
		monday.setDate(diff);
		const weekKey = monday.toISOString().split('T')[0];

		if (!workoutsByWeek[weekKey]) {
			workoutsByWeek[weekKey] = [];
		}
		workoutsByWeek[weekKey].push(workout);
	}

	// Get weeks sorted
	const weeks = Object.keys(workoutsByWeek).sort();

	// Group weeks by month
	const weeksByMonth: Record<string, string[]> = {};
	for (const weekStart of weeks) {
		const date = new Date(weekStart);
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		if (!weeksByMonth[monthKey]) {
			weeksByMonth[monthKey] = [];
		}
		weeksByMonth[monthKey].push(weekStart);
	}

	return {
		activeGoals,
		selectedGoal,
		activePlan,
		workouts,
		workoutsByWeek,
		weeks,
		weeksByMonth
	};
};

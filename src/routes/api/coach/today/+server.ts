import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { plannedWorkouts, trainingPlans, trainingGoals } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Get today's planned workout(s)
export const GET: RequestHandler = async () => {
	try {
		const today = new Date().toISOString().split('T')[0];

		// Get active goals
		const activeGoals = await db
			.select()
			.from(trainingGoals)
			.where(eq(trainingGoals.status, 'active'));

		if (activeGoals.length === 0) {
			return json({ success: true, data: { workouts: [], goals: [] } });
		}

		// Get active plans for active goals
		const goalIds = activeGoals.map((g) => g.id);
		const activePlans = await db
			.select()
			.from(trainingPlans)
			.where(eq(trainingPlans.status, 'active'));

		// Filter to plans for active goals
		const relevantPlans = activePlans.filter((p) => goalIds.includes(p.goalId));

		if (relevantPlans.length === 0) {
			return json({ success: true, data: { workouts: [], goals: activeGoals } });
		}

		// Get today's workouts from active plans
		const planIds = relevantPlans.map((p) => p.id);
		const todayWorkouts = [];

		for (const planId of planIds) {
			const workouts = await db
				.select()
				.from(plannedWorkouts)
				.where(and(eq(plannedWorkouts.planId, planId), eq(plannedWorkouts.date, today)));

			// Find the goal for this plan
			const plan = relevantPlans.find((p) => p.id === planId);
			const goal = activeGoals.find((g) => g.id === plan?.goalId);

			for (const workout of workouts) {
				todayWorkouts.push({
					...workout,
					goal: goal || null
				});
			}
		}

		return json({
			success: true,
			data: {
				workouts: todayWorkouts,
				goals: activeGoals
			}
		});
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : "Failed to fetch today's workout" },
			{ status: 500 }
		);
	}
};

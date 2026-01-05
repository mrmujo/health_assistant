import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDailyFatigueSummary, calculatePeriodFatigue } from '$lib/server/rpe/calculator';
import { db } from '$lib/server/db/client';
import { activityRpe } from '$lib/server/db/schema';
import { gte, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const days = parseInt(url.searchParams.get('days') || '7', 10);

	try {
		const dailySummary = await getDailyFatigueSummary(days);

		// Get all entries for period fatigue calculation
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		const startDateStr = startDate.toISOString().split('T')[0];

		const entries = await db
			.select()
			.from(activityRpe)
			.where(gte(activityRpe.date, startDateStr))
			.orderBy(desc(activityRpe.date));

		const periodFatigue = calculatePeriodFatigue(
			entries.map((e) => ({ fatigue: e.fatigue || 0 }))
		);

		return json({
			success: true,
			data: {
				daily: dailySummary,
				periodFatigue,
				totalEntries: entries.length,
				days
			}
		});
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch fatigue data' },
			{ status: 500 }
		);
	}
};

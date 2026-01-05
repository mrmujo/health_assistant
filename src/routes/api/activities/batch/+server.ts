import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garminClient } from '$lib/server/garmin/client';
import { db } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const startDate = url.searchParams.get('start');
	const endDate = url.searchParams.get('end');

	if (!startDate || !endDate) {
		return json({ success: false, error: 'Start and end dates required' }, { status: 400 });
	}

	try {
		// Generate all dates in the range
		const dates: string[] = [];
		const current = new Date(startDate);
		const end = new Date(endDate);
		while (current <= end) {
			dates.push(current.toISOString().split('T')[0]);
			current.setDate(current.getDate() + 1);
		}

		// Check which dates are already cached
		const cached = await db.select().from(activities).where(inArray(activities.date, dates));

		// Group cached by date
		const cachedByDate: Record<string, typeof cached> = {};
		for (const act of cached) {
			if (!cachedByDate[act.date]) {
				cachedByDate[act.date] = [];
			}
			cachedByDate[act.date].push(act);
		}

		// Find dates that need fetching
		const uncachedDates = dates.filter((d) => !cachedByDate[d]);

		// If all dates are cached, return immediately
		if (uncachedDates.length === 0) {
			return json({ success: true, data: cachedByDate });
		}

		// Fetch uncached dates from Garmin in one call
		const result = await garminClient.fetchActivitiesBatch(
			uncachedDates[0],
			uncachedDates[uncachedDates.length - 1]
		);

		// Cache the results
		if (result.success && result.data) {
			for (const [date, acts] of Object.entries(result.data)) {
				for (const activity of acts) {
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
				// Add to cachedByDate for response
				cachedByDate[date] = acts.map((a) => ({
					...a,
					activityId: String(a.activityId)
				})) as any;
			}

			// Mark dates with no activities as empty arrays
			for (const date of uncachedDates) {
				if (!cachedByDate[date]) {
					cachedByDate[date] = [];
				}
			}
		}

		return json({ success: true, data: cachedByDate });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch activities' },
			{ status: 500 }
		);
	}
};

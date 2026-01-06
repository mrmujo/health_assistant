import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { garminClient } from '$lib/server/garmin/client';
import { db } from '$lib/server/db/client';
import { activities } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
	const date = url.searchParams.get('date');
	const { user } = await locals.safeGetSession();

	if (!date) {
		return json({ success: false, error: 'Date required' }, { status: 400 });
	}

	try {
		// Check database cache first
		const cached = await db.select().from(activities).where(eq(activities.date, date));
		if (cached.length > 0) {
			return json({ success: true, data: cached });
		}

		// Fetch from Garmin API
		const result = await garminClient.fetchActivities(date, user?.id);

		// Cache successful results in database
		if (result.success && result.data && result.data.length > 0) {
			for (const activity of result.data) {
				// Normalize activityId - ensure it's a clean integer string (no .0 suffix)
				const activityId = String(activity.activityId).replace(/\.0$/, '');
				await db
					.insert(activities)
					.values({
						date,
						activityId,
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
					.onConflictDoUpdate({
						target: activities.activityId,
						set: { date } // Update date if conflict (no-op but ensures conflict is handled)
					});
			}
		}

		return json(result);
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch activities' },
			{ status: 500 }
		);
	}
};

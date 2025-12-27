import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { activitySummary, stressData } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Fetch last 14 days of activity data
	const activityRecords = await db
		.select()
		.from(activitySummary)
		.orderBy(desc(activitySummary.date))
		.limit(14);

	const stressRecords = await db
		.select()
		.from(stressData)
		.orderBy(desc(stressData.date))
		.limit(14);

	// Calculate averages for last 7 days
	const last7Days = activityRecords.slice(0, 7);
	const last7Stress = stressRecords.slice(0, 7);

	let avgSteps: number | null = null;
	let avgRestingHR: number | null = null;
	let avgBodyBattery: number | null = null;
	let avgCalories: number | null = null;

	if (last7Days.length > 0) {
		const steps = last7Days.filter((s) => s.steps !== null).map((s) => s.steps!);
		if (steps.length > 0) {
			avgSteps = Math.round(steps.reduce((a, b) => a + b, 0) / steps.length);
		}

		const hrs = last7Days.filter((s) => s.restingHeartRate !== null).map((s) => s.restingHeartRate!);
		if (hrs.length > 0) {
			avgRestingHR = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
		}

		const cals = last7Days.filter((s) => s.totalCalories !== null).map((s) => s.totalCalories!);
		if (cals.length > 0) {
			avgCalories = Math.round(cals.reduce((a, b) => a + b, 0) / cals.length);
		}
	}

	if (last7Stress.length > 0) {
		const batteries = last7Stress.filter((s) => s.bodyBatteryEnd !== null).map((s) => s.bodyBatteryEnd!);
		if (batteries.length > 0) {
			avgBodyBattery = Math.round(batteries.reduce((a, b) => a + b, 0) / batteries.length);
		}
	}

	return {
		activityData: activityRecords,
		stressData: stressRecords,
		avgSteps,
		avgRestingHR,
		avgBodyBattery,
		avgCalories
	};
};

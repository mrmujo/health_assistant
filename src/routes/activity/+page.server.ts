import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { activitySummary, stressData, activityRpe, rpeScales, activities } from '$lib/server/db/schema';
import { desc, gte } from 'drizzle-orm';
import { seedRpeData } from '$lib/server/rpe/seed';

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

	// Prepare chart data (reverse to show oldest first)
	const chartRecords = [...activityRecords].reverse();
	const chartLabels = chartRecords.map((s) => {
		const date = new Date(s.date);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	});

	const chartData = {
		labels: chartLabels,
		steps: chartRecords.map((s) => s.steps),
		restingHR: chartRecords.map((s) => s.restingHeartRate),
		calories: chartRecords.map((s) => s.totalCalories)
	};

	// Weekly totals for bar chart
	const weeklySteps = last7Days.map((s) => ({
		label: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }),
		value: s.steps || 0
	})).reverse();

	// Ensure RPE data is seeded
	await seedRpeData();

	// Fetch RPE data for last 14 days
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - 14);
	const startDateStr = startDate.toISOString().split('T')[0];

	const rpeRecords = await db
		.select()
		.from(activityRpe)
		.where(gte(activityRpe.date, startDateStr))
		.orderBy(desc(activityRpe.date));

	// Group RPE by date for quick lookup
	const rpeByDate: Record<string, typeof rpeRecords> = {};
	for (const record of rpeRecords) {
		if (!rpeByDate[record.date]) {
			rpeByDate[record.date] = [];
		}
		rpeByDate[record.date].push(record);
	}

	// Calculate daily RPE summaries
	const rpeSummaryByDate: Record<string, { avgRpe: number; totalFatigue: number; count: number }> = {};
	for (const [date, entries] of Object.entries(rpeByDate)) {
		const totalRpe = entries.reduce((sum, e) => sum + e.rpe, 0);
		const totalFatigue = entries.reduce((sum, e) => sum + (e.fatigue || 0), 0);
		rpeSummaryByDate[date] = {
			avgRpe: Math.round((totalRpe / entries.length) * 10) / 10,
			totalFatigue: Math.round(totalFatigue * 100) / 100,
			count: entries.length
		};
	}

	// Get all RPE scales for the dropdown
	const allRpeScales = await db.select().from(rpeScales).orderBy(rpeScales.activityType, rpeScales.rpeValue);

	// Group scales by activity type
	const scalesByType: Record<string, typeof allRpeScales> = {};
	for (const scale of allRpeScales) {
		if (!scalesByType[scale.activityType]) {
			scalesByType[scale.activityType] = [];
		}
		scalesByType[scale.activityType].push(scale);
	}

	// Prefetch cached activities for last 14 days
	const cachedActivities = await db
		.select()
		.from(activities)
		.where(gte(activities.date, startDateStr))
		.orderBy(desc(activities.date));

	// Group by date for quick lookup
	const activitiesByDate: Record<string, typeof cachedActivities> = {};
	for (const act of cachedActivities) {
		if (!activitiesByDate[act.date]) {
			activitiesByDate[act.date] = [];
		}
		activitiesByDate[act.date].push(act);
	}

	return {
		activityData: activityRecords,
		stressData: stressRecords,
		avgSteps,
		avgRestingHR,
		avgBodyBattery,
		avgCalories,
		chartData,
		weeklySteps,
		rpeByDate,
		rpeSummaryByDate,
		scalesByType,
		activitiesByDate
	};
};

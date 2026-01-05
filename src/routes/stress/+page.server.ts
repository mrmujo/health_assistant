import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { stressData, activityRpe } from '$lib/server/db/schema';
import { desc, gte } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Fetch last 14 days of stress data
	const stressRecords = await db
		.select()
		.from(stressData)
		.orderBy(desc(stressData.date))
		.limit(14);

	// Calculate averages for last 7 days
	const last7Days = stressRecords.slice(0, 7);

	let avgStress: number | null = null;
	let avgBodyBattery: number | null = null;
	let avgLowStress: number | null = null;
	let avgHighStress: number | null = null;

	if (last7Days.length > 0) {
		const stressValues = last7Days.filter((s) => s.avgStress !== null).map((s) => s.avgStress!);
		if (stressValues.length > 0) {
			avgStress = Math.round(stressValues.reduce((a, b) => a + b, 0) / stressValues.length);
		}

		const batteryValues = last7Days.filter((s) => s.bodyBatteryEnd !== null).map((s) => s.bodyBatteryEnd!);
		if (batteryValues.length > 0) {
			avgBodyBattery = Math.round(batteryValues.reduce((a, b) => a + b, 0) / batteryValues.length);
		}

		const lowStressValues = last7Days
			.filter((s) => s.lowStressMinutes !== null || s.restStressMinutes !== null)
			.map((s) => (s.lowStressMinutes || 0) + (s.restStressMinutes || 0));
		if (lowStressValues.length > 0) {
			avgLowStress = Math.round(lowStressValues.reduce((a, b) => a + b, 0) / lowStressValues.length);
		}

		const highStressValues = last7Days.filter((s) => s.highStressMinutes !== null).map((s) => s.highStressMinutes!);
		if (highStressValues.length > 0) {
			avgHighStress = Math.round(highStressValues.reduce((a, b) => a + b, 0) / highStressValues.length);
		}
	}

	// Prepare chart data (reverse to show oldest first)
	const chartRecords = [...stressRecords].reverse();
	const chartLabels = chartRecords.map((s) => {
		const date = new Date(s.date);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	});

	const chartData = {
		labels: chartLabels,
		avgStress: chartRecords.map((s) => s.avgStress),
		bodyBatteryEnd: chartRecords.map((s) => s.bodyBatteryEnd),
		bodyBatteryCharged: chartRecords.map((s) => s.bodyBatteryCharged),
		bodyBatteryDrained: chartRecords.map((s) => s.bodyBatteryDrained)
	};

	// Weekly stress distribution totals
	const weeklyStressMinutes = {
		rest: last7Days.reduce((sum, s) => sum + (s.restStressMinutes || 0), 0),
		low: last7Days.reduce((sum, s) => sum + (s.lowStressMinutes || 0), 0),
		medium: last7Days.reduce((sum, s) => sum + (s.mediumStressMinutes || 0), 0),
		high: last7Days.reduce((sum, s) => sum + (s.highStressMinutes || 0), 0)
	};

	// Fetch RPE/fatigue data for last 14 days
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - 14);
	const startDateStr = startDate.toISOString().split('T')[0];

	const rpeRecords = await db
		.select()
		.from(activityRpe)
		.where(gte(activityRpe.date, startDateStr))
		.orderBy(desc(activityRpe.date));

	// Group RPE by date and calculate daily fatigue
	const fatigueByDate: Record<string, { totalFatigue: number; avgRpe: number; count: number }> = {};
	for (const record of rpeRecords) {
		if (!fatigueByDate[record.date]) {
			fatigueByDate[record.date] = { totalFatigue: 0, avgRpe: 0, count: 0 };
		}
		fatigueByDate[record.date].totalFatigue += record.fatigue || 0;
		fatigueByDate[record.date].avgRpe += record.rpe;
		fatigueByDate[record.date].count += 1;
	}

	// Finalize averages
	for (const date of Object.keys(fatigueByDate)) {
		fatigueByDate[date].avgRpe = Math.round((fatigueByDate[date].avgRpe / fatigueByDate[date].count) * 10) / 10;
		fatigueByDate[date].totalFatigue = Math.round(fatigueByDate[date].totalFatigue * 100) / 100;
	}

	// Prepare fatigue chart data (aligned with stress chart)
	const fatigueChartData = chartRecords.map((s) => {
		const dayData = fatigueByDate[s.date];
		return dayData ? dayData.totalFatigue : null;
	});

	// Calculate avg fatigue for last 7 days
	const last7Fatigue = last7Days
		.map((s) => fatigueByDate[s.date]?.totalFatigue)
		.filter((f): f is number => f !== undefined);
	const avgFatigue = last7Fatigue.length > 0
		? Math.round((last7Fatigue.reduce((a, b) => a + b, 0) / last7Fatigue.length) * 100) / 100
		: null;

	return {
		stressData: stressRecords,
		avgStress,
		avgBodyBattery,
		avgLowStress,
		avgHighStress,
		chartData,
		weeklyStressMinutes,
		fatigueByDate,
		fatigueChartData,
		avgFatigue
	};
};

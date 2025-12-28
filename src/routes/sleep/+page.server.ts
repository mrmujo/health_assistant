import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { sleepData } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	// Fetch last 14 days of sleep data
	const sleepRecords = await db
		.select()
		.from(sleepData)
		.orderBy(desc(sleepData.date))
		.limit(14);

	// Calculate averages for last 7 days
	const last7Days = sleepRecords.slice(0, 7);

	let avgSleepScore: number | null = null;
	let avgDuration: string | null = null;
	let avgDeepPct: number | null = null;
	let avgRemPct: number | null = null;

	if (last7Days.length > 0) {
		const scores = last7Days.filter((s) => s.sleepScore !== null).map((s) => s.sleepScore!);
		if (scores.length > 0) {
			avgSleepScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
		}

		const durations = last7Days.filter((s) => s.durationSeconds !== null).map((s) => s.durationSeconds!);
		if (durations.length > 0) {
			const avgSeconds = durations.reduce((a, b) => a + b, 0) / durations.length;
			const hours = Math.floor(avgSeconds / 3600);
			const mins = Math.floor((avgSeconds % 3600) / 60);
			avgDuration = `${hours}h ${mins}m`;
		}

		const daysWithDuration = last7Days.filter((s) => s.durationSeconds && s.durationSeconds > 0);
		if (daysWithDuration.length > 0) {
			const deepPcts = daysWithDuration.map(
				(s) => ((s.deepSleepSeconds || 0) / s.durationSeconds!) * 100
			);
			avgDeepPct = Math.round(deepPcts.reduce((a, b) => a + b, 0) / deepPcts.length);

			const remPcts = daysWithDuration.map(
				(s) => ((s.remSleepSeconds || 0) / s.durationSeconds!) * 100
			);
			avgRemPct = Math.round(remPcts.reduce((a, b) => a + b, 0) / remPcts.length);
		}
	}

	// Prepare chart data (reverse to show oldest first)
	const chartRecords = [...sleepRecords].reverse();
	const chartLabels = chartRecords.map((s) => {
		const date = new Date(s.date);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	});

	const chartData = {
		labels: chartLabels,
		sleepScores: chartRecords.map((s) => s.sleepScore),
		durations: chartRecords.map((s) => s.durationSeconds ? Math.round(s.durationSeconds / 3600 * 10) / 10 : null),
		avgHrSleep: chartRecords.map((s) => s.avgHrSleep)
	};

	// Calculate weekly sleep stage totals for pie chart
	const totalDeep = last7Days.reduce((sum, s) => sum + (s.deepSleepSeconds || 0), 0);
	const totalLight = last7Days.reduce((sum, s) => sum + (s.lightSleepSeconds || 0), 0);
	const totalRem = last7Days.reduce((sum, s) => sum + (s.remSleepSeconds || 0), 0);
	const totalAwake = last7Days.reduce((sum, s) => sum + (s.awakeSeconds || 0), 0);

	const sleepStages = {
		labels: ['Deep', 'Light', 'REM', 'Awake'],
		data: [
			Math.round(totalDeep / 3600 * 10) / 10,
			Math.round(totalLight / 3600 * 10) / 10,
			Math.round(totalRem / 3600 * 10) / 10,
			Math.round(totalAwake / 3600 * 10) / 10
		]
	};

	return {
		sleepData: sleepRecords,
		avgSleepScore,
		avgDuration,
		avgDeepPct,
		avgRemPct,
		chartData,
		sleepStages
	};
};

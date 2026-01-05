import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { sleepData, activitySummary, stressData, activityRpe } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

// Calculate Pearson correlation coefficient
function calculateCorrelation(x: number[], y: number[]): number {
	const n = x.length;
	if (n === 0) return 0;

	const sumX = x.reduce((a, b) => a + b, 0);
	const sumY = y.reduce((a, b) => a + b, 0);
	const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
	const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
	const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

	const numerator = n * sumXY - sumX * sumY;
	const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

	if (denominator === 0) return 0;
	return numerator / denominator;
}

function getCorrelationStrength(r: number): { label: string; color: string } {
	const absR = Math.abs(r);
	if (absR >= 0.7) return { label: 'Strong', color: '#22c55e' };
	if (absR >= 0.4) return { label: 'Moderate', color: '#eab308' };
	if (absR >= 0.2) return { label: 'Weak', color: '#f97316' };
	return { label: 'None', color: '#a3a3a3' };
}

export const load: PageServerLoad = async () => {
	// Fetch last 30 days of data for better correlation analysis
	const [sleepRecords, activityRecords, stressRecords, rpeRecords] = await Promise.all([
		db.select().from(sleepData).orderBy(desc(sleepData.date)).limit(30),
		db.select().from(activitySummary).orderBy(desc(activitySummary.date)).limit(30),
		db.select().from(stressData).orderBy(desc(stressData.date)).limit(30),
		db.select().from(activityRpe).orderBy(desc(activityRpe.date)).limit(100)
	]);

	// Create date-indexed maps for easier joining
	const sleepByDate = new Map(sleepRecords.map(s => [s.date, s]));
	const activityByDate = new Map(activityRecords.map(a => [a.date, a]));
	const stressByDate = new Map(stressRecords.map(s => [s.date, s]));

	// Group RPE by date and calculate daily totals
	const rpeByDate = new Map<string, { totalFatigue: number; avgRpe: number; count: number }>();
	for (const rpe of rpeRecords) {
		const existing = rpeByDate.get(rpe.date) || { totalFatigue: 0, avgRpe: 0, count: 0 };
		existing.totalFatigue += rpe.fatigue || 0;
		existing.avgRpe += rpe.rpe;
		existing.count += 1;
		rpeByDate.set(rpe.date, existing);
	}
	// Finalize RPE averages
	for (const [date, data] of rpeByDate) {
		data.avgRpe = data.avgRpe / data.count;
		data.totalFatigue = Math.round(data.totalFatigue * 100) / 100;
	}

	// 1. Sleep Score vs Next-Day Body Battery
	const sleepVsEnergy: { x: number; y: number }[] = [];
	for (const sleep of sleepRecords) {
		if (sleep.sleepScore === null) continue;
		const nextDate = new Date(sleep.date);
		nextDate.setDate(nextDate.getDate() + 1);
		const nextDateStr = nextDate.toISOString().split('T')[0];
		const nextStress = stressByDate.get(nextDateStr);
		if (nextStress?.bodyBatteryMax !== null && nextStress?.bodyBatteryMax !== undefined) {
			sleepVsEnergy.push({ x: sleep.sleepScore, y: nextStress.bodyBatteryMax });
		}
	}
	const sleepEnergyCorr = calculateCorrelation(
		sleepVsEnergy.map(p => p.x),
		sleepVsEnergy.map(p => p.y)
	);

	// 2. Daily Steps vs Sleep Score (that night)
	const stepsVsSleep: { x: number; y: number }[] = [];
	for (const activity of activityRecords) {
		if (activity.steps === null) continue;
		const sleep = sleepByDate.get(activity.date);
		if (sleep?.sleepScore !== null && sleep?.sleepScore !== undefined) {
			stepsVsSleep.push({ x: activity.steps, y: sleep.sleepScore });
		}
	}
	const stepsSleepCorr = calculateCorrelation(
		stepsVsSleep.map(p => p.x),
		stepsVsSleep.map(p => p.y)
	);

	// 3. Average Stress vs Sleep Score
	const stressVsSleep: { x: number; y: number }[] = [];
	for (const stress of stressRecords) {
		if (stress.avgStress === null) continue;
		const sleep = sleepByDate.get(stress.date);
		if (sleep?.sleepScore !== null && sleep?.sleepScore !== undefined) {
			stressVsSleep.push({ x: stress.avgStress, y: sleep.sleepScore });
		}
	}
	const stressSleepCorr = calculateCorrelation(
		stressVsSleep.map(p => p.x),
		stressVsSleep.map(p => p.y)
	);

	// 4. Active Calories vs Body Battery Charged
	const caloriesVsRecovery: { x: number; y: number }[] = [];
	for (const activity of activityRecords) {
		if (activity.activeCalories === null) continue;
		const stress = stressByDate.get(activity.date);
		if (stress?.bodyBatteryCharged !== null && stress?.bodyBatteryCharged !== undefined) {
			caloriesVsRecovery.push({ x: activity.activeCalories, y: stress.bodyBatteryCharged });
		}
	}
	const caloriesRecoveryCorr = calculateCorrelation(
		caloriesVsRecovery.map(p => p.x),
		caloriesVsRecovery.map(p => p.y)
	);

	// 5. RPE Fatigue vs Body Battery Drain
	const fatigueVsDrain: { x: number; y: number }[] = [];
	for (const [date, rpeData] of rpeByDate) {
		const stress = stressByDate.get(date);
		if (stress?.bodyBatteryDrained !== null && stress?.bodyBatteryDrained !== undefined) {
			fatigueVsDrain.push({ x: rpeData.totalFatigue, y: stress.bodyBatteryDrained });
		}
	}
	const fatigueDrainCorr = calculateCorrelation(
		fatigueVsDrain.map(p => p.x),
		fatigueVsDrain.map(p => p.y)
	);

	// 6. RPE Fatigue vs Sleep Score (same night)
	const fatigueVsSleep: { x: number; y: number }[] = [];
	for (const [date, rpeData] of rpeByDate) {
		const sleep = sleepByDate.get(date);
		if (sleep?.sleepScore !== null && sleep?.sleepScore !== undefined) {
			fatigueVsSleep.push({ x: rpeData.totalFatigue, y: sleep.sleepScore });
		}
	}
	const fatigueSleepCorr = calculateCorrelation(
		fatigueVsSleep.map(p => p.x),
		fatigueVsSleep.map(p => p.y)
	);

	return {
		correlations: [
			{
				id: 'sleep-energy',
				title: 'Sleep Quality vs Next-Day Energy',
				description: 'Does better sleep lead to more energy the next day?',
				xLabel: 'Sleep Score',
				yLabel: 'Body Battery Max',
				data: sleepVsEnergy,
				correlation: sleepEnergyCorr,
				strength: getCorrelationStrength(sleepEnergyCorr),
				color: '#22c55e'
			},
			{
				id: 'steps-sleep',
				title: 'Daily Activity vs Sleep Quality',
				description: 'Does more physical activity help you sleep better?',
				xLabel: 'Steps',
				yLabel: 'Sleep Score',
				data: stepsVsSleep,
				correlation: stepsSleepCorr,
				strength: getCorrelationStrength(stepsSleepCorr),
				color: '#3b82f6'
			},
			{
				id: 'stress-sleep',
				title: 'Stress Level vs Sleep Quality',
				description: 'Does higher stress lead to worse sleep?',
				xLabel: 'Avg Stress',
				yLabel: 'Sleep Score',
				data: stressVsSleep,
				correlation: stressSleepCorr,
				strength: getCorrelationStrength(stressSleepCorr),
				color: '#eab308'
			},
			{
				id: 'calories-recovery',
				title: 'Activity Intensity vs Recovery',
				description: 'Does more intense activity affect your body\'s ability to recharge?',
				xLabel: 'Active Calories',
				yLabel: 'Body Battery Charged',
				data: caloriesVsRecovery,
				correlation: caloriesRecoveryCorr,
				strength: getCorrelationStrength(caloriesRecoveryCorr),
				color: '#f97316'
			},
			{
				id: 'fatigue-drain',
				title: 'RPE Fatigue vs Body Battery Drain',
				description: 'Does higher perceived exertion correlate with more energy drain?',
				xLabel: 'RPE Fatigue Score',
				yLabel: 'Body Battery Drained',
				data: fatigueVsDrain,
				correlation: fatigueDrainCorr,
				strength: getCorrelationStrength(fatigueDrainCorr),
				color: '#ef4444'
			},
			{
				id: 'fatigue-sleep',
				title: 'RPE Fatigue vs Sleep Quality',
				description: 'Does training harder affect your sleep that night?',
				xLabel: 'RPE Fatigue Score',
				yLabel: 'Sleep Score',
				data: fatigueVsSleep,
				correlation: fatigueSleepCorr,
				strength: getCorrelationStrength(fatigueSleepCorr),
				color: '#8b5cf6'
			}
		],
		hasData: sleepRecords.length > 0 && activityRecords.length > 0 && stressRecords.length > 0
	};
};

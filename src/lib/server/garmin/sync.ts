import { db } from '$lib/server/db/client';
import { sleepData, activitySummary, stressData } from '$lib/server/db/schema';
import { garminClient, type SyncAllResult } from './client';
import { eq } from 'drizzle-orm';

/**
 * Sync Garmin data for a date range and store in database.
 * Data is already de-personalized by the Python service.
 */
export async function syncGarminData(
	startDate: string,
	endDate: string
): Promise<{ success: boolean; synced: number; errors: string[] }> {
	const errors: string[] = [];
	let synced = 0;

	try {
		const result: SyncAllResult = await garminClient.syncAll(startDate, endDate);

		if (!result.success || !result.dates) {
			return { success: false, synced: 0, errors: [result.error || 'Failed to sync'] };
		}

		for (const [date, dayData] of Object.entries(result.dates)) {
			// Store sleep data (only if we have actual data)
			if (dayData.sleep && dayData.sleep.sleepTimeSeconds) {
				try {
					const sleepRecord = {
						date,
						startTime: dayData.sleep.sleepStartTimestampGMT
							? new Date(dayData.sleep.sleepStartTimestampGMT)
							: null,
						endTime: dayData.sleep.sleepEndTimestampGMT
							? new Date(dayData.sleep.sleepEndTimestampGMT)
							: null,
						durationSeconds: dayData.sleep.sleepTimeSeconds,
						deepSleepSeconds: dayData.sleep.deepSleepSeconds,
						lightSleepSeconds: dayData.sleep.lightSleepSeconds,
						remSleepSeconds: dayData.sleep.remSleepSeconds,
						awakeSeconds: dayData.sleep.awakeSleepSeconds,
						sleepScore: dayData.sleep.sleepScore,
						avgSpO2: dayData.sleep.averageSpO2Value,
						avgRespirationRate: dayData.sleep.averageRespirationValue,
						avgHrSleep: dayData.sleep.avgSleepHR,
						rawData: JSON.stringify(dayData.sleep)
					};

					await db
						.insert(sleepData)
						.values(sleepRecord)
						.onConflictDoUpdate({
							target: sleepData.date,
							set: sleepRecord
						});
					synced++;
				} catch (e) {
					errors.push(`Sleep ${date}: ${e instanceof Error ? e.message : 'Unknown error'}`);
				}
			}

			// Store activity data
			if (dayData.activity) {
				try {
					const activityRecord = {
						date,
						steps: dayData.activity.totalSteps,
						distance: dayData.activity.totalDistanceMeters,
						activeCalories: dayData.activity.activeKilocalories,
						totalCalories: dayData.activity.totalKilocalories,
						floorsClimbed: dayData.activity.floorsAscended,
						avgHeartRate: Math.round(
							(dayData.activity.minHeartRate + dayData.activity.maxHeartRate) / 2
						),
						maxHeartRate: dayData.activity.maxHeartRate,
						restingHeartRate: dayData.activity.restingHeartRate,
						rawData: JSON.stringify(dayData.activity)
					};

					await db
						.insert(activitySummary)
						.values(activityRecord)
						.onConflictDoUpdate({
							target: activitySummary.date,
							set: activityRecord
						});
					synced++;
				} catch (e) {
					errors.push(`Activity ${date}: ${e instanceof Error ? e.message : 'Unknown error'}`);
				}
			}

			// Store stress/body battery data
			if (dayData.activity) {
				try {
					const stressRecord = {
						date,
						avgStress: dayData.activity.averageStressLevel,
						maxStress: dayData.activity.maxStressLevel,
						lowStressMinutes: Math.round((dayData.activity.lowStressDuration || 0) / 60),
						mediumStressMinutes: Math.round((dayData.activity.mediumStressDuration || 0) / 60),
						highStressMinutes: Math.round((dayData.activity.highStressDuration || 0) / 60),
						restStressMinutes: 0,
						bodyBatteryStart: dayData.activity.bodyBatteryLowestValue,
						bodyBatteryEnd: dayData.activity.bodyBatteryMostRecentValue,
						bodyBatteryMax: dayData.activity.bodyBatteryHighestValue,
						bodyBatteryMin: dayData.activity.bodyBatteryLowestValue,
						bodyBatteryDrained: dayData.activity.bodyBatteryDrainedValue,
						bodyBatteryCharged: dayData.activity.bodyBatteryChargedValue,
						rawData: JSON.stringify({
							stress: dayData.stress,
							bodyBattery: dayData.bodyBattery
						})
					};

					await db
						.insert(stressData)
						.values(stressRecord)
						.onConflictDoUpdate({
							target: stressData.date,
							set: stressRecord
						});
					synced++;
				} catch (e) {
					errors.push(`Stress ${date}: ${e instanceof Error ? e.message : 'Unknown error'}`);
				}
			}
		}

		return { success: true, synced, errors };
	} catch (e) {
		return {
			success: false,
			synced: 0,
			errors: [e instanceof Error ? e.message : 'Unknown error']
		};
	}
}

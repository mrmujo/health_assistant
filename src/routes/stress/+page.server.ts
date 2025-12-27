import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { stressData } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

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

	return {
		stressData: stressRecords,
		avgStress,
		avgBodyBattery,
		avgLowStress,
		avgHighStress
	};
};

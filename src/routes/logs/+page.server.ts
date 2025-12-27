import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { foodLogs, medicationLogs, healthNotes } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const foodLogsData = await db
		.select()
		.from(foodLogs)
		.orderBy(desc(foodLogs.date), desc(foodLogs.createdAt))
		.limit(50);

	const medicationLogsData = await db
		.select()
		.from(medicationLogs)
		.orderBy(desc(medicationLogs.date), desc(medicationLogs.createdAt))
		.limit(50);

	const healthNotesData = await db
		.select()
		.from(healthNotes)
		.orderBy(desc(healthNotes.date), desc(healthNotes.createdAt))
		.limit(50);

	return {
		foodLogs: foodLogsData,
		medicationLogs: medicationLogsData,
		healthNotes: healthNotesData
	};
};

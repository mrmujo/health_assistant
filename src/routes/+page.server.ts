import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { sleepData, activitySummary, stressData, foodLogs, medicationLogs, healthNotes } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const today = new Date().toISOString().split('T')[0];

	// Fetch today's data
	const [sleep] = await db.select().from(sleepData).where(eq(sleepData.date, today)).limit(1);
	const [activity] = await db.select().from(activitySummary).where(eq(activitySummary.date, today)).limit(1);
	const [stress] = await db.select().from(stressData).where(eq(stressData.date, today)).limit(1);

	// Fetch recent logs (last 5)
	const recentFood = await db.select().from(foodLogs).orderBy(desc(foodLogs.createdAt)).limit(3);
	const recentMeds = await db.select().from(medicationLogs).orderBy(desc(medicationLogs.createdAt)).limit(3);
	const recentNotes = await db.select().from(healthNotes).orderBy(desc(healthNotes.createdAt)).limit(3);

	// Combine and sort recent logs
	const recentLogs = [
		...recentFood.map(f => ({ type: 'food' as const, description: f.description, time: f.time || '', date: f.date, createdAt: f.createdAt })),
		...recentMeds.map(m => ({ type: 'medication' as const, description: `${m.medicationName} ${m.dosage || ''}`.trim(), time: m.time || '', date: m.date, createdAt: m.createdAt })),
		...recentNotes.map(n => ({ type: 'note' as const, description: n.content.substring(0, 50) + (n.content.length > 50 ? '...' : ''), time: '', date: n.date, createdAt: n.createdAt }))
	]
		.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
		.slice(0, 5);

	return {
		sleep: sleep || null,
		activity: activity || null,
		stress: stress || null,
		recentLogs
	};
};

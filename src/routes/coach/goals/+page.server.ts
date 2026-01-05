import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const goals = await db.select().from(trainingGoals).orderBy(desc(trainingGoals.eventDate));

	return {
		goals
	};
};

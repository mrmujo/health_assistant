import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { trainingGoals } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// GET - List all goals
export const GET: RequestHandler = async ({ url }) => {
	try {
		const status = url.searchParams.get('status');

		let query = db.select().from(trainingGoals);

		if (status) {
			query = query.where(eq(trainingGoals.status, status)) as typeof query;
		}

		const goals = await query.orderBy(desc(trainingGoals.eventDate));

		return json({ success: true, data: goals });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to fetch goals' },
			{ status: 500 }
		);
	}
};

// POST - Create new goal
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { name, eventDate, eventType, distance, targetTime, notes } = body;

		if (!name || !eventDate || !eventType) {
			return json(
				{ success: false, error: 'Name, event date, and event type are required' },
				{ status: 400 }
			);
		}

		// Validate event type
		const validTypes = ['running', 'cycling', 'swimming', 'triathlon'];
		if (!validTypes.includes(eventType)) {
			return json(
				{ success: false, error: `Event type must be one of: ${validTypes.join(', ')}` },
				{ status: 400 }
			);
		}

		const result = await db
			.insert(trainingGoals)
			.values({
				name,
				eventDate,
				eventType,
				distance: distance || null,
				targetTime: targetTime || null,
				notes: notes || null,
				status: 'active'
			})
			.returning();

		return json({ success: true, data: result[0] });
	} catch (e) {
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to create goal' },
			{ status: 500 }
		);
	}
};

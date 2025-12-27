import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { healthNotes } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		await db.insert(healthNotes).values({
			date: data.date,
			category: data.category,
			content: data.content,
			tags: data.tags ? JSON.stringify(data.tags) : null
		});

		return json({ success: true });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed to save' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'ID required' }, { status: 400 });
		}

		await db.delete(healthNotes).where(eq(healthNotes.id, parseInt(id)));
		return json({ success: true });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed to delete' }, { status: 500 });
	}
};

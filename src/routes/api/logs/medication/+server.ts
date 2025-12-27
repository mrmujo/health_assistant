import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { medicationLogs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		await db.insert(medicationLogs).values({
			date: data.date,
			time: data.time,
			medicationName: data.medicationName,
			dosage: data.dosage,
			unit: data.unit,
			notes: data.notes
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

		await db.delete(medicationLogs).where(eq(medicationLogs.id, parseInt(id)));
		return json({ success: true });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed to delete' }, { status: 500 });
	}
};

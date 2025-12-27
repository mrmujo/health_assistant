import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { chatConversations, settings } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { question, title } = await request.json();

		// Create a new conversation
		const result = await db
			.insert(chatConversations)
			.values({
				title: title || question.slice(0, 50) + (question.length > 50 ? '...' : ''),
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({ id: chatConversations.id });

		const conversationId = result[0].id;

		// Store the prefill question and conversation ID in settings
		await db
			.insert(settings)
			.values({ key: 'chatPrefill', value: JSON.stringify({ question, conversationId }) })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: JSON.stringify({ question, conversationId }), updatedAt: new Date() }
			});

		return json({ success: true, conversationId });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
	}
};

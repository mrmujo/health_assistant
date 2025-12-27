import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { chatConversations, chatMessages } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

// Get all conversations
export const GET: RequestHandler = async () => {
	try {
		const conversations = await db
			.select()
			.from(chatConversations)
			.orderBy(desc(chatConversations.updatedAt));

		return json({ success: true, data: conversations });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
	}
};

// Create a new conversation
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { title } = await request.json();

		const result = await db
			.insert(chatConversations)
			.values({
				title: title || 'New Conversation',
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({ id: chatConversations.id });

		return json({ success: true, id: result[0].id });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
	}
};

// Delete a conversation
export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const id = url.searchParams.get('id');
		if (!id) {
			return json({ success: false, error: 'ID required' }, { status: 400 });
		}

		const conversationId = parseInt(id, 10);

		// Delete all messages in the conversation
		await db.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId));

		// Delete the conversation
		await db.delete(chatConversations).where(eq(chatConversations.id, conversationId));

		return json({ success: true });
	} catch (e) {
		return json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
	}
};

import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { chatMessages, chatConversations, settings } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const conversationIdParam = url.searchParams.get('id');

	// Get all conversations for the sidebar
	const conversations = await db
		.select()
		.from(chatConversations)
		.orderBy(desc(chatConversations.updatedAt));

	// Check for prefill question (new conversation from analyze buttons)
	const [prefillSetting] = await db
		.select()
		.from(settings)
		.where(eq(settings.key, 'chatPrefill'))
		.limit(1);

	let prefillQuestion: string | null = null;
	let prefillConversationId: number | null = null;

	if (prefillSetting?.value) {
		try {
			const parsed = JSON.parse(prefillSetting.value);
			prefillQuestion = parsed.question;
			prefillConversationId = parsed.conversationId;
		} catch {
			// Legacy format - just a string
			prefillQuestion = prefillSetting.value;
		}
		// Clear the prefill
		await db.delete(settings).where(eq(settings.key, 'chatPrefill'));
	}

	// Determine which conversation to load
	let currentConversationId: number | null = null;

	if (prefillConversationId) {
		// Coming from an analyze button - use the new conversation
		currentConversationId = prefillConversationId;
	} else if (conversationIdParam) {
		// URL parameter specified
		currentConversationId = parseInt(conversationIdParam, 10);
	}
	// If neither, show the conversation list without loading a specific one

	// Load messages for the current conversation
	let chatHistory: { role: 'user' | 'assistant'; content: string }[] = [];

	if (currentConversationId) {
		const messages = await db
			.select()
			.from(chatMessages)
			.where(eq(chatMessages.conversationId, currentConversationId))
			.orderBy(desc(chatMessages.createdAt))
			.limit(100);

		chatHistory = messages.reverse().map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		}));
	}

	// Get current conversation title
	let currentConversation: { id: number; title: string | null } | null = null;
	if (currentConversationId) {
		const [conv] = await db
			.select()
			.from(chatConversations)
			.where(eq(chatConversations.id, currentConversationId))
			.limit(1);
		if (conv) {
			currentConversation = { id: conv.id, title: conv.title };
		}
	}

	return {
		conversations,
		currentConversation,
		chatHistory,
		prefillQuestion
	};
};

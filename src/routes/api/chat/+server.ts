import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamChat, type Message, type HealthContext } from '$lib/server/ai/provider';
import { db } from '$lib/server/db/client';
import { sleepData, activitySummary, stressData, foodLogs, medicationLogs, healthNotes, chatMessages, chatConversations } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ url }) => {
	const conversationId = url.searchParams.get('conversationId');

	if (conversationId) {
		// Delete messages for specific conversation
		await db.delete(chatMessages).where(eq(chatMessages.conversationId, parseInt(conversationId, 10)));
	} else {
		// Delete all messages (legacy behavior)
		await db.delete(chatMessages);
	}

	return json({ success: true });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages, saveUserMessage, conversationId } = (await request.json()) as {
			messages: Message[];
			saveUserMessage?: boolean;
			conversationId?: number;
		};

		// Save the user's message to the database
		if (saveUserMessage && messages.length > 0) {
			const lastMessage = messages[messages.length - 1];
			if (lastMessage.role === 'user') {
				await db.insert(chatMessages).values({
					role: 'user',
					content: lastMessage.content,
					conversationId: conversationId || null
				});

				// Update conversation's updatedAt
				if (conversationId) {
					await db.update(chatConversations)
						.set({ updatedAt: new Date() })
						.where(eq(chatConversations.id, conversationId));
				}
			}
		}

		// Fetch health context (last 7 days)
		const [sleep, activity, stress, food, meds, notes] = await Promise.all([
			db.select().from(sleepData).orderBy(desc(sleepData.date)).limit(7),
			db.select().from(activitySummary).orderBy(desc(activitySummary.date)).limit(7),
			db.select().from(stressData).orderBy(desc(stressData.date)).limit(7),
			db.select().from(foodLogs).orderBy(desc(foodLogs.date)).limit(20),
			db.select().from(medicationLogs).orderBy(desc(medicationLogs.date)).limit(20),
			db.select().from(healthNotes).orderBy(desc(healthNotes.date)).limit(10)
		]);

		const healthContext: HealthContext = {
			sleep,
			activity,
			stress,
			foodLogs: food,
			medicationLogs: meds,
			notes
		};

		const stream = await streamChat(messages, healthContext);

		// Convert the stream to SSE format and collect full response
		const encoder = new TextEncoder();
		let fullResponse = '';

		const transformedStream = new ReadableStream({
			async start(controller) {
				const reader = stream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							// Save the assistant's response to the database
							if (fullResponse.trim()) {
								await db.insert(chatMessages).values({
									role: 'assistant',
									content: fullResponse,
									conversationId: conversationId || null
								});
							}
							controller.enqueue(encoder.encode('data: [DONE]\n\n'));
							controller.close();
							break;
						}
						fullResponse += value;
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: value })}\n\n`));
					}
				} catch (e) {
					controller.error(e);
				}
			}
		});

		return new Response(transformedStream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (e) {
		return new Response(
			JSON.stringify({ error: e instanceof Error ? e.message : 'Chat failed' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

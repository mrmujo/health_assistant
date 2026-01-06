import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import { sleepData, activitySummary, stressData, foodLogs, medicationLogs, healthNotes, chatMessages, chatConversations } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

interface HealthContext {
	sleep?: unknown[];
	activity?: unknown[];
	stress?: unknown[];
	foodLogs?: unknown[];
	medicationLogs?: unknown[];
	notes?: unknown[];
}

interface ApiConfig {
	provider: string;
	openaiKey?: string;
	anthropicKey?: string;
	ollamaEndpoint?: string;
	ollamaModel?: string;
}

const HEALTH_SYSTEM_PROMPT = `You are a personal health assistant with access to the user's health data from their Garmin device and manual logs. You can analyze sleep patterns, activity levels, stress, and body battery data.

When analyzing health data:
- Look for patterns and correlations between different metrics
- Provide actionable insights based on the data
- Be supportive but not prescriptive (you're not a doctor)
- Reference specific data points when relevant
- If you notice concerning patterns, gently suggest consulting a healthcare professional

You have access to:
- Sleep data: duration, quality, deep/light/REM stages, heart rate during sleep, SpO2
- Activity data: steps, calories, heart rate, distance
- Stress & Body Battery: stress levels throughout the day, body battery charge/drain
- User logs: food intake, medications, and personal health notes

When the user asks about their health, analyze the provided context data and give personalized insights.`;

function formatHealthContext(context: HealthContext): string {
	const parts: string[] = [];

	if (context.sleep && context.sleep.length > 0) {
		parts.push(`Recent Sleep Data (last ${context.sleep.length} days):\n${JSON.stringify(context.sleep, null, 2)}`);
	}

	if (context.activity && context.activity.length > 0) {
		parts.push(`Recent Activity Data (last ${context.activity.length} days):\n${JSON.stringify(context.activity, null, 2)}`);
	}

	if (context.stress && context.stress.length > 0) {
		parts.push(`Recent Stress/Body Battery Data:\n${JSON.stringify(context.stress, null, 2)}`);
	}

	if (context.foodLogs && context.foodLogs.length > 0) {
		parts.push(`Recent Food Logs:\n${JSON.stringify(context.foodLogs, null, 2)}`);
	}

	if (context.medicationLogs && context.medicationLogs.length > 0) {
		parts.push(`Recent Medications:\n${JSON.stringify(context.medicationLogs, null, 2)}`);
	}

	if (context.notes && context.notes.length > 0) {
		parts.push(`Recent Health Notes:\n${JSON.stringify(context.notes, null, 2)}`);
	}

	return parts.length > 0 ? parts.join('\n\n') : 'No health data available yet.';
}

async function streamChat(
	messages: Message[],
	systemPrompt: string,
	config: ApiConfig
): Promise<ReadableStream<string>> {
	if (config.provider === 'ollama' && config.ollamaEndpoint) {
		return streamOllama(messages, systemPrompt, config.ollamaEndpoint, config.ollamaModel || 'llama2');
	} else if (config.provider === 'openai' && config.openaiKey) {
		return streamOpenAI(messages, systemPrompt, config.openaiKey);
	} else if (config.provider === 'anthropic' && config.anthropicKey) {
		return streamAnthropic(messages, systemPrompt, config.anthropicKey);
	} else {
		throw new Error('No API key configured for the selected provider. Please add your API key in Settings.');
	}
}

async function streamAnthropic(
	messages: Message[],
	systemPrompt: string,
	apiKey: string
): Promise<ReadableStream<string>> {
	const client = new Anthropic({ apiKey });

	const stream = client.messages.stream({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4096,
		system: systemPrompt,
		messages: messages.map((m) => ({
			role: m.role,
			content: m.content
		}))
	});

	return new ReadableStream({
		async start(controller) {
			try {
				for await (const event of stream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						controller.enqueue(event.delta.text);
					}
				}
				controller.close();
			} catch (e) {
				controller.error(e);
			}
		}
	});
}

async function streamOpenAI(
	messages: Message[],
	systemPrompt: string,
	apiKey: string
): Promise<ReadableStream<string>> {
	const client = new OpenAI({ apiKey });

	const stream = await client.chat.completions.create({
		model: 'gpt-4-turbo-preview',
		stream: true,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}))
		]
	});

	return new ReadableStream({
		async start(controller) {
			try {
				for await (const chunk of stream) {
					const text = chunk.choices[0]?.delta?.content;
					if (text) {
						controller.enqueue(text);
					}
				}
				controller.close();
			} catch (e) {
				controller.error(e);
			}
		}
	});
}

async function streamOllama(
	messages: Message[],
	systemPrompt: string,
	endpoint: string,
	model: string
): Promise<ReadableStream<string>> {
	let apiUrl = endpoint.trim();
	if (apiUrl.endsWith('/')) {
		apiUrl = apiUrl.slice(0, -1);
	}
	if (!apiUrl.endsWith('/api/chat')) {
		apiUrl = apiUrl + '/api/chat';
	}

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			stream: true,
			messages: [
				{ role: 'system', content: systemPrompt },
				...messages.map((m) => ({
					role: m.role,
					content: m.content
				}))
			]
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama request failed: ${response.status}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body from Ollama');
	}

	return new ReadableStream({
		async start(controller) {
			const decoder = new TextDecoder();
			let buffer = '';

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const parsed = JSON.parse(line);
							if (parsed.message?.content) {
								controller.enqueue(parsed.message.content);
							}
						} catch {
							// Skip invalid JSON
						}
					}
				}

				if (buffer.trim()) {
					try {
						const parsed = JSON.parse(buffer);
						if (parsed.message?.content) {
							controller.enqueue(parsed.message.content);
						}
					} catch {
						// Skip invalid JSON
					}
				}

				controller.close();
			} catch (e) {
				controller.error(e);
			}
		}
	});
}

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
		const { messages, saveUserMessage, conversationId, apiConfig } = (await request.json()) as {
			messages: Message[];
			saveUserMessage?: boolean;
			conversationId?: number;
			apiConfig?: ApiConfig;
		};

		// API config must be provided by the client (keeps keys client-side)
		if (!apiConfig) {
			return new Response(
				JSON.stringify({ error: 'API configuration required. Please configure your AI settings.' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

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

		const contextMessage = `\n\nCurrent Health Data:\n${formatHealthContext(healthContext)}`;
		const systemPrompt = HEALTH_SYSTEM_PROMPT + contextMessage;

		const stream = await streamChat(messages, systemPrompt, apiConfig);

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

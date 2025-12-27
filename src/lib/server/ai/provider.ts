import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { db } from '$lib/server/db/client';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export interface HealthContext {
	sleep?: unknown[];
	activity?: unknown[];
	stress?: unknown[];
	foodLogs?: unknown[];
	medicationLogs?: unknown[];
	notes?: unknown[];
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

interface ApiConfig {
	openaiKey: string | null;
	anthropicKey: string | null;
	ollamaEndpoint: string | null;
	ollamaModel: string | null;
	provider: string;
}

async function getApiKeys(): Promise<ApiConfig> {
	const [openaiSetting, anthropicSetting, providerSetting, ollamaEndpointSetting, ollamaModelSetting] = await Promise.all([
		db.select().from(settings).where(eq(settings.key, 'openaiKey')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'anthropicKey')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'aiProvider')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'ollamaEndpoint')).limit(1),
		db.select().from(settings).where(eq(settings.key, 'ollamaModel')).limit(1)
	]);

	return {
		openaiKey: openaiSetting[0]?.value || null,
		anthropicKey: anthropicSetting[0]?.value || null,
		ollamaEndpoint: ollamaEndpointSetting[0]?.value || null,
		ollamaModel: ollamaModelSetting[0]?.value || null,
		provider: providerSetting[0]?.value || 'anthropic'
	};
}

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

export async function streamChat(
	messages: Message[],
	healthContext: HealthContext
): Promise<ReadableStream<string>> {
	const config = await getApiKeys();

	const contextMessage = `\n\nCurrent Health Data:\n${formatHealthContext(healthContext)}`;
	const systemPrompt = HEALTH_SYSTEM_PROMPT + contextMessage;

	if (config.provider === 'ollama' && config.ollamaEndpoint) {
		return streamOllama(messages, systemPrompt, config.ollamaEndpoint, config.ollamaModel || 'llama2');
	} else if (config.provider === 'openai' && config.openaiKey) {
		return streamOpenAI(messages, systemPrompt, config.openaiKey);
	} else if (config.anthropicKey) {
		return streamAnthropic(messages, systemPrompt, config.anthropicKey);
	} else {
		throw new Error('No API key configured. Please add your API keys in Settings.');
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

interface OllamaStreamChunk {
	message: {
		content: string;
	};
	done: boolean;
}

async function streamOllama(
	messages: Message[],
	systemPrompt: string,
	endpoint: string,
	model: string
): Promise<ReadableStream<string>> {
	// Normalize endpoint - ensure it ends with /api/chat
	let apiUrl = endpoint.trim();
	if (apiUrl.endsWith('/')) {
		apiUrl = apiUrl.slice(0, -1);
	}
	if (!apiUrl.endsWith('/api/chat')) {
		apiUrl = apiUrl + '/api/chat';
	}

	const body = {
		model,
		stream: true,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((m) => ({
				role: m.role,
				content: m.content
			}))
		]
	};

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
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

					// Process complete lines (Ollama sends newline-delimited JSON)
					const lines = buffer.split('\n');
					buffer = lines.pop() || ''; // Keep incomplete line in buffer

					for (const line of lines) {
						if (!line.trim()) continue;

						try {
							const parsed: OllamaStreamChunk = JSON.parse(line);
							if (parsed.message?.content) {
								controller.enqueue(parsed.message.content);
							}
						} catch {
							// Skip invalid JSON lines
						}
					}
				}

				// Process any remaining buffer
				if (buffer.trim()) {
					try {
						const parsed: OllamaStreamChunk = JSON.parse(buffer);
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

export async function getCurrentProvider(): Promise<string> {
	const config = await getApiKeys();

	// Return the configured provider if it's properly set up
	if (config.provider === 'ollama' && config.ollamaEndpoint) return 'ollama';
	if (config.provider === 'openai' && config.openaiKey) return 'openai';
	if (config.provider === 'anthropic' && config.anthropicKey) return 'anthropic';

	// Fall back to any available provider
	if (config.anthropicKey) return 'anthropic';
	if (config.openaiKey) return 'openai';
	if (config.ollamaEndpoint) return 'ollama';

	return 'none';
}

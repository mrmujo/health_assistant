import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/client';
import {
	trainingGoals,
	trainingPlans,
	plannedWorkouts,
	activityRpe,
	sleepData,
	stressData,
	activities
} from '$lib/server/db/schema';
import { eq, desc, gte } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const COACH_CHAT_SYSTEM_PROMPT = `You are an expert endurance coach helping an athlete with their training plan.

Your role is to:
1. Answer questions about their training plan
2. Explain workout choices and periodization
3. Suggest modifications when asked
4. Provide coaching advice

IMPORTANT: When suggesting plan changes, include an ACTION block that the system can parse:

Example responses with actions:

"I recommend making today a rest day since your sleep score is low.
[ACTION:makeRest:WORKOUT_ID]"

"Let's swap tomorrow's long run with Thursday's easy run.
[ACTION:swap:WORKOUT_ID_1:WORKOUT_ID_2]"

"Given your fatigue, reduce today's workout duration by 25%.
[ACTION:reduceDuration:WORKOUT_ID:25]"

"Let's increase the intensity - change this to a tempo run.
[ACTION:changeType:WORKOUT_ID:tempo]"

"Lower the target effort to RPE 5 for this session.
[ACTION:adjustRpe:WORKOUT_ID:5]"

Available actions:
- [ACTION:makeRest:ID] - Convert workout to rest day
- [ACTION:swap:ID1:ID2] - Swap two workouts
- [ACTION:reduceDuration:ID:PERCENT] - Reduce duration (default 25%)
- [ACTION:increaseDuration:ID:PERCENT] - Increase duration (default 10%)
- [ACTION:changeType:ID:TYPE] - Change to: easy, tempo, intervals, long, recovery
- [ACTION:adjustRpe:ID:RPE] - Set target RPE (1-10)

Use the WORKOUT_ID values provided in the context. Only include action blocks when the user asks for changes.

For major plan restructuring, suggest using "Regenerate Plan" instead.`;

interface ApiConfig {
	openaiKey?: string | null;
	anthropicKey?: string | null;
	ollamaEndpoint?: string | null;
	ollamaModel?: string | null;
	provider: string;
}

function formatDistance(meters: number | null): string {
	if (!meters) return 'N/A';
	if (meters >= 1000) {
		return `${(meters / 1000).toFixed(1)}km`;
	}
	return `${meters}m`;
}

function formatTime(seconds: number | null): string {
	if (!seconds) return 'N/A';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m}min`;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { goalId, messages, apiConfig } = await request.json();

		if (!goalId) {
			return new Response(JSON.stringify({ error: 'Goal ID required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// API config must be provided by the client (keeps keys client-side)
		if (!apiConfig) {
			return new Response(JSON.stringify({ error: 'API configuration required. Please configure your AI settings.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const config: ApiConfig = apiConfig;

		// Get goal
		const goals = await db
			.select()
			.from(trainingGoals)
			.where(eq(trainingGoals.id, goalId))
			.limit(1);

		if (goals.length === 0) {
			return new Response(JSON.stringify({ error: 'Goal not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const goal = goals[0];

		// Get active plan
		const plans = await db
			.select()
			.from(trainingPlans)
			.where(eq(trainingPlans.goalId, goalId))
			.orderBy(desc(trainingPlans.version));

		const activePlan = plans.find((p) => p.status === 'active');

		// Get workouts
		let workouts: (typeof plannedWorkouts.$inferSelect)[] = [];
		if (activePlan) {
			workouts = await db
				.select()
				.from(plannedWorkouts)
				.where(eq(plannedWorkouts.planId, activePlan.id))
				.orderBy(plannedWorkouts.date);
		}

		// Calculate weeks until event
		const eventDate = new Date(goal.eventDate);
		const today = new Date();
		const weeksUntilEvent = Math.ceil(
			(eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7)
		);

		// Get recent data for context
		const twoWeeksAgo = new Date();
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
		const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

		const [recentActivities, recentSleep, recentStress] = await Promise.all([
			db.select().from(activities).where(gte(activities.date, twoWeeksAgoStr)),
			db.select().from(sleepData).where(gte(sleepData.date, twoWeeksAgoStr)),
			db.select().from(stressData).where(gte(stressData.date, twoWeeksAgoStr))
		]);

		// Build context
		const todayStr = today.toISOString().split('T')[0];
		const todayWorkout = workouts.find((w) => w.date === todayStr);
		const upcomingWorkouts = workouts.filter((w) => w.date >= todayStr).slice(0, 7);
		const completedCount = workouts.filter((w) => w.completed).length;
		const totalCount = workouts.length;
		const adherencePercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

		// Build context message with workout IDs for actions
		const contextMessage = `
CURRENT TRAINING CONTEXT:

Goal: ${goal.name}
Event Type: ${goal.eventType}
Event Date: ${goal.eventDate} (${weeksUntilEvent} weeks away)
Distance: ${formatDistance(goal.distance)}
Target Time: ${formatTime(goal.targetTime)}
${goal.notes ? `Notes: ${goal.notes}` : ''}

Current Plan: v${activePlan?.version || 'None'}
Adherence: ${adherencePercent}% (${completedCount}/${totalCount} workouts completed)

Today's Workout:
${todayWorkout ? `- ID:${todayWorkout.id} | ${todayWorkout.date} | ${todayWorkout.workoutType}: ${formatTime(todayWorkout.duration)}, RPE ${todayWorkout.targetRpe}` : '- Rest day (no workout scheduled)'}

Upcoming Week (use these IDs for actions):
${upcomingWorkouts.map((w) => `- ID:${w.id} | ${w.date} | ${w.workoutType}: ${formatTime(w.duration)}, RPE ${w.targetRpe}`).join('\n')}

Recent Training:
${recentActivities.slice(0, 5).map((a) => `- ${a.date}: ${a.activityType} ${formatTime(a.duration)} ${formatDistance(a.distance)}`).join('\n') || 'No recent activities logged'}

Recovery Data:
- Recent sleep scores: ${recentSleep.slice(0, 5).map((s) => s.sleepScore).filter(Boolean).join(', ') || 'No data'}
- Recent body battery: ${recentStress.slice(0, 5).map((s) => s.bodyBatteryEnd).filter(Boolean).join(', ') || 'No data'}
`;

		const fullSystemPrompt = COACH_CHAT_SYSTEM_PROMPT + '\n\n' + contextMessage;

		// Stream response using client-provided API config
		if (config.provider === 'ollama' && config.ollamaEndpoint) {
			return streamOllama(messages, fullSystemPrompt, config.ollamaEndpoint, config.ollamaModel || 'llama2');
		} else if (config.provider === 'openai' && config.openaiKey) {
			return streamOpenAI(messages, fullSystemPrompt, config.openaiKey);
		} else if (config.provider === 'anthropic' && config.anthropicKey) {
			return streamAnthropic(messages, fullSystemPrompt, config.anthropicKey);
		} else {
			return new Response(JSON.stringify({ error: 'No API key configured for the selected provider. Please add your API key in Settings.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	} catch (e) {
		console.error('Coach chat error:', e);
		return new Response(
			JSON.stringify({ error: e instanceof Error ? e.message : 'Chat failed' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

async function streamAnthropic(
	messages: { role: string; content: string }[],
	systemPrompt: string,
	apiKey: string
): Promise<Response> {
	const client = new Anthropic({ apiKey });

	const stream = client.messages.stream({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 2048,
		system: systemPrompt,
		messages: messages.map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		}))
	});

	const encoder = new TextEncoder();

	return new Response(
		new ReadableStream({
			async start(controller) {
				try {
					for await (const event of stream) {
						if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
						}
					}
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (e) {
					controller.error(e);
				}
			}
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		}
	);
}

async function streamOpenAI(
	messages: { role: string; content: string }[],
	systemPrompt: string,
	apiKey: string
): Promise<Response> {
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

	const encoder = new TextEncoder();

	return new Response(
		new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of stream) {
						const text = chunk.choices[0]?.delta?.content;
						if (text) {
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
						}
					}
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (e) {
					controller.error(e);
				}
			}
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		}
	);
}

async function streamOllama(
	messages: { role: string; content: string }[],
	systemPrompt: string,
	endpoint: string,
	model: string
): Promise<Response> {
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

	const encoder = new TextEncoder();
	const decoder = new TextDecoder();

	return new Response(
		new ReadableStream({
			async start(controller) {
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
									controller.enqueue(
										encoder.encode(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`)
									);
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
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify({ text: parsed.message.content })}\n\n`)
								);
							}
						} catch {
							// Skip
						}
					}

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (e) {
					controller.error(e);
				}
			}
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		}
	);
}

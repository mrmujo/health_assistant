import { json } from '@sveltejs/kit';
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

const COACH_SYSTEM_PROMPT = `You are a professional endurance coach. Generate COMPLETE training plans covering ALL weeks until the event.

CRITICAL: Generate ALL weeks. 24 weeks away = 24 weeks. Never truncate.

Periodization: base(40%), build(40%), peak(15%), taper(5% or 1-2 weeks).

Output ONLY this compact JSON (no markdown, no extra text):
{"s":"summary","w":[{"n":1,"p":"base","d":[{"d":0,"t":"rest","m":0,"r":1},{"d":1,"t":"easy","m":30,"r":3}]}]}

Key: s=summary, w=weeks, n=weekNumber, p=phase(base/build/peak/taper), d=days array
Day: d=dayOfWeek(0-6), t=type(easy/tempo/intervals/long/recovery/rest), m=minutes, r=rpe(1-10)

Include ALL 7 days per week. Use t:"rest" with m:0 for rest days.`;

interface ApiConfig {
	openaiKey?: string | null;
	anthropicKey?: string | null;
	ollamaEndpoint?: string | null;
	ollamaModel?: string | null;
	provider: string;
}

function callAI(systemPrompt: string, userPrompt: string, config: ApiConfig): Promise<string> {
	if (config.provider === 'ollama' && config.ollamaEndpoint) {
		return callOllama(systemPrompt, userPrompt, config.ollamaEndpoint, config.ollamaModel || 'llama2');
	} else if (config.provider === 'openai' && config.openaiKey) {
		return callOpenAI(systemPrompt, userPrompt, config.openaiKey);
	} else if (config.provider === 'anthropic' && config.anthropicKey) {
		return callAnthropic(systemPrompt, userPrompt, config.anthropicKey);
	} else {
		throw new Error('No API key configured for the selected provider. Please add your API key in Settings.');
	}
}

async function callAnthropic(
	systemPrompt: string,
	userPrompt: string,
	apiKey: string
): Promise<string> {
	const client = new Anthropic({ apiKey });

	const response = await client.messages.create({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 16384,
		system: systemPrompt,
		messages: [{ role: 'user', content: userPrompt }]
	});

	const textBlock = response.content.find((c) => c.type === 'text');
	return textBlock?.type === 'text' ? textBlock.text : '';
}

async function callOpenAI(
	systemPrompt: string,
	userPrompt: string,
	apiKey: string
): Promise<string> {
	const client = new OpenAI({ apiKey });

	const response = await client.chat.completions.create({
		model: 'gpt-4-turbo-preview',
		max_tokens: 4096,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		]
	});

	return response.choices[0]?.message?.content || '';
}

async function callOllama(
	systemPrompt: string,
	userPrompt: string,
	endpoint: string,
	model: string
): Promise<string> {
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
			stream: false,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			]
		})
	});

	if (!response.ok) {
		throw new Error(`Ollama request failed: ${response.status}`);
	}

	const data = await response.json();
	return data.message?.content || '';
}

function formatTime(seconds: number | null): string {
	if (!seconds) return 'no target time';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) {
		return `${h}h ${m}m`;
	}
	return `${m} minutes`;
}

function formatDistance(meters: number | null): string {
	if (!meters) return 'unspecified distance';
	if (meters >= 1000) {
		return `${(meters / 1000).toFixed(1)}km`;
	}
	return `${meters}m`;
}

interface CompactDay {
	d: number; // dayOfWeek
	t: string; // type
	m: number; // minutes
	r: number; // rpe
}

interface CompactWeek {
	n: number; // weekNumber
	p: string; // phase
	d: CompactDay[]; // days
}

interface CompactPlan {
	s: string; // summary
	w: CompactWeek[]; // weeks
}

interface ExpandedWorkout {
	dayOfWeek: number;
	workoutType: string;
	durationMinutes: number;
	targetRpe: number;
}

interface ExpandedWeek {
	weekNumber: number;
	phase: string;
	workouts: ExpandedWorkout[];
}

interface ExpandedPlan {
	summary: string;
	weeks: ExpandedWeek[];
}

function expandCompactPlan(compact: CompactPlan): ExpandedPlan {
	return {
		summary: compact.s,
		weeks: compact.w.map((week) => ({
			weekNumber: week.n,
			phase: week.p,
			workouts: week.d.map((day) => ({
				dayOfWeek: day.d,
				workoutType: day.t,
				durationMinutes: day.m,
				targetRpe: day.r
			}))
		}))
	};
}

function isCompactFormat(data: unknown): data is CompactPlan {
	const plan = data as CompactPlan;
	return plan && Array.isArray(plan.w) && plan.w.length > 0 && plan.w[0].d !== undefined;
}

function isExpandedFormat(data: unknown): data is ExpandedPlan {
	const plan = data as ExpandedPlan;
	return plan && Array.isArray(plan.weeks) && plan.weeks.length > 0;
}

function extractJSON(text: string): { json: unknown; error?: string } {
	// First, try to extract from markdown code blocks
	let jsonStr = text.trim();

	// Remove markdown code blocks
	const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (codeBlockMatch) {
		jsonStr = codeBlockMatch[1].trim();
	}

	// If still not valid, try to find JSON object boundaries
	if (!jsonStr.startsWith('{')) {
		const startIdx = jsonStr.indexOf('{');
		if (startIdx === -1) {
			return { json: null, error: 'No JSON object found in response' };
		}
		jsonStr = jsonStr.slice(startIdx);
	}

	// Find the matching closing brace
	let braceCount = 0;
	let endIdx = -1;
	for (let i = 0; i < jsonStr.length; i++) {
		if (jsonStr[i] === '{') braceCount++;
		if (jsonStr[i] === '}') braceCount--;
		if (braceCount === 0) {
			endIdx = i + 1;
			break;
		}
	}

	if (endIdx === -1) {
		return { json: null, error: 'JSON appears to be truncated (no closing brace found)' };
	}

	jsonStr = jsonStr.slice(0, endIdx);

	try {
		return { json: JSON.parse(jsonStr) };
	} catch (e) {
		return { json: null, error: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}` };
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { goalId, apiConfig } = body;

		if (!goalId) {
			return json({ success: false, error: 'Goal ID required' }, { status: 400 });
		}

		// API config must be provided by the client (keeps keys client-side)
		if (!apiConfig) {
			return json({ success: false, error: 'API configuration required. Please configure your AI settings.' }, { status: 400 });
		}

		const config: ApiConfig = apiConfig;

		// Get the goal
		const goals = await db
			.select()
			.from(trainingGoals)
			.where(eq(trainingGoals.id, goalId))
			.limit(1);

		if (goals.length === 0) {
			return json({ success: false, error: 'Goal not found' }, { status: 404 });
		}

		const goal = goals[0];

		// Calculate weeks until event
		const eventDate = new Date(goal.eventDate);
		const today = new Date();
		const weeksUntilEvent = Math.ceil(
			(eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 7)
		);

		if (weeksUntilEvent <= 0) {
			return json({ success: false, error: 'Event date has already passed' }, { status: 400 });
		}

		// Get recent activity data for context
		const twoWeeksAgo = new Date();
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
		const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

		const [recentActivities, recentRpe, recentSleep, recentStress] = await Promise.all([
			db.select().from(activities).where(gte(activities.date, twoWeeksAgoStr)),
			db.select().from(activityRpe).where(gte(activityRpe.date, twoWeeksAgoStr)),
			db.select().from(sleepData).where(gte(sleepData.date, twoWeeksAgoStr)),
			db.select().from(stressData).where(gte(stressData.date, twoWeeksAgoStr))
		]);

		// Build context for AI
		let activityContext = 'No recent activity data available.';
		if (recentActivities.length > 0 || recentRpe.length > 0) {
			const activitySummary = recentActivities.map((a) => ({
				date: a.date,
				type: a.activityType,
				duration: a.duration ? Math.round(a.duration / 60) + ' min' : 'unknown',
				distance: a.distance ? (a.distance / 1000).toFixed(1) + 'km' : 'unknown'
			}));
			const rpeSummary = recentRpe.map((r) => ({
				date: r.date,
				type: r.activityType,
				rpe: r.rpe,
				fatigue: r.fatigue
			}));
			activityContext = `Recent activities (last 14 days):\n${JSON.stringify(activitySummary, null, 2)}\n\nRecent RPE data:\n${JSON.stringify(rpeSummary, null, 2)}`;
		}

		let recoveryContext = 'No recent recovery data available.';
		if (recentSleep.length > 0 || recentStress.length > 0) {
			const sleepSummary = recentSleep.map((s) => ({
				date: s.date,
				score: s.sleepScore,
				duration: s.durationSeconds ? Math.round(s.durationSeconds / 3600) + 'h' : 'unknown'
			}));
			const stressSummary = recentStress.map((s) => ({
				date: s.date,
				avgStress: s.avgStress,
				bodyBatteryEnd: s.bodyBatteryEnd
			}));
			recoveryContext = `Recent sleep data:\n${JSON.stringify(sleepSummary, null, 2)}\n\nRecent stress/body battery:\n${JSON.stringify(stressSummary, null, 2)}`;
		}

		// Build the user prompt
		const userPrompt = `Create a COMPLETE training plan for the following goal:

Event: ${goal.name}
Event Type: ${goal.eventType}
Event Date: ${goal.eventDate}
Weeks until event: ${weeksUntilEvent} weeks
Distance: ${formatDistance(goal.distance)}
Target Time: ${formatTime(goal.targetTime)}
${goal.notes ? `Notes: ${goal.notes}` : ''}

Athlete Context:
${activityContext}

Recovery Context:
${recoveryContext}

REQUIREMENTS:
1. Generate EXACTLY ${weeksUntilEvent} weeks of training (Week 1 through Week ${weeksUntilEvent})
2. Start date: ${today.toISOString().split('T')[0]}
3. Event date: ${goal.eventDate}
4. Include 7 days of workouts for each week (including rest days)
5. Use proper periodization across all ${weeksUntilEvent} weeks

This is a ${weeksUntilEvent}-week plan. You MUST include all ${weeksUntilEvent} weeks in the response. Do not truncate.

Return ONLY the JSON object, no other text.`;

		// Call AI to generate plan using client-provided API config
		const aiResponse = await callAI(COACH_SYSTEM_PROMPT, userPrompt, config);

		// Extract and parse JSON from response
		const { json: planData, error: parseError } = extractJSON(aiResponse);
		if (!planData || parseError) {
			console.error('Failed to parse AI response:', aiResponse);
			return json(
				{ success: false, error: parseError || 'Failed to parse training plan from AI' },
				{ status: 500 }
			);
		}

		// Handle both compact and expanded formats
		let expandedPlan: ExpandedPlan;
		if (isCompactFormat(planData)) {
			expandedPlan = expandCompactPlan(planData);
		} else if (isExpandedFormat(planData)) {
			expandedPlan = planData;
		} else {
			console.error('Invalid plan structure:', planData);
			return json(
				{ success: false, error: 'AI returned an invalid plan format. Please try again.' },
				{ status: 500 }
			);
		}

		if (expandedPlan.weeks.length === 0) {
			console.error('Plan has no weeks:', planData);
			return json(
				{ success: false, error: 'AI returned a plan without any weeks. Please try again.' },
				{ status: 500 }
			);
		}

		// Get existing plan count for versioning
		const existingPlans = await db
			.select()
			.from(trainingPlans)
			.where(eq(trainingPlans.goalId, goalId));

		const newVersion = existingPlans.length + 1;

		// Mark any existing active plans as superseded
		for (const existingPlan of existingPlans) {
			if (existingPlan.status === 'active') {
				await db
					.update(trainingPlans)
					.set({ status: 'superseded' })
					.where(eq(trainingPlans.id, existingPlan.id));
			}
		}

		// Create the new plan
		const [newPlan] = await db
			.insert(trainingPlans)
			.values({
				goalId,
				version: newVersion,
				planData: JSON.stringify(expandedPlan),
				status: 'active'
			})
			.returning();

		// Create individual workouts
		const workoutsToInsert = [];
		const startDate = new Date(today);
		startDate.setHours(0, 0, 0, 0);

		for (const week of expandedPlan.weeks) {
			for (const workout of week.workouts) {
				// Calculate the actual date based on week number and day of week
				const workoutDate = new Date(startDate);
				workoutDate.setDate(
					startDate.getDate() + (week.weekNumber - 1) * 7 + workout.dayOfWeek
				);
				const dateStr = workoutDate.toISOString().split('T')[0];

				workoutsToInsert.push({
					planId: newPlan.id,
					date: dateStr,
					workoutType: workout.workoutType || null,
					activityType: workout.activityType || goal.eventType,
					description: workout.description || null,
					duration: workout.durationMinutes ? workout.durationMinutes * 60 : null,
					distance: workout.distanceKm ? workout.distanceKm * 1000 : null,
					targetRpe: workout.targetRpe || null,
					notes: workout.notes || null
				});
			}
		}

		// Insert all workouts
		if (workoutsToInsert.length > 0) {
			await db.insert(plannedWorkouts).values(workoutsToInsert);
		}

		return json({
			success: true,
			data: {
				plan: newPlan,
				workoutCount: workoutsToInsert.length
			}
		});
	} catch (e) {
		console.error('Generate plan error:', e);
		return json(
			{ success: false, error: e instanceof Error ? e.message : 'Failed to generate plan' },
			{ status: 500 }
		);
	}
};

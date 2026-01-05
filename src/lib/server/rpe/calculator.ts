import { db } from '../db/client';
import { rpeMultipliers, rpeScales, activityRpe } from '../db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import type { RpeMultiplier } from '../db/schema';

/**
 * Get the fatigue multiplier for an activity type and duration.
 * - For strength/yoga: returns constant 1.2
 * - For running/cycling/swimming: interpolates between reference points
 */
export async function getMultiplier(activityType: string, durationSeconds: number): Promise<number> {
	const normalizedType = normalizeActivityType(activityType);
	const config = await db.select().from(rpeMultipliers)
		.where(eq(rpeMultipliers.activityType, normalizedType));

	if (config.length === 0) {
		// Unknown activity type, use default multiplier
		return 1.0;
	}

	// Check if constant multiplier (strength, yoga)
	const constantRow = config.find((r) => r.useDurationScaling === 0);
	if (constantRow && constantRow.constantMultiplier !== null) {
		return constantRow.constantMultiplier;
	}

	// Duration-based scaling (running, cycling, swimming)
	const hours = durationSeconds / 3600;
	const referencePoints = config
		.filter((r) => r.durationHours !== null && r.multiplier !== null)
		.sort((a, b) => a.durationHours! - b.durationHours!);

	return interpolateMultiplier(hours, referencePoints);
}

/**
 * Interpolate multiplier between reference points.
 * Uses linear interpolation, falls back to formula for edge cases.
 */
function interpolateMultiplier(hours: number, points: RpeMultiplier[]): number {
	if (points.length === 0) {
		return calculateFallbackMultiplier(hours);
	}

	// Below minimum reference point
	if (hours <= points[0].durationHours!) {
		return points[0].multiplier!;
	}

	// Above maximum reference point - use formula
	if (hours >= points[points.length - 1].durationHours!) {
		return calculateFallbackMultiplier(hours);
	}

	// Find surrounding points and interpolate
	for (let i = 0; i < points.length - 1; i++) {
		const lower = points[i];
		const upper = points[i + 1];

		if (hours >= lower.durationHours! && hours <= upper.durationHours!) {
			// Linear interpolation
			const ratio = (hours - lower.durationHours!) / (upper.durationHours! - lower.durationHours!);
			return lower.multiplier! + ratio * (upper.multiplier! - lower.multiplier!);
		}
	}

	return calculateFallbackMultiplier(hours);
}

/**
 * Fallback formula for multiplier calculation.
 * if t < 2: multiplier = 1 + 0.15 × (t / 2)
 * else: multiplier = 1 + (t / 2) ^ 0.8
 */
function calculateFallbackMultiplier(hours: number): number {
	if (hours < 2) {
		return 1 + 0.15 * (hours / 2);
	}
	return 1 + Math.pow(hours / 2, 0.8);
}

/**
 * Calculate fatigue score for a session.
 * fatigue = RPE × multiplier
 */
export async function calculateFatigue(
	activityType: string,
	rpe: number,
	durationSeconds: number
): Promise<number> {
	const multiplier = await getMultiplier(activityType, durationSeconds);
	return Math.round(rpe * multiplier * 100) / 100;
}

/**
 * Calculate period fatigue (average across sessions with smoothing).
 * period_fatigue = (Σ session_fatigue) / n × 0.8
 */
export function calculatePeriodFatigue(sessions: { fatigue: number }[]): number {
	if (sessions.length === 0) return 0;

	const totalFatigue = sessions.reduce((sum, s) => sum + s.fatigue, 0);
	const avgFatigue = totalFatigue / sessions.length;
	return Math.round(avgFatigue * 0.8 * 100) / 100;
}

/**
 * Get RPE scale descriptions for an activity type.
 */
export async function getRpeScale(activityType: string) {
	const normalizedType = normalizeActivityType(activityType);
	return db.select().from(rpeScales)
		.where(eq(rpeScales.activityType, normalizedType))
		.orderBy(rpeScales.rpeValue);
}

/**
 * Get RPE description for a specific value and activity type.
 */
export async function getRpeDescription(activityType: string, rpeValue: number) {
	const normalizedType = normalizeActivityType(activityType);
	const result = await db.select().from(rpeScales)
		.where(and(
			eq(rpeScales.activityType, normalizedType),
			eq(rpeScales.rpeValue, rpeValue)
		))
		.limit(1);

	return result[0] || null;
}

/**
 * Get daily fatigue summary for a date range.
 */
export async function getDailyFatigueSummary(days: number = 7) {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	const startDateStr = startDate.toISOString().split('T')[0];

	const entries = await db.select().from(activityRpe)
		.where(gte(activityRpe.date, startDateStr))
		.orderBy(desc(activityRpe.date));

	// Group by date
	const byDate = new Map<string, { fatigue: number; count: number; totalRpe: number }>();

	for (const entry of entries) {
		const existing = byDate.get(entry.date) || { fatigue: 0, count: 0, totalRpe: 0 };
		existing.fatigue += entry.fatigue || 0;
		existing.count += 1;
		existing.totalRpe += entry.rpe;
		byDate.set(entry.date, existing);
	}

	return Array.from(byDate.entries()).map(([date, data]) => ({
		date,
		totalFatigue: Math.round(data.fatigue * 100) / 100,
		avgRpe: Math.round((data.totalRpe / data.count) * 10) / 10,
		activityCount: data.count
	}));
}

/**
 * Normalize activity type to match our stored types.
 */
export function normalizeActivityType(type: string): string {
	const normalized = type.toLowerCase().trim();

	// Map common variations
	const mappings: Record<string, string> = {
		run: 'running',
		running: 'running',
		trail_running: 'running',
		treadmill_running: 'running',
		cycle: 'cycling',
		cycling: 'cycling',
		biking: 'cycling',
		indoor_cycling: 'cycling',
		swim: 'swimming',
		swimming: 'swimming',
		lap_swimming: 'swimming',
		open_water_swimming: 'swimming',
		strength: 'strength',
		strength_training: 'strength',
		weight_training: 'strength',
		gym: 'strength',
		yoga: 'yoga',
		pilates: 'yoga'
	};

	return mappings[normalized] || 'running'; // Default to running if unknown
}

/**
 * Get all supported activity types.
 */
export function getSupportedActivityTypes(): string[] {
	return ['running', 'cycling', 'swimming', 'strength', 'yoga'];
}

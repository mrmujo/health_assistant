import { db } from '../db/client';
import { rpeScales, rpeMultipliers } from '../db/schema';

// RPE Scale data for each activity type
const rpeScaleData = [
	// Running
	{ activityType: 'running', rpeValue: 0, name: 'Rest', description: 'Rest' },
	{ activityType: 'running', rpeValue: 1, name: 'Very Easy', description: 'Very easy shuffle, no load' },
	{ activityType: 'running', rpeValue: 2, name: 'Easy', description: 'Easy, fully conversational, no fatigue accumulating' },
	{ activityType: 'running', rpeValue: 3, name: 'Comfortable', description: 'Comfortable, could hold for a very long time' },
	{ activityType: 'running', rpeValue: 4, name: 'Steady', description: 'Steady but relaxed, aware of effort' },
	{ activityType: 'running', rpeValue: 5, name: 'Working', description: 'Working, needs fueling/pacing awareness, sustainable' },
	{ activityType: 'running', rpeValue: 6, name: 'Moderate', description: 'Fatigue gradually accumulating, requires focus' },
	{ activityType: 'running', rpeValue: 7, name: 'Hard', description: 'Hard, soreness/fatigue real, mentally engaging' },
	{ activityType: 'running', rpeValue: 8, name: 'Very Hard', description: 'Very hard, grinding, slowdown inevitable' },
	{ activityType: 'running', rpeValue: 9, name: 'Maximum', description: 'Max sustainable, holding things together' },
	{ activityType: 'running', rpeValue: 10, name: 'All-Out', description: 'All-out / survival effort' },

	// Cycling
	{ activityType: 'cycling', rpeValue: 0, name: 'Rest', description: 'Rest / coasting' },
	{ activityType: 'cycling', rpeValue: 1, name: 'Very Easy', description: 'Gentle spinning' },
	{ activityType: 'cycling', rpeValue: 2, name: 'Easy', description: 'Easy, legs feel fresh' },
	{ activityType: 'cycling', rpeValue: 3, name: 'Comfortable', description: 'Comfortable, could ride a long time' },
	{ activityType: 'cycling', rpeValue: 4, name: 'Steady', description: 'Steady endurance effort' },
	{ activityType: 'cycling', rpeValue: 5, name: 'Working', description: 'Sustained work, fatigue creeping in' },
	{ activityType: 'cycling', rpeValue: 6, name: 'Moderate', description: 'Noticeable muscular fatigue building' },
	{ activityType: 'cycling', rpeValue: 7, name: 'Hard', description: 'Hard endurance, requires concentration' },
	{ activityType: 'cycling', rpeValue: 8, name: 'Very Hard', description: 'Deep fatigue, mentally demanding' },
	{ activityType: 'cycling', rpeValue: 9, name: 'Maximum', description: 'Near limit, barely holding power' },
	{ activityType: 'cycling', rpeValue: 10, name: 'All-Out', description: 'Total depletion' },

	// Swimming
	{ activityType: 'swimming', rpeValue: 0, name: 'Rest', description: 'Rest' },
	{ activityType: 'swimming', rpeValue: 1, name: 'Very Easy', description: 'Floating / very easy movement' },
	{ activityType: 'swimming', rpeValue: 2, name: 'Easy', description: 'Relaxed rhythm' },
	{ activityType: 'swimming', rpeValue: 3, name: 'Comfortable', description: 'Comfortable, sustainable rhythm' },
	{ activityType: 'swimming', rpeValue: 4, name: 'Steady', description: 'Steady endurance swimming' },
	{ activityType: 'swimming', rpeValue: 5, name: 'Working', description: 'Working, controlled breathing focus' },
	{ activityType: 'swimming', rpeValue: 6, name: 'Moderate', description: 'Fatigue accumulating, technique effortful' },
	{ activityType: 'swimming', rpeValue: 7, name: 'Hard', description: 'Hard endurance, requires mental engagement' },
	{ activityType: 'swimming', rpeValue: 8, name: 'Very Hard', description: 'Very hard, whole-body fatigue' },
	{ activityType: 'swimming', rpeValue: 9, name: 'Maximum', description: 'Near failure' },
	{ activityType: 'swimming', rpeValue: 10, name: 'All-Out', description: 'Complete exhaustion' },

	// Strength Training
	{ activityType: 'strength', rpeValue: 0, name: 'Rest', description: 'Rest' },
	{ activityType: 'strength', rpeValue: 1, name: 'Warm-up', description: 'Warm-up / trivial' },
	{ activityType: 'strength', rpeValue: 2, name: 'Warm-up', description: 'Warm-up / trivial' },
	{ activityType: 'strength', rpeValue: 3, name: 'Warm-up', description: 'Warm-up / trivial' },
	{ activityType: 'strength', rpeValue: 4, name: 'Moderate', description: 'Moderate load, controlled' },
	{ activityType: 'strength', rpeValue: 5, name: 'Moderate', description: 'Moderate load, controlled' },
	{ activityType: 'strength', rpeValue: 6, name: 'Hard', description: 'Hard, close to failure' },
	{ activityType: 'strength', rpeValue: 7, name: 'Hard', description: 'Hard, close to failure' },
	{ activityType: 'strength', rpeValue: 8, name: 'Very Hard', description: 'Very hard, grinding' },
	{ activityType: 'strength', rpeValue: 9, name: 'Very Hard', description: 'Very hard, grinding' },
	{ activityType: 'strength', rpeValue: 10, name: 'Failure', description: 'Failure' },

	// Yoga
	{ activityType: 'yoga', rpeValue: 0, name: 'Restorative', description: 'Restorative' },
	{ activityType: 'yoga', rpeValue: 1, name: 'Gentle', description: 'Gentle stretch' },
	{ activityType: 'yoga', rpeValue: 2, name: 'Gentle', description: 'Gentle stretch' },
	{ activityType: 'yoga', rpeValue: 3, name: 'Active', description: 'Active but easy' },
	{ activityType: 'yoga', rpeValue: 4, name: 'Active', description: 'Active but easy' },
	{ activityType: 'yoga', rpeValue: 5, name: 'Challenging', description: 'Challenging, muscular activation' },
	{ activityType: 'yoga', rpeValue: 6, name: 'Challenging', description: 'Challenging, muscular activation' },
	{ activityType: 'yoga', rpeValue: 7, name: 'Intense', description: 'Intense, strength + focus' },
	{ activityType: 'yoga', rpeValue: 8, name: 'Intense', description: 'Intense, strength + focus' },
	{ activityType: 'yoga', rpeValue: 9, name: 'Maximum', description: 'Maximum physical + mental effort' },
	{ activityType: 'yoga', rpeValue: 10, name: 'Maximum', description: 'Maximum physical + mental effort' }
];

// Duration-based multipliers for endurance activities
const durationMultipliers = [
	{ durationHours: 0.5, multiplier: 1.04, interpretation: 'Normal training load' },
	{ durationHours: 1, multiplier: 1.08, interpretation: 'Normal load' },
	{ durationHours: 1.5, multiplier: 1.11, interpretation: 'Slight accumulation' },
	{ durationHours: 2, multiplier: 1.15, interpretation: 'Beginning of meaningful strain' },
	{ durationHours: 3, multiplier: 1.7, interpretation: 'Noticeable long-run fatigue' },
	{ durationHours: 4, multiplier: 2.4, interpretation: 'Classic long-run load' },
	{ durationHours: 6, multiplier: 2.9, interpretation: 'Heavy endurance load' },
	{ durationHours: 8, multiplier: 3.3, interpretation: 'Ultra-style fatigue' },
	{ durationHours: 12, multiplier: 4.0, interpretation: 'Major recovery demand' },
	{ durationHours: 24, multiplier: 7.8, interpretation: 'Full-body depletion' }
];

// Multiplier configurations per activity type
const multiplierConfigs = [
	// Running - duration-based scaling
	...durationMultipliers.map((m) => ({
		activityType: 'running',
		useDurationScaling: 1,
		constantMultiplier: null,
		durationHours: m.durationHours,
		multiplier: m.multiplier,
		interpretation: m.interpretation
	})),
	// Cycling - duration-based scaling
	...durationMultipliers.map((m) => ({
		activityType: 'cycling',
		useDurationScaling: 1,
		constantMultiplier: null,
		durationHours: m.durationHours,
		multiplier: m.multiplier,
		interpretation: m.interpretation
	})),
	// Swimming - duration-based scaling
	...durationMultipliers.map((m) => ({
		activityType: 'swimming',
		useDurationScaling: 1,
		constantMultiplier: null,
		durationHours: m.durationHours,
		multiplier: m.multiplier,
		interpretation: m.interpretation
	})),
	// Strength - constant multiplier
	{
		activityType: 'strength',
		useDurationScaling: 0,
		constantMultiplier: 1.2,
		durationHours: null,
		multiplier: null,
		interpretation: 'Constant load factor'
	},
	// Yoga - constant multiplier
	{
		activityType: 'yoga',
		useDurationScaling: 0,
		constantMultiplier: 1.2,
		durationHours: null,
		multiplier: null,
		interpretation: 'Constant load factor'
	}
];

export async function seedRpeData() {
	// Check if data already exists
	const existingScales = await db.select().from(rpeScales).limit(1);
	if (existingScales.length > 0) {
		console.log('RPE data already seeded, skipping...');
		return;
	}

	console.log('Seeding RPE scales...');
	await db.insert(rpeScales).values(rpeScaleData);

	console.log('Seeding RPE multipliers...');
	await db.insert(rpeMultipliers).values(multiplierConfigs);

	console.log('RPE data seeded successfully!');
}

// Export data for use elsewhere
export { rpeScaleData, multiplierConfigs, durationMultipliers };

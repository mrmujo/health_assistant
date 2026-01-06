import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Settings table (single user, stores preferences)
export const settings = sqliteTable('settings', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	key: text('key').notNull().unique(),
	value: text('value'),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Sleep data from Garmin (de-personalized - no user identifiers)
export const sleepData = sqliteTable('sleep_data', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull().unique(), // YYYY-MM-DD
	startTime: integer('start_time', { mode: 'timestamp' }),
	endTime: integer('end_time', { mode: 'timestamp' }),
	durationSeconds: integer('duration_seconds'),
	deepSleepSeconds: integer('deep_sleep_seconds'),
	lightSleepSeconds: integer('light_sleep_seconds'),
	remSleepSeconds: integer('rem_sleep_seconds'),
	awakeSeconds: integer('awake_seconds'),
	sleepScore: integer('sleep_score'),
	avgSpO2: real('avg_spo2'),
	avgRespirationRate: real('avg_respiration_rate'),
	avgHrSleep: integer('avg_hr_sleep'),
	rawData: text('raw_data'), // JSON blob for additional data
	note: text('note'), // User notes about sleep
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Daily activity summary (de-personalized)
export const activitySummary = sqliteTable('activity_summary', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull().unique(), // YYYY-MM-DD
	steps: integer('steps'),
	distance: real('distance'), // meters
	activeCalories: integer('active_calories'),
	totalCalories: integer('total_calories'),
	floorsClimbed: integer('floors_climbed'),
	intensityMinutes: integer('intensity_minutes'),
	avgHeartRate: integer('avg_heart_rate'),
	maxHeartRate: integer('max_heart_rate'),
	restingHeartRate: integer('resting_heart_rate'),
	rawData: text('raw_data'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Stress and Body Battery (de-personalized)
export const stressData = sqliteTable('stress_data', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull().unique(),
	avgStress: integer('avg_stress'),
	maxStress: integer('max_stress'),
	lowStressMinutes: integer('low_stress_minutes'),
	mediumStressMinutes: integer('medium_stress_minutes'),
	highStressMinutes: integer('high_stress_minutes'),
	restStressMinutes: integer('rest_stress_minutes'),
	bodyBatteryStart: integer('body_battery_start'),
	bodyBatteryEnd: integer('body_battery_end'),
	bodyBatteryMax: integer('body_battery_max'),
	bodyBatteryMin: integer('body_battery_min'),
	bodyBatteryDrained: integer('body_battery_drained'),
	bodyBatteryCharged: integer('body_battery_charged'),
	rawData: text('raw_data'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Food log
export const foodLogs = sqliteTable('food_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull(),
	time: text('time'), // HH:MM
	mealType: text('meal_type'), // breakfast, lunch, dinner, snack
	description: text('description').notNull(),
	calories: integer('calories'),
	protein: real('protein'),
	carbs: real('carbs'),
	fat: real('fat'),
	fiber: real('fiber'),
	notes: text('notes'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Medication log
export const medicationLogs = sqliteTable('medication_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull(),
	time: text('time'),
	medicationName: text('medication_name').notNull(),
	dosage: text('dosage'),
	unit: text('unit'), // mg, ml, tablets, etc.
	notes: text('notes'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// General health notes
export const healthNotes = sqliteTable('health_notes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull(),
	category: text('category'), // mood, symptoms, exercise, other
	content: text('content').notNull(),
	tags: text('tags'), // JSON array of tags
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Chat messages
export const chatMessages = sqliteTable('chat_messages', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	conversationId: integer('conversation_id'),
	role: text('role').notNull(), // user, assistant, system
	content: text('content').notNull(),
	provider: text('provider'), // openai, anthropic
	model: text('model'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Chat conversations (for organizing)
export const chatConversations = sqliteTable('chat_conversations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title'),
	summary: text('summary'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// RPE Scales - descriptions for each RPE level per activity type
export const rpeScales = sqliteTable('rpe_scales', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	activityType: text('activity_type').notNull(), // running, cycling, swimming, strength, yoga
	rpeValue: integer('rpe_value').notNull(), // 0-10
	name: text('name').notNull(), // e.g., "Easy", "Hard"
	description: text('description').notNull() // Full description
});

// RPE Multipliers - fatigue multipliers per activity type
export const rpeMultipliers = sqliteTable('rpe_multipliers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	activityType: text('activity_type').notNull(), // running, cycling, swimming, strength, yoga
	useDurationScaling: integer('use_duration_scaling').notNull(), // 1 = use duration formula, 0 = constant
	constantMultiplier: real('constant_multiplier'), // For strength/yoga: 1.2
	durationHours: real('duration_hours'), // For running/cycling/swimming: reference duration
	multiplier: real('multiplier'), // Multiplier value at this duration
	interpretation: text('interpretation') // e.g., "Normal load", "Heavy endurance"
});

// Activity RPE - user-entered RPE for activities
export const activityRpe = sqliteTable('activity_rpe', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull(), // YYYY-MM-DD
	activityId: text('activity_id'), // Garmin activity ID (optional)
	activityType: text('activity_type').notNull(), // running, cycling, etc.
	activityName: text('activity_name'),
	duration: integer('duration'), // seconds
	distance: real('distance'), // meters (for running, cycling, swimming)
	rpe: integer('rpe').notNull(), // 0-10
	note: text('note'), // User notes
	fatigue: real('fatigue'), // Calculated: RPE × multiplier
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Cached activities from Garmin API
export const activities = sqliteTable('activities', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	date: text('date').notNull(), // YYYY-MM-DD
	activityId: text('activity_id').notNull().unique(),
	activityType: text('activity_type'),
	activityName: text('activity_name'),
	duration: integer('duration'), // seconds
	distance: real('distance'), // meters
	calories: integer('calories'),
	averageHR: integer('average_hr'),
	maxHR: integer('max_hr'),
	averageSpeed: real('average_speed'),
	rawData: text('raw_data'), // JSON blob for additional data
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Training goals/events for coach feature
export const trainingGoals = sqliteTable('training_goals', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(), // "Spring Marathon"
	eventDate: text('event_date').notNull(), // YYYY-MM-DD
	eventType: text('event_type').notNull(), // running, cycling, swimming, triathlon
	distance: real('distance'), // meters (nullable for time-based events)
	targetTime: integer('target_time'), // seconds (nullable for completion goals)
	notes: text('notes'),
	status: text('status').default('active'), // active, completed, cancelled
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// AI-generated training plans (versioned - multiple per goal)
export const trainingPlans = sqliteTable('training_plans', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	goalId: integer('goal_id').notNull(),
	version: integer('version').notNull().default(1), // v1, v2, v3...
	generatedAt: integer('generated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	planData: text('plan_data'), // JSON: full plan from AI
	regenerateReason: text('regenerate_reason'), // Why this version was created
	status: text('status').default('active') // active, superseded
});

// Individual workouts in a plan
export const plannedWorkouts = sqliteTable('planned_workouts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	planId: integer('plan_id').notNull(),
	date: text('date').notNull(), // YYYY-MM-DD
	workoutType: text('workout_type'), // easy, tempo, intervals, long, rest, recovery, brick
	activityType: text('activity_type'), // running, cycling, swimming
	description: text('description'), // "Easy 5km recovery run"
	duration: integer('duration'), // planned seconds
	distance: real('distance'), // planned meters
	targetRpe: integer('target_rpe'), // 1-10
	notes: text('notes'), // AI coaching notes
	completed: integer('completed').default(0),
	skipped: integer('skipped').default(0), // Track skipped workouts
	completedActivityId: text('completed_activity_id') // link to actual activity
});

// Encrypted data storage (for E2E encryption)
export const encryptedData = sqliteTable('encrypted_data', {
	id: text('id').primaryKey(), // UUID
	userId: text('user_id').notNull(), // Supabase user ID
	type: text('type').notNull(), // Data type: sleep, activity, etc.
	date: text('date').notNull(), // YYYY-MM-DD (for date-range queries)
	ciphertext: text('ciphertext').notNull(), // Encrypted JSON data
	iv: text('iv').notNull(), // Initialization vector
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// User salt storage (for key derivation on new devices)
export const userSalts = sqliteTable('user_salts', {
	userId: text('user_id').primaryKey(), // Supabase user ID
	salt: text('salt').notNull(), // Base64-encoded salt
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// Types for use in the application
export type Settings = typeof settings.$inferSelect;
export type SleepData = typeof sleepData.$inferSelect;
export type ActivitySummary = typeof activitySummary.$inferSelect;
export type StressData = typeof stressData.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type MedicationLog = typeof medicationLogs.$inferSelect;
export type HealthNote = typeof healthNotes.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type RpeScale = typeof rpeScales.$inferSelect;
export type RpeMultiplier = typeof rpeMultipliers.$inferSelect;
export type ActivityRpe = typeof activityRpe.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type TrainingGoal = typeof trainingGoals.$inferSelect;
export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type PlannedWorkout = typeof plannedWorkouts.$inferSelect;
export type EncryptedData = typeof encryptedData.$inferSelect;
export type UserSalt = typeof userSalts.$inferSelect;

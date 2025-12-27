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

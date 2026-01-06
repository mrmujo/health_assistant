import { spawn } from 'child_process';
import { join } from 'path';
import { env } from '$env/dynamic/private';

interface GarminResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

interface AuthResult {
	success: boolean;
	message?: string;
	error?: string;
}

interface AuthStatus {
	authenticated: boolean;
}

interface SleepData {
	calendarDate: string;
	sleepTimeSeconds: number;
	deepSleepSeconds: number;
	lightSleepSeconds: number;
	remSleepSeconds: number;
	awakeSleepSeconds: number;
	sleepScores: {
		totalScore: number;
		qualityScore: number;
		recoveryScore: number;
		restfulnessScore: number;
	};
	averageSpO2Value: number;
	averageRespirationValue: number;
	sleepStartTimestampGMT: number;
	sleepEndTimestampGMT: number;
	avgSleepStress: number;
	sleepHeartRate: number;
}

interface ActivityData {
	calendarDate: string;
	totalSteps: number;
	totalDistanceMeters: number;
	activeKilocalories: number;
	totalKilocalories: number;
	floorsAscended: number;
	floorsDescended: number;
	restingHeartRate: number;
	minHeartRate: number;
	maxHeartRate: number;
	averageStressLevel: number;
	maxStressLevel: number;
	lowStressDuration: number;
	mediumStressDuration: number;
	highStressDuration: number;
	bodyBatteryChargedValue: number;
	bodyBatteryDrainedValue: number;
	bodyBatteryHighestValue: number;
	bodyBatteryLowestValue: number;
	bodyBatteryMostRecentValue: number;
}

interface StressData {
	calendarDate: string;
	overallStressLevel: number;
	restStressDuration: number;
	activityStressDuration: number;
	lowStressDuration: number;
	mediumStressDuration: number;
	highStressDuration: number;
	stressQualifier: string;
}

interface SyncAllResult {
	success: boolean;
	dates?: Record<
		string,
		{
			sleep: SleepData | null;
			activity: ActivityData | null;
			stress: StressData | null;
			bodyBattery: unknown[];
			heartRate: unknown;
		}
	>;
	error?: string;
}

interface Activity {
	activityId: number;
	activityName: string;
	activityType: string;
	startTimeLocal: string;
	duration: number;
	distance: number;
	calories: number;
	averageHR: number;
	maxHR: number;
	averageSpeed: number;
	elevationGain: number;
	steps: number;
}

// HTTP client for deployed service
async function callHttpService<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
	const serviceUrl = env.GARMIN_SERVICE_URL;
	const apiKey = env.GARMIN_SERVICE_API_KEY;

	if (!serviceUrl) {
		throw new Error('GARMIN_SERVICE_URL not configured');
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}

	const response = await fetch(`${serviceUrl}${endpoint}`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error(`Garmin service error: ${response.status}`);
	}

	return response.json();
}

// Subprocess client for local development
async function runPythonCommand<T>(
	command: string,
	args: Record<string, unknown> = {}
): Promise<T> {
	return new Promise((resolve, reject) => {
		const pythonScript = join(process.cwd(), 'python', 'garmin_service.py');
		// Use venv Python if available, otherwise fall back to system Python
		const venvPython = join(process.cwd(), '.venv', 'bin', 'python');
		const proc = spawn(venvPython, [pythonScript, command, JSON.stringify(args)]);

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				try {
					resolve(JSON.parse(stdout));
				} catch {
					reject(new Error('Failed to parse Python response'));
				}
			} else {
				reject(new Error(stderr || `Python script exited with code ${code}`));
			}
		});

		proc.on('error', (err) => {
			reject(new Error(`Failed to spawn Python process: ${err.message}`));
		});
	});
}

// Check if we should use HTTP or subprocess
function useHttpService(): boolean {
	return !!env.GARMIN_SERVICE_URL;
}

export const garminClient = {
	authenticate: async (email: string, password: string, userId?: string): Promise<AuthResult> => {
		if (useHttpService()) {
			return callHttpService('/authenticate', { email, password, user_id: userId });
		}
		return runPythonCommand('authenticate', { email, password, user_id: userId });
	},

	checkAuth: async (userId?: string): Promise<AuthStatus> => {
		if (useHttpService()) {
			return callHttpService('/check-auth', { user_id: userId });
		}
		return runPythonCommand('check_auth', { user_id: userId });
	},

	fetchSleep: async (date: string, userId?: string): Promise<GarminResult<SleepData>> => {
		if (useHttpService()) {
			return callHttpService('/sleep', { date, user_id: userId });
		}
		return runPythonCommand('fetch_sleep', { date, user_id: userId });
	},

	fetchActivity: async (date: string, userId?: string): Promise<GarminResult<ActivityData>> => {
		if (useHttpService()) {
			return callHttpService('/activity', { date, user_id: userId });
		}
		return runPythonCommand('fetch_activity', { date, user_id: userId });
	},

	fetchStress: async (date: string, userId?: string): Promise<GarminResult<StressData>> => {
		if (useHttpService()) {
			return callHttpService('/stress', { date, user_id: userId });
		}
		return runPythonCommand('fetch_stress', { date, user_id: userId });
	},

	fetchBodyBattery: async (date: string, userId?: string): Promise<GarminResult<unknown[]>> => {
		if (useHttpService()) {
			return callHttpService('/body-battery', { date, user_id: userId });
		}
		return runPythonCommand('fetch_body_battery', { date, user_id: userId });
	},

	fetchHeartRate: async (date: string, userId?: string): Promise<GarminResult<unknown>> => {
		if (useHttpService()) {
			return callHttpService('/heart-rate', { date, user_id: userId });
		}
		return runPythonCommand('fetch_heart_rate', { date, user_id: userId });
	},

	syncAll: async (startDate: string, endDate: string, userId?: string): Promise<SyncAllResult> => {
		if (useHttpService()) {
			return callHttpService('/sync-all', { start_date: startDate, end_date: endDate, user_id: userId });
		}
		return runPythonCommand('sync_all', { start_date: startDate, end_date: endDate, user_id: userId });
	},

	fetchActivities: async (date: string, userId?: string): Promise<GarminResult<Activity[]>> => {
		if (useHttpService()) {
			return callHttpService('/activities', { date, user_id: userId });
		}
		return runPythonCommand('fetch_activities', { date, user_id: userId });
	},

	fetchActivitiesBatch: async (
		startDate: string,
		endDate: string,
		userId?: string
	): Promise<GarminResult<Record<string, Activity[]>>> => {
		if (useHttpService()) {
			return callHttpService('/activities-batch', { start_date: startDate, end_date: endDate, user_id: userId });
		}
		return runPythonCommand('fetch_activities_batch', { start_date: startDate, end_date: endDate, user_id: userId });
	}
};

export type { Activity };
export type { SleepData, ActivityData, StressData, SyncAllResult };

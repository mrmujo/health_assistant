import { spawn } from 'child_process';
import { join } from 'path';

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

export const garminClient = {
	authenticate: (email: string, password: string): Promise<AuthResult> =>
		runPythonCommand('authenticate', { email, password }),

	checkAuth: (): Promise<AuthStatus> => runPythonCommand('check_auth'),

	fetchSleep: (date: string): Promise<GarminResult<SleepData>> =>
		runPythonCommand('fetch_sleep', { date }),

	fetchActivity: (date: string): Promise<GarminResult<ActivityData>> =>
		runPythonCommand('fetch_activity', { date }),

	fetchStress: (date: string): Promise<GarminResult<StressData>> =>
		runPythonCommand('fetch_stress', { date }),

	fetchBodyBattery: (date: string): Promise<GarminResult<unknown[]>> =>
		runPythonCommand('fetch_body_battery', { date }),

	fetchHeartRate: (date: string): Promise<GarminResult<unknown>> =>
		runPythonCommand('fetch_heart_rate', { date }),

	syncAll: (startDate: string, endDate: string): Promise<SyncAllResult> =>
		runPythonCommand('sync_all', { start_date: startDate, end_date: endDate }),

	fetchActivities: (date: string): Promise<GarminResult<Activity[]>> =>
		runPythonCommand('fetch_activities', { date }),

	fetchActivitiesBatch: (
		startDate: string,
		endDate: string
	): Promise<GarminResult<Record<string, Activity[]>>> =>
		runPythonCommand('fetch_activities_batch', { start_date: startDate, end_date: endDate })
};

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

export type { Activity };

export type { SleepData, ActivityData, StressData, SyncAllResult };

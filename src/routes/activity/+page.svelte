<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import LineChart from '$lib/components/charts/LineChart.svelte';

	let { data } = $props();

	let expandedDays = $state<Set<string>>(new Set());
	let activitiesCache = $state<Record<string, any[]>>({});
	let loadingActivities = $state<Set<string>>(new Set());

	function formatDistance(meters: number): string {
		const km = meters / 1000;
		return km >= 1 ? `${km.toFixed(2)} km` : `${meters.toFixed(0)} m`;
	}

	function formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m ${secs}s`;
		return `${secs}s`;
	}

	function formatPace(speedMs: number): string {
		if (!speedMs || speedMs <= 0) return '--';
		const paceSecsPerKm = 1000 / speedMs;
		const mins = Math.floor(paceSecsPerKm / 60);
		const secs = Math.floor(paceSecsPerKm % 60);
		return `${mins}:${secs.toString().padStart(2, '0')} /km`;
	}

	async function toggleDay(date: string) {
		if (expandedDays.has(date)) {
			expandedDays.delete(date);
			expandedDays = new Set(expandedDays);
		} else {
			expandedDays.add(date);
			expandedDays = new Set(expandedDays);

			// Fetch activities if not cached
			if (!activitiesCache[date]) {
				loadingActivities.add(date);
				loadingActivities = new Set(loadingActivities);

				try {
					const res = await fetch(`/api/activities?date=${date}`);
					const result = await res.json();
					if (result.success) {
						activitiesCache[date] = result.data;
						activitiesCache = { ...activitiesCache };
					}
				} catch (e) {
					console.error('Failed to fetch activities', e);
				} finally {
					loadingActivities.delete(date);
					loadingActivities = new Set(loadingActivities);
				}
			}
		}
	}

	async function analyzeDay(date: string) {
		const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const question = `Analyze my activity and fitness data from ${date}. How was my performance? Any insights?`;
		const title = `Activity Analysis - ${formattedDate}`;
		await fetch('/api/chat/prefill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question, title })
		});
		goto('/chat');
	}

	async function analyzeActivity(activity: any) {
		const activityName = activity.activityName || activity.activityType;
		const question = `Analyze my ${activityName} activity: Duration ${formatDuration(activity.duration)}, Distance ${activity.distance ? formatDistance(activity.distance) : 'N/A'}, Avg HR ${activity.averageHR || 'N/A'} bpm, Max HR ${activity.maxHR || 'N/A'} bpm, Calories ${activity.calories || 'N/A'}. How was my performance?`;
		const title = `${activityName} Analysis`;
		await fetch('/api/chat/prefill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question, title })
		});
		goto('/chat');
	}

	function getActivityIcon(type: string): string {
		const icons: Record<string, string> = {
			running: '🏃',
			walking: '🚶',
			cycling: '🚴',
			swimming: '🏊',
			hiking: '🥾',
			strength_training: '🏋️',
			yoga: '🧘',
			other: '💪'
		};
		return icons[type?.toLowerCase()] || '💪';
	}
</script>

<svelte:head>
	<title>Activity | Health Assistant</title>
</svelte:head>

<div class="activity-page">
	<header class="page-header">
		<h1>Activity</h1>
		<p>Your daily activity, heart rate, and body battery</p>
	</header>

	{#if data.activityData.length > 0}
		<section class="grid grid-4">
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgSteps?.toLocaleString() ?? '--'}</div>
					<div class="stat-label">Avg Steps (7d)</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgRestingHR ?? '--'}</div>
					<div class="stat-label">Avg Resting HR</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgBodyBattery ?? '--'}</div>
					<div class="stat-label">Avg Body Battery</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgCalories?.toLocaleString() ?? '--'}</div>
					<div class="stat-label">Avg Calories</div>
				</div>
			</div>
		</section>

		<section class="charts-section">
			<div class="grid grid-3">
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Steps Trend</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.steps}
						color="#22c55e"
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Resting Heart Rate</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.restingHR}
						color="#ef4444"
						fill={false}
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Calories Burned</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.calories}
						color="#f97316"
					/>
				</div>
			</div>
		</section>

		<section class="card">
			<div class="card-header">
				<h2 class="card-title">Activity History</h2>
			</div>
			<div class="activity-history">
				{#each data.activityData as day}
					{@const isExpanded = expandedDays.has(day.date)}
					{@const isLoading = loadingActivities.has(day.date)}
					{@const activities = activitiesCache[day.date] || []}
					<div class="activity-day" class:expanded={isExpanded}>
						<div class="activity-day-header">
							<button class="expand-btn" onclick={() => toggleDay(day.date)}>
								<span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
								<span class="activity-date">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
							</button>
							<div class="activity-day-actions">
								<button class="btn-analyze" onclick={() => analyzeDay(day.date)} title="Analyze with AI">
									🔍
								</button>
							</div>
						</div>
						<div class="activity-metrics">
							<div class="metric">
								<span class="metric-value">{day.steps?.toLocaleString() ?? '--'}</span>
								<span class="metric-label">steps</span>
							</div>
							<div class="metric">
								<span class="metric-value">{day.distance ? formatDistance(day.distance) : '--'}</span>
								<span class="metric-label">distance</span>
							</div>
							<div class="metric">
								<span class="metric-value">{day.totalCalories?.toLocaleString() ?? '--'}</span>
								<span class="metric-label">calories</span>
							</div>
							<div class="metric">
								<span class="metric-value">{day.restingHeartRate ?? '--'}</span>
								<span class="metric-label">resting HR</span>
							</div>
						</div>
						{#if data.stressData.find(s => s.date === day.date)}
							{@const stress = data.stressData.find(s => s.date === day.date)}
							<div class="body-battery">
								<div class="battery-bar">
									<div class="battery-fill" style="width: {stress?.bodyBatteryEnd ?? 0}%"></div>
								</div>
								<div class="battery-info">
									<span>Body Battery: {stress?.bodyBatteryEnd ?? '--'}</span>
									<span class="battery-change">
										{#if (stress?.bodyBatteryCharged ?? 0) > (stress?.bodyBatteryDrained ?? 0)}
											+{(stress?.bodyBatteryCharged ?? 0) - (stress?.bodyBatteryDrained ?? 0)}
										{:else}
											{(stress?.bodyBatteryCharged ?? 0) - (stress?.bodyBatteryDrained ?? 0)}
										{/if}
									</span>
								</div>
							</div>
						{/if}

						{#if isExpanded}
							<div class="activities-detail">
								{#if isLoading}
									<p class="loading">Loading activities...</p>
								{:else if activities.length > 0}
									<div class="activities-list">
										{#each activities as activity}
											<div class="activity-item">
												<div class="activity-item-header">
													<span class="activity-icon">{getActivityIcon(activity.activityType)}</span>
													<span class="activity-name">{activity.activityName || activity.activityType}</span>
													<button class="btn-analyze-sm" onclick={() => analyzeActivity(activity)} title="Analyze">
														🔍
													</button>
												</div>
												<div class="activity-item-stats">
													{#if activity.duration}
														<span>⏱️ {formatDuration(activity.duration)}</span>
													{/if}
													{#if activity.distance}
														<span>📏 {formatDistance(activity.distance)}</span>
													{/if}
													{#if activity.averageHR}
														<span>❤️ {activity.averageHR} bpm</span>
													{/if}
													{#if activity.calories}
														<span>🔥 {activity.calories} cal</span>
													{/if}
													{#if activity.averageSpeed && activity.activityType?.toLowerCase().includes('running')}
														<span>🏃 {formatPace(activity.averageSpeed)}</span>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<p class="no-activities">No recorded activities for this day</p>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<div class="card empty-state">
			<p>No activity data available. <a href="/settings">Connect Garmin and sync your data</a> to see activity metrics.</p>
		</div>
	{/if}
</div>

<style>
	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}

	.page-header p {
		color: var(--color-text-secondary);
	}

	section {
		margin-bottom: 1.5rem;
	}

	.stat-card {
		text-align: center;
	}

	.activity-history {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.activity-day {
		padding: 1rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
	}

	.activity-day.expanded {
		background: var(--color-bg-secondary);
	}

	.activity-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.expand-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		color: var(--color-text);
		cursor: pointer;
		padding: 0;
		font-size: inherit;
	}

	.expand-icon {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.activity-date {
		font-weight: 600;
	}

	.activity-day-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-analyze {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.15s ease;
	}

	.btn-analyze:hover {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.activity-metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.metric {
		text-align: center;
	}

	.metric-value {
		display: block;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.metric-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.body-battery {
		margin-top: 0.5rem;
	}

	.battery-bar {
		height: 8px;
		background: var(--color-bg-secondary);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.battery-fill {
		height: 100%;
		background: linear-gradient(90deg, #f97316, #22c55e);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.battery-info {
		display: flex;
		justify-content: space-between;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.battery-change {
		font-weight: 500;
	}

	.activities-detail {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.loading, .no-activities {
		text-align: center;
		color: var(--color-text-secondary);
		padding: 1rem;
		font-size: 0.875rem;
	}

	.activities-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.activity-item {
		background: var(--color-bg-tertiary);
		padding: 0.75rem;
		border-radius: var(--radius);
	}

	.activity-item-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.activity-icon {
		font-size: 1.25rem;
	}

	.activity-name {
		flex: 1;
		font-weight: 500;
	}

	.btn-analyze-sm {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		opacity: 0.6;
		transition: opacity 0.15s ease;
	}

	.btn-analyze-sm:hover {
		opacity: 1;
	}

	.activity-item-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--color-text-secondary);
	}

	.charts-section {
		margin-bottom: 1.5rem;
	}

	@media (max-width: 1024px) {
		.charts-section .grid-3 {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.activity-metrics {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>

<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props();

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	const today = new Date();
</script>

<svelte:head>
	<title>Dashboard | Health Assistant</title>
</svelte:head>

<div class="dashboard">
	<header class="dashboard-header">
		<h1>Good {today.getHours() < 12 ? 'morning' : today.getHours() < 18 ? 'afternoon' : 'evening'}</h1>
		<p class="date">{formatDate(today)}</p>
	</header>

	<section class="stats-grid grid grid-4">
		<div class="card stat-card">
			<div class="stat">
				<div class="stat-value">{data.sleep?.sleepScore ?? '--'}</div>
				<div class="stat-label">Sleep Score</div>
			</div>
		</div>
		<div class="card stat-card">
			<div class="stat">
				<div class="stat-value">{data.activity?.steps?.toLocaleString() ?? '--'}</div>
				<div class="stat-label">Steps</div>
			</div>
		</div>
		<div class="card stat-card">
			<div class="stat">
				<div class="stat-value">{data.stress?.bodyBatteryEnd ?? '--'}</div>
				<div class="stat-label">Body Battery</div>
			</div>
		</div>
		<div class="card stat-card">
			<div class="stat">
				<div class="stat-value">{data.activity?.restingHeartRate ?? '--'}</div>
				<div class="stat-label">Resting HR</div>
			</div>
		</div>
	</section>

	<section class="grid grid-2">
		<div class="card">
			<div class="card-header">
				<h2 class="card-title">Sleep Overview</h2>
			</div>
			{#if data.sleep}
				<div class="sleep-breakdown">
					<div class="sleep-bar">
						<div class="sleep-segment deep" style="width: {(data.sleep.deepSleepSeconds ?? 0) / (data.sleep.durationSeconds ?? 1) * 100}%"></div>
						<div class="sleep-segment light" style="width: {(data.sleep.lightSleepSeconds ?? 0) / (data.sleep.durationSeconds ?? 1) * 100}%"></div>
						<div class="sleep-segment rem" style="width: {(data.sleep.remSleepSeconds ?? 0) / (data.sleep.durationSeconds ?? 1) * 100}%"></div>
						<div class="sleep-segment awake" style="width: {(data.sleep.awakeSeconds ?? 0) / (data.sleep.durationSeconds ?? 1) * 100}%"></div>
					</div>
					<div class="sleep-legend">
						<span class="legend-item"><span class="legend-dot deep"></span> Deep</span>
						<span class="legend-item"><span class="legend-dot light"></span> Light</span>
						<span class="legend-item"><span class="legend-dot rem"></span> REM</span>
						<span class="legend-item"><span class="legend-dot awake"></span> Awake</span>
					</div>
					<p class="sleep-duration">
						Total: {Math.floor((data.sleep.durationSeconds ?? 0) / 3600)}h {Math.floor(((data.sleep.durationSeconds ?? 0) % 3600) / 60)}m
					</p>
				</div>
			{:else}
				<p class="empty-state">No sleep data for today. <a href="/settings">Sync with Garmin</a></p>
			{/if}
		</div>

		<div class="card">
			<div class="card-header">
				<h2 class="card-title">Quick Actions</h2>
			</div>
			<div class="quick-actions">
				<a href="/chat" class="btn btn-primary">Ask AI about your health</a>
				<a href="/logs" class="btn btn-secondary">Log food or medication</a>
				<a href="/settings" class="btn btn-secondary">Sync Garmin data</a>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<h2 class="card-title">Recent Logs</h2>
			<a href="/logs" class="btn btn-secondary">View all</a>
		</div>
		{#if data.recentLogs.length > 0}
			<div class="logs-list">
				{#each data.recentLogs as log}
					<div class="log-item">
						<span class="log-icon">{log.type === 'food' ? '🍽️' : log.type === 'medication' ? '💊' : '📝'}</span>
						<span class="log-content">{log.description}</span>
						<span class="log-time">{log.time}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty-state">No recent logs. <a href="/logs">Add your first log</a></p>
		{/if}
	</section>
</div>

<style>
	.dashboard-header {
		margin-bottom: 2rem;
	}

	.dashboard-header h1 {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
	}

	.date {
		color: var(--color-text-secondary);
	}

	.stats-grid {
		margin-bottom: 1.5rem;
	}

	.stat-card {
		text-align: center;
	}

	.sleep-breakdown {
		margin-top: 0.5rem;
	}

	.sleep-bar {
		display: flex;
		height: 24px;
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.sleep-segment {
		min-width: 2px;
	}

	.sleep-segment.deep { background: #6366f1; }
	.sleep-segment.light { background: #8b5cf6; }
	.sleep-segment.rem { background: #ec4899; }
	.sleep-segment.awake { background: #f97316; }

	.sleep-legend {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.legend-dot.deep { background: #6366f1; }
	.legend-dot.light { background: #8b5cf6; }
	.legend-dot.rem { background: #ec4899; }
	.legend-dot.awake { background: #f97316; }

	.sleep-duration {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.quick-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.quick-actions .btn {
		justify-content: flex-start;
	}

	.logs-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.log-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
	}

	.log-icon {
		font-size: 1.25rem;
	}

	.log-content {
		flex: 1;
	}

	.log-time {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.empty-state {
		color: var(--color-text-secondary);
		text-align: center;
		padding: 2rem;
	}

	section {
		margin-bottom: 1.5rem;
	}
</style>

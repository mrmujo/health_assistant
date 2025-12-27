<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data } = $props();

	function formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	}

	function formatTime(date: Date | null): string {
		if (!date) return '--';
		return new Date(date).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	async function analyzeDay(date: string) {
		const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const question = `Analyze my sleep from ${date}. What patterns do you see? Any suggestions for improvement?`;
		const title = `Sleep Analysis - ${formattedDate}`;
		// Save the question and navigate to chat
		await fetch('/api/chat/prefill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question, title })
		});
		goto('/chat');
	}
</script>

<svelte:head>
	<title>Sleep Analysis | Health Assistant</title>
</svelte:head>

<div class="sleep-page">
	<header class="page-header">
		<h1>Sleep Analysis</h1>
		<p>Track your sleep patterns and quality over time</p>
	</header>

	{#if data.sleepData.length > 0}
		<section class="grid grid-4">
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgSleepScore ?? '--'}</div>
					<div class="stat-label">Avg Sleep Score (7d)</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgDuration ?? '--'}</div>
					<div class="stat-label">Avg Duration</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgDeepPct ?? '--'}%</div>
					<div class="stat-label">Avg Deep Sleep</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgRemPct ?? '--'}%</div>
					<div class="stat-label">Avg REM Sleep</div>
				</div>
			</div>
		</section>

		<section class="card">
			<div class="card-header">
				<h2 class="card-title">Sleep History</h2>
			</div>
			<div class="sleep-history">
				{#each data.sleepData as sleep}
					<div class="sleep-day">
						<div class="sleep-day-header">
							<span class="sleep-date">{new Date(sleep.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
							<div class="sleep-day-actions">
								<span class="sleep-score badge badge-success">{sleep.sleepScore ?? '--'}</span>
								<button class="btn-analyze" onclick={() => analyzeDay(sleep.date)} title="Analyze with AI">
									🔍
								</button>
							</div>
						</div>
						<div class="sleep-times">
							<span>{formatTime(sleep.startTime)} - {formatTime(sleep.endTime)}</span>
							<span class="sleep-total">{formatDuration(sleep.durationSeconds ?? 0)}</span>
						</div>
						<div class="sleep-bar">
							<div class="sleep-segment deep" style="width: {((sleep.deepSleepSeconds ?? 0) / (sleep.durationSeconds ?? 1)) * 100}%" title="Deep: {formatDuration(sleep.deepSleepSeconds ?? 0)}"></div>
							<div class="sleep-segment light" style="width: {((sleep.lightSleepSeconds ?? 0) / (sleep.durationSeconds ?? 1)) * 100}%" title="Light: {formatDuration(sleep.lightSleepSeconds ?? 0)}"></div>
							<div class="sleep-segment rem" style="width: {((sleep.remSleepSeconds ?? 0) / (sleep.durationSeconds ?? 1)) * 100}%" title="REM: {formatDuration(sleep.remSleepSeconds ?? 0)}"></div>
							<div class="sleep-segment awake" style="width: {((sleep.awakeSeconds ?? 0) / (sleep.durationSeconds ?? 1)) * 100}%" title="Awake: {formatDuration(sleep.awakeSeconds ?? 0)}"></div>
						</div>
						<div class="sleep-metrics">
							{#if sleep.avgHrSleep}
								<span>HR: {sleep.avgHrSleep} bpm</span>
							{/if}
							{#if sleep.avgSpO2}
								<span>SpO2: {sleep.avgSpO2}%</span>
							{/if}
							{#if sleep.avgRespirationRate}
								<span>Resp: {sleep.avgRespirationRate?.toFixed(1)}/min</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<div class="sleep-legend card">
			<span class="legend-item"><span class="legend-dot deep"></span> Deep Sleep</span>
			<span class="legend-item"><span class="legend-dot light"></span> Light Sleep</span>
			<span class="legend-item"><span class="legend-dot rem"></span> REM Sleep</span>
			<span class="legend-item"><span class="legend-dot awake"></span> Awake</span>
		</div>
	{:else}
		<div class="card empty-state">
			<p>No sleep data available. <a href="/settings">Connect Garmin and sync your data</a> to see sleep analysis.</p>
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

	.sleep-history {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sleep-day {
		padding: 1rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
	}

	.sleep-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.sleep-date {
		font-weight: 600;
	}

	.sleep-day-actions {
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

	.sleep-times {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.sleep-total {
		font-weight: 500;
		color: var(--color-text);
	}

	.sleep-bar {
		display: flex;
		height: 20px;
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.sleep-segment {
		min-width: 2px;
	}

	.sleep-segment.deep { background: #6366f1; }
	.sleep-segment.light { background: #8b5cf6; }
	.sleep-segment.rem { background: #ec4899; }
	.sleep-segment.awake { background: #f97316; }

	.sleep-metrics {
		display: flex;
		gap: 1rem;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.sleep-legend {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.legend-dot.deep { background: #6366f1; }
	.legend-dot.light { background: #8b5cf6; }
	.legend-dot.rem { background: #ec4899; }
	.legend-dot.awake { background: #f97316; }

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--color-text-secondary);
	}
</style>

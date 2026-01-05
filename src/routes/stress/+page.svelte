<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';

	let { data } = $props();

	async function analyzeDay(date: string) {
		const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const question = `Analyze my stress and body battery data from ${date}. What patterns do you see? How was my recovery?`;
		const title = `Stress Analysis - ${formattedDate}`;
		await fetch('/api/chat/prefill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question, title })
		});
		goto('/chat');
	}

	function getStressLevel(value: number | null): { label: string; color: string } {
		if (value === null) return { label: 'Unknown', color: 'var(--color-text-secondary)' };
		if (value <= 25) return { label: 'Rest', color: '#22c55e' };
		if (value <= 50) return { label: 'Low', color: '#84cc16' };
		if (value <= 75) return { label: 'Medium', color: '#eab308' };
		return { label: 'High', color: '#ef4444' };
	}

	function formatMinutes(mins: number | null): string {
		if (!mins) return '0m';
		const hours = Math.floor(mins / 60);
		const minutes = mins % 60;
		return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
	}
</script>

<svelte:head>
	<title>Stress Analysis | Health Assistant</title>
</svelte:head>

<div class="stress-page">
	<header class="page-header">
		<h1>Stress & Body Battery</h1>
		<p>Track your stress levels and energy throughout the day</p>
	</header>

	{#if data.stressData.length > 0}
		<section class="grid grid-5">
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{data.avgStress ?? '--'}</div>
					<div class="stat-label">Avg Stress (7d)</div>
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
					<div class="stat-value">{formatMinutes(data.avgLowStress)}</div>
					<div class="stat-label">Avg Rest/Low Time</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value">{formatMinutes(data.avgHighStress)}</div>
					<div class="stat-label">Avg High Stress</div>
				</div>
			</div>
			<div class="card stat-card">
				<div class="stat">
					<div class="stat-value" style="color: #f97316">{data.avgFatigue ?? '--'}</div>
					<div class="stat-label">Avg RPE Fatigue</div>
				</div>
			</div>
		</section>

		<section class="charts-section">
			<div class="grid grid-3">
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Stress Level Trend</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.avgStress}
						color="#eab308"
						fill={false}
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Body Battery Trend</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.bodyBatteryEnd}
						color="#22c55e"
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">RPE Fatigue Trend</h2>
					</div>
					{#if data.fatigueChartData.some((v: number | null) => v !== null)}
						<LineChart
							labels={data.chartData.labels}
							data={data.fatigueChartData}
							color="#f97316"
							fill={false}
						/>
					{:else}
						<div class="empty-chart">
							<p>No RPE data yet</p>
							<p class="empty-hint">Add RPE ratings to activities to see fatigue trends</p>
						</div>
					{/if}
				</div>
			</div>
			<div class="grid grid-2">
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Weekly Stress Distribution (hours)</h2>
					</div>
					<PieChart
						labels={['Rest', 'Low', 'Medium', 'High']}
						data={[
							Math.round(data.weeklyStressMinutes.rest / 60 * 10) / 10,
							Math.round(data.weeklyStressMinutes.low / 60 * 10) / 10,
							Math.round(data.weeklyStressMinutes.medium / 60 * 10) / 10,
							Math.round(data.weeklyStressMinutes.high / 60 * 10) / 10
						]}
						colors={['#22c55e', '#84cc16', '#eab308', '#ef4444']}
						height={220}
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Charge vs Drain</h2>
					</div>
					<div class="charge-drain-chart">
						{#each data.chartData.labels as label, i}
							<div class="charge-drain-bar">
								<span class="bar-date">{label}</span>
								<div class="bar-container">
									<div class="bar charged" style="width: {(data.chartData.bodyBatteryCharged[i] || 0)}%"></div>
									<div class="bar drained" style="width: {(data.chartData.bodyBatteryDrained[i] || 0)}%"></div>
								</div>
							</div>
						{/each}
						<div class="charge-drain-legend">
							<span><span class="dot charged"></span> Charged</span>
							<span><span class="dot drained"></span> Drained</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="card">
			<div class="card-header">
				<h2 class="card-title">Daily Breakdown</h2>
			</div>
			<div class="stress-history">
				{#each data.stressData as day}
					{@const stressLevel = getStressLevel(day.avgStress)}
					<div class="stress-day">
						<div class="stress-day-header">
							<span class="stress-date">
								{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
							</span>
							<div class="stress-day-actions">
								<span class="stress-badge" style="background: {stressLevel.color}20; color: {stressLevel.color}">
									{stressLevel.label} ({day.avgStress ?? '--'})
								</span>
								{#if data.fatigueByDate[day.date]}
									<span class="fatigue-badge">
										RPE Fatigue: {data.fatigueByDate[day.date].totalFatigue}
									</span>
								{/if}
								<button class="btn-analyze" onclick={() => analyzeDay(day.date)} title="Analyze with AI">
									🔍
								</button>
							</div>
						</div>

						<div class="stress-bars">
							<div class="stress-bar-row">
								<span class="bar-label">Stress Distribution</span>
								<div class="stress-bar">
									{#if day.restStressMinutes}
										<div class="bar-segment rest" style="width: {(day.restStressMinutes / ((day.restStressMinutes || 0) + (day.lowStressMinutes || 0) + (day.mediumStressMinutes || 0) + (day.highStressMinutes || 0))) * 100}%" title="Rest: {formatMinutes(day.restStressMinutes)}"></div>
									{/if}
									{#if day.lowStressMinutes}
										<div class="bar-segment low" style="width: {(day.lowStressMinutes / ((day.restStressMinutes || 0) + (day.lowStressMinutes || 0) + (day.mediumStressMinutes || 0) + (day.highStressMinutes || 0))) * 100}%" title="Low: {formatMinutes(day.lowStressMinutes)}"></div>
									{/if}
									{#if day.mediumStressMinutes}
										<div class="bar-segment medium" style="width: {(day.mediumStressMinutes / ((day.restStressMinutes || 0) + (day.lowStressMinutes || 0) + (day.mediumStressMinutes || 0) + (day.highStressMinutes || 0))) * 100}%" title="Medium: {formatMinutes(day.mediumStressMinutes)}"></div>
									{/if}
									{#if day.highStressMinutes}
										<div class="bar-segment high" style="width: {(day.highStressMinutes / ((day.restStressMinutes || 0) + (day.lowStressMinutes || 0) + (day.mediumStressMinutes || 0) + (day.highStressMinutes || 0))) * 100}%" title="High: {formatMinutes(day.highStressMinutes)}"></div>
									{/if}
								</div>
							</div>
						</div>

						<div class="body-battery-section">
							<div class="battery-header">
								<span>Body Battery</span>
								<span class="battery-range">{day.bodyBatteryMin ?? '--'} → {day.bodyBatteryEnd ?? '--'}</span>
							</div>
							<div class="battery-bar">
								<div class="battery-fill" style="width: {day.bodyBatteryEnd ?? 0}%"></div>
								<div class="battery-marker min" style="left: {day.bodyBatteryMin ?? 0}%"></div>
								<div class="battery-marker max" style="left: {day.bodyBatteryMax ?? 0}%"></div>
							</div>
							<div class="battery-stats">
								<span class="charged">+{day.bodyBatteryCharged ?? 0} charged</span>
								<span class="drained">-{day.bodyBatteryDrained ?? 0} drained</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<div class="legend card">
			<div class="legend-section">
				<span class="legend-title">Stress Levels:</span>
				<span class="legend-item"><span class="legend-dot rest"></span> Rest</span>
				<span class="legend-item"><span class="legend-dot low"></span> Low</span>
				<span class="legend-item"><span class="legend-dot medium"></span> Medium</span>
				<span class="legend-item"><span class="legend-dot high"></span> High</span>
			</div>
		</div>
	{:else}
		<div class="card empty-state">
			<p>No stress data available. <a href="/settings">Connect Garmin and sync your data</a> to see stress analysis.</p>
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

	.stress-history {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.stress-day {
		padding: 1rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
	}

	.stress-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.stress-date {
		font-weight: 600;
	}

	.stress-day-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stress-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
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

	.stress-bars {
		margin-bottom: 1rem;
	}

	.stress-bar-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bar-label {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.stress-bar {
		display: flex;
		height: 20px;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--color-bg-secondary);
	}

	.bar-segment {
		min-width: 2px;
	}

	.bar-segment.rest { background: #22c55e; }
	.bar-segment.low { background: #84cc16; }
	.bar-segment.medium { background: #eab308; }
	.bar-segment.high { background: #ef4444; }

	.body-battery-section {
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}

	.battery-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.8125rem;
		margin-bottom: 0.5rem;
	}

	.battery-range {
		color: var(--color-text-secondary);
	}

	.battery-bar {
		position: relative;
		height: 12px;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		overflow: visible;
		margin-bottom: 0.5rem;
	}

	.battery-fill {
		height: 100%;
		background: linear-gradient(90deg, #f97316 0%, #eab308 30%, #22c55e 70%);
		border-radius: 6px;
		transition: width 0.3s ease;
	}

	.battery-marker {
		position: absolute;
		top: -2px;
		width: 4px;
		height: 16px;
		background: var(--color-text);
		border-radius: 2px;
		transform: translateX(-50%);
	}

	.battery-marker.min {
		background: #ef4444;
	}

	.battery-marker.max {
		background: #22c55e;
	}

	.battery-stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.8125rem;
	}

	.charged {
		color: #22c55e;
	}

	.drained {
		color: #ef4444;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.legend-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.legend-title {
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.legend-dot.rest { background: #22c55e; }
	.legend-dot.low { background: #84cc16; }
	.legend-dot.medium { background: #eab308; }
	.legend-dot.high { background: #ef4444; }

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--color-text-secondary);
	}

	.charts-section {
		margin-bottom: 1.5rem;
	}

	.charts-section .grid {
		margin-bottom: 1rem;
	}

	.charge-drain-chart {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.charge-drain-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.bar-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		width: 50px;
		flex-shrink: 0;
	}

	.bar-container {
		flex: 1;
		display: flex;
		gap: 2px;
		height: 16px;
	}

	.bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.bar.charged {
		background: #22c55e;
	}

	.bar.drained {
		background: #ef4444;
	}

	.charge-drain-legend {
		display: flex;
		gap: 1rem;
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.charge-drain-legend span {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.dot.charged {
		background: #22c55e;
	}

	.dot.drained {
		background: #ef4444;
	}

	.grid-5 {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1rem;
	}

	.empty-chart {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--color-text-secondary);
		text-align: center;
	}

	.empty-chart p {
		margin: 0;
	}

	.empty-hint {
		font-size: 0.8125rem;
		margin-top: 0.5rem !important;
		opacity: 0.7;
	}

	.fatigue-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
		background: #f9731620;
		color: #f97316;
	}

	@media (max-width: 1200px) {
		.grid-5 {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.grid-5 {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.grid-5 {
			grid-template-columns: 1fr;
		}
	}
</style>

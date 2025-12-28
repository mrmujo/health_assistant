<script lang="ts">
	import type { PageData } from './$types';
	import ScatterChart from '$lib/components/charts/ScatterChart.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Insights | Health Assistant</title>
</svelte:head>

<div class="insights-page">
	<header class="page-header">
		<h1>Health Insights</h1>
		<p>Discover correlations between your health metrics</p>
	</header>

	{#if data.hasData && data.correlations.some(c => c.data.length >= 5)}
		<section class="correlations-grid">
			{#each data.correlations as correlation}
				{#if correlation.data.length >= 5}
					<div class="card correlation-card">
						<div class="card-header">
							<div>
								<h2 class="card-title">{correlation.title}</h2>
								<p class="correlation-desc">{correlation.description}</p>
							</div>
							<div class="correlation-badge" style="background: {correlation.strength.color}20; color: {correlation.strength.color}">
								{correlation.strength.label}
								<span class="correlation-value">r = {correlation.correlation.toFixed(2)}</span>
							</div>
						</div>
						<ScatterChart
							data={correlation.data}
							xLabel={correlation.xLabel}
							yLabel={correlation.yLabel}
							color={correlation.color}
							height={280}
						/>
						<div class="correlation-insight">
							{#if Math.abs(correlation.correlation) >= 0.4}
								{#if correlation.correlation > 0}
									<p>There's a positive relationship: as {correlation.xLabel.toLowerCase()} increases, {correlation.yLabel.toLowerCase()} tends to increase too.</p>
								{:else}
									<p>There's an inverse relationship: as {correlation.xLabel.toLowerCase()} increases, {correlation.yLabel.toLowerCase()} tends to decrease.</p>
								{/if}
							{:else}
								<p>No strong correlation detected. These metrics may be influenced by other factors.</p>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</section>

		<section class="card info-card">
			<h3>Understanding Correlations</h3>
			<div class="correlation-guide">
				<div class="guide-item">
					<span class="guide-badge" style="background: #22c55e20; color: #22c55e">Strong (r > 0.7)</span>
					<p>Clear relationship between metrics</p>
				</div>
				<div class="guide-item">
					<span class="guide-badge" style="background: #eab30820; color: #eab308">Moderate (0.4-0.7)</span>
					<p>Noticeable but not definitive relationship</p>
				</div>
				<div class="guide-item">
					<span class="guide-badge" style="background: #f9731620; color: #f97316">Weak (0.2-0.4)</span>
					<p>Slight tendency, other factors likely involved</p>
				</div>
				<div class="guide-item">
					<span class="guide-badge" style="background: #a3a3a320; color: #a3a3a3">None (&lt; 0.2)</span>
					<p>No meaningful relationship detected</p>
				</div>
			</div>
			<p class="guide-note">Note: Correlation does not imply causation. These insights are based on your personal data patterns over the last 30 days.</p>
		</section>
	{:else}
		<div class="card empty-state">
			<p>Not enough data to calculate correlations yet.</p>
			<p>Sync at least 5-7 days of data from Garmin to see insights.</p>
			<a href="/settings" class="btn btn-primary">Go to Settings</a>
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

	.correlations-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.correlation-card .card-header {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.correlation-desc {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.correlation-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.correlation-value {
		opacity: 0.8;
		font-weight: 400;
	}

	.correlation-insight {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.info-card {
		margin-bottom: 1.5rem;
	}

	.info-card h3 {
		font-size: 1rem;
		margin-bottom: 1rem;
	}

	.correlation-guide {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.guide-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.guide-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
		font-size: 0.75rem;
		font-weight: 500;
		width: fit-content;
	}

	.guide-item p {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.guide-note {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
	}

	.empty-state p {
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.empty-state .btn {
		margin-top: 1rem;
	}

	@media (max-width: 1024px) {
		.correlations-grid {
			grid-template-columns: 1fr;
		}

		.correlation-guide {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 640px) {
		.correlation-guide {
			grid-template-columns: 1fr;
		}
	}
</style>

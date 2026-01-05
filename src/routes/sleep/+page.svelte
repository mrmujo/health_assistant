<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import PieChart from '$lib/components/charts/PieChart.svelte';

	let { data } = $props();

	// Note modal state
	let showNoteModal = $state(false);
	let noteModalDate = $state('');
	let noteText = $state('');
	let savingNote = $state(false);

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

	function openNoteModal(date: string, existingNote: string | null) {
		noteModalDate = date;
		noteText = existingNote || '';
		showNoteModal = true;
	}

	async function saveNote() {
		savingNote = true;
		try {
			const res = await fetch('/api/sleep/note', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date: noteModalDate, note: noteText })
			});
			if (res.ok) {
				showNoteModal = false;
				await invalidateAll();
			}
		} catch (e) {
			console.error('Failed to save note', e);
		} finally {
			savingNote = false;
		}
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

		<section class="charts-section">
			<div class="grid grid-2">
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Sleep Score Trend</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.sleepScores}
						title=""
						color="#22c55e"
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Sleep Duration (hours)</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.durations}
						title=""
						color="#8b5cf6"
					/>
				</div>
			</div>
			<div class="grid grid-2">
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Heart Rate During Sleep</h2>
					</div>
					<LineChart
						labels={data.chartData.labels}
						data={data.chartData.avgHrSleep}
						title=""
						color="#ef4444"
						fill={false}
					/>
				</div>
				<div class="card">
					<div class="card-header">
						<h2 class="card-title">Weekly Sleep Stages (hours)</h2>
					</div>
					<PieChart
						labels={data.sleepStages.labels}
						data={data.sleepStages.data}
						colors={['#6366f1', '#8b5cf6', '#ec4899', '#f97316']}
						height={220}
					/>
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
						<div class="sleep-note-section">
							{#if sleep.note}
								<div class="sleep-note">
									<span class="note-icon">📝</span>
									<span class="note-text">{sleep.note}</span>
									<button class="btn-edit-note" onclick={() => openNoteModal(sleep.date, sleep.note)} title="Edit note">
										Edit
									</button>
								</div>
							{:else}
								<button class="btn-add-note" onclick={() => openNoteModal(sleep.date, null)}>
									+ Add note
								</button>
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

	{#if showNoteModal}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-overlay" onclick={() => showNoteModal = false} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<div class="modal-header">
					<h3>Sleep Note</h3>
					<button class="modal-close" onclick={() => showNoteModal = false}>&times;</button>
				</div>
				<div class="modal-body">
					<p class="modal-date">{new Date(noteModalDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
					<textarea
						bind:value={noteText}
						placeholder="How did you sleep? Any factors that affected your sleep..."
						rows="4"
						class="note-textarea"
					></textarea>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" onclick={() => showNoteModal = false}>Cancel</button>
					<button class="btn btn-primary" onclick={saveNote} disabled={savingNote}>
						{savingNote ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
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

	.charts-section {
		margin-bottom: 1.5rem;
	}

	.charts-section .grid {
		margin-bottom: 1rem;
	}

	/* Note styles */
	.sleep-note-section {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--color-border);
	}

	.sleep-note {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.note-icon {
		flex-shrink: 0;
	}

	.note-text {
		flex: 1;
		line-height: 1.4;
	}

	.btn-edit-note {
		background: none;
		border: none;
		color: var(--color-primary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
		flex-shrink: 0;
	}

	.btn-edit-note:hover {
		text-decoration: underline;
	}

	.btn-add-note {
		background: none;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		padding: 0.375rem 0.75rem;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.8125rem;
		transition: all 0.15s ease;
	}

	.btn-add-note:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: var(--color-bg);
		border-radius: var(--radius-lg, 0.75rem);
		width: 100%;
		max-width: 420px;
		max-height: 90vh;
		overflow: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h3 {
		font-size: 1.125rem;
		margin: 0;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-secondary);
		padding: 0;
		line-height: 1;
	}

	.modal-close:hover {
		color: var(--color-text);
	}

	.modal-body {
		padding: 1.25rem;
	}

	.modal-date {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.note-textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
	}

	.note-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--color-border);
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-secondary {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.btn-secondary:hover {
		background: var(--color-bg-tertiary);
	}

	.btn-primary {
		background: var(--color-primary);
		border: 1px solid var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

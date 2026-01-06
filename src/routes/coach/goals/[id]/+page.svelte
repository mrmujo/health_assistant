<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { getAISettings, type AISettings } from '$lib/ai';

	let { data }: { data: PageData } = $props();
	let aiSettings = $state<AISettings | null>(null);

	onMount(async () => {
		aiSettings = await getAISettings();
	});

	let generating = $state(false);
	let generateError = $state('');
	let regenerating = $state(false);
	let showRegenerateModal = $state(false);
	let regenerateReason = $state('');

	const eventIcons: Record<string, string> = {
		running: '🏃',
		cycling: '🚴',
		swimming: '🏊',
		triathlon: '🏆'
	};

	function formatDistance(meters: number | null): string {
		if (!meters) return 'N/A';
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(1)}km`;
		}
		return `${meters}m`;
	}

	function formatTime(seconds: number | null): string {
		if (!seconds) return 'N/A';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) {
			return `${h}h ${m}m`;
		}
		return `${m}min`;
	}

	function getWeeksUntil(dateStr: string): number {
		const eventDate = new Date(dateStr);
		const today = new Date();
		const diffTime = eventDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.ceil(diffDays / 7);
	}

	function formatEventDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatWorkoutDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	async function generatePlan() {
		if (!aiSettings) {
			generateError = 'Please configure your AI settings first in the Settings page.';
			return;
		}

		generating = true;
		generateError = '';

		try {
			const res = await fetch('/api/coach/generate-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goalId: data.goal.id,
					apiConfig: {
						provider: aiSettings.provider,
						openaiKey: aiSettings.openaiKey,
						anthropicKey: aiSettings.anthropicKey,
						ollamaEndpoint: aiSettings.ollamaEndpoint,
						ollamaModel: aiSettings.ollamaModel
					}
				})
			});

			const result = await res.json();
			if (result.success) {
				// Reload the page to show the new plan
				window.location.reload();
			} else {
				generateError = result.error || 'Failed to generate plan';
			}
		} catch (e) {
			generateError = 'Failed to generate plan';
		} finally {
			generating = false;
		}
	}

	async function regeneratePlan() {
		if (!aiSettings) {
			generateError = 'Please configure your AI settings first in the Settings page.';
			return;
		}

		regenerating = true;
		generateError = '';

		try {
			const res = await fetch('/api/coach/regenerate-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goalId: data.goal.id,
					reason: regenerateReason || undefined,
					apiConfig: {
						provider: aiSettings.provider,
						openaiKey: aiSettings.openaiKey,
						anthropicKey: aiSettings.anthropicKey,
						ollamaEndpoint: aiSettings.ollamaEndpoint,
						ollamaModel: aiSettings.ollamaModel
					}
				})
			});

			const result = await res.json();
			if (result.success) {
				showRegenerateModal = false;
				regenerateReason = '';
				window.location.reload();
			} else {
				generateError = result.error || 'Failed to regenerate plan';
			}
		} catch (e) {
			generateError = 'Failed to regenerate plan';
		} finally {
			regenerating = false;
		}
	}

	const workoutTypeColors: Record<string, string> = {
		easy: '#22c55e',
		recovery: '#22c55e',
		tempo: '#f59e0b',
		intervals: '#ef4444',
		long: '#3b82f6',
		rest: '#6b7280',
		brick: '#8b5cf6'
	};
</script>

<div class="page">
	<header class="page-header">
		<a href="/coach/goals" class="back-link">Back to Goals</a>
		<div class="header-content">
			<span class="event-icon">{eventIcons[data.goal.eventType] || '🎯'}</span>
			<div>
				<h1>{data.goal.name}</h1>
				<p class="event-date">{formatEventDate(data.goal.eventDate)}</p>
			</div>
		</div>
	</header>

	<div class="goal-stats">
		<div class="stat">
			<span class="stat-value">{getWeeksUntil(data.goal.eventDate)}</span>
			<span class="stat-label">Weeks to go</span>
		</div>
		<div class="stat">
			<span class="stat-value">{formatDistance(data.goal.distance)}</span>
			<span class="stat-label">Distance</span>
		</div>
		<div class="stat">
			<span class="stat-value">{formatTime(data.goal.targetTime)}</span>
			<span class="stat-label">Target Time</span>
		</div>
		{#if data.activePlan}
			<div class="stat">
				<span class="stat-value">{data.adherence.percentage}%</span>
				<span class="stat-label">Adherence</span>
			</div>
		{/if}
	</div>

	{#if data.goal.notes}
		<div class="notes-section">
			<h3>Notes</h3>
			<p>{data.goal.notes}</p>
		</div>
	{/if}

	{#if !data.activePlan}
		<div class="no-plan">
			<div class="no-plan-icon">📋</div>
			<h2>No Training Plan Yet</h2>
			<p>Generate an AI-powered training plan tailored to your goal and current fitness level.</p>
			{#if generateError}
				<div class="error-message">{generateError}</div>
			{/if}
			<button class="btn btn-primary btn-large" onclick={generatePlan} disabled={generating}>
				{generating ? 'Generating Plan...' : 'Generate Training Plan'}
			</button>
		</div>
	{:else}
		<div class="plan-section">
			<div class="plan-header">
				<div class="plan-title">
					<h2>Training Plan</h2>
					<span class="plan-version">v{data.activePlan.version}</span>
				</div>
				<button class="btn btn-secondary btn-small" onclick={() => (showRegenerateModal = true)}>
					Regenerate Plan
				</button>
			</div>

			{#if generateError}
				<div class="error-message">{generateError}</div>
			{/if}

			<div class="adherence-bar">
				<div class="adherence-progress" style="width: {data.adherence.percentage}%"></div>
			</div>
			<div class="adherence-stats">
				<span class="completed">{data.adherence.completed} completed</span>
				<span class="skipped">{data.adherence.skipped} skipped</span>
				<span class="remaining">{data.adherence.remaining} remaining</span>
			</div>

			<div class="workouts-list">
				{#each data.workouts as workout}
					{@const isPast = new Date(workout.date) < new Date(new Date().toDateString())}
					{@const isToday = workout.date === new Date().toISOString().split('T')[0]}
					<div
						class="workout-item"
						class:completed={workout.completed}
						class:skipped={workout.skipped}
						class:today={isToday}
						class:past={isPast && !workout.completed && !workout.skipped}
					>
						<div class="workout-date">
							<span class="date-text">{formatWorkoutDate(workout.date)}</span>
							{#if isToday}
								<span class="today-badge">Today</span>
							{/if}
						</div>
						<div
							class="workout-type-indicator"
							style="background-color: {workoutTypeColors[workout.workoutType || ''] || '#6b7280'}"
						></div>
						<div class="workout-info">
							<span class="workout-type">{workout.workoutType || 'Workout'}</span>
							<span class="workout-description">{workout.description}</span>
							<div class="workout-meta">
								{#if workout.duration}
									<span>{formatDuration(workout.duration)}</span>
								{/if}
								{#if workout.distance}
									<span>{formatDistance(workout.distance)}</span>
								{/if}
								{#if workout.targetRpe}
									<span>RPE {workout.targetRpe}</span>
								{/if}
							</div>
						</div>
						<div class="workout-status">
							{#if workout.completed}
								<span class="status-icon completed-icon">✓</span>
							{:else if workout.skipped}
								<span class="status-icon skipped-icon">✗</span>
							{:else if isPast}
								<span class="status-icon missed-icon">!</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		{#if data.plans.length > 1}
			<div class="plan-history">
				<h3>Plan History</h3>
				{#each data.plans as plan}
					<div class="plan-history-item" class:active={plan.status === 'active'}>
						<span>v{plan.version}</span>
						<span class="plan-date">
							{new Date(plan.generatedAt || '').toLocaleDateString()}
						</span>
						{#if plan.regenerateReason}
							<span class="regenerate-reason">{plan.regenerateReason}</span>
						{/if}
						{#if plan.status === 'active'}
							<span class="active-badge">Active</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if showRegenerateModal}
	<div class="modal-overlay" onclick={() => (showRegenerateModal = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h3>Regenerate Training Plan</h3>
			<p>
				This will create a new version of your training plan based on your current adherence
				({data.adherence.percentage}% completed) and remaining time until your event.
			</p>
			<div class="form-group">
				<label for="reason">Reason for regeneration (optional)</label>
				<textarea
					id="reason"
					bind:value={regenerateReason}
					placeholder="e.g., Missed training due to injury, Want to increase intensity..."
					rows="3"
				></textarea>
			</div>
			<div class="modal-actions">
				<button class="btn btn-secondary" onclick={() => (showRegenerateModal = false)}>
					Cancel
				</button>
				<button class="btn btn-primary" onclick={regeneratePlan} disabled={regenerating}>
					{regenerating ? 'Regenerating...' : 'Regenerate Plan'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.back-link {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		text-decoration: none;
		display: inline-block;
		margin-bottom: 1rem;
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.event-icon {
		font-size: 3rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0;
	}

	.event-date {
		margin: 0.25rem 0 0;
		color: var(--color-text-secondary);
	}

	.goal-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat {
		background: var(--color-bg-secondary);
		padding: 1.25rem;
		border-radius: var(--radius-lg);
		text-align: center;
		border: 1px solid var(--color-border);
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.notes-section {
		background: var(--color-bg-secondary);
		padding: 1rem;
		border-radius: var(--radius);
		margin-bottom: 2rem;
		border: 1px solid var(--color-border);
	}

	.notes-section h3 {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.notes-section p {
		margin: 0;
	}

	.no-plan {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.no-plan-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.no-plan h2 {
		margin: 0 0 0.5rem;
	}

	.no-plan p {
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
		border: none;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.125rem;
	}

	.plan-section {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		margin-bottom: 2rem;
	}

	.plan-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.plan-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.plan-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}

	.btn-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-border);
	}

	.btn-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.plan-version {
		background: var(--color-bg-tertiary);
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.adherence-bar {
		height: 8px;
		background: var(--color-bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.adherence-progress {
		height: 100%;
		background: var(--color-primary);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.adherence-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.adherence-stats .completed {
		color: #22c55e;
	}

	.adherence-stats .skipped {
		color: #f59e0b;
	}

	.adherence-stats .remaining {
		color: var(--color-text-secondary);
	}

	.workouts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.workout-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
	}

	.workout-item.today {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.workout-item.completed {
		opacity: 0.7;
	}

	.workout-item.skipped {
		opacity: 0.5;
	}

	.workout-item.past {
		border-color: #f59e0b;
	}

	.workout-date {
		min-width: 80px;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.date-text {
		display: block;
	}

	.today-badge {
		font-size: 0.625rem;
		background: var(--color-primary);
		color: white;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		text-transform: uppercase;
		font-weight: 600;
	}

	.workout-type-indicator {
		width: 4px;
		height: 40px;
		border-radius: 2px;
	}

	.workout-info {
		flex: 1;
	}

	.workout-type {
		display: block;
		font-weight: 600;
		text-transform: capitalize;
		font-size: 0.875rem;
	}

	.workout-description {
		display: block;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.workout-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.workout-status {
		width: 24px;
		text-align: center;
	}

	.status-icon {
		font-size: 1rem;
		font-weight: 700;
	}

	.completed-icon {
		color: #22c55e;
	}

	.skipped-icon {
		color: #f59e0b;
	}

	.missed-icon {
		color: #ef4444;
	}

	.plan-history {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
	}

	.plan-history h3 {
		margin: 0 0 1rem;
		font-size: 1rem;
	}

	.plan-history-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem;
		font-size: 0.875rem;
	}

	.plan-history-item.active {
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
	}

	.plan-date {
		color: var(--color-text-secondary);
	}

	.regenerate-reason {
		flex: 1;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.active-badge {
		background: var(--color-primary);
		color: white;
		padding: 0.125rem 0.5rem;
		border-radius: var(--radius);
		font-size: 0.75rem;
		font-weight: 500;
	}

	@media (max-width: 600px) {
		.goal-stats {
			grid-template-columns: repeat(2, 1fr);
		}

		.workout-item {
			flex-wrap: wrap;
		}

		.workout-date {
			min-width: 100%;
			margin-bottom: -0.5rem;
		}

		.plan-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
	}

	/* Modal styles */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		max-width: 500px;
		width: 100%;
		border: 1px solid var(--color-border);
	}

	.modal h3 {
		margin: 0 0 0.75rem;
		font-size: 1.25rem;
	}

	.modal p {
		margin: 0 0 1rem;
		color: var(--color-text-secondary);
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 0.875rem;
		resize: vertical;
	}

	.form-group textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>

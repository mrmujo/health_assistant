<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let updating = $state<number | null>(null);
	let syncing = $state(false);
	let syncMessage = $state('');

	const eventIcons: Record<string, string> = {
		running: '🏃',
		cycling: '🚴',
		swimming: '🏊',
		triathlon: '🏆'
	};

	const workoutTypeColors: Record<string, string> = {
		easy: '#22c55e',
		recovery: '#22c55e',
		tempo: '#f59e0b',
		intervals: '#ef4444',
		long: '#3b82f6',
		rest: '#6b7280',
		brick: '#8b5cf6',
		hills: '#f97316',
		technique: '#06b6d4'
	};

	function formatDistance(meters: number | null): string {
		if (!meters) return '';
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(1)}km`;
		}
		return `${meters}m`;
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

	function formatTime(seconds: number | null): string {
		if (!seconds) return '';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) {
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		}
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function getWeeksUntil(dateStr: string): number {
		const eventDate = new Date(dateStr);
		const today = new Date();
		const diffTime = eventDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.ceil(diffDays / 7);
	}

	function getDayName(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { weekday: 'short' });
	}

	function isToday(dateStr: string): boolean {
		return dateStr === data.today;
	}

	function isPast(dateStr: string): boolean {
		return dateStr < data.today;
	}

	async function updateWorkout(workoutId: number, action: 'complete' | 'skip' | 'reset') {
		updating = workoutId;
		try {
			const res = await fetch(`/api/coach/workouts/${workoutId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});

			const result = await res.json();
			if (result.success) {
				// Update local state
				const todayIdx = data.todayWorkouts.findIndex((w) => w.id === workoutId);
				if (todayIdx >= 0) {
					if (action === 'complete') {
						data.todayWorkouts[todayIdx].completed = 1;
						data.todayWorkouts[todayIdx].skipped = 0;
					} else if (action === 'skip') {
						data.todayWorkouts[todayIdx].skipped = 1;
						data.todayWorkouts[todayIdx].completed = 0;
					} else {
						data.todayWorkouts[todayIdx].completed = 0;
						data.todayWorkouts[todayIdx].skipped = 0;
					}
				}

				const weekIdx = data.weekWorkouts.findIndex((w) => w.id === workoutId);
				if (weekIdx >= 0) {
					if (action === 'complete') {
						data.weekWorkouts[weekIdx].completed = 1;
						data.weekWorkouts[weekIdx].skipped = 0;
					} else if (action === 'skip') {
						data.weekWorkouts[weekIdx].skipped = 1;
						data.weekWorkouts[weekIdx].completed = 0;
					} else {
						data.weekWorkouts[weekIdx].completed = 0;
						data.weekWorkouts[weekIdx].skipped = 0;
					}
				}

				// Trigger reactivity
				data.todayWorkouts = [...data.todayWorkouts];
				data.weekWorkouts = [...data.weekWorkouts];
			}
		} catch (e) {
			console.error('Failed to update workout', e);
		} finally {
			updating = null;
		}
	}

	async function syncActivities() {
		syncing = true;
		syncMessage = '';
		try {
			const res = await fetch('/api/coach/sync-activities', { method: 'POST' });
			const result = await res.json();
			if (result.success) {
				syncMessage = `Synced! ${result.data.matched} workouts matched.`;
				// Reload page to show updated data
				setTimeout(() => window.location.reload(), 1500);
			} else {
				syncMessage = result.error || 'Sync failed';
			}
		} catch (e) {
			syncMessage = 'Sync failed';
		} finally {
			syncing = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<h1>Training Coach</h1>
		<div class="header-actions">
			<a href="/coach/chat" class="btn btn-secondary">Chat with Coach</a>
			<a href="/coach/plan" class="btn btn-secondary">View Full Plan</a>
			<button class="btn btn-secondary" onclick={syncActivities} disabled={syncing}>
				{syncing ? 'Syncing...' : 'Sync'}
			</button>
			<a href="/coach/goals" class="btn btn-primary">Goals</a>
		</div>
	</header>

	{#if syncMessage}
		<div class="sync-message" class:success={syncMessage.includes('Synced')}>
			{syncMessage}
		</div>
	{/if}

	{#if data.activeGoals.length === 0}
		<div class="empty-state">
			<div class="empty-icon">🎯</div>
			<h2>No Active Goals</h2>
			<p>Set a training goal to get started with AI-powered coaching.</p>
			<a href="/coach/goals/new" class="btn btn-primary">Create Goal</a>
		</div>
	{:else}
		<!-- Today's Workout -->
		<section class="section">
			<h2 class="section-title">Today's Workout</h2>
			{#if data.todayWorkouts.length === 0}
				<div class="rest-day">
					<span class="rest-icon">😴</span>
					<p>Rest day! No workouts scheduled for today.</p>
				</div>
			{:else}
				{#each data.todayWorkouts as workout}
					<div
						class="today-workout"
						class:completed={workout.completed}
						class:skipped={workout.skipped}
					>
						<div
							class="workout-type-bar"
							style="background-color: {workoutTypeColors[workout.workoutType || ''] || '#6b7280'}"
						></div>
						<div class="workout-content">
							<div class="workout-header">
								<span class="workout-type">{workout.workoutType || 'Workout'}</span>
								{#if workout.targetRpe}
									<span class="rpe-badge">RPE {workout.targetRpe}</span>
								{/if}
							</div>
							<p class="workout-description">{workout.description}</p>
							<div class="workout-meta">
								{#if workout.duration}
									<span>⏱️ {formatDuration(workout.duration)}</span>
								{/if}
								{#if workout.distance}
									<span>📏 {formatDistance(workout.distance)}</span>
								{/if}
								{#if workout.activityType}
									<span class="activity-type">{eventIcons[workout.activityType] || ''} {workout.activityType}</span>
								{/if}
							</div>
							{#if workout.notes}
								<p class="workout-notes">{workout.notes}</p>
							{/if}
							<div class="workout-actions">
								{#if workout.completed}
									<span class="status completed">Completed</span>
									<button
										class="btn btn-small btn-ghost"
										onclick={() => updateWorkout(workout.id, 'reset')}
										disabled={updating === workout.id}
									>
										Undo
									</button>
								{:else if workout.skipped}
									<span class="status skipped">Skipped</span>
									<button
										class="btn btn-small btn-ghost"
										onclick={() => updateWorkout(workout.id, 'reset')}
										disabled={updating === workout.id}
									>
										Undo
									</button>
								{:else}
									<button
										class="btn btn-small btn-success"
										onclick={() => updateWorkout(workout.id, 'complete')}
										disabled={updating === workout.id}
									>
										{updating === workout.id ? '...' : 'Mark Complete'}
									</button>
									<button
										class="btn btn-small btn-warning"
										onclick={() => updateWorkout(workout.id, 'skip')}
										disabled={updating === workout.id}
									>
										Skip
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Active Goal -->
		{#each data.activeGoals as goal}
			{@const weeks = getWeeksUntil(goal.eventDate)}
			<section class="section goal-section">
				<div class="goal-card">
					<span class="goal-icon">{eventIcons[goal.eventType] || '🎯'}</span>
					<div class="goal-info">
						<h3>{goal.name}</h3>
						<p class="goal-details">
							{#if goal.distance}
								{formatDistance(goal.distance)}
							{/if}
							{#if goal.targetTime}
								in {formatTime(goal.targetTime)}
							{/if}
						</p>
					</div>
					<div class="goal-countdown">
						<span class="weeks-number">{weeks}</span>
						<span class="weeks-label">weeks</span>
					</div>
				</div>
				<div class="goal-actions">
					<a href="/coach/goals/{goal.id}" class="btn btn-small">View Plan</a>
				</div>
			</section>
		{/each}

		<!-- This Week -->
		<section class="section">
			<h2 class="section-title">This Week</h2>
			<div class="week-grid">
				{#each data.weekWorkouts as workout}
					<div
						class="week-day"
						class:today={isToday(workout.date)}
						class:past={isPast(workout.date)}
						class:completed={workout.completed}
						class:skipped={workout.skipped}
					>
						<div class="day-header">
							<span class="day-name">{getDayName(workout.date)}</span>
							{#if isToday(workout.date)}
								<span class="today-indicator">Today</span>
							{/if}
						</div>
						<div
							class="day-type"
							style="border-left-color: {workoutTypeColors[workout.workoutType || ''] || '#6b7280'}"
						>
							<span class="type-name">{workout.workoutType || 'Workout'}</span>
							{#if workout.duration}
								<span class="type-duration">{formatDuration(workout.duration)}</span>
							{/if}
						</div>
						{#if workout.completed}
							<span class="day-status completed">✓</span>
						{:else if workout.skipped}
							<span class="day-status skipped">✗</span>
						{:else if isPast(workout.date)}
							<span class="day-status missed">!</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
		border: none;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.btn-secondary {
		background: var(--color-bg-secondary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-bg-tertiary);
	}

	.btn-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.btn-success {
		background: #22c55e;
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background: #16a34a;
	}

	.btn-warning {
		background: #f59e0b;
		color: white;
	}

	.btn-warning:hover:not(:disabled) {
		background: #d97706;
	}

	.btn-ghost {
		background: transparent;
		color: var(--color-text-secondary);
	}

	.btn-ghost:hover {
		background: var(--color-bg-tertiary);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.sync-message {
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.sync-message.success {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h2 {
		margin: 0 0 0.5rem;
	}

	.empty-state p {
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
	}

	.section {
		margin-bottom: 2rem;
	}

	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 1rem;
	}

	.rest-day {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.rest-icon {
		font-size: 2rem;
	}

	.rest-day p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.today-workout {
		display: flex;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.today-workout.completed {
		opacity: 0.7;
	}

	.today-workout.skipped {
		opacity: 0.5;
	}

	.workout-type-bar {
		width: 6px;
		flex-shrink: 0;
	}

	.workout-content {
		flex: 1;
		padding: 1.5rem;
	}

	.workout-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.workout-type {
		font-size: 1.25rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.rpe-badge {
		background: var(--color-bg-tertiary);
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.workout-description {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}

	.workout-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.activity-type {
		text-transform: capitalize;
	}

	.workout-notes {
		background: var(--color-bg);
		padding: 0.75rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin: 0 0 1rem;
		border-left: 3px solid var(--color-primary);
	}

	.workout-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status {
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius);
	}

	.status.completed {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.status.skipped {
		background: rgba(245, 158, 11, 0.1);
		color: #f59e0b;
	}

	.goal-section {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
	}

	.goal-card {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.goal-icon {
		font-size: 2.5rem;
	}

	.goal-info {
		flex: 1;
	}

	.goal-info h3 {
		margin: 0;
		font-size: 1.125rem;
	}

	.goal-details {
		margin: 0.25rem 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.goal-countdown {
		text-align: center;
	}

	.weeks-number {
		display: block;
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
		line-height: 1;
	}

	.weeks-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
	}

	.goal-actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.week-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.5rem;
	}

	.week-day {
		background: var(--color-bg-secondary);
		border-radius: var(--radius);
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		position: relative;
	}

	.week-day.today {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.week-day.past:not(.completed):not(.skipped) {
		border-color: #f59e0b;
	}

	.week-day.completed {
		opacity: 0.7;
	}

	.week-day.skipped {
		opacity: 0.5;
	}

	.day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.day-name {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.today-indicator {
		font-size: 0.625rem;
		background: var(--color-primary);
		color: white;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		text-transform: uppercase;
		font-weight: 600;
	}

	.day-type {
		border-left: 3px solid;
		padding-left: 0.5rem;
	}

	.type-name {
		display: block;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.type-duration {
		display: block;
		font-size: 0.625rem;
		color: var(--color-text-secondary);
	}

	.day-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.day-status.completed {
		color: #22c55e;
	}

	.day-status.skipped {
		color: #f59e0b;
	}

	.day-status.missed {
		color: #ef4444;
	}

	@media (max-width: 600px) {
		.page-header {
			flex-direction: column;
			align-items: stretch;
		}

		.header-actions {
			justify-content: stretch;
		}

		.header-actions .btn {
			flex: 1;
			justify-content: center;
		}

		.week-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.goal-card {
			flex-wrap: wrap;
		}

		.goal-countdown {
			width: 100%;
			text-align: left;
			margin-top: 0.5rem;
			display: flex;
			align-items: baseline;
			gap: 0.5rem;
		}

		.weeks-number {
			font-size: 1.5rem;
		}
	}
</style>

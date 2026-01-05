<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleting = $state<number | null>(null);

	const eventIcons: Record<string, string> = {
		running: '🏃',
		cycling: '🚴',
		swimming: '🏊',
		triathlon: '🏆'
	};

	function formatDistance(meters: number | null): string {
		if (!meters) return '';
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(1)}km`;
		}
		return `${meters}m`;
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

	function formatEventDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function deleteGoal(id: number) {
		if (!confirm('Are you sure you want to delete this goal? This will also delete any associated training plans.')) {
			return;
		}

		deleting = id;
		try {
			const res = await fetch(`/api/coach/goals/${id}`, { method: 'DELETE' });
			const result = await res.json();
			if (result.success) {
				data.goals = data.goals.filter((g) => g.id !== id);
			}
		} catch (e) {
			console.error('Failed to delete goal', e);
		} finally {
			deleting = null;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div>
			<a href="/coach" class="back-link">Back to Coach</a>
			<h1>Training Goals</h1>
		</div>
		<a href="/coach/goals/new" class="btn btn-primary">New Goal</a>
	</header>

	{#if data.goals.length === 0}
		<div class="empty-state">
			<div class="empty-icon">🎯</div>
			<h2>No goals yet</h2>
			<p>Create your first training goal to get started with AI coaching.</p>
			<a href="/coach/goals/new" class="btn btn-primary">Create Goal</a>
		</div>
	{:else}
		<div class="goals-list">
			{#each data.goals as goal}
				<div class="goal-card" class:completed={goal.status === 'completed'} class:cancelled={goal.status === 'cancelled'}>
					<div class="goal-header">
						<span class="event-icon">{eventIcons[goal.eventType] || '🎯'}</span>
						<div class="goal-info">
							<h3>{goal.name}</h3>
							<p class="event-date">{formatEventDate(goal.eventDate)}</p>
						</div>
						{#if goal.status === 'active'}
							{@const weeks = getWeeksUntil(goal.eventDate)}
							<span class="weeks-badge" class:urgent={weeks <= 2} class:soon={weeks <= 4 && weeks > 2}>
								{weeks > 0 ? `${weeks} weeks` : 'Past due'}
							</span>
						{:else}
							<span class="status-badge" class:completed={goal.status === 'completed'}>
								{goal.status}
							</span>
						{/if}
					</div>

					<div class="goal-details">
						{#if goal.distance}
							<div class="detail">
								<span class="detail-label">Distance</span>
								<span class="detail-value">{formatDistance(goal.distance)}</span>
							</div>
						{/if}
						{#if goal.targetTime}
							<div class="detail">
								<span class="detail-label">Target Time</span>
								<span class="detail-value">{formatTime(goal.targetTime)}</span>
							</div>
						{/if}
						<div class="detail">
							<span class="detail-label">Type</span>
							<span class="detail-value capitalize">{goal.eventType}</span>
						</div>
					</div>

					{#if goal.notes}
						<p class="goal-notes">{goal.notes}</p>
					{/if}

					<div class="goal-actions">
						<a href="/coach/goals/{goal.id}" class="btn btn-small">View Details</a>
						<button
							class="btn btn-small btn-danger"
							onclick={() => deleteGoal(goal.id)}
							disabled={deleting === goal.id}
						>
							{deleting === goal.id ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</div>
			{/each}
		</div>
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
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.back-link {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		text-decoration: none;
		display: inline-block;
		margin-bottom: 0.5rem;
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 600;
		margin: 0;
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

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.btn-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		background: var(--color-bg-tertiary);
		color: var(--color-text);
	}

	.btn-small:hover {
		background: var(--color-border);
	}

	.btn-danger {
		color: #ef4444;
	}

	.btn-danger:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		font-size: 1.25rem;
	}

	.empty-state p {
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
	}

	.goals-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.goal-card {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
	}

	.goal-card.completed {
		opacity: 0.7;
	}

	.goal-card.cancelled {
		opacity: 0.5;
	}

	.goal-header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.event-icon {
		font-size: 2rem;
	}

	.goal-info {
		flex: 1;
	}

	.goal-info h3 {
		margin: 0 0 0.25rem;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.event-date {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.weeks-badge {
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius);
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
	}

	.weeks-badge.soon {
		background: rgba(234, 179, 8, 0.2);
		color: #ca8a04;
	}

	.weeks-badge.urgent {
		background: rgba(239, 68, 68, 0.2);
		color: #dc2626;
	}

	.status-badge {
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius);
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
		text-transform: capitalize;
	}

	.status-badge.completed {
		background: rgba(34, 197, 94, 0.2);
		color: #16a34a;
	}

	.goal-details {
		display: flex;
		gap: 2rem;
		margin-bottom: 1rem;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.detail-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-value {
		font-weight: 600;
	}

	.capitalize {
		text-transform: capitalize;
	}

	.goal-notes {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin: 0 0 1rem;
		padding: 0.75rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	.goal-actions {
		display: flex;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	@media (max-width: 480px) {
		.page-header {
			flex-direction: column;
			gap: 1rem;
		}

		.goal-details {
			flex-wrap: wrap;
			gap: 1rem;
		}
	}
</style>

<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let viewMode = $state<'week' | 'month'>('week');
	let currentWeekIndex = $state(0);
	let currentMonthKey = $state(Object.keys(data.weeksByMonth)[0] || '');

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

	const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
			return `${h}h${m > 0 ? ` ${m}m` : ''}`;
		}
		return `${m}m`;
	}

	function formatWeekRange(weekStart: string): string {
		const start = new Date(weekStart);
		const end = new Date(start);
		end.setDate(end.getDate() + 6);

		const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
		const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

		if (startMonth === endMonth) {
			return `${startMonth} ${start.getDate()}-${end.getDate()}`;
		}
		return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
	}

	function formatMonthName(monthKey: string): string {
		const [year, month] = monthKey.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1, 1);
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	function getWeekNumber(weekStart: string): number {
		return data.weeks.indexOf(weekStart) + 1;
	}

	function isToday(dateStr: string): boolean {
		return dateStr === new Date().toISOString().split('T')[0];
	}

	function isPast(dateStr: string): boolean {
		return dateStr < new Date().toISOString().split('T')[0];
	}

	function isCurrentWeek(weekStart: string): boolean {
		const today = new Date();
		const day = today.getDay();
		const diff = today.getDate() - day + (day === 0 ? -6 : 1);
		const currentMonday = new Date(today);
		currentMonday.setDate(diff);
		return weekStart === currentMonday.toISOString().split('T')[0];
	}

	function getWorkoutsForDay(weekStart: string, dayIndex: number) {
		const date = new Date(weekStart);
		date.setDate(date.getDate() + dayIndex);
		const dateStr = date.toISOString().split('T')[0];
		return (data.workoutsByWeek[weekStart] || []).filter((w) => w.date === dateStr);
	}

	function getWeekStats(weekStart: string) {
		const workouts = data.workoutsByWeek[weekStart] || [];
		const completed = workouts.filter((w) => w.completed).length;
		const total = workouts.filter((w) => w.workoutType !== 'rest').length;
		const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);
		const totalDistance = workouts.reduce((sum, w) => sum + (w.distance || 0), 0);

		return { completed, total, totalDuration, totalDistance };
	}

	function getPhaseForWeek(weekStart: string): string {
		// Try to determine phase from plan data
		if (data.activePlan?.planData) {
			try {
				const planData = JSON.parse(data.activePlan.planData);
				const weekNum = getWeekNumber(weekStart);
				const week = planData.weeks?.find((w: any) => w.weekNumber === weekNum);
				return week?.phase || '';
			} catch {
				return '';
			}
		}
		return '';
	}

	function goToPreviousWeek() {
		if (currentWeekIndex > 0) {
			currentWeekIndex--;
		}
	}

	function goToNextWeek() {
		if (currentWeekIndex < data.weeks.length - 1) {
			currentWeekIndex++;
		}
	}

	function goToCurrentWeek() {
		const today = new Date();
		const day = today.getDay();
		const diff = today.getDate() - day + (day === 0 ? -6 : 1);
		const currentMonday = new Date(today);
		currentMonday.setDate(diff);
		const currentWeekStr = currentMonday.toISOString().split('T')[0];
		const index = data.weeks.indexOf(currentWeekStr);
		if (index >= 0) {
			currentWeekIndex = index;
		}
	}

	// Initialize to current week
	$effect(() => {
		goToCurrentWeek();
	});

	const months = $derived(Object.keys(data.weeksByMonth).sort());
</script>

<div class="page">
	<header class="page-header">
		<div>
			<a href="/coach" class="back-link">Back to Coach</a>
			<h1>Training Plan</h1>
		</div>
		<div class="header-actions">
			{#if data.activeGoals.length > 1}
				<select
					class="goal-select"
					value={data.selectedGoal.id}
					onchange={(e) => {
						window.location.href = `/coach/plan?goal=${e.currentTarget.value}`;
					}}
				>
					{#each data.activeGoals as goal}
						<option value={goal.id}>{goal.name}</option>
					{/each}
				</select>
			{/if}
			<div class="view-toggle">
				<button
					class="toggle-btn"
					class:active={viewMode === 'week'}
					onclick={() => (viewMode = 'week')}
				>
					Week
				</button>
				<button
					class="toggle-btn"
					class:active={viewMode === 'month'}
					onclick={() => (viewMode = 'month')}
				>
					Month
				</button>
			</div>
		</div>
	</header>

	{#if !data.activePlan}
		<div class="empty-state">
			<p>No training plan found for this goal.</p>
			<a href="/coach/goals/{data.selectedGoal.id}" class="btn btn-primary">
				Generate Plan
			</a>
		</div>
	{:else}
		<div class="goal-banner">
			<span class="goal-icon">{eventIcons[data.selectedGoal.eventType] || '🎯'}</span>
			<div class="goal-info">
				<strong>{data.selectedGoal.name}</strong>
				<span class="goal-date">
					{new Date(data.selectedGoal.eventDate).toLocaleDateString('en-US', {
						month: 'long',
						day: 'numeric',
						year: 'numeric'
					})}
				</span>
			</div>
			<a href="/coach/chat?goal={data.selectedGoal.id}" class="btn btn-secondary btn-small">
				Chat with Coach
			</a>
		</div>

		{#if viewMode === 'week'}
			<!-- Week View -->
			<div class="week-navigation">
				<button class="nav-btn" onclick={goToPreviousWeek} disabled={currentWeekIndex === 0}>
					←
				</button>
				<div class="week-info">
					<span class="week-number">Week {currentWeekIndex + 1} of {data.weeks.length}</span>
					<span class="week-dates">{formatWeekRange(data.weeks[currentWeekIndex])}</span>
					{#if getPhaseForWeek(data.weeks[currentWeekIndex])}
						<span class="week-phase">{getPhaseForWeek(data.weeks[currentWeekIndex])}</span>
					{/if}
				</div>
				<button
					class="nav-btn"
					onclick={goToNextWeek}
					disabled={currentWeekIndex === data.weeks.length - 1}
				>
					→
				</button>
			</div>

			<button class="today-btn" onclick={goToCurrentWeek}>Go to Current Week</button>

			{#if data.weeks[currentWeekIndex]}
			{@const weekStart = data.weeks[currentWeekIndex]}
			{@const stats = getWeekStats(weekStart)}

			<div class="week-stats">
				<div class="stat">
					<span class="stat-value">{stats.completed}/{stats.total}</span>
					<span class="stat-label">Workouts</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatDuration(stats.totalDuration)}</span>
					<span class="stat-label">Duration</span>
				</div>
				<div class="stat">
					<span class="stat-value">{formatDistance(stats.totalDistance)}</span>
					<span class="stat-label">Distance</span>
				</div>
			</div>

			<div class="week-grid">
				{#each dayNames as day, i}
					{@const workouts = getWorkoutsForDay(weekStart, i)}
					{@const date = new Date(weekStart)}
					{@const _ = date.setDate(date.getDate() + i)}
					{@const dateStr = date.toISOString().split('T')[0]}
					<div
						class="day-column"
						class:today={isToday(dateStr)}
						class:past={isPast(dateStr)}
					>
						<div class="day-header">
							<span class="day-name">{day}</span>
							<span class="day-date">{date.getDate()}</span>
						</div>
						<div class="day-workouts">
							{#if workouts.length === 0}
								<div class="rest-indicator">Rest</div>
							{:else}
								{#each workouts as workout}
									<div
										class="workout-card"
										class:completed={workout.completed}
										class:skipped={workout.skipped}
										style="border-left-color: {workoutTypeColors[workout.workoutType || ''] || '#6b7280'}"
									>
										<div class="workout-type">{workout.workoutType}</div>
										<div class="workout-desc">{workout.description}</div>
										<div class="workout-meta">
											{#if workout.duration}
												<span>{formatDuration(workout.duration)}</span>
											{/if}
											{#if workout.targetRpe}
												<span>RPE {workout.targetRpe}</span>
											{/if}
										</div>
										{#if workout.completed}
											<span class="status-badge completed">✓</span>
										{:else if workout.skipped}
											<span class="status-badge skipped">✗</span>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
			{/if}
		{:else}
			<!-- Month View -->
			<div class="month-navigation">
				<select class="month-select" bind:value={currentMonthKey}>
					{#each months as month}
						<option value={month}>{formatMonthName(month)}</option>
					{/each}
				</select>
			</div>

			<div class="month-view">
				{#each data.weeksByMonth[currentMonthKey] || [] as weekStart}
					{@const stats = getWeekStats(weekStart)}
					{@const phase = getPhaseForWeek(weekStart)}
					<div
						class="month-week"
						class:current={isCurrentWeek(weekStart)}
						onclick={() => {
							currentWeekIndex = data.weeks.indexOf(weekStart);
							viewMode = 'week';
						}}
					>
						<div class="month-week-header">
							<span class="month-week-num">Week {getWeekNumber(weekStart)}</span>
							<span class="month-week-dates">{formatWeekRange(weekStart)}</span>
							{#if phase}
								<span class="phase-badge">{phase}</span>
							{/if}
						</div>
						<div class="month-week-days">
							{#each dayNames as day, i}
								{@const workouts = getWorkoutsForDay(weekStart, i)}
								{@const date = new Date(weekStart)}
								{@const _ = date.setDate(date.getDate() + i)}
								{@const dateStr = date.toISOString().split('T')[0]}
								<div
									class="month-day"
									class:today={isToday(dateStr)}
									class:has-workout={workouts.length > 0 && workouts[0].workoutType !== 'rest'}
								>
									<span class="month-day-name">{day[0]}</span>
									{#if workouts.length > 0 && workouts[0].workoutType !== 'rest'}
										<div
											class="month-workout-indicator"
											class:completed={workouts[0].completed}
											class:skipped={workouts[0].skipped}
											style="background-color: {workoutTypeColors[workouts[0].workoutType || ''] || '#6b7280'}"
										></div>
									{:else}
										<div class="month-rest-indicator"></div>
									{/if}
								</div>
							{/each}
						</div>
						<div class="month-week-stats">
							<span>{stats.completed}/{stats.total} done</span>
							<span>{formatDuration(stats.totalDuration)}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
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

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.goal-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.view-toggle {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		border: none;
		background: var(--color-bg-secondary);
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.toggle-btn:first-child {
		border-right: 1px solid var(--color-border);
	}

	.toggle-btn.active {
		background: var(--color-primary);
		color: white;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		border: none;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-small {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
	}

	.goal-banner {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		margin-bottom: 1.5rem;
	}

	.goal-icon {
		font-size: 2rem;
	}

	.goal-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.goal-date {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	/* Week View */
	.week-navigation {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		margin-bottom: 1rem;
	}

	.nav-btn {
		width: 40px;
		height: 40px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		cursor: pointer;
		font-size: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.nav-btn:hover:not(:disabled) {
		background: var(--color-bg-tertiary);
	}

	.week-info {
		text-align: center;
	}

	.week-number {
		display: block;
		font-weight: 600;
		font-size: 1.125rem;
	}

	.week-dates {
		display: block;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.week-phase {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0.125rem 0.5rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.today-btn {
		display: block;
		margin: 0 auto 1.5rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.today-btn:hover {
		background: var(--color-bg-tertiary);
	}

	.week-stats {
		display: flex;
		justify-content: center;
		gap: 2rem;
		margin-bottom: 1.5rem;
	}

	.stat {
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
	}

	.week-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 0.5rem;
	}

	.day-column {
		background: var(--color-bg-secondary);
		border-radius: var(--radius);
		border: 1px solid var(--color-border);
		min-height: 200px;
	}

	.day-column.today {
		border-color: var(--color-primary);
	}

	.day-column.past {
		opacity: 0.7;
	}

	.day-header {
		padding: 0.75rem;
		text-align: center;
		border-bottom: 1px solid var(--color-border);
	}

	.day-name {
		display: block;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.day-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.day-workouts {
		padding: 0.5rem;
	}

	.rest-indicator {
		text-align: center;
		padding: 1rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.workout-card {
		padding: 0.5rem;
		background: var(--color-bg);
		border-radius: var(--radius);
		border-left: 3px solid;
		margin-bottom: 0.5rem;
		position: relative;
	}

	.workout-card.completed {
		opacity: 0.7;
	}

	.workout-card.skipped {
		opacity: 0.5;
	}

	.workout-type {
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.workout-desc {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin: 0.25rem 0;
	}

	.workout-meta {
		font-size: 0.625rem;
		color: var(--color-text-secondary);
		display: flex;
		gap: 0.5rem;
	}

	.status-badge {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.status-badge.completed {
		color: #22c55e;
	}

	.status-badge.skipped {
		color: #f59e0b;
	}

	/* Month View */
	.month-navigation {
		margin-bottom: 1.5rem;
	}

	.month-select {
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 1rem;
		width: 100%;
		max-width: 300px;
	}

	.month-view {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.month-week {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1rem;
		border: 1px solid var(--color-border);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.month-week:hover {
		border-color: var(--color-primary);
	}

	.month-week.current {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.month-week-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.month-week-num {
		font-weight: 600;
	}

	.month-week-dates {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.phase-badge {
		padding: 0.125rem 0.5rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.month-week-days {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.month-day {
		flex: 1;
		text-align: center;
		padding: 0.5rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	.month-day.today {
		border: 2px solid var(--color-primary);
	}

	.month-day-name {
		display: block;
		font-size: 0.625rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.25rem;
	}

	.month-workout-indicator {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		margin: 0 auto;
	}

	.month-workout-indicator.completed {
		opacity: 0.5;
	}

	.month-workout-indicator.skipped {
		opacity: 0.3;
	}

	.month-rest-indicator {
		width: 24px;
		height: 24px;
		margin: 0 auto;
	}

	.month-week-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	@media (max-width: 768px) {
		.week-grid {
			grid-template-columns: 1fr;
		}

		.day-column {
			min-height: auto;
		}

		.day-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}

		.day-workouts {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.workout-card {
			flex: 1;
			min-width: 120px;
		}

		.month-week-days {
			overflow-x: auto;
		}

		.month-day {
			min-width: 40px;
		}
	}
</style>

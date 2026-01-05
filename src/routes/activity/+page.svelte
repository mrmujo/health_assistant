<script lang="ts">
	import type { PageData } from './$types';
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';

	let { data } = $props();

	let expandedDays = $state<Set<string>>(new Set());
	let activitiesCache = $state<Record<string, any[]>>(data.activitiesByDate || {});
	let loadingActivities = $state<Set<string>>(new Set());

	// Helper to get manual activities from rpeByDate
	function getManualActivities(date: string): any[] {
		const rpeEntries = data.rpeByDate[date] || [];
		return rpeEntries.filter((entry: any) => entry.activityId?.startsWith('manual_'));
	}

	// Prefetch activities for all dates in the background on page load
	onMount(() => {
		const allDates = data.activityData.map((day: any) => day.date);
		const uncachedDates = allDates.filter((date: string) => !activitiesCache[date]);

		if (uncachedDates.length === 0) return;

		// Use batch endpoint to fetch all uncached dates in a single API call
		const prefetchActivities = async () => {
			try {
				const startDate = uncachedDates[uncachedDates.length - 1]; // oldest
				const endDate = uncachedDates[0]; // newest
				const res = await fetch(`/api/activities/batch?start=${startDate}&end=${endDate}`);
				const result = await res.json();
				if (result.success && result.data) {
					// Merge fetched activities into cache
					for (const [date, acts] of Object.entries(result.data)) {
						activitiesCache[date] = acts as any[];
					}
					activitiesCache = { ...activitiesCache };
				}
			} catch (e) {
				console.error('Failed to prefetch activities', e);
			}
		};

		prefetchActivities();
	});

	// RPE Modal state
	let showRpeModal = $state(false);
	let rpeModalData = $state<{
		date: string;
		activityId?: string;
		activityType: string;
		activityName?: string;
		duration?: number;
	} | null>(null);
	let selectedRpe = $state(5);
	let rpeNote = $state('');
	let savingRpe = $state(false);

	// Manual Activity Modal state
	let showActivityModal = $state(false);
	let activityDate = $state(new Date().toISOString().split('T')[0]);
	let activityType = $state('running');
	let activityName = $state('');
	let activityDurationHours = $state(0);
	let activityDurationMins = $state(30);
	let activityDistance = $state<number | null>(null);
	let activityRpe = $state(5);
	let activityNote = $state('');
	let savingActivity = $state(false);

	// Check if activity type supports distance
	let activitySupportsDistance = $derived(() => {
		return ['running', 'cycling', 'swimming'].includes(activityType);
	});

	// Get current scales for selected activity type (RPE modal)
	let currentScales = $derived(() => {
		if (!rpeModalData) return [];
		const type = normalizeActivityType(rpeModalData.activityType);
		return data.scalesByType[type] || data.scalesByType['running'] || [];
	});

	// Get description for current RPE value (RPE modal)
	let currentRpeDescription = $derived(() => {
		const scales = currentScales();
		const scale = scales.find((s: any) => s.rpeValue === selectedRpe);
		return scale ? `${scale.name}: ${scale.description}` : '';
	});

	// Get scales for manual activity modal
	let manualActivityScales = $derived(() => {
		const type = normalizeActivityType(activityType);
		return data.scalesByType[type] || data.scalesByType['running'] || [];
	});

	// Get description for manual activity RPE
	let manualActivityRpeDescription = $derived(() => {
		const scales = manualActivityScales();
		const scale = scales.find((s: any) => s.rpeValue === activityRpe);
		return scale ? `${scale.name}: ${scale.description}` : '';
	});

	function normalizeActivityType(type: string): string {
		const normalized = type.toLowerCase().trim();
		const mappings: Record<string, string> = {
			run: 'running', running: 'running', trail_running: 'running', treadmill_running: 'running',
			cycle: 'cycling', cycling: 'cycling', biking: 'cycling', indoor_cycling: 'cycling',
			swim: 'swimming', swimming: 'swimming', lap_swimming: 'swimming', open_water_swimming: 'swimming',
			strength: 'strength', strength_training: 'strength', weight_training: 'strength', gym: 'strength',
			yoga: 'yoga', pilates: 'yoga'
		};
		return mappings[normalized] || 'running';
	}

	function openRpeModal(date: string, activity?: any) {
		rpeModalData = {
			date,
			activityId: activity?.activityId,
			activityType: activity?.activityType || 'running',
			activityName: activity?.activityName,
			duration: activity?.duration
		};
		selectedRpe = 5;
		rpeNote = '';
		showRpeModal = true;
	}

	async function saveRpe() {
		if (!rpeModalData) return;
		savingRpe = true;

		try {
			const res = await fetch('/api/rpe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: rpeModalData.date,
					activityId: rpeModalData.activityId,
					activityType: rpeModalData.activityType,
					activityName: rpeModalData.activityName,
					duration: rpeModalData.duration,
					rpe: selectedRpe,
					note: rpeNote || null
				})
			});

			if (res.ok) {
				showRpeModal = false;
				rpeModalData = null;
				await invalidateAll();
			}
		} catch (e) {
			console.error('Failed to save RPE', e);
		} finally {
			savingRpe = false;
		}
	}

	function getRpeColor(rpe: number): string {
		if (rpe <= 3) return '#22c55e';
		if (rpe <= 5) return '#84cc16';
		if (rpe <= 7) return '#eab308';
		if (rpe <= 8) return '#f97316';
		return '#ef4444';
	}

	function openActivityModal() {
		activityDate = new Date().toISOString().split('T')[0];
		activityType = 'running';
		activityName = '';
		activityDurationHours = 0;
		activityDurationMins = 30;
		activityDistance = null;
		activityRpe = 5;
		activityNote = '';
		showActivityModal = true;
	}

	async function saveManualActivity() {
		savingActivity = true;

		try {
			const durationSeconds = (activityDurationHours * 3600) + (activityDurationMins * 60);
			const distanceMeters = activityDistance ? activityDistance * 1000 : null;
			const res = await fetch('/api/rpe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: activityDate,
					activityId: `manual_${Date.now()}`,
					activityType: activityType,
					activityName: activityName || getDefaultActivityName(activityType),
					duration: durationSeconds,
					distance: distanceMeters,
					rpe: activityRpe,
					note: activityNote || null
				})
			});

			if (res.ok) {
				showActivityModal = false;
				await invalidateAll();
			}
		} catch (e) {
			console.error('Failed to save activity', e);
		} finally {
			savingActivity = false;
		}
	}

	function getDefaultActivityName(type: string): string {
		const names: Record<string, string> = {
			running: 'Run',
			cycling: 'Ride',
			swimming: 'Swim',
			strength: 'Strength Training',
			yoga: 'Yoga Session'
		};
		return names[type] || 'Workout';
	}

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
		<div class="page-header-content">
			<div>
				<h1>Activity</h1>
				<p>Your daily activity, heart rate, and body battery</p>
			</div>
			<button class="btn btn-primary" onclick={openActivityModal}>
				+ Add Activity
			</button>
		</div>
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
								{#if data.rpeSummaryByDate[day.date]}
									{@const summary = data.rpeSummaryByDate[day.date]}
									<div class="rpe-summary" style="--rpe-color: {getRpeColor(summary.avgRpe)}">
										<span class="rpe-badge">RPE {summary.avgRpe}</span>
										<span class="fatigue-badge">Fatigue {summary.totalFatigue}</span>
									</div>
								{/if}
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
							{@const manualActivities = getManualActivities(day.date)}
							<div class="activities-detail">
								{#if isLoading}
									<p class="loading">Loading activities...</p>
								{:else if activities.length > 0 || manualActivities.length > 0}
									<div class="activities-list">
										{#each activities as activity}
											<div class="activity-item">
												<div class="activity-item-header">
													<span class="activity-icon">{getActivityIcon(activity.activityType)}</span>
													<span class="activity-name">{activity.activityName || activity.activityType}</span>
													{#if data.rpeByDate[day.date]?.find((r: any) => r.activityId === activity.activityId)}
														{@const rpeEntry = data.rpeByDate[day.date].find((r: any) => r.activityId === activity.activityId)}
														<span class="rpe-indicator" style="background: {getRpeColor(rpeEntry.rpe)}20; color: {getRpeColor(rpeEntry.rpe)}">
															RPE {rpeEntry.rpe}
														</span>
													{:else}
														<button class="btn-add-rpe" onclick={() => openRpeModal(day.date, activity)} title="Add RPE">
															+RPE
														</button>
													{/if}
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
										{#each manualActivities as manual}
											<div class="activity-item manual-activity">
												<div class="activity-item-header">
													<span class="activity-icon">{getActivityIcon(manual.activityType)}</span>
													<span class="activity-name">{manual.activityName || manual.activityType}</span>
													<span class="manual-badge">Manual</span>
													<span class="rpe-indicator" style="background: {getRpeColor(manual.rpe)}20; color: {getRpeColor(manual.rpe)}">
														RPE {manual.rpe}
													</span>
												</div>
												<div class="activity-item-stats">
													{#if manual.duration}
														<span>⏱️ {formatDuration(manual.duration)}</span>
													{/if}
													{#if manual.distance}
														<span>📏 {formatDistance(manual.distance)}</span>
													{/if}
													{#if manual.note}
														<span>📝 {manual.note}</span>
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

	{#if showRpeModal && rpeModalData}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-overlay" onclick={() => showRpeModal = false} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<div class="modal-header">
					<h3>Add RPE Rating</h3>
					<button class="modal-close" onclick={() => showRpeModal = false}>&times;</button>
				</div>
				<div class="modal-body">
					{#if rpeModalData.activityName}
						<p class="modal-activity-name">{rpeModalData.activityName}</p>
					{/if}
					<p class="modal-date">{new Date(rpeModalData.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

					<div class="rpe-slider-container">
						<label for="rpe-slider">Rate of Perceived Exertion</label>
						<div class="rpe-slider-row">
							<input
								type="range"
								id="rpe-slider"
								min="0"
								max="10"
								step="1"
								bind:value={selectedRpe}
								class="rpe-slider"
								style="--rpe-color: {getRpeColor(selectedRpe)}"
							/>
							<span class="rpe-value" style="color: {getRpeColor(selectedRpe)}">{selectedRpe}</span>
						</div>
						<p class="rpe-description">{currentRpeDescription()}</p>
					</div>

					<div class="rpe-note-container">
						<label for="rpe-note">Notes (optional)</label>
						<textarea
							id="rpe-note"
							bind:value={rpeNote}
							placeholder="How did this session feel? Any observations..."
							rows="3"
						></textarea>
					</div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" onclick={() => showRpeModal = false}>Cancel</button>
					<button class="btn btn-primary" onclick={saveRpe} disabled={savingRpe}>
						{savingRpe ? 'Saving...' : 'Save RPE'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showActivityModal}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-overlay" onclick={() => showActivityModal = false} role="presentation">
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="modal modal-wide" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<div class="modal-header">
					<h3>Add Manual Activity</h3>
					<button class="modal-close" onclick={() => showActivityModal = false}>&times;</button>
				</div>
				<div class="modal-body">
					<div class="form-row">
						<div class="form-group">
							<label for="activity-date">Date</label>
							<input type="date" id="activity-date" bind:value={activityDate} class="form-input" />
						</div>
						<div class="form-group">
							<label for="activity-type">Activity Type</label>
							<select id="activity-type" bind:value={activityType} class="form-input">
								<option value="running">Running</option>
								<option value="cycling">Cycling</option>
								<option value="swimming">Swimming</option>
								<option value="strength">Strength Training</option>
								<option value="yoga">Yoga</option>
							</select>
						</div>
					</div>

					<div class="form-group">
						<label for="activity-name">Activity Name (optional)</label>
						<input type="text" id="activity-name" bind:value={activityName} class="form-input" placeholder={getDefaultActivityName(activityType)} />
					</div>

					<div class="form-row">
						<div class="form-group">
							<label>Duration</label>
							<div class="duration-inputs">
								<div class="duration-input">
									<input type="number" min="0" max="24" bind:value={activityDurationHours} class="form-input" />
									<span>hours</span>
								</div>
								<div class="duration-input">
									<input type="number" min="0" max="59" bind:value={activityDurationMins} class="form-input" />
									<span>mins</span>
								</div>
							</div>
						</div>

						{#if activitySupportsDistance()}
							<div class="form-group">
								<label for="activity-distance">Distance (optional)</label>
								<div class="distance-input">
									<input type="number" id="activity-distance" min="0" step="0.1" bind:value={activityDistance} class="form-input" placeholder="0.0" />
									<span>km</span>
								</div>
							</div>
						{/if}
					</div>

					<div class="rpe-slider-container">
						<label for="activity-rpe-slider">Rate of Perceived Exertion</label>
						<div class="rpe-slider-row">
							<input
								type="range"
								id="activity-rpe-slider"
								min="0"
								max="10"
								step="1"
								bind:value={activityRpe}
								class="rpe-slider"
								style="--rpe-color: {getRpeColor(activityRpe)}"
							/>
							<span class="rpe-value" style="color: {getRpeColor(activityRpe)}">{activityRpe}</span>
						</div>
						<p class="rpe-description">{manualActivityRpeDescription()}</p>
					</div>

					<div class="form-group">
						<label for="activity-note">Notes (optional)</label>
						<textarea
							id="activity-note"
							bind:value={activityNote}
							class="form-input"
							placeholder="How did this session feel?"
							rows="2"
						></textarea>
					</div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" onclick={() => showActivityModal = false}>Cancel</button>
					<button class="btn btn-primary" onclick={saveManualActivity} disabled={savingActivity}>
						{savingActivity ? 'Saving...' : 'Save Activity'}
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

	.page-header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
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

	/* RPE Styles */
	.rpe-summary {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.rpe-badge, .fatigue-badge {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius);
	}

	.rpe-badge {
		background: var(--rpe-color, #84cc16)20;
		color: var(--rpe-color, #84cc16);
	}

	.fatigue-badge {
		background: var(--color-bg-secondary);
		color: var(--color-text-secondary);
	}

	.btn-rpe {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-primary);
		transition: all 0.15s ease;
	}

	.btn-rpe:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.btn-add-rpe {
		background: none;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		padding: 0.125rem 0.375rem;
		cursor: pointer;
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
		transition: all 0.15s ease;
	}

	.btn-add-rpe:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.rpe-indicator {
		font-size: 0.6875rem;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius);
	}

	.manual-badge {
		font-size: 0.625rem;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius);
		background: var(--color-primary)20;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.manual-activity {
		border-left: 3px solid var(--color-primary);
	}

	/* Modal Styles */
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

	.modal-activity-name {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.modal-date {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.rpe-slider-container {
		margin-bottom: 1.5rem;
	}

	.rpe-slider-container label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.75rem;
	}

	.rpe-slider-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.rpe-slider {
		flex: 1;
		height: 8px;
		-webkit-appearance: none;
		background: var(--color-bg-tertiary);
		border-radius: 4px;
		outline: none;
	}

	.rpe-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--rpe-color, #84cc16);
		cursor: pointer;
		border: 3px solid var(--color-bg);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.rpe-slider::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--rpe-color, #84cc16);
		cursor: pointer;
		border: 3px solid var(--color-bg);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.rpe-value {
		font-size: 1.5rem;
		font-weight: 700;
		min-width: 2rem;
		text-align: center;
	}

	.rpe-description {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		min-height: 1.25rem;
	}

	.rpe-note-container label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.rpe-note-container textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 0.875rem;
		resize: vertical;
		font-family: inherit;
	}

	.rpe-note-container textarea:focus {
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

	@media (max-width: 640px) {
		.activity-day-actions {
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.rpe-summary {
			order: 10;
			width: 100%;
			margin-top: 0.5rem;
		}

		.page-header-content {
			flex-direction: column;
		}
	}

	/* Form styles for manual activity modal */
	.modal-wide {
		max-width: 500px;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
	}

	.form-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.form-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	select.form-input {
		cursor: pointer;
	}

	textarea.form-input {
		resize: vertical;
		min-height: 60px;
	}

	.duration-inputs {
		display: flex;
		gap: 1rem;
	}

	.duration-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.duration-input input {
		width: 70px;
	}

	.duration-input span {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.distance-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.distance-input input {
		flex: 1;
	}

	.distance-input span {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	@media (max-width: 480px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>

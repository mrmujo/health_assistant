<script lang="ts">
	import { goto } from '$app/navigation';

	let name = $state('');
	let eventDate = $state('');
	let eventType = $state('running');
	let distance = $state('');
	let targetHours = $state('');
	let targetMinutes = $state('');
	let targetSeconds = $state('');
	let notes = $state('');
	let saving = $state(false);
	let error = $state('');

	const eventTypes = [
		{ value: 'running', label: 'Running', icon: '🏃' },
		{ value: 'cycling', label: 'Cycling', icon: '🚴' },
		{ value: 'swimming', label: 'Swimming', icon: '🏊' },
		{ value: 'triathlon', label: 'Triathlon', icon: '🏆' }
	];

	const distancePresets: Record<string, { label: string; meters: number }[]> = {
		running: [
			{ label: '5K', meters: 5000 },
			{ label: '10K', meters: 10000 },
			{ label: 'Half Marathon', meters: 21097.5 },
			{ label: 'Marathon', meters: 42195 }
		],
		cycling: [
			{ label: '50km', meters: 50000 },
			{ label: '100km', meters: 100000 },
			{ label: '160km (Century)', meters: 160000 }
		],
		swimming: [
			{ label: '1500m', meters: 1500 },
			{ label: '3000m', meters: 3000 },
			{ label: '5000m', meters: 5000 }
		],
		triathlon: [
			{ label: 'Sprint (750m/20km/5km)', meters: 25750 },
			{ label: 'Olympic (1.5km/40km/10km)', meters: 51500 },
			{ label: 'Half Ironman', meters: 113000 },
			{ label: 'Ironman', meters: 226000 }
		]
	};

	function selectPreset(meters: number) {
		distance = String(meters);
	}

	function formatDistanceDisplay(meters: number): string {
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(1)}km`;
		}
		return `${meters}m`;
	}

	async function handleSubmit() {
		error = '';

		if (!name.trim()) {
			error = 'Please enter a name for your goal';
			return;
		}

		if (!eventDate) {
			error = 'Please select an event date';
			return;
		}

		// Calculate target time in seconds
		let targetTime: number | null = null;
		if (targetHours || targetMinutes || targetSeconds) {
			targetTime =
				(parseInt(targetHours) || 0) * 3600 +
				(parseInt(targetMinutes) || 0) * 60 +
				(parseInt(targetSeconds) || 0);
		}

		saving = true;
		try {
			const res = await fetch('/api/coach/goals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					eventDate,
					eventType,
					distance: distance ? parseFloat(distance) : null,
					targetTime,
					notes: notes.trim() || null
				})
			});

			const result = await res.json();
			if (result.success) {
				goto('/coach/goals');
			} else {
				error = result.error || 'Failed to create goal';
			}
		} catch (e) {
			error = 'Failed to create goal';
		} finally {
			saving = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<a href="/coach/goals" class="back-link">Back to Goals</a>
		<h1>New Training Goal</h1>
	</header>

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="form">
		{#if error}
			<div class="error-message">{error}</div>
		{/if}

		<div class="form-group">
			<label for="name">Goal Name</label>
			<input
				type="text"
				id="name"
				bind:value={name}
				placeholder="e.g., Spring Marathon 2024"
				class="input"
			/>
		</div>

		<div class="form-group">
			<label for="eventDate">Event Date</label>
			<input type="date" id="eventDate" bind:value={eventDate} class="input" />
		</div>

		<div class="form-group">
			<label>Event Type</label>
			<div class="event-types">
				{#each eventTypes as type}
					<button
						type="button"
						class="event-type-btn"
						class:selected={eventType === type.value}
						onclick={() => (eventType = type.value)}
					>
						<span class="event-icon">{type.icon}</span>
						<span>{type.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="form-group">
			<label>Distance</label>
			<div class="distance-presets">
				{#each distancePresets[eventType] || [] as preset}
					<button
						type="button"
						class="preset-btn"
						class:selected={distance === String(preset.meters)}
						onclick={() => selectPreset(preset.meters)}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			<div class="custom-distance">
				<input
					type="number"
					bind:value={distance}
					placeholder="Custom distance in meters"
					class="input"
				/>
				{#if distance}
					<span class="distance-display">{formatDistanceDisplay(parseFloat(distance))}</span>
				{/if}
			</div>
		</div>

		<div class="form-group">
			<label>Target Time (optional)</label>
			<div class="time-inputs">
				<div class="time-input-group">
					<input
						type="number"
						bind:value={targetHours}
						placeholder="0"
						min="0"
						max="99"
						class="input time-input"
					/>
					<span class="time-label">hours</span>
				</div>
				<div class="time-input-group">
					<input
						type="number"
						bind:value={targetMinutes}
						placeholder="0"
						min="0"
						max="59"
						class="input time-input"
					/>
					<span class="time-label">min</span>
				</div>
				<div class="time-input-group">
					<input
						type="number"
						bind:value={targetSeconds}
						placeholder="0"
						min="0"
						max="59"
						class="input time-input"
					/>
					<span class="time-label">sec</span>
				</div>
			</div>
		</div>

		<div class="form-group">
			<label for="notes">Notes (optional)</label>
			<textarea
				id="notes"
				bind:value={notes}
				placeholder="Any additional notes about your goal..."
				class="input textarea"
				rows="3"
			></textarea>
		</div>

		<div class="form-actions">
			<a href="/coach/goals" class="btn btn-secondary">Cancel</a>
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Creating...' : 'Create Goal'}
			</button>
		</div>
	</form>
</div>

<style>
	.page {
		max-width: 600px;
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

	.form {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		border: 1px solid var(--color-border);
	}

	.error-message {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--color-text);
	}

	.input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 1rem;
	}

	.input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.textarea {
		resize: vertical;
		min-height: 80px;
	}

	.event-types {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	.event-type-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.event-type-btn:hover {
		border-color: var(--color-primary);
	}

	.event-type-btn.selected {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.1);
	}

	.event-icon {
		font-size: 1.5rem;
	}

	.distance-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.preset-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.preset-btn:hover {
		border-color: var(--color-primary);
	}

	.preset-btn.selected {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.1);
		color: var(--color-primary);
	}

	.custom-distance {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.custom-distance .input {
		flex: 1;
	}

	.distance-display {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		white-space: nowrap;
	}

	.time-inputs {
		display: flex;
		gap: 1rem;
	}

	.time-input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.time-input {
		width: 70px;
		text-align: center;
	}

	.time-label {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: var(--radius);
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		border: none;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.btn-secondary:hover {
		background: var(--color-bg-tertiary);
	}

	@media (max-width: 480px) {
		.event-types {
			grid-template-columns: 1fr;
		}

		.time-inputs {
			flex-wrap: wrap;
		}
	}
</style>

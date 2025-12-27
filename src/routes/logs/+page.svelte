<script lang="ts">
	import type { PageData } from './$types';

	let { data } = $props();

	let activeTab = $state<'food' | 'medication' | 'notes'>('food');
	let showForm = $state(false);

	// Food form
	let foodDescription = $state('');
	let foodMealType = $state('snack');
	let foodCalories = $state('');
	let foodTime = $state('');

	// Medication form
	let medName = $state('');
	let medDosage = $state('');
	let medUnit = $state('mg');
	let medTime = $state('');

	// Notes form
	let noteContent = $state('');
	let noteCategory = $state('other');

	let saving = $state(false);

	async function saveFood() {
		saving = true;
		try {
			await fetch('/api/logs/food', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: foodDescription,
					mealType: foodMealType,
					calories: foodCalories ? parseInt(foodCalories) : null,
					time: foodTime || null,
					date: new Date().toISOString().split('T')[0]
				})
			});
			foodDescription = '';
			foodCalories = '';
			foodTime = '';
			showForm = false;
			window.location.reload();
		} finally {
			saving = false;
		}
	}

	async function saveMedication() {
		saving = true;
		try {
			await fetch('/api/logs/medication', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					medicationName: medName,
					dosage: medDosage,
					unit: medUnit,
					time: medTime || null,
					date: new Date().toISOString().split('T')[0]
				})
			});
			medName = '';
			medDosage = '';
			medTime = '';
			showForm = false;
			window.location.reload();
		} finally {
			saving = false;
		}
	}

	async function saveNote() {
		saving = true;
		try {
			await fetch('/api/logs/notes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: noteContent,
					category: noteCategory,
					date: new Date().toISOString().split('T')[0]
				})
			});
			noteContent = '';
			showForm = false;
			window.location.reload();
		} finally {
			saving = false;
		}
	}

	async function deleteLog(type: string, id: number) {
		if (!confirm('Delete this entry?')) return;
		await fetch(`/api/logs/${type}?id=${id}`, { method: 'DELETE' });
		window.location.reload();
	}
</script>

<svelte:head>
	<title>Health Logs | Health Assistant</title>
</svelte:head>

<div class="logs-page">
	<header class="page-header">
		<h1>Health Logs</h1>
		<button class="btn btn-primary" onclick={() => showForm = !showForm}>
			{showForm ? 'Cancel' : '+ Add Entry'}
		</button>
	</header>

	<div class="tabs">
		<button class="tab" class:active={activeTab === 'food'} onclick={() => activeTab = 'food'}>
			Food
		</button>
		<button class="tab" class:active={activeTab === 'medication'} onclick={() => activeTab = 'medication'}>
			Medication
		</button>
		<button class="tab" class:active={activeTab === 'notes'} onclick={() => activeTab = 'notes'}>
			Notes
		</button>
	</div>

	{#if showForm}
		<div class="card form-card">
			{#if activeTab === 'food'}
				<h3>Log Food</h3>
				<form onsubmit={(e) => { e.preventDefault(); saveFood(); }}>
					<div class="form-group">
						<label class="form-label">What did you eat?</label>
						<input class="input" bind:value={foodDescription} placeholder="e.g., Grilled chicken salad" required />
					</div>
					<div class="form-row">
						<div class="form-group">
							<label class="form-label">Meal</label>
							<select class="input" bind:value={foodMealType}>
								<option value="breakfast">Breakfast</option>
								<option value="lunch">Lunch</option>
								<option value="dinner">Dinner</option>
								<option value="snack">Snack</option>
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">Calories (optional)</label>
							<input class="input" type="number" bind:value={foodCalories} placeholder="500" />
						</div>
						<div class="form-group">
							<label class="form-label">Time (optional)</label>
							<input class="input" type="time" bind:value={foodTime} />
						</div>
					</div>
					<button type="submit" class="btn btn-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</form>
			{:else if activeTab === 'medication'}
				<h3>Log Medication</h3>
				<form onsubmit={(e) => { e.preventDefault(); saveMedication(); }}>
					<div class="form-group">
						<label class="form-label">Medication name</label>
						<input class="input" bind:value={medName} placeholder="e.g., Vitamin D" required />
					</div>
					<div class="form-row">
						<div class="form-group">
							<label class="form-label">Dosage</label>
							<input class="input" bind:value={medDosage} placeholder="e.g., 1000" />
						</div>
						<div class="form-group">
							<label class="form-label">Unit</label>
							<select class="input" bind:value={medUnit}>
								<option value="mg">mg</option>
								<option value="mcg">mcg</option>
								<option value="ml">ml</option>
								<option value="tablets">tablets</option>
								<option value="drops">drops</option>
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">Time (optional)</label>
							<input class="input" type="time" bind:value={medTime} />
						</div>
					</div>
					<button type="submit" class="btn btn-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</form>
			{:else}
				<h3>Add Note</h3>
				<form onsubmit={(e) => { e.preventDefault(); saveNote(); }}>
					<div class="form-group">
						<label class="form-label">Category</label>
						<select class="input" bind:value={noteCategory}>
							<option value="mood">Mood</option>
							<option value="symptoms">Symptoms</option>
							<option value="exercise">Exercise</option>
							<option value="other">Other</option>
						</select>
					</div>
					<div class="form-group">
						<label class="form-label">Note</label>
						<textarea class="input" rows="3" bind:value={noteContent} placeholder="How are you feeling?" required></textarea>
					</div>
					<button type="submit" class="btn btn-primary" disabled={saving}>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</form>
			{/if}
		</div>
	{/if}

	<div class="logs-list">
		{#if activeTab === 'food'}
			{#if data.foodLogs.length > 0}
				{#each data.foodLogs as log}
					<div class="log-entry card">
						<div class="log-header">
							<span class="log-type">{log.mealType}</span>
							<span class="log-date">{log.date} {log.time || ''}</span>
						</div>
						<div class="log-content">{log.description}</div>
						{#if log.calories}
							<div class="log-meta">{log.calories} cal</div>
						{/if}
						<button class="delete-btn" onclick={() => deleteLog('food', log.id)}>Delete</button>
					</div>
				{/each}
			{:else}
				<p class="empty">No food logs yet</p>
			{/if}
		{:else if activeTab === 'medication'}
			{#if data.medicationLogs.length > 0}
				{#each data.medicationLogs as log}
					<div class="log-entry card">
						<div class="log-header">
							<span class="log-type">{log.medicationName}</span>
							<span class="log-date">{log.date} {log.time || ''}</span>
						</div>
						{#if log.dosage}
							<div class="log-meta">{log.dosage} {log.unit}</div>
						{/if}
						<button class="delete-btn" onclick={() => deleteLog('medication', log.id)}>Delete</button>
					</div>
				{/each}
			{:else}
				<p class="empty">No medication logs yet</p>
			{/if}
		{:else}
			{#if data.healthNotes.length > 0}
				{#each data.healthNotes as note}
					<div class="log-entry card">
						<div class="log-header">
							<span class="log-type">{note.category}</span>
							<span class="log-date">{note.date}</span>
						</div>
						<div class="log-content">{note.content}</div>
						<button class="delete-btn" onclick={() => deleteLog('notes', note.id)}>Delete</button>
					</div>
				{/each}
			{:else}
				<p class="empty">No notes yet</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.tab {
		padding: 0.625rem 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		background: var(--color-bg-tertiary);
	}

	.tab.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.form-card {
		margin-bottom: 1.5rem;
	}

	.form-card h3 {
		margin-bottom: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.logs-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.log-entry {
		position: relative;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.log-type {
		font-weight: 600;
		text-transform: capitalize;
	}

	.log-date {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.log-content {
		margin-bottom: 0.5rem;
	}

	.log-meta {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.delete-btn {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: none;
		color: var(--color-error);
		font-size: 0.8125rem;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.log-entry:hover .delete-btn {
		opacity: 1;
	}

	.empty {
		text-align: center;
		color: var(--color-text-secondary);
		padding: 3rem;
	}

	@media (max-width: 640px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>

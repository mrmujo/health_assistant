<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getAISettings, saveAISettings, type AISettings } from '$lib/ai';
	import { cryptoStore } from '$lib/crypto';

	let { data } = $props();

	// Check if running in local mode (passed from layout)
	const isLocalMode = data.isLocalMode;

	let garminEmail = $state('');
	let garminPassword = $state('');
	let authLoading = $state(false);
	let authError = $state('');
	let authSuccess = $state('');

	let syncLoading = $state(false);
	let syncDays = $state(7);
	let syncResult = $state('');

	let aiProvider = $state<'anthropic' | 'openai' | 'ollama'>('anthropic');
	let openaiKey = $state('');
	let anthropicKey = $state('');
	let ollamaEndpoint = $state('');
	let ollamaModel = $state('');
	let keysSaving = $state(false);
	let keysSuccess = $state('');
	let cryptoReady = $state(false);
	let aiSettingsLoaded = $state(false);

	// Storage helpers - use localStorage as fallback when encryption not set up
	function getLocalSettings(): AISettings | null {
		try {
			const stored = localStorage.getItem('ai-settings');
			return stored ? JSON.parse(stored) : null;
		} catch {
			return null;
		}
	}

	function saveLocalSettings(settings: AISettings): void {
		localStorage.setItem('ai-settings', JSON.stringify(settings));
	}

	onMount(async () => {
		if (isLocalMode) {
			// Local mode: use localStorage directly
			cryptoReady = true;
			const settings = getLocalSettings();
			if (settings) {
				aiProvider = settings.provider;
				openaiKey = settings.openaiKey || '';
				anthropicKey = settings.anthropicKey || '';
				ollamaEndpoint = settings.ollamaEndpoint || '';
				ollamaModel = settings.ollamaModel || '';
			}
		} else {
			// Production mode: check for encryption, fallback to localStorage
			await cryptoStore.init();
			cryptoReady = cryptoStore.isUnlocked();

			if (cryptoReady) {
				const settings = await getAISettings();
				if (settings) {
					aiProvider = settings.provider;
					openaiKey = settings.openaiKey || '';
					anthropicKey = settings.anthropicKey || '';
					ollamaEndpoint = settings.ollamaEndpoint || '';
					ollamaModel = settings.ollamaModel || '';
				}
			} else {
				// Fallback to localStorage if encryption not set up
				const settings = getLocalSettings();
				if (settings) {
					aiProvider = settings.provider;
					openaiKey = settings.openaiKey || '';
					anthropicKey = settings.anthropicKey || '';
					ollamaEndpoint = settings.ollamaEndpoint || '';
					ollamaModel = settings.ollamaModel || '';
				}
			}
		}
		aiSettingsLoaded = true;
	});

	async function authenticateGarmin() {
		authLoading = true;
		authError = '';
		authSuccess = '';

		try {
			const res = await fetch('/api/garmin/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: garminEmail, password: garminPassword })
			});

			const result = await res.json();

			if (result.success) {
				authSuccess = 'Successfully connected to Garmin!';
				garminPassword = '';
				// Reload to update auth status
				window.location.reload();
			} else {
				authError = result.error || 'Authentication failed';
			}
		} catch (e) {
			authError = 'Failed to connect to server';
		} finally {
			authLoading = false;
		}
	}

	async function syncData() {
		syncLoading = true;
		syncResult = '';

		try {
			const res = await fetch('/api/garmin/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ days: syncDays })
			});

			const result = await res.json();

			if (result.success) {
				syncResult = `Synced ${result.synced} records successfully!`;
				if (result.errors?.length) {
					syncResult += ` (${result.errors.length} warnings)`;
				}
			} else {
				syncResult = `Error: ${result.error || 'Sync failed'}`;
			}
		} catch (e) {
			syncResult = 'Failed to sync data';
		} finally {
			syncLoading = false;
		}
	}

	async function saveAiSettingsHandler() {
		keysSaving = true;
		keysSuccess = '';

		try {
			const settings: AISettings = {
				provider: aiProvider,
				anthropicKey: anthropicKey || undefined,
				openaiKey: openaiKey || undefined,
				ollamaEndpoint: ollamaEndpoint || undefined,
				ollamaModel: ollamaModel || undefined
			};

			if (isLocalMode) {
				saveLocalSettings(settings);
				keysSuccess = 'AI settings saved locally';
			} else if (cryptoReady) {
				await saveAISettings(settings);
				keysSuccess = 'AI settings saved (encrypted)';
			} else {
				// No encryption set up - use localStorage
				saveLocalSettings(settings);
				keysSuccess = 'AI settings saved locally (enable encryption for extra security)';
			}
		} catch (e) {
			keysSuccess = 'Failed to save settings';
		} finally {
			keysSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Settings | Health Assistant</title>
</svelte:head>

<div class="settings">
	<h1>Settings</h1>

	<section class="card">
		<div class="card-header">
			<h2 class="card-title">Garmin Connect</h2>
			{#if data.garminConnected}
				<span class="badge badge-success">Connected</span>
			{:else}
				<span class="badge badge-warning">Not connected</span>
			{/if}
		</div>

		{#if !data.garminConnected}
			<form onsubmit={(e) => { e.preventDefault(); authenticateGarmin(); }} class="auth-form">
				<div class="form-group">
					<label class="form-label" for="garmin-email">Garmin Email</label>
					<input
						type="email"
						id="garmin-email"
						class="input"
						bind:value={garminEmail}
						placeholder="your@email.com"
						required
					/>
				</div>
				<div class="form-group">
					<label class="form-label" for="garmin-password">Garmin Password</label>
					<input
						type="password"
						id="garmin-password"
						class="input"
						bind:value={garminPassword}
						placeholder="••••••••"
						required
					/>
				</div>
				{#if authError}
					<p class="error-message">{authError}</p>
				{/if}
				{#if authSuccess}
					<p class="success-message">{authSuccess}</p>
				{/if}
				<button type="submit" class="btn btn-primary" disabled={authLoading}>
					{authLoading ? 'Connecting...' : 'Connect Garmin'}
				</button>
			</form>
			<p class="info-text">
				Your credentials are only used to obtain OAuth tokens. They are not stored.
			</p>
		{:else}
			<div class="sync-section">
				<p>Sync your Garmin data to get the latest health metrics.</p>
				<div class="sync-controls">
					<div class="form-group">
						<label class="form-label" for="sync-days">Days to sync</label>
						<select id="sync-days" class="input" bind:value={syncDays}>
							<option value={1}>Last 1 day</option>
							<option value={7}>Last 7 days</option>
							<option value={14}>Last 14 days</option>
							<option value={30}>Last 30 days</option>
						</select>
					</div>
					<button class="btn btn-primary" onclick={syncData} disabled={syncLoading}>
						{syncLoading ? 'Syncing...' : 'Sync Now'}
					</button>
				</div>
				{#if syncResult}
					<p class="sync-result">{syncResult}</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if !isLocalMode}
		<section class="card">
			<div class="card-header">
				<h2 class="card-title">Encryption</h2>
				{#if cryptoReady}
					<span class="badge badge-success">Enabled</span>
				{:else}
					<span class="badge badge-secondary">Not set up</span>
				{/if}
			</div>

			{#if cryptoReady}
				<p class="info-text">
					Your AI API keys are encrypted with your personal recovery phrase.
					Only you can decrypt them.
				</p>
			{:else}
				<div class="encryption-info">
					<p>Add an extra layer of security by encrypting sensitive data with a recovery phrase only you control.</p>
					<ul>
						<li>Your AI API keys will be encrypted locally</li>
						<li>24-word recovery phrase backs up your encryption key</li>
						<li>We never see your encryption key or unencrypted data</li>
					</ul>
					<button class="btn btn-secondary" onclick={() => goto('/setup')}>
						Set Up Encryption
					</button>
				</div>
			{/if}
		</section>
	{/if}

	<section class="card">
		<div class="card-header">
			<h2 class="card-title">AI Provider</h2>
		</div>

		<div class="form-group">
			<label class="form-label">Select AI Provider</label>
			<div class="provider-options">
				<label class="provider-option">
					<input type="radio" name="provider" value="anthropic" bind:group={aiProvider} />
					<span class="provider-label">
						<strong>Claude (Anthropic)</strong>
						<small>Great for analysis and nuanced responses</small>
					</span>
				</label>
				<label class="provider-option">
					<input type="radio" name="provider" value="openai" bind:group={aiProvider} />
					<span class="provider-label">
						<strong>GPT-4 (OpenAI)</strong>
						<small>Widely used, good reasoning</small>
					</span>
				</label>
				<label class="provider-option">
					<input type="radio" name="provider" value="ollama" bind:group={aiProvider} />
					<span class="provider-label">
						<strong>Ollama (Local)</strong>
						<small>Run models locally, no API key needed</small>
					</span>
				</label>
			</div>
		</div>

		{#if aiProvider === 'openai'}
			<div class="form-group">
				<label class="form-label" for="openai-key">OpenAI API Key</label>
				<input
					type="password"
					id="openai-key"
					class="input"
					bind:value={openaiKey}
					placeholder="sk-..."
				/>
			</div>
		{/if}

		{#if aiProvider === 'anthropic'}
			<div class="form-group">
				<label class="form-label" for="anthropic-key">Anthropic API Key</label>
				<input
					type="password"
					id="anthropic-key"
					class="input"
					bind:value={anthropicKey}
					placeholder="sk-ant-..."
				/>
			</div>
		{/if}

		{#if aiProvider === 'ollama'}
			<div class="ollama-settings">
				<div class="form-group">
					<label class="form-label" for="ollama-endpoint">Ollama Endpoint</label>
					<input
						type="url"
						id="ollama-endpoint"
						class="input"
						bind:value={ollamaEndpoint}
						placeholder="http://localhost:11434"
					/>
					<small class="input-hint">The URL where your Ollama server is running</small>
				</div>
				<div class="form-group">
					<label class="form-label" for="ollama-model">Model Name</label>
					<input
						type="text"
						id="ollama-model"
						class="input"
						bind:value={ollamaModel}
						placeholder="llama2"
					/>
					<small class="input-hint">The model to use (e.g., llama2, mistral, codellama)</small>
				</div>
			</div>
		{/if}

		{#if keysSuccess}
			<p class="success-message">{keysSuccess}</p>
		{/if}

		<button class="btn btn-primary" onclick={saveAiSettingsHandler} disabled={keysSaving}>
			{keysSaving ? 'Saving...' : 'Save AI Settings'}
		</button>
	</section>
</div>

<style>
	.settings {
		max-width: 600px;
	}

	.settings h1 {
		font-size: 1.5rem;
		margin-bottom: 1.5rem;
	}

	section {
		margin-bottom: 1.5rem;
	}

	.auth-form {
		margin-bottom: 1rem;
	}

	.error-message {
		color: var(--color-error);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.success-message {
		color: var(--color-success);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.info-text {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-top: 1rem;
	}

	.sync-section p {
		margin-bottom: 1rem;
		color: var(--color-text-secondary);
	}

	.sync-controls {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
	}

	.sync-controls .form-group {
		margin-bottom: 0;
		flex: 1;
	}

	.sync-result {
		margin-top: 1rem;
		font-size: 0.875rem;
	}

	.provider-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.provider-option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg-tertiary);
		border-radius: var(--radius);
		cursor: pointer;
	}

	.provider-option:hover {
		background: var(--color-border);
	}

	.provider-option input {
		margin-top: 0.25rem;
	}

	.provider-label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.provider-label small {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.ollama-settings {
		background: var(--color-bg-tertiary);
		padding: 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}

	.input-hint {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.warning-message {
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: #f59e0b;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.warning-message a {
		color: inherit;
		font-weight: 500;
	}

	.encryption-info {
		font-size: 0.875rem;
	}

	.encryption-info p {
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.encryption-info ul {
		margin: 0 0 1rem;
		padding-left: 1.25rem;
		color: var(--color-text-secondary);
	}

	.encryption-info li {
		margin-bottom: 0.25rem;
	}

	.badge-secondary {
		background: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
	}
</style>

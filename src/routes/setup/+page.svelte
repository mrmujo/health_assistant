<script lang="ts">
	import { goto } from '$app/navigation';
	import { cryptoStore, type CryptoState } from '$lib/crypto';
	import { onMount } from 'svelte';

	type SetupStep = 'checking' | 'choose' | 'generate' | 'confirm' | 'recover' | 'complete';

	let step = $state<SetupStep>('checking');
	let mnemonic = $state('');
	let mnemonicWords = $derived(mnemonic.split(' '));
	let confirmInput = $state('');
	let recoverInput = $state('');
	let error = $state('');
	let loading = $state(false);
	let saltBase64 = $state('');

	// For confirmation: which words to verify
	let verifyIndices = $state<number[]>([]);

	onMount(async () => {
		// Check if already set up
		const hasKey = await cryptoStore.hasKey();
		if (hasKey) {
			// Already set up, go to home
			goto('/');
			return;
		}
		step = 'choose';
	});

	function startNewSetup() {
		// Generate new mnemonic
		mnemonic = cryptoStore.generateMnemonic();

		// Pick 3 random word indices for verification
		const indices = new Set<number>();
		while (indices.size < 3) {
			indices.add(Math.floor(Math.random() * 24));
		}
		verifyIndices = [...indices].sort((a, b) => a - b);

		step = 'generate';
	}

	function proceedToConfirm() {
		error = '';
		step = 'confirm';
	}

	async function confirmBackup() {
		error = '';

		// Parse user input and compare with expected words
		const expectedWords = verifyIndices.map(i => mnemonicWords[i]).join(' ');
		const inputWords = confirmInput.trim().toLowerCase();

		if (inputWords !== expectedWords) {
			error = `Incorrect words. Please enter words #${verifyIndices.map(i => i + 1).join(', #')} from your recovery phrase.`;
			return;
		}

		// Setup encryption
		loading = true;
		const result = await cryptoStore.setup(mnemonic);
		loading = false;

		if (!result.success) {
			error = result.error || 'Failed to set up encryption';
			return;
		}

		// Get the salt to show user for complete backup
		const salt = await cryptoStore.getSalt();
		if (salt) {
			saltBase64 = btoa(String.fromCharCode(...salt));
		}

		step = 'complete';
	}

	function startRecovery() {
		step = 'recover';
	}

	async function recoverWithMnemonic() {
		error = '';

		const words = recoverInput.trim().toLowerCase().split(/\s+/);
		if (words.length !== 24) {
			error = 'Recovery phrase must be 24 words';
			return;
		}

		const phrase = words.join(' ');

		loading = true;
		// Try to recover using salt from server
		const result = await cryptoStore.recover(phrase);
		loading = false;

		if (!result.success) {
			error = result.error || 'Invalid recovery phrase';
			return;
		}

		const salt = await cryptoStore.getSalt();
		if (salt) {
			saltBase64 = btoa(String.fromCharCode(...salt));
		}

		step = 'complete';
	}

	function goToApp() {
		goto('/');
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}
</script>

<div class="setup-page">
	<div class="setup-card">
		{#if step === 'checking'}
			<div class="loading">
				<div class="spinner"></div>
				<p>Checking encryption status...</p>
			</div>
		{:else if step === 'choose'}
			<div class="logo">
				<span class="logo-icon">&#128274;</span>
				<h1>Set Up Encryption</h1>
			</div>

			<p class="description">
				Optionally protect your health data with end-to-end encryption.
				Only you can access encrypted data with your recovery phrase.
			</p>

			<div class="info-box">
				<strong>What does encryption protect?</strong>
				<ul>
					<li>AI API keys stored in your browser</li>
					<li>Future: encrypted health notes and logs</li>
				</ul>
				<p>Your Garmin data is already stored securely on our servers. Encryption adds an extra layer where only you hold the key.</p>
			</div>

			<div class="options">
				<button class="option-btn primary" onclick={startNewSetup}>
					<span class="option-icon">&#10024;</span>
					<span class="option-text">
						<strong>New Setup</strong>
						<small>Generate a new recovery phrase</small>
					</span>
				</button>

				<button class="option-btn secondary" onclick={startRecovery}>
					<span class="option-icon">&#128260;</span>
					<span class="option-text">
						<strong>Recover</strong>
						<small>I have a recovery phrase</small>
					</span>
				</button>

				<button class="option-btn skip" onclick={goToApp}>
					<span class="option-icon">&#10145;</span>
					<span class="option-text">
						<strong>Skip for Now</strong>
						<small>You can set this up later in Settings</small>
					</span>
				</button>
			</div>
		{:else if step === 'generate'}
			<h2>Your Recovery Phrase</h2>
			<p class="warning">
				Write down these 24 words in order. This is the ONLY way to recover your data.
				Never share this with anyone.
			</p>

			<div class="mnemonic-grid">
				{#each mnemonicWords as word, i}
					<div class="word">
						<span class="word-num">{i + 1}</span>
						<span class="word-text">{word}</span>
					</div>
				{/each}
			</div>

			<button class="copy-btn" onclick={() => copyToClipboard(mnemonic)}>
				Copy to Clipboard
			</button>

			<div class="actions">
				<button class="btn primary" onclick={proceedToConfirm}>
					I've Written It Down
				</button>
			</div>
		{:else if step === 'confirm'}
			<h2>Confirm Your Backup</h2>
			<p class="description">
				Enter words #{verifyIndices.map(i => i + 1).join(', #')} from your recovery phrase, separated by spaces.
			</p>

			<input
				type="text"
				bind:value={confirmInput}
				placeholder="Enter the 3 words..."
				disabled={loading}
			/>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<div class="actions">
				<button class="btn secondary" onclick={() => step = 'generate'} disabled={loading}>
					Back
				</button>
				<button class="btn primary" onclick={confirmBackup} disabled={loading}>
					{loading ? 'Setting up...' : 'Confirm'}
				</button>
			</div>
		{:else if step === 'recover'}
			<h2>Enter Recovery Phrase</h2>
			<p class="description">
				Enter your 24-word recovery phrase to restore access to your encrypted data.
			</p>

			<textarea
				bind:value={recoverInput}
				placeholder="Enter your 24 words separated by spaces..."
				rows="4"
				disabled={loading}
			></textarea>

			{#if error}
				<div class="error">{error}</div>
			{/if}

			<div class="actions">
				<button class="btn secondary" onclick={() => step = 'choose'} disabled={loading}>
					Back
				</button>
				<button class="btn primary" onclick={recoverWithMnemonic} disabled={loading}>
					{loading ? 'Recovering...' : 'Recover'}
				</button>
			</div>
		{:else if step === 'complete'}
			<div class="success">
				<span class="success-icon">&#10003;</span>
				<h2>Encryption Active</h2>
				<p>Your data is now protected with end-to-end encryption.</p>
			</div>

			<div class="actions">
				<button class="btn primary" onclick={goToApp}>
					Start Using App
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.setup-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: var(--color-bg);
	}

	.setup-card {
		width: 100%;
		max-width: 500px;
		padding: 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.logo {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.logo-icon {
		font-size: 3rem;
	}

	.logo h1 {
		font-size: 1.5rem;
		margin: 0.5rem 0 0;
	}

	h2 {
		text-align: center;
		margin-bottom: 1rem;
	}

	.description {
		text-align: center;
		color: var(--color-text-secondary);
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.warning {
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: #f59e0b;
		padding: 1rem;
		border-radius: var(--radius);
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.option-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.option-btn:hover {
		border-color: var(--color-primary);
	}

	.option-btn.primary {
		border-color: var(--color-primary);
		background: rgba(59, 130, 246, 0.05);
	}

	.option-btn.skip {
		border-style: dashed;
		opacity: 0.8;
	}

	.info-box {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: 1rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
	}

	.info-box strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.info-box ul {
		margin: 0.5rem 0;
		padding-left: 1.25rem;
	}

	.info-box li {
		color: var(--color-text-secondary);
		margin-bottom: 0.25rem;
	}

	.info-box p {
		margin: 0.5rem 0 0;
		color: var(--color-text-secondary);
	}

	.option-icon {
		font-size: 1.5rem;
	}

	.option-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.option-text strong {
		color: var(--color-text);
	}

	.option-text small {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.mnemonic-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.word {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		font-size: 0.875rem;
	}

	.word-num {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		min-width: 1.5rem;
	}

	.word-text {
		font-family: monospace;
	}

	.copy-btn {
		display: block;
		width: 100%;
		padding: 0.5rem;
		margin-bottom: 1.5rem;
		background: transparent;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.copy-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	input, textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 1rem;
		margin-bottom: 1rem;
	}

	input:focus, textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	textarea {
		resize: vertical;
		font-family: monospace;
	}

	.error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #ef4444;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: var(--radius);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn.primary {
		background: var(--color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	.btn.secondary {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.btn.secondary:hover:not(:disabled) {
		border-color: var(--color-primary);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.success {
		text-align: center;
		margin-bottom: 2rem;
	}

	.success-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4rem;
		height: 4rem;
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border-radius: 50%;
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.success p {
		color: var(--color-text-secondary);
	}

	.loading {
		text-align: center;
		padding: 2rem;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 500px) {
		.mnemonic-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>

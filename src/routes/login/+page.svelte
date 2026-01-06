<script lang="ts">
	import { createClient } from '$lib/supabase/client';
	import { onMount } from 'svelte';

	let { data } = $props();

	let email = $state('');
	let loading = $state(false);
	let message = $state('');
	let error = $state('');
	let turnstileToken = $state('');
	let turnstileReady = $state(false);

	const turnstileSiteKey = data.turnstileSiteKey;

	onMount(() => {
		if (!turnstileSiteKey) {
			// No Turnstile configured, skip
			turnstileReady = true;
			return;
		}

		// Load Turnstile script
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
		script.async = true;
		document.head.appendChild(script);

		// Global callback for Turnstile
		(window as any).onTurnstileLoad = () => {
			(window as any).turnstile.render('#turnstile-container', {
				sitekey: turnstileSiteKey,
				callback: (token: string) => {
					turnstileToken = token;
					turnstileReady = true;
				},
				'expired-callback': () => {
					turnstileToken = '';
					turnstileReady = false;
				}
			});
		};

		return () => {
			delete (window as any).onTurnstileLoad;
		};
	});

	async function handleLogin() {
		if (!email.trim()) {
			error = 'Please enter your email';
			return;
		}

		if (turnstileSiteKey && !turnstileToken) {
			error = 'Please complete the verification';
			return;
		}

		loading = true;
		error = '';
		message = '';

		// Verify turnstile token server-side if configured
		if (turnstileSiteKey && turnstileToken) {
			const verifyRes = await fetch('/api/verify-turnstile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: turnstileToken })
			});
			const verifyResult = await verifyRes.json();
			if (!verifyResult.success) {
				error = 'Verification failed. Please try again.';
				loading = false;
				// Reset turnstile
				if ((window as any).turnstile) {
					(window as any).turnstile.reset();
				}
				return;
			}
		}

		const supabase = createClient();
		const { error: authError } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: {
				emailRedirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (authError) {
			error = authError.message;
		} else {
			message = 'Check your email for the magic link!';
		}

		loading = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<div class="login-page">
	<div class="login-card">
		<div class="logo">
			<span class="logo-icon">&#9829;</span>
			<h1>Health Assistant</h1>
		</div>

		<p class="subtitle">Track your health data with end-to-end encryption</p>

		<div class="form">
			<label for="email">Email</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				onkeydown={handleKeydown}
				placeholder="you@example.com"
				disabled={loading}
			/>

			{#if turnstileSiteKey}
				<div id="turnstile-container" class="turnstile"></div>
			{/if}

			<button onclick={handleLogin} disabled={loading || (turnstileSiteKey && !turnstileReady)}>
				{loading ? 'Sending...' : 'Send Magic Link'}
			</button>
		</div>

		{#if message}
			<div class="message success">{message}</div>
		{/if}

		{#if error}
			<div class="message error">{error}</div>
		{/if}

		<p class="info">
			We'll send you a magic link to sign in. No password needed.
			<br />
			Your data is encrypted with a key only you control.
		</p>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: var(--color-bg);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		padding: 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.logo {
		text-align: center;
		margin-bottom: 1rem;
	}

	.logo-icon {
		font-size: 3rem;
		color: var(--color-primary);
	}

	.logo h1 {
		font-size: 1.5rem;
		margin: 0.5rem 0 0;
	}

	.subtitle {
		text-align: center;
		color: var(--color-text-secondary);
		margin-bottom: 2rem;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		font-weight: 500;
		font-size: 0.875rem;
	}

	input {
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	input:disabled {
		opacity: 0.6;
	}

	button {
		padding: 0.75rem 1rem;
		border: none;
		border-radius: var(--radius);
		background: var(--color-primary);
		color: white;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	button:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.message {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius);
		font-size: 0.875rem;
	}

	.message.success {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.2);
	}

	.message.error {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.info {
		margin-top: 2rem;
		text-align: center;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	.turnstile {
		margin-bottom: 0.5rem;
	}
</style>

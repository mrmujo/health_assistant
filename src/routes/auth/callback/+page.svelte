<script lang="ts">
	import { onMount } from 'svelte';

	let status = $state('Processing login...');
	let error = $state('');

	onMount(async () => {
		// Check for hash-based tokens (implicit flow / some mobile browsers)
		const hash = window.location.hash;
		if (hash && hash.includes('access_token')) {
			try {
				// Parse the hash fragment
				const params = new URLSearchParams(hash.substring(1));
				const access_token = params.get('access_token');
				const refresh_token = params.get('refresh_token');

				if (access_token) {
					// Send tokens to server to establish session with proper cookies
					const response = await fetch('/auth/callback/set-session', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ access_token, refresh_token })
					});

					const result = await response.json();

					if (!response.ok || result.error) {
						error = result.error || 'Failed to establish session';
						status = '';
						return;
					}

					// Successfully logged in - use full page navigation to ensure cookies are sent
					window.location.href = result.redirect || '/setup';
					return;
				}
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to process login';
				status = '';
				return;
			}
		}

		// Check for error in hash
		if (hash && hash.includes('error')) {
			const params = new URLSearchParams(hash.substring(1));
			error = params.get('error_description') || params.get('error') || 'Login failed';
			status = '';
			return;
		}

		// If we reach here with no hash, the server-side handler should have redirected
		// This might mean we're in a loading state or something went wrong
		setTimeout(() => {
			if (!error) {
				// If still here after 3 seconds, redirect to login
				window.location.href = '/login?error=callback_timeout';
			}
		}, 3000);
	});
</script>

<div class="callback-page">
	<div class="callback-card">
		{#if status}
			<div class="loading">
				<div class="spinner"></div>
				<p>{status}</p>
			</div>
		{/if}

		{#if error}
			<div class="error">
				<p>Login failed: {error}</p>
				<a href="/login" class="btn">Back to Login</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.callback-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: var(--color-bg);
	}

	.callback-card {
		width: 100%;
		max-width: 400px;
		padding: 2rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		text-align: center;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		color: #ef4444;
	}

	.error p {
		margin-bottom: 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		text-decoration: none;
		border-radius: var(--radius);
		font-weight: 500;
	}

	.btn:hover {
		background: var(--color-primary-hover);
	}
</style>

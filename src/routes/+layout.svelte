<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';

	let { children } = $props();

	const navItems = [
		{ href: '/', label: 'Home', icon: '📊' },
		{ href: '/chat', label: 'Chat', icon: '💬' },
		{ href: '/sleep', label: 'Sleep', icon: '😴' },
		{ href: '/activity', label: 'Activity', icon: '🏃' },
		{ href: '/stress', label: 'Stress', icon: '🧘' },
		{ href: '/logs', label: 'Logs', icon: '📝' },
		{ href: '/settings', label: 'Settings', icon: '⚙️' }
	];
</script>

<div class="app">
	<aside class="sidebar">
		<div class="logo">
			<span class="logo-icon">❤️</span>
			<span class="logo-text">Health Assistant</span>
		</div>
		<nav class="nav">
			{#each navItems as item}
				<a href={item.href} class="nav-item" class:active={$page.url.pathname === item.href}>
					<span class="nav-icon">{item.icon}</span>
					<span class="nav-label">{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>
	<main class="main">
		{@render children()}
	</main>
	<nav class="mobile-nav">
		{#each navItems as item}
			<a href={item.href} class="mobile-nav-item" class:active={$page.url.pathname === item.href}>
				<span class="mobile-nav-icon">{item.icon}</span>
				<span class="mobile-nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}

	.sidebar {
		width: 240px;
		background: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border);
		padding: 1.5rem 1rem;
		display: flex;
		flex-direction: column;
		position: fixed;
		height: 100vh;
		overflow-y: auto;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 0.75rem;
		margin-bottom: 2rem;
	}

	.logo-icon {
		font-size: 1.5rem;
	}

	.logo-text {
		font-size: 1.125rem;
		font-weight: 600;
	}

	.nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: var(--radius);
		color: var(--color-text-secondary);
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.nav-item:hover {
		background: var(--color-bg-tertiary);
		color: var(--color-text);
		text-decoration: none;
	}

	.nav-item.active {
		background: var(--color-bg-tertiary);
		color: var(--color-primary);
	}

	.nav-icon {
		font-size: 1.25rem;
	}

	.nav-label {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.main {
		flex: 1;
		margin-left: 240px;
		padding: 2rem;
	}

	.mobile-nav {
		display: none;
	}

	@media (max-width: 768px) {
		.sidebar {
			display: none;
		}

		.main {
			margin-left: 0;
			padding: 1rem;
			padding-bottom: 5rem;
		}

		.mobile-nav {
			display: flex;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			background: var(--color-bg-secondary);
			border-top: 1px solid var(--color-border);
			padding: 0.5rem;
			justify-content: space-around;
			z-index: 100;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.mobile-nav-item {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.25rem;
			padding: 0.5rem;
			border-radius: var(--radius);
			color: var(--color-text-secondary);
			text-decoration: none;
			min-width: 50px;
			font-size: 0.75rem;
		}

		.mobile-nav-item:hover {
			text-decoration: none;
		}

		.mobile-nav-item.active {
			color: var(--color-primary);
		}

		.mobile-nav-icon {
			font-size: 1.25rem;
		}

		.mobile-nav-label {
			font-size: 0.625rem;
			font-weight: 500;
			white-space: nowrap;
		}
	}
</style>

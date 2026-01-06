<script lang="ts">
	import type { PageData } from './$types';
	import { tick, onMount } from 'svelte';
	import { getAISettings, type AISettings } from '$lib/ai';

	let { data }: { data: PageData } = $props();

	interface ParsedAction {
		type: string;
		params: string[];
		label: string;
	}

	interface Message {
		role: 'user' | 'assistant';
		content: string;
		actions?: ParsedAction[];
		actionsApplied?: boolean;
	}

	let messages = $state<Message[]>([]);
	let input = $state('');
	let sending = $state(false);
	let applyingAction = $state(false);
	let messagesContainer: HTMLDivElement;
	let aiSettings = $state<AISettings | null>(null);
	let settingsError = $state('');

	onMount(async () => {
		aiSettings = await getAISettings();
		if (!aiSettings) {
			settingsError = 'Please configure your AI settings first.';
		}
	});

	const eventIcons: Record<string, string> = {
		running: '🏃',
		cycling: '🚴',
		swimming: '🏊',
		triathlon: '🏆'
	};

	const suggestedQuestions = [
		"Why is today's workout structured this way?",
		'How should I adjust if I feel tired?',
		"Can you make today's workout easier?",
		'Can I swap tomorrow with another day?',
		"What's the focus for this week?"
	];

	const actionLabels: Record<string, string> = {
		makeRest: 'Make Rest Day',
		swap: 'Swap Workouts',
		reduceDuration: 'Reduce Duration',
		increaseDuration: 'Increase Duration',
		changeType: 'Change Type',
		adjustRpe: 'Adjust RPE'
	};

	function parseActions(content: string): { text: string; actions: ParsedAction[] } {
		const actionRegex = /\[ACTION:([^\]]+)\]/g;
		const actions: ParsedAction[] = [];
		let match;

		while ((match = actionRegex.exec(content)) !== null) {
			const parts = match[1].split(':');
			const type = parts[0];
			const params = parts.slice(1);
			actions.push({
				type,
				params,
				label: actionLabels[type] || type
			});
		}

		// Remove action blocks from displayed text
		const text = content.replace(actionRegex, '').trim();
		return { text, actions };
	}

	async function applyAction(action: ParsedAction, messageIndex: number) {
		if (applyingAction) return;
		applyingAction = true;

		try {
			let body: Record<string, unknown> = {};

			switch (action.type) {
				case 'makeRest':
					body = { action: 'makeRest', workoutId: parseInt(action.params[0]) };
					break;
				case 'swap':
					body = {
						action: 'swap',
						data: {
							workoutId1: parseInt(action.params[0]),
							workoutId2: parseInt(action.params[1])
						}
					};
					break;
				case 'reduceDuration':
					body = {
						action: 'reduceDuration',
						workoutId: parseInt(action.params[0]),
						data: { percentage: parseInt(action.params[1]) || 25 }
					};
					break;
				case 'increaseDuration':
					body = {
						action: 'increaseDuration',
						workoutId: parseInt(action.params[0]),
						data: { percentage: parseInt(action.params[1]) || 10 }
					};
					break;
				case 'changeType':
					body = {
						action: 'changeType',
						workoutId: parseInt(action.params[0]),
						data: { newType: action.params[1] }
					};
					break;
				case 'adjustRpe':
					body = {
						action: 'adjustRpe',
						workoutId: parseInt(action.params[0]),
						data: { newRpe: parseInt(action.params[1]) }
					};
					break;
			}

			const response = await fetch('/api/coach/workouts/modify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const result = await response.json();

			if (result.success) {
				messages[messageIndex].actionsApplied = true;
				// Add confirmation message
				messages = [
					...messages,
					{ role: 'assistant', content: `Done! ${result.message}. Refresh the page to see updated workouts.` }
				];
			} else {
				messages = [
					...messages,
					{ role: 'assistant', content: `Failed to apply change: ${result.error}` }
				];
			}
		} catch (e) {
			messages = [
				...messages,
				{ role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Failed to apply action'}` }
			];
		} finally {
			applyingAction = false;
			await scrollToBottom();
		}
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	async function sendMessage(content?: string) {
		const messageContent = content || input.trim();
		if (!messageContent || sending) return;

		if (!aiSettings) {
			settingsError = 'Please configure your AI settings first.';
			return;
		}

		input = '';
		sending = true;
		settingsError = '';

		// Add user message
		messages = [...messages, { role: 'user', content: messageContent }];
		await scrollToBottom();

		// Add empty assistant message for streaming
		messages = [...messages, { role: 'assistant', content: '' }];
		await scrollToBottom();

		try {
			const response = await fetch('/api/coach/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goalId: data.selectedGoal.id,
					messages: messages.slice(0, -1), // Don't include the empty assistant message
					apiConfig: {
						provider: aiSettings.provider,
						openaiKey: aiSettings.openaiKey,
						anthropicKey: aiSettings.anthropicKey,
						ollamaEndpoint: aiSettings.ollamaEndpoint,
						ollamaModel: aiSettings.ollamaModel
					}
				})
			});

			if (!response.ok) {
				const error = await response.json();
				messages[messages.length - 1].content = `Error: ${error.error || 'Failed to get response'}`;
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				messages[messages.length - 1].content = 'Error: No response stream';
				return;
			}

			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const lineData = line.slice(6);
						if (lineData === '[DONE]') {
							break;
						}
						try {
							const parsed = JSON.parse(lineData);
							if (parsed.text) {
								messages[messages.length - 1].content += parsed.text;
								await scrollToBottom();
							}
						} catch {
							// Skip invalid JSON
						}
					}
				}
			}

			// Parse actions from final message
			const lastMessage = messages[messages.length - 1];
			const { text, actions } = parseActions(lastMessage.content);
			lastMessage.content = text;
			if (actions.length > 0) {
				lastMessage.actions = actions;
			}
		} catch (e) {
			messages[messages.length - 1].content = `Error: ${e instanceof Error ? e.message : 'Failed to send message'}`;
		} finally {
			sending = false;
			await scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) {
			return `${h}h ${m}m`;
		}
		return `${m}min`;
	}
</script>

<div class="page">
	<header class="page-header">
		<div>
			<a href="/coach" class="back-link">Back to Coach</a>
			<h1>Chat with Coach</h1>
		</div>
		{#if data.activeGoals.length > 1}
			<select
				class="goal-select"
				value={data.selectedGoal.id}
				onchange={(e) => {
					window.location.href = `/coach/chat?goal=${e.currentTarget.value}`;
				}}
			>
				{#each data.activeGoals as goal}
					<option value={goal.id}>{goal.name}</option>
				{/each}
			</select>
		{/if}
	</header>

	<div class="chat-container">
		<div class="context-bar">
			<span class="goal-badge">
				{eventIcons[data.selectedGoal.eventType] || '🎯'}
				{data.selectedGoal.name}
			</span>
			{#if data.todayWorkout}
				<span class="today-badge">
					Today: {data.todayWorkout.workoutType} - {formatDuration(data.todayWorkout.duration)}
				</span>
			{:else}
				<span class="today-badge">Today: Rest day</span>
			{/if}
		</div>

		<div class="messages" bind:this={messagesContainer}>
			{#if settingsError}
				<div class="settings-error">
					<div class="error-icon">⚙️</div>
					<h2>AI Settings Required</h2>
					<p>Please configure your AI provider and API keys to use the coach.</p>
					<a href="/settings" class="btn-settings">Go to Settings</a>
				</div>
			{:else if messages.length === 0}
				<div class="welcome">
					<div class="welcome-icon">🏅</div>
					<h2>Your AI Training Coach</h2>
					<p>
						Ask me anything about your training plan, workout suggestions, or how to optimize your
						preparation for {data.selectedGoal.name}.
					</p>
					<div class="suggested-questions">
						<p class="suggested-label">Try asking:</p>
						{#each suggestedQuestions as question}
							<button class="suggested-btn" onclick={() => sendMessage(question)}>
								{question}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#each messages as message, i}
					<div class="message" class:user={message.role === 'user'}>
						<div class="message-avatar">
							{message.role === 'user' ? '👤' : '🏅'}
						</div>
						<div class="message-bubble">
							<div class="message-content">
								{#if message.role === 'assistant' && !message.content && sending}
									<span class="typing-indicator">...</span>
								{:else}
									{message.content}
								{/if}
							</div>
							{#if message.actions && message.actions.length > 0 && !message.actionsApplied}
								<div class="action-buttons">
									{#each message.actions as action}
										<button
											class="action-btn"
											onclick={() => applyAction(action, i)}
											disabled={applyingAction}
										>
											{applyingAction ? '...' : `Apply: ${action.label}`}
										</button>
									{/each}
								</div>
							{/if}
							{#if message.actionsApplied}
								<div class="action-applied">Changes applied</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<div class="input-container">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="Ask your coach..."
				rows="1"
				disabled={sending}
			></textarea>
			<button class="send-btn" onclick={() => sendMessage()} disabled={!input.trim() || sending}>
				{sending ? '...' : '→'}
			</button>
		</div>
	</div>
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
		height: calc(100vh - 4rem);
		display: flex;
		flex-direction: column;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		flex-shrink: 0;
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

	.goal-select {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.chat-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.context-bar {
		display: flex;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--color-bg-tertiary);
		border-bottom: 1px solid var(--color-border);
		flex-wrap: wrap;
	}

	.goal-badge,
	.today-badge {
		font-size: 0.875rem;
		padding: 0.25rem 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.settings-error {
		text-align: center;
		padding: 3rem 2rem;
	}

	.settings-error .error-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.settings-error h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
	}

	.settings-error p {
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
	}

	.btn-settings {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: var(--color-primary);
		color: white;
		text-decoration: none;
		border-radius: var(--radius);
		font-weight: 500;
	}

	.btn-settings:hover {
		background: var(--color-primary-hover);
	}

	.welcome {
		text-align: center;
		padding: 2rem;
	}

	.welcome-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.welcome h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
	}

	.welcome p {
		color: var(--color-text-secondary);
		margin: 0 0 1.5rem;
	}

	.suggested-questions {
		text-align: left;
		max-width: 400px;
		margin: 0 auto;
	}

	.suggested-label {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: 0.5rem;
	}

	.suggested-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.75rem 1rem;
		margin-bottom: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.suggested-btn:hover {
		border-color: var(--color-primary);
		background: rgba(37, 99, 235, 0.05);
	}

	.message {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.message.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-bg-tertiary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.message.user .message-avatar {
		background: var(--color-primary);
	}

	.message-bubble {
		max-width: 70%;
	}

	.message-content {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-lg);
		background: var(--color-bg);
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.message.user .message-content {
		background: var(--color-primary);
		color: white;
	}

	.action-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.action-btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-primary);
		border-radius: var(--radius);
		background: transparent;
		color: var(--color-primary);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--color-primary);
		color: white;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-applied {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-success, #10b981);
		font-style: italic;
	}

	.typing-indicator {
		display: inline-block;
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.input-container {
		display: flex;
		gap: 0.5rem;
		padding: 1rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.input-container textarea {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg-secondary);
		color: var(--color-text);
		font-size: 1rem;
		resize: none;
		min-height: 44px;
		max-height: 120px;
	}

	.input-container textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.input-container textarea:disabled {
		opacity: 0.6;
	}

	.send-btn {
		width: 44px;
		height: 44px;
		border: none;
		border-radius: var(--radius);
		background: var(--color-primary);
		color: white;
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--color-primary-hover);
	}

	@media (max-width: 600px) {
		.page {
			height: calc(100vh - 6rem);
		}

		.message-bubble {
			max-width: 85%;
		}

		.context-bar {
			flex-direction: column;
			gap: 0.5rem;
		}

		.action-buttons {
			flex-direction: column;
		}

		.action-btn {
			width: 100%;
		}
	}
</style>

<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	interface Message {
		role: 'user' | 'assistant';
		content: string;
	}

	interface Conversation {
		id: number;
		title: string | null;
		createdAt: Date;
		updatedAt: Date | null;
	}

	let messages = $state<Message[]>([]);
	let conversations = $state<Conversation[]>([]);
	let currentConversation = $state<{ id: number; title: string | null } | null>(null);
	let input = $state('');
	let isLoading = $state(false);
	let showSidebar = $state(true);
	let messagesContainer: HTMLDivElement;
	let textareaRef: HTMLTextAreaElement;

	// Auto-resize textarea
	function autoResize() {
		if (textareaRef) {
			textareaRef.style.height = 'auto';
			textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + 'px';
		}
	}

	// Handle keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
		// Shift+Enter will naturally insert a newline
	}

	// Update state when data changes (e.g., when navigating between conversations)
	$effect(() => {
		messages = data.chatHistory || [];
		conversations = data.conversations || [];
		currentConversation = data.currentConversation;
	});

	// Auto-send prefill question on mount
	onMount(() => {
		if (data.prefillQuestion && data.currentConversation) {
			input = data.prefillQuestion;
			setTimeout(() => sendMessage(), 100);
		}
	});

	const suggestedQuestions = [
		'How was my sleep this week?',
		'What patterns do you see in my activity?',
		'How is my body battery trending?',
		'Any suggestions to improve my sleep?',
		'Analyze my stress levels'
	];

	async function createNewConversation() {
		try {
			const res = await fetch('/api/conversations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'New Conversation' })
			});
			const result = await res.json();
			if (result.success) {
				goto(`/chat?id=${result.id}`);
			}
		} catch (e) {
			console.error('Failed to create conversation', e);
		}
	}

	async function selectConversation(id: number) {
		goto(`/chat?id=${id}`);
	}

	async function deleteConversation(id: number, e: Event) {
		e.stopPropagation();
		if (!confirm('Delete this conversation?')) return;

		try {
			await fetch(`/api/conversations?id=${id}`, { method: 'DELETE' });
			conversations = conversations.filter((c) => c.id !== id);
			if (currentConversation?.id === id) {
				goto('/chat');
			}
		} catch (e) {
			console.error('Failed to delete conversation', e);
		}
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		// If no conversation selected, create one first
		if (!currentConversation) {
			try {
				const res = await fetch('/api/conversations', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: input.slice(0, 50) + (input.length > 50 ? '...' : '') })
				});
				const result = await res.json();
				if (result.success) {
					currentConversation = { id: result.id, title: input.slice(0, 50) };
					// Update URL without full page reload
					window.history.replaceState({}, '', `/chat?id=${result.id}`);
				}
			} catch (e) {
				console.error('Failed to create conversation', e);
				return;
			}
		}

		const userMessage = input.trim();
		input = '';
		// Reset textarea height
		if (textareaRef) {
			textareaRef.style.height = 'auto';
		}
		messages = [...messages, { role: 'user', content: userMessage }];
		isLoading = true;

		// Scroll to bottom
		setTimeout(() => {
			messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
		}, 50);

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages,
					saveUserMessage: true,
					conversationId: currentConversation?.id
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to get response');
			}

			// Add empty assistant message
			messages = [...messages, { role: 'assistant', content: '' }];
			const assistantIndex = messages.length - 1;

			// Read the stream
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (reader) {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					const lines = chunk.split('\n');

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data === '[DONE]') continue;

							try {
								const parsed = JSON.parse(data);
								if (parsed.text) {
									messages[assistantIndex].content += parsed.text;
									messages = [...messages]; // Trigger reactivity
								}
							} catch {
								// Ignore parse errors
							}
						}
					}

					// Scroll as content streams
					messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight });
				}
			}
		} catch (e) {
			messages = [
				...messages,
				{
					role: 'assistant',
					content: `Error: ${e instanceof Error ? e.message : 'Something went wrong'}`
				}
			];
		} finally {
			isLoading = false;
		}
	}

	function askSuggested(question: string) {
		input = question;
		sendMessage();
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '';
		const d = new Date(date);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Chat | Health Assistant</title>
</svelte:head>

<div class="chat-layout">
	<!-- Sidebar with conversations -->
	<aside class="sidebar" class:collapsed={!showSidebar}>
		<div class="sidebar-header">
			<h2>Conversations</h2>
			<button class="btn-new" onclick={createNewConversation} title="New conversation">+</button>
		</div>
		<div class="conversations-list">
			{#each conversations as conv}
				<div
					class="conversation-item"
					class:active={currentConversation?.id === conv.id}
					onclick={() => selectConversation(conv.id)}
					onkeydown={(e) => e.key === 'Enter' && selectConversation(conv.id)}
					role="button"
					tabindex="0"
				>
					<span class="conv-title">{conv.title || 'Untitled'}</span>
					<span class="conv-date">{formatDate(conv.updatedAt || conv.createdAt)}</span>
					<button
						class="btn-delete"
						onclick={(e) => deleteConversation(conv.id, e)}
						title="Delete"
					>
						x
					</button>
				</div>
			{/each}
			{#if conversations.length === 0}
				<p class="no-conversations">No conversations yet</p>
			{/if}
		</div>
	</aside>

	<!-- Toggle sidebar button -->
	<button class="sidebar-toggle" onclick={() => (showSidebar = !showSidebar)}>
		{showSidebar ? '<' : '>'}
	</button>

	<!-- Main chat area -->
	<div class="chat-main">
		<header class="chat-header">
			<div>
				<h1>{currentConversation?.title || 'Health Chat'}</h1>
				<p class="provider-info">
					Using {data.provider === 'openai'
						? 'GPT-4'
						: data.provider === 'anthropic'
							? 'Claude'
							: data.provider === 'ollama'
								? 'Ollama (Local)'
								: 'No AI configured'}
				</p>
			</div>
		</header>

		<div class="chat-container" bind:this={messagesContainer}>
			{#if !currentConversation && messages.length === 0}
				<div class="welcome">
					<h2>Ask me about your health</h2>
					<p>I have access to your Garmin data and health logs. Try asking:</p>
					<div class="suggestions">
						{#each suggestedQuestions as question}
							<button class="suggestion" onclick={() => askSuggested(question)}>
								{question}
							</button>
						{/each}
					</div>
				</div>
			{:else if messages.length === 0}
				<div class="welcome">
					<h2>Start the conversation</h2>
					<p>Ask anything about your health data.</p>
				</div>
			{:else}
				<div class="messages">
					{#each messages as message}
						<div class="message {message.role}">
							<div class="message-avatar">
								{message.role === 'user' ? '👤' : '🤖'}
							</div>
							<div class="message-content">
								{#if message.role === 'assistant' && message.content === '' && isLoading}
									<span class="typing">Thinking...</span>
								{:else}
									{message.content}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="chat-input">
			<textarea
				bind:this={textareaRef}
				class="input chat-textarea"
				bind:value={input}
				placeholder="Ask about your health data... (Shift+Enter for new line)"
				disabled={isLoading || data.provider === 'none'}
				oninput={autoResize}
				onkeydown={handleKeydown}
				rows="1"
			></textarea>
			<button
				type="button"
				class="btn btn-primary"
				disabled={isLoading || !input.trim() || data.provider === 'none'}
				onclick={sendMessage}
			>
				{isLoading ? 'Sending...' : 'Send'}
			</button>
		</div>

		{#if data.provider === 'none'}
			<p class="no-provider">
				No AI provider configured. <a href="/settings">Add your API keys in Settings</a>
			</p>
		{/if}
	</div>
</div>

<style>
	.chat-layout {
		display: flex;
		height: calc(100vh - 4rem);
		gap: 0;
		position: relative;
	}

	.sidebar {
		width: 280px;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		margin-right: 1rem;
		transition: all 0.2s ease;
	}

	.sidebar.collapsed {
		width: 0;
		margin-right: 0;
		overflow: hidden;
		opacity: 0;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.sidebar-header h2 {
		font-size: 1rem;
		font-weight: 600;
	}

	.btn-new {
		width: 28px;
		height: 28px;
		border-radius: var(--radius);
		background: var(--color-primary);
		color: white;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-new:hover {
		opacity: 0.9;
	}

	.conversations-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.conversation-item {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.75rem;
		background: transparent;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		text-align: left;
		position: relative;
		color: var(--color-text);
	}

	.conversation-item:hover {
		background: var(--color-bg-tertiary);
	}

	.conversation-item.active {
		background: var(--color-bg-tertiary);
		border-left: 3px solid var(--color-primary);
	}

	.conv-title {
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		padding-right: 1.5rem;
	}

	.conv-date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.btn-delete {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		border-radius: var(--radius);
		background: transparent;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.conversation-item:hover .btn-delete {
		opacity: 1;
	}

	.btn-delete:hover {
		background: var(--color-danger);
		color: white;
	}

	.no-conversations {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		padding: 2rem 1rem;
	}

	.sidebar-toggle {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 40px;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-left: none;
		border-radius: 0 var(--radius) var(--radius) 0;
		cursor: pointer;
		color: var(--color-text-secondary);
		z-index: 10;
	}

	.sidebar:not(.collapsed) ~ .sidebar-toggle {
		left: 280px;
	}

	.chat-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 800px;
		min-width: 0;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.chat-header h1 {
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.provider-info {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.chat-container {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		margin-bottom: 1rem;
	}

	.welcome {
		text-align: center;
		padding: 2rem;
	}

	.welcome h2 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.welcome p {
		color: var(--color-text-secondary);
		margin-bottom: 1.5rem;
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
	}

	.suggestion {
		padding: 0.5rem 1rem;
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.suggestion:hover {
		background: var(--color-border);
	}

	.messages {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.message {
		display: flex;
		gap: 0.75rem;
	}

	.message.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-tertiary);
		border-radius: 50%;
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.message-content {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-lg);
		max-width: 80%;
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.message.user .message-content {
		background: var(--color-primary);
		color: white;
	}

	.message.assistant .message-content {
		background: var(--color-bg-tertiary);
	}

	.typing {
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.chat-input {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
	}

	.chat-input .input {
		flex: 1;
	}

	.chat-textarea {
		resize: none;
		min-height: 42px;
		max-height: 200px;
		line-height: 1.5;
		overflow-y: auto;
	}

	.chat-input .btn {
		align-self: flex-end;
		height: 42px;
	}

	.no-provider {
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.sidebar {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: 20;
			margin-right: 0;
		}

		.sidebar.collapsed {
			transform: translateX(-100%);
		}

		.sidebar:not(.collapsed) ~ .sidebar-toggle {
			left: 280px;
		}
	}
</style>

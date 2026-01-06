import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { cryptoStore } from '$lib/crypto';

export interface Message {
	role: 'user' | 'assistant';
	content: string;
}

export interface HealthContext {
	sleep?: unknown[];
	activity?: unknown[];
	stress?: unknown[];
	foodLogs?: unknown[];
	medicationLogs?: unknown[];
	notes?: unknown[];
}

export interface AISettings {
	provider: 'anthropic' | 'openai' | 'ollama';
	anthropicKey?: string;
	openaiKey?: string;
	ollamaEndpoint?: string;
	ollamaModel?: string;
}

const SETTINGS_KEY = 'ai-settings';
const LOCAL_STORAGE_KEY = 'ai-settings';

const HEALTH_SYSTEM_PROMPT = `You are a personal health assistant with access to the user's health data from their Garmin device and manual logs. You can analyze sleep patterns, activity levels, stress, and body battery data.

When analyzing health data:
- Look for patterns and correlations between different metrics
- Provide actionable insights based on the data
- Be supportive but not prescriptive (you're not a doctor)
- Reference specific data points when relevant
- If you notice concerning patterns, gently suggest consulting a healthcare professional

You have access to:
- Sleep data: duration, quality, deep/light/REM stages, heart rate during sleep, SpO2
- Activity data: steps, calories, heart rate, distance
- Stress & Body Battery: stress levels throughout the day, body battery charge/drain
- User logs: food intake, medications, and personal health notes

When the user asks about their health, analyze the provided context data and give personalized insights.`;

// Store for encrypted AI settings in IndexedDB
const DB_NAME = 'health-assistant-ai';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
}

// Save AI settings (encrypted)
export async function saveAISettings(settings: AISettings): Promise<void> {
	const { ciphertext, iv } = await cryptoStore.encryptJSON(settings);
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put({ id: SETTINGS_KEY, ciphertext, iv });
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		transaction.oncomplete = () => db.close();
	});
}

// Load AI settings (decrypted or from localStorage in local mode)
export async function getAISettings(): Promise<AISettings | null> {
	// First try localStorage (for local mode)
	try {
		const localSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (localSettings) {
			return JSON.parse(localSettings);
		}
	} catch {
		// localStorage not available or invalid
	}

	// Fall back to encrypted IndexedDB storage
	const db = await openDatabase();

	return new Promise(async (resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(SETTINGS_KEY);

		request.onerror = () => reject(request.error);
		request.onsuccess = async () => {
			const entry = request.result;
			if (!entry) {
				resolve(null);
				return;
			}

			try {
				const settings = await cryptoStore.decryptJSON<AISettings>(entry.ciphertext, entry.iv);
				resolve(settings);
			} catch (error) {
				console.error('Failed to decrypt AI settings:', error);
				resolve(null);
			}
		};

		transaction.oncomplete = () => db.close();
	});
}

// Clear AI settings
export async function clearAISettings(): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(SETTINGS_KEY);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		transaction.oncomplete = () => db.close();
	});
}

function formatHealthContext(context: HealthContext): string {
	const parts: string[] = [];

	if (context.sleep && context.sleep.length > 0) {
		parts.push(`Recent Sleep Data (last ${context.sleep.length} days):\n${JSON.stringify(context.sleep, null, 2)}`);
	}

	if (context.activity && context.activity.length > 0) {
		parts.push(`Recent Activity Data (last ${context.activity.length} days):\n${JSON.stringify(context.activity, null, 2)}`);
	}

	if (context.stress && context.stress.length > 0) {
		parts.push(`Recent Stress/Body Battery Data:\n${JSON.stringify(context.stress, null, 2)}`);
	}

	if (context.foodLogs && context.foodLogs.length > 0) {
		parts.push(`Recent Food Logs:\n${JSON.stringify(context.foodLogs, null, 2)}`);
	}

	if (context.medicationLogs && context.medicationLogs.length > 0) {
		parts.push(`Recent Medications:\n${JSON.stringify(context.medicationLogs, null, 2)}`);
	}

	if (context.notes && context.notes.length > 0) {
		parts.push(`Recent Health Notes:\n${JSON.stringify(context.notes, null, 2)}`);
	}

	return parts.length > 0 ? parts.join('\n\n') : 'No health data available yet.';
}

export async function streamChat(
	messages: Message[],
	healthContext: HealthContext,
	onToken: (token: string) => void
): Promise<void> {
	const settings = await getAISettings();

	if (!settings) {
		throw new Error('No AI settings configured. Please add your API keys in Settings.');
	}

	const contextMessage = `\n\nCurrent Health Data:\n${formatHealthContext(healthContext)}`;
	const systemPrompt = HEALTH_SYSTEM_PROMPT + contextMessage;

	if (settings.provider === 'ollama' && settings.ollamaEndpoint) {
		await streamOllama(messages, systemPrompt, settings.ollamaEndpoint, settings.ollamaModel || 'llama2', onToken);
	} else if (settings.provider === 'openai' && settings.openaiKey) {
		await streamOpenAI(messages, systemPrompt, settings.openaiKey, onToken);
	} else if (settings.provider === 'anthropic' && settings.anthropicKey) {
		await streamAnthropic(messages, systemPrompt, settings.anthropicKey, onToken);
	} else {
		throw new Error('No valid AI provider configured. Please check your API keys in Settings.');
	}
}

async function streamAnthropic(
	messages: Message[],
	systemPrompt: string,
	apiKey: string,
	onToken: (token: string) => void
): Promise<void> {
	const client = new Anthropic({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	const stream = client.messages.stream({
		model: 'claude-sonnet-4-20250514',
		max_tokens: 4096,
		system: systemPrompt,
		messages: messages.map((m) => ({
			role: m.role,
			content: m.content
		}))
	});

	for await (const event of stream) {
		if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
			onToken(event.delta.text);
		}
	}
}

async function streamOpenAI(
	messages: Message[],
	systemPrompt: string,
	apiKey: string,
	onToken: (token: string) => void
): Promise<void> {
	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	const stream = await client.chat.completions.create({
		model: 'gpt-4-turbo-preview',
		stream: true,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}))
		]
	});

	for await (const chunk of stream) {
		const text = chunk.choices[0]?.delta?.content;
		if (text) {
			onToken(text);
		}
	}
}

interface OllamaStreamChunk {
	message: {
		content: string;
	};
	done: boolean;
}

async function streamOllama(
	messages: Message[],
	systemPrompt: string,
	endpoint: string,
	model: string,
	onToken: (token: string) => void
): Promise<void> {
	let apiUrl = endpoint.trim();
	if (apiUrl.endsWith('/')) {
		apiUrl = apiUrl.slice(0, -1);
	}
	if (!apiUrl.endsWith('/api/chat')) {
		apiUrl = apiUrl + '/api/chat';
	}

	const body = {
		model,
		stream: true,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((m) => ({
				role: m.role,
				content: m.content
			}))
		]
	};

	const response = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body from Ollama');
	}

	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });

		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (!line.trim()) continue;

			try {
				const parsed: OllamaStreamChunk = JSON.parse(line);
				if (parsed.message?.content) {
					onToken(parsed.message.content);
				}
			} catch {
				// Skip invalid JSON lines
			}
		}
	}

	if (buffer.trim()) {
		try {
			const parsed: OllamaStreamChunk = JSON.parse(buffer);
			if (parsed.message?.content) {
				onToken(parsed.message.content);
			}
		} catch {
			// Skip invalid JSON
		}
	}
}

export async function getCurrentProvider(): Promise<string> {
	const settings = await getAISettings();

	if (!settings) return 'none';

	if (settings.provider === 'ollama' && settings.ollamaEndpoint) return 'ollama';
	if (settings.provider === 'openai' && settings.openaiKey) return 'openai';
	if (settings.provider === 'anthropic' && settings.anthropicKey) return 'anthropic';

	return 'none';
}

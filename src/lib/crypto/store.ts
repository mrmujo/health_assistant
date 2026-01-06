import { writable, get } from 'svelte/store';
import {
	generateMnemonic,
	validateMnemonic,
	deriveKeyFromMnemonic,
	generateSalt,
	encrypt,
	decrypt,
	encryptJSON,
	decryptJSON
} from './encryption';
import {
	storeKey,
	getKey,
	storeSalt,
	getSalt,
	hasKey,
	clearKeystore
} from './keystore';

export type CryptoState =
	| { status: 'loading' }
	| { status: 'locked' } // No key in keystore, need to setup/unlock
	| { status: 'unlocked'; key: CryptoKey }
	| { status: 'error'; error: string };

function createCryptoStore() {
	const { subscribe, set } = writable<CryptoState>({ status: 'loading' });

	return {
		subscribe,

		// Initialize the store - check if we have a stored key
		async init() {
			try {
				const key = await getKey();
				if (key) {
					set({ status: 'unlocked', key });
				} else {
					set({ status: 'locked' });
				}
			} catch (error) {
				set({ status: 'error', error: String(error) });
			}
		},

		// Generate a new mnemonic for first-time setup
		generateMnemonic(): string {
			return generateMnemonic();
		},

		// Setup with a new mnemonic (first-time user)
		async setup(mnemonic: string): Promise<{ success: boolean; error?: string }> {
			if (!validateMnemonic(mnemonic)) {
				return { success: false, error: 'Invalid mnemonic phrase' };
			}

			try {
				// Generate and store a new salt
				const salt = generateSalt();
				await storeSalt(salt);

				// Store salt on server for recovery
				const saltBase64 = btoa(String.fromCharCode(...salt));
				await fetch('/api/salt', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ salt: saltBase64 })
				});

				// Derive and store the key
				const key = await deriveKeyFromMnemonic(mnemonic, salt);
				await storeKey(key);

				set({ status: 'unlocked', key });
				return { success: true };
			} catch (error) {
				set({ status: 'error', error: String(error) });
				return { success: false, error: String(error) };
			}
		},

		// Unlock with existing mnemonic (returning user on new device)
		async unlock(mnemonic: string, salt: Uint8Array): Promise<{ success: boolean; error?: string }> {
			if (!validateMnemonic(mnemonic)) {
				return { success: false, error: 'Invalid mnemonic phrase' };
			}

			try {
				// Store the provided salt
				await storeSalt(salt);

				// Derive and store the key
				const key = await deriveKeyFromMnemonic(mnemonic, salt);
				await storeKey(key);

				set({ status: 'unlocked', key });
				return { success: true };
			} catch (error) {
				set({ status: 'error', error: String(error) });
				return { success: false, error: String(error) };
			}
		},

		// Recover on a new device by fetching salt from server
		async recover(mnemonic: string): Promise<{ success: boolean; error?: string }> {
			if (!validateMnemonic(mnemonic)) {
				return { success: false, error: 'Invalid mnemonic phrase' };
			}

			try {
				// Fetch salt from server
				const response = await fetch('/api/salt');
				const result = await response.json();

				if (!result.success || !result.data?.salt) {
					// No salt found - this is a new setup, not recovery
					return { success: false, error: 'No existing encryption found for this account. Please use "New Setup" instead.' };
				}

				// Convert base64 salt to Uint8Array
				const saltBinary = atob(result.data.salt);
				const salt = new Uint8Array(saltBinary.length);
				for (let i = 0; i < saltBinary.length; i++) {
					salt[i] = saltBinary.charCodeAt(i);
				}

				// Use unlock with the fetched salt
				return this.unlock(mnemonic, salt);
			} catch (error) {
				set({ status: 'error', error: String(error) });
				return { success: false, error: String(error) };
			}
		},

		// Lock the store (clear keys from memory and storage)
		async lock() {
			await clearKeystore();
			set({ status: 'locked' });
		},

		// Get the current key (if unlocked)
		getKey(): CryptoKey | null {
			const state = get({ subscribe });
			if (state.status === 'unlocked') {
				return state.key;
			}
			return null;
		},

		// Check if store is unlocked
		isUnlocked(): boolean {
			const state = get({ subscribe });
			return state.status === 'unlocked';
		},

		// Encrypt a string
		async encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
			const key = this.getKey();
			if (!key) throw new Error('Crypto store is locked');
			return encrypt(key, plaintext);
		},

		// Decrypt a string
		async decrypt(ciphertext: string, iv: string): Promise<string> {
			const key = this.getKey();
			if (!key) throw new Error('Crypto store is locked');
			return decrypt(key, ciphertext, iv);
		},

		// Encrypt JSON data
		async encryptJSON<T>(data: T): Promise<{ ciphertext: string; iv: string }> {
			const key = this.getKey();
			if (!key) throw new Error('Crypto store is locked');
			return encryptJSON(key, data);
		},

		// Decrypt JSON data
		async decryptJSON<T>(ciphertext: string, iv: string): Promise<T> {
			const key = this.getKey();
			if (!key) throw new Error('Crypto store is locked');
			return decryptJSON(key, ciphertext, iv);
		},

		// Get the stored salt (for backup/recovery purposes)
		async getSalt(): Promise<Uint8Array | null> {
			return getSalt();
		},

		// Check if keystore has a key
		async hasKey(): Promise<boolean> {
			return hasKey();
		}
	};
}

export const cryptoStore = createCryptoStore();

// Re-export utilities for direct use
export { validateMnemonic } from './encryption';

import * as bip39 from 'bip39';

// Generate a new BIP39 mnemonic (24 words for 256-bit entropy)
export function generateMnemonic(): string {
	return bip39.generateMnemonic(256);
}

// Validate a mnemonic phrase
export function validateMnemonic(mnemonic: string): boolean {
	return bip39.validateMnemonic(mnemonic);
}

// Derive an AES-256-GCM key from a mnemonic using PBKDF2
export async function deriveKeyFromMnemonic(
	mnemonic: string,
	salt: Uint8Array
): Promise<CryptoKey> {
	// Convert mnemonic to seed (512-bit)
	const seed = await bip39.mnemonicToSeed(mnemonic);

	// Import seed as raw key material for PBKDF2
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		seed,
		'PBKDF2',
		false,
		['deriveKey']
	);

	// Derive AES-256-GCM key using PBKDF2
	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt,
			iterations: 600000, // OWASP recommendation for PBKDF2-SHA256
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false, // Not extractable for security
		['encrypt', 'decrypt']
	);
}

// Generate a random salt for key derivation
export function generateSalt(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(32));
}

// Encrypt data using AES-256-GCM
export async function encrypt(
	key: CryptoKey,
	plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);

	// Generate a random 12-byte IV (recommended for GCM)
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		data
	);

	return {
		ciphertext: arrayBufferToBase64(encrypted),
		iv: arrayBufferToBase64(iv)
	};
}

// Decrypt data using AES-256-GCM
export async function decrypt(
	key: CryptoKey,
	ciphertext: string,
	iv: string
): Promise<string> {
	const decoder = new TextDecoder();

	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
		key,
		base64ToArrayBuffer(ciphertext)
	);

	return decoder.decode(decrypted);
}

// Encrypt a JSON object
export async function encryptJSON<T>(
	key: CryptoKey,
	data: T
): Promise<{ ciphertext: string; iv: string }> {
	return encrypt(key, JSON.stringify(data));
}

// Decrypt to a JSON object
export async function decryptJSON<T>(
	key: CryptoKey,
	ciphertext: string,
	iv: string
): Promise<T> {
	const json = await decrypt(key, ciphertext, iv);
	return JSON.parse(json);
}

// Utility: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// Utility: Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

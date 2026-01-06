const DB_NAME = 'health-assistant-keystore';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_ID = 'encryption-key';
const SALT_ID = 'key-salt';

interface KeystoreEntry {
	id: string;
	key?: CryptoKey;
	salt?: Uint8Array;
}

// Open or create the IndexedDB database
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

// Store the encryption key in IndexedDB
export async function storeKey(key: CryptoKey): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const entry: KeystoreEntry = { id: KEY_ID, key };
		const request = store.put(entry);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();

		transaction.oncomplete = () => db.close();
	});
}

// Retrieve the encryption key from IndexedDB
export async function getKey(): Promise<CryptoKey | null> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(KEY_ID);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const entry = request.result as KeystoreEntry | undefined;
			resolve(entry?.key ?? null);
		};

		transaction.oncomplete = () => db.close();
	});
}

// Store the salt used for key derivation
export async function storeSalt(salt: Uint8Array): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const entry: KeystoreEntry = { id: SALT_ID, salt };
		const request = store.put(entry);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();

		transaction.oncomplete = () => db.close();
	});
}

// Retrieve the salt from IndexedDB
export async function getSalt(): Promise<Uint8Array | null> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(SALT_ID);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const entry = request.result as KeystoreEntry | undefined;
			resolve(entry?.salt ?? null);
		};

		transaction.oncomplete = () => db.close();
	});
}

// Check if a key exists in the keystore
export async function hasKey(): Promise<boolean> {
	const key = await getKey();
	return key !== null;
}

// Clear all keys from the keystore (for logout)
export async function clearKeystore(): Promise<void> {
	const db = await openDatabase();

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();

		transaction.oncomplete = () => db.close();
	});
}

// Delete the entire database (full reset)
export async function deleteKeystore(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DB_NAME);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

import { cryptoStore } from './store';

export interface EncryptedRecord {
	id: string;
	userId: string;
	type: string;
	date: string; // YYYY-MM-DD, kept unencrypted for date-range queries
	ciphertext: string;
	iv: string;
	createdAt: string;
	updatedAt: string;
}

export interface DecryptedRecord<T> {
	id: string;
	userId: string;
	type: string;
	date: string;
	data: T;
	createdAt: string;
	updatedAt: string;
}

// Data types that can be encrypted
export type DataType =
	| 'sleep'
	| 'activity'
	| 'activity_summary'
	| 'stress'
	| 'food_log'
	| 'medication_log'
	| 'health_note'
	| 'chat_message'
	| 'chat_conversation'
	| 'activity_rpe'
	| 'training_goal'
	| 'training_plan'
	| 'planned_workout'
	| 'settings'
	| 'garmin_tokens';

// API response wrapper
interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

class EncryptedDataService {
	private baseUrl = '/api/data';

	// Create a new encrypted record
	async create<T>(type: DataType, date: string, data: T): Promise<DecryptedRecord<T> | null> {
		try {
			const { ciphertext, iv } = await cryptoStore.encryptJSON(data);

			const response = await fetch(this.baseUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, date, ciphertext, iv })
			});

			const result: ApiResponse<EncryptedRecord> = await response.json();

			if (!result.success || !result.data) {
				console.error('Failed to create record:', result.error);
				return null;
			}

			return {
				id: result.data.id,
				userId: result.data.userId,
				type: result.data.type,
				date: result.data.date,
				data,
				createdAt: result.data.createdAt,
				updatedAt: result.data.updatedAt
			};
		} catch (error) {
			console.error('Error creating encrypted record:', error);
			return null;
		}
	}

	// Get a single record by ID
	async get<T>(id: string): Promise<DecryptedRecord<T> | null> {
		try {
			const response = await fetch(`${this.baseUrl}/${id}`);
			const result: ApiResponse<EncryptedRecord> = await response.json();

			if (!result.success || !result.data) {
				return null;
			}

			const data = await cryptoStore.decryptJSON<T>(
				result.data.ciphertext,
				result.data.iv
			);

			return {
				id: result.data.id,
				userId: result.data.userId,
				type: result.data.type,
				date: result.data.date,
				data,
				createdAt: result.data.createdAt,
				updatedAt: result.data.updatedAt
			};
		} catch (error) {
			console.error('Error getting encrypted record:', error);
			return null;
		}
	}

	// Get records by type and date range
	async getByType<T>(
		type: DataType,
		options?: {
			startDate?: string;
			endDate?: string;
			limit?: number;
		}
	): Promise<DecryptedRecord<T>[]> {
		try {
			const params = new URLSearchParams({ type });
			if (options?.startDate) params.set('startDate', options.startDate);
			if (options?.endDate) params.set('endDate', options.endDate);
			if (options?.limit) params.set('limit', options.limit.toString());

			const response = await fetch(`${this.baseUrl}?${params}`);
			const result: ApiResponse<EncryptedRecord[]> = await response.json();

			if (!result.success || !result.data) {
				return [];
			}

			// Decrypt all records in parallel
			const decrypted = await Promise.all(
				result.data.map(async (record) => {
					try {
						const data = await cryptoStore.decryptJSON<T>(
							record.ciphertext,
							record.iv
						);
						return {
							id: record.id,
							userId: record.userId,
							type: record.type,
							date: record.date,
							data,
							createdAt: record.createdAt,
							updatedAt: record.updatedAt
						};
					} catch (error) {
						console.error('Error decrypting record:', record.id, error);
						return null;
					}
				})
			);

			return decrypted.filter((r): r is DecryptedRecord<T> => r !== null);
		} catch (error) {
			console.error('Error getting encrypted records:', error);
			return [];
		}
	}

	// Get single record by type and date (for unique date entries like sleep/stress)
	async getByTypeAndDate<T>(type: DataType, date: string): Promise<DecryptedRecord<T> | null> {
		const records = await this.getByType<T>(type, { startDate: date, endDate: date, limit: 1 });
		return records[0] || null;
	}

	// Update a record
	async update<T>(id: string, data: T): Promise<DecryptedRecord<T> | null> {
		try {
			const { ciphertext, iv } = await cryptoStore.encryptJSON(data);

			const response = await fetch(`${this.baseUrl}/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ciphertext, iv })
			});

			const result: ApiResponse<EncryptedRecord> = await response.json();

			if (!result.success || !result.data) {
				console.error('Failed to update record:', result.error);
				return null;
			}

			return {
				id: result.data.id,
				userId: result.data.userId,
				type: result.data.type,
				date: result.data.date,
				data,
				createdAt: result.data.createdAt,
				updatedAt: result.data.updatedAt
			};
		} catch (error) {
			console.error('Error updating encrypted record:', error);
			return null;
		}
	}

	// Upsert - create or update by type and date
	async upsert<T>(type: DataType, date: string, data: T): Promise<DecryptedRecord<T> | null> {
		// Check if record exists
		const existing = await this.getByTypeAndDate<T>(type, date);

		if (existing) {
			return this.update(existing.id, data);
		} else {
			return this.create(type, date, data);
		}
	}

	// Delete a record
	async delete(id: string): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/${id}`, {
				method: 'DELETE'
			});

			const result: ApiResponse<void> = await response.json();
			return result.success;
		} catch (error) {
			console.error('Error deleting encrypted record:', error);
			return false;
		}
	}

	// Bulk create records (for import/sync)
	async bulkCreate<T>(
		type: DataType,
		records: Array<{ date: string; data: T }>
	): Promise<number> {
		let created = 0;

		// Encrypt and send in batches
		const batchSize = 50;
		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize);

			const encryptedBatch = await Promise.all(
				batch.map(async ({ date, data }) => {
					const { ciphertext, iv } = await cryptoStore.encryptJSON(data);
					return { type, date, ciphertext, iv };
				})
			);

			try {
				const response = await fetch(`${this.baseUrl}/bulk`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ records: encryptedBatch })
				});

				const result: ApiResponse<{ created: number }> = await response.json();
				if (result.success && result.data) {
					created += result.data.created;
				}
			} catch (error) {
				console.error('Error in bulk create:', error);
			}
		}

		return created;
	}
}

export const encryptedData = new EncryptedDataService();

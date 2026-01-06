import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Buffer as BufferType } from 'buffer';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
	}
	interface Window {
		Buffer: typeof BufferType;
	}
}

export {};

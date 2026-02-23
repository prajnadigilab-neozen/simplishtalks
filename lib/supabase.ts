
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration. Check your .env.local file.");
}

/**
 * Supabase client with Navigator Lock disabled.
 *
 * The default lock mechanism uses browser's navigator.locks API, causing
 * NavigatorLockAcquireTimeoutError when multiple concurrent auth calls are
 * made during initialization (getSession + onAuthStateChange + getUserSession).
 *
 * By providing a no-op lock function, we allow all auth operations to proceed
 * concurrently without deadlocking. This is safe for single-tab web apps using
 * JWT-based sessions (which Supabase uses).
 */
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'simplishtalks-auth-token',
  }
});

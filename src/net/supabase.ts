import type { SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when this build is connected to Supabase (online rooms, shared gardens, community questions). */
export const online = !!(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

/** Lazily load the Supabase client so the first paint does not wait for it. */
export function sb(): Promise<SupabaseClient> {
  if (!online) return Promise.reject(new Error('offline build'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  );
  return client;
}

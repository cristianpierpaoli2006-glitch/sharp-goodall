import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = (): boolean => {
  return !!(
    rawUrl &&
    rawAnonKey &&
    rawUrl !== 'https://your-project-id.supabase.co' &&
    rawAnonKey !== 'your-anon-key-here' &&
    rawUrl.startsWith('https://')
  );
};

// Se non è ancora configurato, usiamo un URL dummy valido per evitare eccezioni fatali all'importazione
const supabaseUrl = isSupabaseConfigured() ? rawUrl! : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured() ? rawAnonKey! : 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

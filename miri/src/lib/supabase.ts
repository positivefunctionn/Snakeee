import { createClient, type SupabaseClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = Boolean(url && key);
// The app renders its setup screen whenever configuration is missing, before this
// client can issue a request. Keeping a typed client avoids nullable client calls
// throughout protected UI code while never embedding credentials in the bundle.
export const supabase: SupabaseClient = createClient(
  url ?? 'https://miri-unconfigured.invalid',
  key ?? 'unconfigured-client-key',
  { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } },
);

import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: (options?: { template?: string }) => Promise<string | null>;
      } | null;
    };
  }
}

const FALLBACK_SUPABASE_URL = 'https://gwctdvjdfvhunwpukdyi.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Y3RkdmpkZnZodW53cHVrZHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NDgzNzIsImV4cCI6MjEwNDAyNDM3Mn0.S4l4-nwsmbGeY05DWg9fBg1t9nNDIctos7SzgFIv12Q';

const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseUrl = (envUrl && !envUrl.includes('your-project')) ? envUrl.trim() : FALLBACK_SUPABASE_URL;
const supabaseAnonKey = (envAnonKey && !envAnonKey.includes('your_supabase_anon_key')) ? envAnonKey.trim() : FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Attaches the current Clerk session token to every Supabase request, so RLS
// policies can verify `auth.jwt()->>'sub'` against the Clerk-authenticated user
// instead of trusting the client-side `user_id` filter alone. Requires Clerk to
// be added as a Third-Party Auth provider in the Supabase dashboard first.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        try {
          return (await window.Clerk?.session?.getToken()) ?? null;
        } catch {
          return null;
        }
      },
    })
  : null;

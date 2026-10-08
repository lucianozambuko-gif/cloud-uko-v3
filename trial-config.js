/**
 * Public, client-safe config for the demo trial system.
 *
 * SUPABASE_ANON_KEY is designed to be public - it only grants whatever
 * access the Row Level Security policies in supabase/schema.sql allow
 * (a user can read/create their own trial_access row, nothing more).
 * The real secret, SUPABASE_SERVICE_ROLE_KEY, only ever lives in the
 * server/ backend's environment variables - never here.
 *
 * Fill these in once the Supabase project and Render backend exist.
 */
const TRIAL_CONFIG = {
    SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR-SUPABASE-ANON-KEY',
    BACKEND_URL: 'https://YOUR-RENDER-SERVICE.onrender.com',
    TRIAL_LENGTH_DAYS: 7
};

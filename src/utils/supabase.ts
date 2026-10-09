import { supabase as centralizedClient, supabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

export const supabase = centralizedClient;
export { supabaseClient, isSupabaseConfigured };
export default supabase;

import { createClient } from '@supabase/supabase-js';
import { supabase as centralizedClient, supabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://hlkprapotgvtmqqnwddx.supabase.co';
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';

export const supabase = centralizedClient || createClient(supabaseUrl, supabaseKey);
export { supabaseClient, isSupabaseConfigured };
export default supabase;

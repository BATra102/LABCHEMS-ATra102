import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables or localStorage config for client-side configuration
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const envPublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  '';

const localUrl = typeof window !== 'undefined' ? localStorage.getItem('labchem_supabase_url') || '' : '';
const localPublishableKey =
  typeof window !== 'undefined'
    ? localStorage.getItem('labchem_supabase_publishable_key') ||
      localStorage.getItem('labchem_supabase_anon_key') ||
      ''
    : '';

const activeUrl = envUrl || localUrl || 'https://placeholder-project.supabase.co';
const activePublishableKey = envPublishableKey || localPublishableKey || 'placeholder-publishable-key';

export const isSupabaseConfigured = (): boolean => {
  const url = envUrl || (typeof window !== 'undefined' ? localStorage.getItem('labchem_supabase_url') || '' : '');
  const key =
    envPublishableKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('labchem_supabase_publishable_key') ||
        localStorage.getItem('labchem_supabase_anon_key') ||
        ''
      : '');
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    !url.includes('placeholder-project') &&
    key.length > 20
  );
};

export const getSupabaseConfig = () => {
  const url = envUrl || (typeof window !== 'undefined' ? localStorage.getItem('labchem_supabase_url') || '' : '');
  const publishableKey =
    envPublishableKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('labchem_supabase_publishable_key') ||
        localStorage.getItem('labchem_supabase_anon_key') ||
        ''
      : '');
  return {
    url,
    publishableKey,
    anonKey: publishableKey, // backward compatible alias
    isFromEnv: Boolean(envUrl && envPublishableKey),
    isConfigured: isSupabaseConfigured(),
  };
};

// Helper to build a client instance
const createClientInstance = (url: string, key: string): SupabaseClient => {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });
};

let currentClientInstance: SupabaseClient = createClientInstance(activeUrl, activePublishableKey);

export const reinitializeSupabaseClient = (customUrl?: string, customKey?: string): SupabaseClient => {
  const url =
    customUrl ||
    envUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('labchem_supabase_url') || '' : '') ||
    activeUrl;
  const key =
    customKey ||
    envPublishableKey ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('labchem_supabase_publishable_key') ||
        localStorage.getItem('labchem_supabase_anon_key') ||
        ''
      : '') ||
    activePublishableKey;

  currentClientInstance = createClientInstance(url, key);
  return currentClientInstance;
};

export const saveCustomSupabaseConfig = (url: string, publishableKey: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('labchem_supabase_url', url.trim());
    localStorage.setItem('labchem_supabase_publishable_key', publishableKey.trim());
    // Also sync old key for backward compatibility
    localStorage.setItem('labchem_supabase_anon_key', publishableKey.trim());
  }
  reinitializeSupabaseClient(url.trim(), publishableKey.trim());
};

export const clearCustomSupabaseConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('labchem_supabase_url');
    localStorage.removeItem('labchem_supabase_publishable_key');
    localStorage.removeItem('labchem_supabase_anon_key');
  }
  reinitializeSupabaseClient(
    envUrl || 'https://placeholder-project.supabase.co',
    envPublishableKey || 'placeholder-publishable-key'
  );
};

// Create Supabase client singleton Proxy with realtime enabled
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = currentClientInstance as any;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export const testSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Chưa cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY.',
    };
  }

  const start = performance.now();
  try {
    const { error } = await supabase.from('chemicals').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: `Kết nối host Supabase thành công nhưng chưa tạo bảng 'chemicals' (Lỗi 42P01). Bạn chỉ cần mở Supabase Dashboard -> SQL Editor và chạy file 'supabase/migrations/20261003000000_init_labchem.sql'.`,
          latencyMs,
        };
      }
      // If permission denied or other error
      return {
        success: false,
        message: `Lỗi kết nối Supabase: ${error.message} (Mã lỗi: ${error.code || 'UNKNOWN'})`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Kết nối Supabase thành công! Độ trễ phản hồi: ${latencyMs}ms`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: `Không thể kết nối đến Supabase host: ${err?.message || 'Lỗi mạng'}`,
      latencyMs,
    };
  }
};

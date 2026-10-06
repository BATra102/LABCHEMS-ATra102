import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Đọc thông tin cấu hình tập trung từ biến môi trường của ứng dụng
// Tuyệt đối không yêu cầu người dùng nhập thủ công URL hay API Key trên giao diện
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const envPublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    envUrl &&
    envPublishableKey &&
    envUrl.startsWith('https://') &&
    !envUrl.includes('placeholder-project') &&
    envPublishableKey.length > 20
  );
};

// Supabase client dùng chung duy nhất cho toàn bộ ứng dụng
export const supabaseClient: SupabaseClient = createClient(
  envUrl || 'https://placeholder-project.supabase.co',
  envPublishableKey || 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  }
);

// Alias xuất khẩu chuẩn hóa
export const supabase = supabaseClient;

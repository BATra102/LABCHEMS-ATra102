import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient, supabase, isSupabaseConfigured } from './supabaseClient';

export { supabaseClient, supabase, isSupabaseConfigured };

// Lấy thông tin cấu hình phục vụ trạng thái hiển thị (tuyệt đối không để lộ Secret Key)
export const getSupabaseConfig = () => {
  const envUrl =
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    'https://hlkprapotgvtmqqnwddx.supabase.co';
  const envPublishableKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';

  return {
    url: envUrl,
    publishableKey: envPublishableKey,
    anonKey: envPublishableKey,
    isFromEnv: Boolean(envUrl && envPublishableKey),
    isConfigured: isSupabaseConfigured(),
    // Tên miền hiển thị an toàn (không hiển thị đầy đủ token hay key)
    maskedHost: envUrl ? new URL(envUrl).hostname : 'hlkprapotgvtmqqnwddx.supabase.co',
  };
};

// Storage adapter an toàn cho Supabase Auth hỗ trợ "Ghi nhớ đăng nhập trên thiết bị này"
export const authStorageAdapter = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const isRemembered = localStorage.getItem('labchem_remember_me') !== 'false';
    const sessionVal = sessionStorage.getItem(key);
    if (sessionVal) return sessionVal;
    if (isRemembered) {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const isRemembered = localStorage.getItem('labchem_remember_me') !== 'false';
    if (isRemembered) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

// Không còn cho phép lưu hoặc thay đổi cấu hình thủ công vào localStorage
export const reinitializeSupabaseClient = (): SupabaseClient => {
  return supabaseClient;
};

export const saveCustomSupabaseConfig = (_url: string, _publishableKey: string) => {
  console.info('LabChem sử dụng Cloud Database tập trung đã cấu hình sẵn qua biến môi trường.');
};

export const clearCustomSupabaseConfig = () => {
  console.info('LabChem sử dụng Cloud Database tập trung đã cấu hình sẵn qua biến môi trường.');
};

// Hàm kiểm tra kết nối (Ping test) tới Supabase Cloud Database
export const testSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Chưa cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY trên môi trường ứng dụng.',
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
          message: `Kết nối host Supabase thành công nhưng chưa tạo bảng 'chemicals' (Lỗi 42P01).`,
          latencyMs,
        };
      }
      // Phân quyền RLS đang chặn anon hoặc permission error
      if (error.code === '42501') {
        return {
          success: true,
          message: `Kết nối Supabase Cloud thành công (RLS bảo vệ: yêu cầu đăng nhập tài khoản). Độ trễ: ${latencyMs}ms`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Lỗi kết nối Supabase: ${error.message} (Mã lỗi: ${error.code || 'UNKNOWN'})`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: `Đã kết nối Cloud Database thành công! Độ trễ phản hồi: ${latencyMs}ms`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: `Không thể kết nối đến Supabase Cloud Database: ${err?.message || 'Lỗi mạng'}`,
      latencyMs,
    };
  }
};

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole, UserStatus } from '../types';
import { isSeniorManagerEmail } from '../utils/roleUtils';

export const rowToUser = (row: any): User => {
  const isSenior = row.is_senior_manager || isSeniorManagerEmail(row.google_email);
  const role: UserRole = isSenior ? 'SENIOR_MANAGER' : ((row.role || 'USER') as UserRole);
  const isManagerLike = role === 'SENIOR_MANAGER' || role === 'MANAGER' || role === 'ADMIN' || role === 'LAB_MANAGER';
  const isStaff = role === 'STAFF';
  const isViewer = role === 'VIEWER';

  return {
    id: row.id,
    username:
      row.username ||
      (isSenior
        ? 'manager'
        : row.email
        ? row.email.split('@')[0]
        : row.google_email
        ? row.google_email.split('@')[0]
        : ''),
    name: row.full_name || (isSenior ? 'Người quản lý cao cấp' : 'Người dùng Lab'),
    email: row.google_email || row.email || '',
    role,
    status: (row.status || 'ACTIVE') as UserStatus,
    department: row.department || 'Bộ môn Dược liệu & Chiết xuất',
    picture: row.avatar_url || undefined,
    position: row.job_title || undefined,
    phone: row.phone || undefined,
    member_code: row.member_code || undefined,
    notes: row.notes || undefined,
    manager_id: row.manager_id || undefined,
    manager_name: row.manager_name || undefined,
    limits: row.limits || {
      maxUsagePerTransaction: isManagerLike ? null : 100,
      dailyUsageLimit: isManagerLike ? null : 500,
      dailyTransactionCount: isManagerLike ? null : 10,
      maxStockInQuantity: isManagerLike ? null : isStaff ? 20 : 5,
    },
    permissions: row.permissions || {
      viewInventory: true,
      addChemical: isManagerLike,
      editChemical: isManagerLike,
      archiveChemical: isManagerLike,
      deleteChemical: isManagerLike,
      restoreChemical: isManagerLike,
      recordUsage: !isViewer,
      viewAllUsageHistory: isManagerLike || isStaff,
      createStockIn: isManagerLike || isStaff,
      adjustStock: isManagerLike,
      importExcel: isManagerLike,
      viewReports: isManagerLike || isStaff,
      manageUsers: isManagerLike,
    },
    dateJoined: row.created_at ? row.created_at.split('T')[0] : undefined,
    lastLogin: row.last_login_at || undefined,
    deleted_at: row.deleted_at || undefined,
    deleted_by: row.deleted_by || undefined,
    deleted_by_name: row.deleted_by_name || undefined,
    deletion_reason: row.deletion_reason || undefined,
    must_change_password: Boolean(row.must_change_password),
  };
};

export const authService = {
  async signInWithUsername(username: string, password: string): Promise<{ data: any; error: any }> {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      return { data: null, error: new Error('Vui lòng nhập Tên đăng nhập.') };
    }

    // 1. Thử gọi backend API bảo mật /api/login-with-username
    try {
      const res = await fetch('/api/login-with-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed, password }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.session) {
          try {
            await supabase.auth.setSession({
              access_token: json.session.access_token,
              refresh_token: json.session.refresh_token,
            });
          } catch (_) {}
          return { data: json, error: null };
        }
        if (json.success && json.user) {
          return { data: json, error: null };
        }
        if (!json.success) {
          return { data: null, error: new Error(json.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.') };
        }
      }
    } catch (_) {}

    // 2. Tra cứu email nội bộ tương ứng với username
    let internalEmail = '';
    const isSenior =
      trimmed === 'manager' ||
      trimmed === 'admin' ||
      trimmed === 'buiantra' ||
      trimmed === 'buiantra2021' ||
      trimmed === 'buiantra2021@gmail.com';
    const isLabMgr =
      trimmed === 'labmanager' ||
      trimmed === 'jasminebee279' ||
      trimmed === 'jasminebee279@gmail.com';

    if (isSenior) {
      internalEmail = 'buiantra2021@gmail.com';
    } else if (isLabMgr) {
      internalEmail = 'jasminebee279@gmail.com';
    } else {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email, google_email, username')
          .ilike('username', trimmed)
          .maybeSingle();

        if (prof?.email || prof?.google_email) {
          internalEmail = prof.email || prof.google_email;
        }
      } catch (_) {}

      if (!internalEmail) {
        internalEmail = `${trimmed}@labchem.local`;
      }
    }

    return supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
  },

  async signInWithPassword(email: string, password: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase chưa được cấu hình.');
    }
    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  async signUpWithPassword(email: string, password: string, fullName?: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase chưa được cấu hình.');
    }
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
  },

  async resetPasswordForEmail(email: string, redirectTo?: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase chưa được cấu hình.');
    }
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || window.location.origin,
    });
  },

  async updateUserPassword(newPassword: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase chưa được cấu hình.');
    }
    return supabase.auth.updateUser({
      password: newPassword,
    });
  },

  async signInWithGoogle() {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase chưa được cấu hình. Vui lòng nhập Project URL và Publishable Key trong Cài Đặt.');
    }
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  },

  async signOut() {
    if (!isSupabaseConfigured()) return;
    return supabase.auth.signOut();
  },

  async getCurrentSession() {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return authListener.subscription;
  },

  async fetchProfiles(): Promise<{ data: User[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      const formatted: User[] = (data || []).map(rowToUser);
      return { data: formatted, error: null };
    } catch (err: any) {
      if (err?.code !== '42501') {
        console.error('authService.fetchProfiles error:', err);
      } else {
        console.warn('authService.fetchProfiles (permission denied or unauthenticated):', err.message);
      }
      return { data: null, error: err };
    }
  },

  async getProfile(userId: string): Promise<{ data: User | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { data: null, error: null };
      return { data: rowToUser(data), error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  async syncAuthUser(authUser: any): Promise<{ user: User | null; error: any }> {
    if (!isSupabaseConfigured() || !authUser) {
      return { user: null, error: new Error('Supabase chưa sẵn sàng') };
    }

    try {
      const email = authUser.email || '';
      const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0];
      const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;

      // 1. Check existing profile
      const { data: existing, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existing) {
        // Update last login safely via secure RPC
        try {
          await supabase.rpc('update_own_profile', {
            p_avatar_url: avatarUrl || existing.avatar_url,
          });
        } catch (_) {}

        return { user: rowToUser({ ...existing, last_login_at: new Date().toISOString() }), error: null };
      }

      // 2. New User: The Supabase trigger handle_new_user() automatically provisions profile
      // Check if trigger has already created the profile
      const { data: createdByTrigger } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (createdByTrigger) {
        return { user: rowToUser(createdByTrigger), error: null };
      }

      // Fallback: If trigger was not installed yet
      const isSenior = isSeniorManagerEmail(email);
      const isDefaultManager = isSenior || email.toLowerCase().includes('jasminebee279') || email.toLowerCase().includes('buianhtra') || email.toLowerCase().includes('buiantra');
      const newRole: UserRole = isSenior ? 'SENIOR_MANAGER' : isDefaultManager ? 'MANAGER' : 'USER';
      const newStatus: UserStatus = (isSenior || isDefaultManager) ? 'ACTIVE' : 'PENDING';

      const payload = {
        id: authUser.id,
        google_email: email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: newRole,
        department: 'Bộ môn Dược liệu & Chiết xuất',
        status: newStatus,
        last_login_at: new Date().toISOString(),
      };

      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .insert(payload)
        .select()
        .maybeSingle();

      if (insertErr) {
        console.warn('Profile creation notice (handled by DB trigger):', insertErr.message);
      }
      return { user: created ? rowToUser(created) : null, error: null };
    } catch (err: any) {
      console.error('authService.syncAuthUser error:', err);
      return { user: null, error: err };
    }
  },

  async updateProfile(id: string, updates: Partial<User>): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      // 1. Try secure RPC update_own_profile first for personal field updates
      const { error: rpcErr } = await supabase.rpc('update_own_profile', {
        p_full_name: updates.name || null,
        p_avatar_url: updates.avatar_url || updates.picture || null,
        p_phone: updates.phone || null,
        p_job_title: updates.position || null,
        p_notes: updates.notes || null,
      });

      if (!rpcErr) {
        return { success: true, error: null };
      }

      // 2. If Manager is updating another user profile
      const payload: any = {};
      if (updates.name !== undefined) payload.full_name = updates.name;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.department !== undefined) payload.department = updates.department;
      if (updates.position !== undefined) payload.job_title = updates.position;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.member_code !== undefined) payload.member_code = updates.member_code;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.manager_id !== undefined) payload.manager_id = updates.manager_id;
      if (updates.manager_name !== undefined) payload.manager_name = updates.manager_name;
      if (updates.limits !== undefined) payload.limits = updates.limits;
      if (updates.permissions !== undefined) payload.permissions = updates.permissions;
      if (updates.deleted_at !== undefined) payload.deleted_at = updates.deleted_at;
      if (updates.deleted_by !== undefined) payload.deleted_by = updates.deleted_by;
      if (updates.deleted_by_name !== undefined) payload.deleted_by_name = updates.deleted_by_name;
      if (updates.deletion_reason !== undefined) payload.deletion_reason = updates.deletion_reason;

      payload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('authService.updateProfile error:', err);
      return { success: false, error: err };
    }
  },
};

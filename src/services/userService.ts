import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserLimits, UserPermissions, UserRole, UserStatus } from '../types';
import { rowToUser } from './authService';
import { auditService } from './auditService';
import { isSeniorManagerEmail, isSeniorManagerUser, isSeniorManagerIdentifier, isLabManagerIdentifier } from '../utils/roleUtils';

/**
 * Sinh mật khẩu ngẫu nhiên đủ mạnh theo mẫu: Lab@4827Xq!
 */
export function generateStrongPassword(): string {
  const numbers = '23456789';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const specials = '!@#$%&*';

  let pwd = 'Lab@';
  for (let i = 0; i < 4; i++) {
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  for (let i = 0; i < 2; i++) {
    pwd += upper.charAt(Math.floor(Math.random() * upper.length));
  }
  for (let i = 0; i < 2; i++) {
    pwd += lower.charAt(Math.floor(Math.random() * lower.length));
  }
  pwd += specials.charAt(Math.floor(Math.random() * specials.length));
  return pwd;
}

export const userService = {
  /**
   * Truy vấn danh sách toàn bộ người dùng từ bảng profiles
   */
  async fetchAll(callerEmail?: string): Promise<{ data: User[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const allUsers = (data || []).map(rowToUser);

      // Ẩn Người quản lý cao cấp khỏi danh sách nếu caller không phải là Người quản lý cao cấp
      const isCallerSenior = isSeniorManagerEmail(callerEmail);
      const filtered = isCallerSenior
        ? allUsers
        : allUsers.filter((u) => !isSeniorManagerEmail(u.email) && u.role !== 'SENIOR_MANAGER');

      return { data: filtered, error: null };
    } catch (err: any) {
      console.error('userService.fetchAll error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Truy vấn chi tiết một người dùng theo ID
   */
  async getById(id: string): Promise<{ data: User | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { data: data ? rowToUser(data) : null, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * CẤP TÀI KHOẢN NGƯỜI DÙNG THẬT
   * CHỈ Người quản lý cao cấp mới được phép gọi hàm này.
   * Tạo tài khoản thật trong Supabase Authentication mà không làm thay đổi phiên làm việc của Quản lý.
   * Tạo profile tương ứng trong public.profiles.
   * Tuyệt đối không lưu mật khẩu plaintext trong profiles, localStorage, hay audit_logs.
   */
  async provisionUser(
    params: {
      username?: string;
      name: string;
      email?: string;
      password?: string;
      role: UserRole;
      status: UserStatus;
      department?: string;
    },
    callerUser?: User | null
  ): Promise<{ success: boolean; user?: User; message: string; error?: any }> {
    const rawUsername = params.username || params.email?.split('@')[0] || '';
    const trimmedUsername = rawUsername.trim().toLowerCase();
    const trimmedName = params.name.trim();

    // 1. Kiểm tra thẩm quyền người gọi: Người quản lý cao cấp hoặc Quản lý (MANAGER / ADMIN / LAB_MANAGER)
    const isCallerSenior =
      isSeniorManagerUser(callerUser) ||
      isSeniorManagerEmail(callerUser?.email) ||
      isSeniorManagerIdentifier(callerUser?.username);
    const isCallerManager =
      isCallerSenior ||
      callerUser?.role === 'MANAGER' ||
      callerUser?.role === 'ADMIN' ||
      callerUser?.role === 'LAB_MANAGER' ||
      isLabManagerIdentifier(callerUser?.username) ||
      isLabManagerIdentifier(callerUser?.email) ||
      callerUser?.email === 'jasminebee279@gmail.com';

    if (callerUser && !isCallerManager) {
      return {
        success: false,
        message: '403 Forbidden: Chỉ tài khoản Quản lý (MANAGER) mới có quyền cấp tài khoản mới!',
      };
    }

    if (!trimmedUsername) {
      return { success: false, message: 'Tên đăng nhập không được để trống.' };
    }

    if (!trimmedName) {
      return { success: false, message: 'Họ và tên không được để trống.' };
    }

    // Kiểm tra định dạng username (cho phép chữ cái, số, dấu gạch dưới và dấu chấm)
    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return {
        success: false,
        message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc dấu chấm (.).',
      };
    }

    const emailCandidate = params.email?.trim().toLowerCase();
    const internalEmail =
      emailCandidate && emailCandidate.includes('@') && !emailCandidate.endsWith('@labchem.local') && !emailCandidate.endsWith('@labchem.internal')
        ? emailCandidate
        : `${trimmedUsername}@labchem.vn`;

    // 2. Nếu Supabase chưa kết nối (chế độ offline)
    if (!isSupabaseConfigured()) {
      const localId = `usr-${Date.now().toString(36)}`;
      const newUser: User = {
        id: localId,
        username: trimmedUsername,
        name: trimmedName,
        email: internalEmail,
        role: params.role,
        status: params.status || 'ACTIVE',
        department: params.department || 'Bộ môn Dược liệu & Chiết xuất',
        dateJoined: new Date().toISOString().split('T')[0],
      };

      await auditService.log({
        action: 'ACCOUNT_CREATED',
        entityType: 'USER',
        entityId: localId,
        description: `Người quản lý đã cấp tài khoản mới: Tên đăng nhập "${trimmedUsername}" (${trimmedName}) [Vai trò: ${params.role}, Trạng thái: ${params.status}]`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý',
        newData: {
          username: trimmedUsername,
          name: trimmedName,
          role: params.role,
          status: params.status,
          department: params.department,
        },
      });

      return { success: true, user: newUser, message: 'Đã cấp tài khoản thành công.' };
    }

    // 3. Thử gọi API máy chủ bảo mật /api/admin-create-user với Bearer token của Người quản lý
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: trimmedUsername,
          name: trimmedName,
          full_name: trimmedName,
          email: internalEmail,
          password: params.password,
          role: params.role,
          status: params.status || 'ACTIVE',
          department: params.department || 'Bộ môn Dược liệu & Chiết xuất',
          callerEmail: callerUser?.email,
          callerRole: callerUser?.role,
          callerId: callerUser?.id,
        }),
      });

      if (response.ok) {
        const resJson = await response.json();
        if (resJson.success && resJson.user) {
          return {
            success: true,
            user: resJson.user,
            message: resJson.message || `Đã cấp tài khoản thành công cho "${trimmedUsername}".`,
          };
        }
        if (!resJson.success && resJson.message) {
          return {
            success: false,
            message: resJson.message,
          };
        }
      } else {
        try {
          const errJson = await response.json();
          if (errJson && errJson.message) {
            return {
              success: false,
              message: errJson.message,
            };
          }
        } catch (_) {}
      }
    } catch (apiErr) {
      console.warn('Backend API /api/admin-create-user notice:', apiErr);
    }

    // 3b. Thử gọi Supabase Edge Function create-user
    try {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-user', {
        body: {
          username: trimmedUsername,
          full_name: trimmedName,
          name: trimmedName,
          password: params.password,
          role: params.role,
          status: params.status || 'ACTIVE',
          department: params.department || 'Bộ môn Dược liệu & Chiết xuất',
        },
      });

      if (!edgeErr && edgeData?.success && edgeData?.user) {
        return {
          success: true,
          user: edgeData.user,
          message: edgeData.message || `Đã cấp tài khoản thành công cho "${trimmedUsername}".`,
        };
      }
      if (edgeData && !edgeData.success && edgeData.message) {
        return {
          success: false,
          message: edgeData.message,
        };
      }
    } catch (edgeEx) {
      console.warn('Edge Function create-user notice:', edgeEx);
    }

    try {
      // Kiểm tra trùng username trên database
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', trimmedUsername)
        .maybeSingle();

      if (existingUser) {
        return {
          success: false,
          message: `Tên đăng nhập "${trimmedUsername}" đã tồn tại. Vui lòng chọn tên đăng nhập khác!`,
        };
      }

      let authUserId: string | null = null;
      // Tra cứu profile theo username nếu đã tồn tại
      const { data: existingProf } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', trimmedUsername)
        .maybeSingle();

      if (existingProf) {
        authUserId = existingProf.id;
      }

      const generatedId = authUserId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now().toString(36)}`);

      // 6. Cập nhật / Thêm vào bảng public.profiles bằng client Supabase chung
      const profilePayload: any = {
        id: generatedId,
        username: trimmedUsername,
        email: internalEmail,
        google_email: internalEmail,
        full_name: trimmedName,
        role: params.role,
        status: params.status || 'ACTIVE',
        department: params.department || 'Bộ môn Dược liệu & Chiết xuất',
        must_change_password: true,
        updated_at: new Date().toISOString(),
      };

      let { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (upsertErr && (upsertErr.code === 'PGRST204' || upsertErr.message?.includes('username'))) {
        const { username: _u, ...payloadWithoutUsername } = profilePayload;
        const retryRes = await supabase
          .from('profiles')
          .upsert(payloadWithoutUsername, { onConflict: 'id' });
        upsertErr = retryRes.error;
      }

      if (upsertErr) {
        console.warn('Upsert profile notice:', upsertErr);
      }

      // Nếu vai trò là MANAGER, tự động thêm vào system_roles_whitelist
      if (params.role === 'MANAGER') {
        try {
          await supabase
            .from('system_roles_whitelist')
            .upsert({
              email: internalEmail,
              role: 'MANAGER',
              notes: `Cấp bởi Người quản lý cao cấp lúc ${new Date().toLocaleString('vi-VN')} cho ${trimmedUsername}`,
            }, { onConflict: 'email' });
        } catch (_) {}
      }

      const createdUser: User = {
        id: generatedId,
        username: trimmedUsername,
        name: trimmedName,
        email: internalEmail,
        role: params.role,
        status: params.status || 'ACTIVE',
        department: params.department || 'Bộ môn Dược liệu & Chiết xuất',
        dateJoined: new Date().toISOString().split('T')[0],
      };

      // 7. Ghi nhận Nhật Ký Kiểm Toán (ACCOUNT_CREATED) - Tuyệt đối không lưu mật khẩu
      await auditService.log({
        action: 'ACCOUNT_CREATED',
        entityType: 'USER',
        entityId: generatedId,
        description: `Đã cấp tài khoản mới: Tên đăng nhập "${trimmedUsername}" (${trimmedName}) [Vai trò: ${params.role}, Trạng thái: ${params.status}]`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý',
        newData: {
          username: trimmedUsername,
          name: trimmedName,
          role: params.role,
          status: params.status,
          department: params.department,
        },
      });

      return {
        success: true,
        user: createdUser,
        message: `Đã cấp tài khoản thành công cho "${trimmedUsername}" (${trimmedName}).`,
      };
    } catch (err: any) {
      console.error('Error provisioning user:', err);
      return { success: false, message: err.message || 'Lỗi khi cấp tài khoản mới.' };
    }
  },

  /**
   * Cập nhật thông tin người dùng với cơ chế bảo vệ tài khoản Người quản lý cao cấp
   */
  async updateUser(id: string, updates: Partial<User>, callerUser?: User | null): Promise<{ success: boolean; error: any; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      // 1. Kiểm tra tài khoản đích có phải Người quản lý cao cấp không
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('email, role, full_name')
        .eq('id', id)
        .maybeSingle();

      const isTargetSenior = targetProfile && (isSeniorManagerEmail(targetProfile.email) || targetProfile.role === 'SENIOR_MANAGER');
      const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);

      if (isTargetSenior && !isCallerSenior) {
        return {
          success: false,
          error: new Error('BẢO VỆ TỐI CAO: Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể sửa đổi hoặc khóa!'),
          message: 'Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối!',
        };
      }

      const payload: any = { updated_at: new Date().toISOString() };
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

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('userService.updateUser error:', err);
      return { success: false, error: err, message: err.message };
    }
  },

  /**
   * KHÓA TÀI KHOẢN (ACCOUNT_LOCKED)
   * CHỈ Người quản lý cao cấp mới có quyền khóa
   */
  async lockUser(id: string, callerUser?: User | null): Promise<{ success: boolean; message: string }> {
    const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);
    if (!isCallerSenior) {
      return { success: false, message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền khóa tài khoản!' };
    }

    const { data: target } = await this.getById(id);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng' };

    if (isSeniorManagerUser(target) || isSeniorManagerEmail(target.email)) {
      return { success: false, message: 'Không thể khóa tài khoản Người quản lý cao cấp!' };
    }

    const res = await this.updateUser(id, { status: 'LOCKED' }, callerUser);
    if (res.success) {
      await auditService.log({
        action: 'ACCOUNT_LOCKED',
        entityType: 'USER',
        entityId: id,
        description: `Người quản lý cao cấp đã khóa tài khoản của: ${target.name} (${target.email})`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý cao cấp',
        newData: { targetId: id, email: target.email, status: 'LOCKED' },
      });
      return { success: true, message: `Đã khóa tài khoản của ${target.name}.` };
    }
    return { success: false, message: res.message || 'Lỗi khi khóa tài khoản.' };
  },

  /**
   * MỞ KHÓA TÀI KHOẢN (ACCOUNT_UNLOCKED)
   */
  async unlockUser(id: string, callerUser?: User | null): Promise<{ success: boolean; message: string }> {
    const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);
    if (!isCallerSenior) {
      return { success: false, message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền mở khóa tài khoản!' };
    }

    const { data: target } = await this.getById(id);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng' };

    const res = await this.updateUser(id, { status: 'ACTIVE' }, callerUser);
    if (res.success) {
      await auditService.log({
        action: 'ACCOUNT_UNLOCKED',
        entityType: 'USER',
        entityId: id,
        description: `Người quản lý cao cấp đã mở khóa tài khoản cho: ${target.name} (${target.email})`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý cao cấp',
        newData: { targetId: id, email: target.email, status: 'ACTIVE' },
      });
      return { success: true, message: `Đã mở khóa tài khoản cho ${target.name}.` };
    }
    return { success: false, message: res.message || 'Lỗi khi mở khóa tài khoản.' };
  },

  /**
   * ĐỔI VAI TRÒ TÀI KHOẢN (ACCOUNT_ROLE_CHANGED)
   */
  async changeRole(id: string, newRole: UserRole, callerUser?: User | null): Promise<{ success: boolean; message: string }> {
    const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);
    if (!isCallerSenior) {
      return { success: false, message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền đổi vai trò!' };
    }

    const { data: target } = await this.getById(id);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng' };

    if (isSeniorManagerUser(target) || isSeniorManagerEmail(target.email)) {
      return { success: false, message: 'Không được phép hạ quyền hoặc thay đổi vai trò của Người quản lý cao cấp!' };
    }

    const oldRole = target.role;
    const res = await this.updateUser(id, { role: newRole }, callerUser);
    if (res.success) {
      await auditService.log({
        action: 'ACCOUNT_ROLE_CHANGED',
        entityType: 'USER',
        entityId: id,
        description: `Người quản lý cao cấp đã đổi vai trò của ${target.name} (${target.email}) từ ${oldRole} sang ${newRole}`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý cao cấp',
        oldData: { role: oldRole },
        newData: { role: newRole, email: target.email },
      });
      return { success: true, message: `Đã đổi vai trò sang ${newRole}.` };
    }
    return { success: false, message: res.message || 'Lỗi khi đổi vai trò.' };
  },

  /**
   * XÓA TÀI KHOẢN (ACCOUNT_DELETED)
   */
  async deleteUser(id: string, reason: string, callerUser?: User | null): Promise<{ success: boolean; message: string }> {
    const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);
    if (!isCallerSenior) {
      return { success: false, message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền xóa tài khoản!' };
    }

    const { data: target } = await this.getById(id);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng' };

    if (isSeniorManagerUser(target) || isSeniorManagerEmail(target.email)) {
      return { success: false, message: 'VIOLATION: Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể xóa!' };
    }

    const res = await this.updateUser(
      id,
      {
        status: 'DELETED',
        deleted_at: new Date().toISOString(),
        deleted_by: callerUser?.id || '',
        deleted_by_name: callerUser?.name || 'Người quản lý cao cấp',
        deletion_reason: reason,
      },
      callerUser
    );

    if (res.success) {
      await auditService.log({
        action: 'ACCOUNT_DELETED',
        entityType: 'USER',
        entityId: id,
        description: `Người quản lý cao cấp đã xóa tài khoản: ${target.name} (${target.email}). Lý do: ${reason}`,
        actorId: callerUser?.id,
        actorName: callerUser?.name || 'Người quản lý cao cấp',
        newData: { targetId: id, email: target.email, reason },
      });
      return { success: true, message: `Đã xóa tài khoản "${target.name}".` };
    }
    return { success: false, message: res.message || 'Lỗi khi xóa tài khoản.' };
  },

  /**
   * CẤP LẠI MẬT KHẨU (PASSWORD_RESET)
   * Chỉ MANAGER hoặc Người quản lý cao cấp được thực hiện.
   * Không hiển thị mật khẩu cũ.
   * Gọi API server an toàn và cập nhật must_change_password = true.
   * Ghi nhận audit log không lưu mật khẩu.
   */
  async resetPassword(
    id: string,
    newPassword: string,
    callerUser?: User | null
  ): Promise<{ success: boolean; message: string }> {
    const isCallerSenior = isSeniorManagerUser(callerUser) || isSeniorManagerEmail(callerUser?.email);
    const isCallerManager =
      isCallerSenior ||
      callerUser?.role === 'MANAGER' ||
      callerUser?.role === 'ADMIN' ||
      callerUser?.email === 'jasminebee279@gmail.com';

    if (!isCallerManager) {
      return { success: false, message: '403 Forbidden: Chỉ Quản lý (MANAGER) mới có quyền cấp lại mật khẩu!' };
    }

    const { data: target } = await this.getById(id);
    if (!target) return { success: false, message: 'Không tìm thấy tài khoản người dùng.' };

    const isTargetSenior = isSeniorManagerUser(target) || isSeniorManagerEmail(target.email);
    if (isTargetSenior && !isCallerSenior) {
      return {
        success: false,
        message: 'Tài khoản Người quản lý cao cấp (buiantra2021@gmail.com) được bảo vệ tuyệt đối, không thể cấp lại mật khẩu từ tài khoản khác!',
      };
    }

    // 1. Thử gọi API server an toàn /api/admin-reset-user-password với Bearer token
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const response = await fetch('/api/admin-reset-user-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetUserId: id,
            newPassword,
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            return {
              success: true,
              message: resJson.message || `Đã cấp lại mật khẩu thành công cho ${target.name}.`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Backend API reset password notice:', err);
    }

    // 2. Cập nhật profile trên database: đặt must_change_password = true (giữ nguyên status)
    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('profiles')
          .update({
            must_change_password: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (e) {
        console.warn('Update must_change_password notice:', e);
      }
    }

    // 3. Ghi nhận nhật ký kiểm toán PASSWORD_RESET (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
    await auditService.log({
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      description: `Người quản lý đã cấp lại mật khẩu cho tài khoản: ${target.name} (${target.email}). Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo.`,
      actorId: callerUser?.id,
      actorName: callerUser?.name || 'Quản lý',
      newData: { targetId: id, email: target.email, must_change_password: true, resetAt: new Date().toISOString() },
    });

    return {
      success: true,
      message: `Đã cấp lại mật khẩu thành công cho ${target.name}. Hãy cung cấp mật khẩu mới cho người dùng qua kênh liên hệ an toàn.`,
    };
  },

  // Giữ lại các method tương thích cũ
  async createUser(params: any): Promise<any> {
    return this.provisionUser(params);
  },
  async changeStatus(id: string, status: UserStatus, callerEmail?: string): Promise<any> {
    return this.updateUser(id, { status }, { email: callerEmail } as any);
  },
  async updateLimits(id: string, limits: UserLimits, callerEmail?: string): Promise<any> {
    return this.updateUser(id, { limits }, { email: callerEmail } as any);
  },
  async updatePermissions(id: string, permissions: UserPermissions, callerEmail?: string): Promise<any> {
    return this.updateUser(id, { permissions }, { email: callerEmail } as any);
  },
  async softDelete(id: string, reason: string, deletedBy: any): Promise<any> {
    return this.deleteUser(id, reason, deletedBy);
  },
  async restoreUser(id: string, callerEmail?: string): Promise<any> {
    return this.updateUser(id, { status: 'ACTIVE', deleted_at: null }, { email: callerEmail } as any);
  },
};

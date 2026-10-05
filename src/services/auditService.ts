import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types';

export type AuthActionType = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'ACCESS_DENIED';

export interface AuditLogInput {
  action: string;
  entityType?: 'CHEMICAL' | 'BOTTLE' | 'USER' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM' | 'PURCHASE' | 'ADJUSTMENT' | 'DISCREPANCY' | 'IMPORT' | 'REQUEST';
  entityId?: string;
  description: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  oldData?: any;
  newData?: any;
}

export interface AuthAuditParams {
  email?: string;
  userId?: string;
  userName?: string;
  role?: string;
  department?: string;
  reason?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

/**
 * Kiểm tra xem chuỗi có phải là định dạng UUID hợp lệ hay không.
 * Phòng ngừa lỗi định dạng khi truyền vào cột uuid của Supabase PostgreSQL.
 */
function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Tẩy sạch tuyệt đối mật khẩu và thông tin bí mật trước khi lưu vào audit_logs.
 * Đảm bảo ngay cả khi dữ liệu đầu vào chứa trường mật khẩu, nó cũng sẽ bị loại bỏ hoàn toàn.
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const sensitiveKeyPatterns = [
    'password',
    'passwd',
    'pass',
    'pwd',
    'secret',
    'token',
    'access_token',
    'refresh_token',
    'auth_token',
    'api_key',
    'apikey',
    'matkhau',
    'mat_khau',
  ];

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const isSensitive = sensitiveKeyPatterns.some((pattern) => lowerKey.includes(pattern));

    if (isSensitive) {
      // Loại bỏ hoàn toàn trường nhạy cảm, không lưu vào database
      continue;
    }

    if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeAuditData(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export const auditService = {
  /**
   * Ghi nhận sự kiện kiểm toán xác thực (Authentication Audit Event)
   * Các hành động chính: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, ACCESS_DENIED
   */
  async logAuthEvent(
    action: AuthActionType,
    params: AuthAuditParams
  ): Promise<void> {
    const cleanEmail = params.email?.trim().toLowerCase() || '';
    const cleanUserId = isValidUUID(params.userId) ? params.userId : undefined;
    const cleanUserName = params.userName || cleanEmail || 'Người dùng';

    let description = '';
    switch (action) {
      case 'LOGIN_SUCCESS':
        description = `Đăng nhập thành công: ${cleanUserName} (${cleanEmail || 'Tài khoản nội bộ'})`;
        if (params.role) description += ` [Quyền: ${params.role}]`;
        break;
      case 'LOGIN_FAILED':
        description = `Đăng nhập thất bại cho email: ${cleanEmail || 'Ẩn danh'}. Lý do: ${params.reason || 'Sai thông tin xác thực'}`;
        break;
      case 'LOGOUT':
        description = `Đăng xuất khỏi hệ thống: ${cleanUserName} (${cleanEmail || 'Tài khoản nội bộ'})`;
        break;
      case 'ACCESS_DENIED':
        description = `Từ chối truy cập: ${cleanEmail || cleanUserName}. Lý do: ${params.reason || 'Không đủ thẩm quyền hoặc tài khoản chưa kích hoạt'}`;
        break;
    }

    const payloadNewData = sanitizeAuditData({
      email: cleanEmail || undefined,
      role: params.role,
      department: params.department,
      reason: params.reason,
      timestamp: new Date().toISOString(),
      ...(params.details ? sanitizeAuditData(params.details) : {}),
    });

    await this.log({
      action,
      entityType: 'USER',
      entityId: cleanUserId || cleanEmail || undefined,
      description,
      actorId: cleanUserId,
      actorName: cleanUserName,
      actorEmail: cleanEmail,
      newData: payloadNewData,
    });
  },

  /**
   * Helper: Ghi nhận Đăng nhập thành công (LOGIN_SUCCESS)
   */
  async logLoginSuccess(
    user: { id?: string; email: string; name?: string; role?: string; department?: string },
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuthEvent('LOGIN_SUCCESS', {
      email: user.email,
      userId: user.id,
      userName: user.name,
      role: user.role,
      department: user.department,
      details: metadata,
    });
  },

  /**
   * Helper: Ghi nhận Đăng nhập thất bại (LOGIN_FAILED)
   * Tuyệt đối không lưu mật khẩu được nhập vào log.
   */
  async logLoginFailed(
    email: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuthEvent('LOGIN_FAILED', {
      email,
      reason,
      details: metadata,
    });
  },

  /**
   * Helper: Ghi nhận Đăng xuất (LOGOUT)
   */
  async logLogout(
    user?: { id?: string; email?: string; name?: string; role?: string } | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logAuthEvent('LOGOUT', {
      email: user?.email,
      userId: user?.id,
      userName: user?.name,
      role: user?.role,
      details: metadata,
    });
  },

  /**
   * Helper: Ghi nhận Từ chối truy cập (ACCESS_DENIED)
   */
  async logAccessDenied(
    email: string,
    reason: string,
    metadata?: Record<string, any>,
    user?: { id?: string; email?: string; name?: string; role?: string } | null
  ): Promise<void> {
    await this.logAuthEvent('ACCESS_DENIED', {
      email: email || user?.email,
      userId: user?.id,
      userName: user?.name,
      role: user?.role,
      reason,
      details: metadata,
    });
  },

  /**
   * Phương thức ghi log chung vào bảng 'audit_logs' của Supabase
   * Hỗ trợ cả object tham số và các đối số truyền theo vị trí để tương thích ngược.
   */
  async log(
    actionOrParams: string | AuditLogInput,
    entityType?: 'CHEMICAL' | 'BOTTLE' | 'USER' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM' | 'PURCHASE' | 'ADJUSTMENT' | 'DISCREPANCY' | 'IMPORT' | 'REQUEST',
    entityId?: string,
    description?: string,
    actorId?: string,
    actorName?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    let pAction = '';
    let pEntityType = 'USER';
    let pEntityId: string | null = null;
    let pDescription: string | null = null;
    let pActorId: string | null = null;
    let pActorName: string | null = null;
    let pOldData: any = null;
    let pNewData: any = null;

    if (typeof actionOrParams === 'object' && actionOrParams !== null) {
      pAction = actionOrParams.action;
      pEntityType = actionOrParams.entityType || 'USER';
      pEntityId = actionOrParams.entityId || null;
      pDescription = actionOrParams.description || null;
      pActorId = actionOrParams.actorId || null;
      pActorName = actionOrParams.actorName || actionOrParams.actorEmail || null;
      pOldData = actionOrParams.oldData || null;
      pNewData = actionOrParams.newData || null;
    } else {
      pAction = actionOrParams;
      pEntityType = entityType || 'USER';
      pEntityId = entityId || null;
      pDescription = description || null;
      pActorId = actorId || null;
      pActorName = actorName || null;
      pOldData = oldData || null;
      pNewData = newData || null;
    }

    // Tẩy sạch mật khẩu trước khi xử lý
    const safeOldData = sanitizeAuditData(pOldData);
    const safeNewData = sanitizeAuditData(pNewData);

    if (!isSupabaseConfigured()) {
      // Khi ở chế độ ngoại tuyến / Offline, ghi nhật ký vào console dev
      console.log(`[Offline Audit] [${pAction}] ${pDescription || ''}`, {
        entityType: pEntityType,
        entityId: pEntityId,
        actor: pActorName,
        data: safeNewData,
      });
      return;
    }

    try {
      const validActorUuid = isValidUUID(pActorId) ? pActorId : null;

      // 1. Thử ghi trực tiếp vào bảng 'audit_logs' của Supabase
      const insertPayload: Record<string, any> = {
        action: pAction,
        entity_type: pEntityType,
        entity_id: pEntityId,
        actor_name: pActorName || 'Hệ thống',
        description: pDescription,
        old_data: safeOldData,
        new_data: safeNewData,
        created_at: new Date().toISOString(),
      };

      if (validActorUuid) {
        insertPayload.actor_user_id = validActorUuid;
        insertPayload.user_id = validActorUuid;
      }

      const { error: insertError } = await supabase
        .from('audit_logs')
        .insert(insertPayload);

      if (!insertError) {
        return;
      }

      // 2. Nếu insert trực tiếp gặp trở ngại (ví dụ RPC policy), thử gọi qua RPC log_auth_audit
      const { error: rpcAuthErr } = await supabase.rpc('log_auth_audit', {
        p_action: pAction,
        p_actor_email: pActorName || pEntityId,
        p_description: pDescription,
        p_actor_name: pActorName,
        p_entity_id: pEntityId,
        p_new_data: safeNewData,
      });

      if (!rpcAuthErr) {
        return;
      }

      // 3. Fallback thử RPC record_audit_log gốc nếu người dùng đã đăng nhập session
      if (validActorUuid) {
        await supabase.rpc('record_audit_log', {
          p_action: pAction,
          p_entity_type: pEntityType,
          p_entity_id: pEntityId,
          p_description: pDescription,
          p_old_data: safeOldData,
          p_new_data: safeNewData,
        });
      }
    } catch (err: any) {
      console.warn('auditService.log notice:', err?.message || err);
    }
  },

  /**
   * Truy vấn danh sách lịch sử kiểm toán từ bảng 'audit_logs'
   */
  async fetchAll(limit = 100): Promise<{ data: AuditLog[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formatted: AuditLog[] = (data || []).map((row: any) => ({
        id: row.id,
        timestamp: row.created_at,
        user: row.actor_name || 'Hệ thống',
        action: row.action,
        entityType: row.entity_type || 'USER',
        entityId: row.entity_id || '',
        description: row.description || '',
        previousData: row.old_data ? JSON.stringify(row.old_data) : undefined,
        newData: row.new_data ? JSON.stringify(row.new_data) : undefined,
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      if (err?.code !== '42501') {
        console.error('auditService.fetchAll error:', err);
      } else {
        console.warn('auditService.fetchAll (permission denied or unauthenticated):', err.message);
      }
      return { data: null, error: err };
    }
  },
};

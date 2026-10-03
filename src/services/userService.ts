import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserLimits, UserPermissions, UserRole, UserStatus } from '../types';
import { rowToUser } from './authService';

export const userService = {
  async fetchAll(): Promise<{ data: User[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: (data || []).map(rowToUser), error: null };
    } catch (err: any) {
      console.error('userService.fetchAll error:', err);
      return { data: null, error: err };
    }
  },

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

  async updateUser(id: string, updates: Partial<User>): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
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
      return { success: false, error: err };
    }
  },

  async changeRole(id: string, role: UserRole): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, { role });
  },

  async changeStatus(id: string, status: UserStatus): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, { status });
  },

  async updateLimits(id: string, limits: UserLimits): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, { limits });
  },

  async updatePermissions(id: string, permissions: UserPermissions): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, { permissions });
  },

  async softDelete(id: string, reason: string, deletedBy: { id: string; name: string }): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, {
      status: 'INACTIVE',
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy.id,
      deleted_by_name: deletedBy.name,
      deletion_reason: reason,
    });
  },

  async restoreUser(id: string): Promise<{ success: boolean; error: any }> {
    return this.updateUser(id, {
      status: 'ACTIVE',
      deleted_at: null,
      deleted_by: null,
      deleted_by_name: null,
      deletion_reason: null,
    });
  },
};

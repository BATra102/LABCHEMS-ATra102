import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types';

export const auditService = {
  async log(
    action: string,
    entityType: 'CHEMICAL' | 'BOTTLE' | 'USER' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM',
    entityId: string,
    description: string,
    actorId?: string,
    actorName?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    try {
      // Use secure RPC that verifies auth.uid() on the server
      const { error: rpcErr } = await supabase.rpc('record_audit_log', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId || null,
        p_description: description || null,
        p_old_data: oldData ? oldData : null,
        p_new_data: newData ? newData : null,
      });

      if (rpcErr) {
        console.warn('auditService.log rpc notice:', rpcErr.message);
      }
    } catch (err) {
      console.warn('auditService.log error:', err);
    }
  },

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
        entityType: row.entity_type,
        entityId: row.entity_id || '',
        description: row.description || '',
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      console.error('auditService.fetchAll error:', err);
      return { data: null, error: err };
    }
  },
};

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types';

export interface AuditLogInput {
  action: string;
  entityType: 'CHEMICAL' | 'BOTTLE' | 'USER' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM';
  entityId?: string;
  description: string;
  actorId?: string;
  actorName?: string;
  oldData?: any;
  newData?: any;
}

export const auditService = {
  async log(
    actionOrParams: string | AuditLogInput,
    entityType?: 'CHEMICAL' | 'BOTTLE' | 'USER' | 'TRANSACTION' | 'SETTINGS' | 'SYSTEM',
    entityId?: string,
    description?: string,
    actorId?: string,
    actorName?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    if (!isSupabaseConfigured()) return;

    let pAction = '';
    let pEntityType = 'SYSTEM';
    let pEntityId: string | null = null;
    let pDescription: string | null = null;
    let pOldData: any = null;
    let pNewData: any = null;

    if (typeof actionOrParams === 'object' && actionOrParams !== null) {
      pAction = actionOrParams.action;
      pEntityType = actionOrParams.entityType;
      pEntityId = actionOrParams.entityId || null;
      pDescription = actionOrParams.description || null;
      pOldData = actionOrParams.oldData || null;
      pNewData = actionOrParams.newData || null;
    } else {
      pAction = actionOrParams;
      pEntityType = entityType || 'SYSTEM';
      pEntityId = entityId || null;
      pDescription = description || null;
      pOldData = oldData || null;
      pNewData = newData || null;
    }

    try {
      // Use secure RPC that verifies auth.uid() on the server
      const { error: rpcErr } = await supabase.rpc('record_audit_log', {
        p_action: pAction,
        p_entity_type: pEntityType,
        p_entity_id: pEntityId,
        p_description: pDescription,
        p_old_data: pOldData,
        p_new_data: pNewData,
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

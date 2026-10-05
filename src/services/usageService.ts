import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { InventoryTransaction } from '../types';

export interface RecordUsageParams {
  bottleId: string;
  quantityUsed: number;
  userId: string;
  userName: string;
  chemicalId?: string;
  chemicalName?: string;
  purpose?: string;
  projectName?: string;
  notes?: string;
}

export const rowToUsageTransaction = (row: any): InventoryTransaction => {
  const ts = row.created_at || new Date().toISOString();
  return {
    id: row.id,
    timestamp: ts,
    date: ts.split('T')[0],
    type: 'USAGE',
    chemicalId: row.chemical_id,
    chemicalName: row.chemical_name || 'Hóa chất',
    bottleId: row.bottle_id,
    bottleCode: row.bottle_code,
    quantity: Number(row.quantity_used) || 0,
    unit: row.unit || 'mL',
    previousStock: Number(row.quantity_before) || 0,
    newStock: Number(row.quantity_after) || 0,
    user: row.user_name || 'Người dùng',
    userId: row.user_id,
    purpose: row.usage_purpose || '',
    project: row.project_name || '',
    notes: row.notes || '',
    source: 'QR_SCAN',
  };
};

export const usageService = {
  /**
   * Atomic usage recording with Row-Level Locking in PostgreSQL
   * Calls stored procedure record_bottle_usage to prevent race condition between concurrent users
   */
  async recordUsage(params: RecordUsageParams): Promise<{
    success: boolean;
    data?: any;
    error?: any;
  }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      // Ensure p_user_id matches authenticated session uid
      const { data: authUser } = await supabase.auth.getUser();
      const sessionUserId = authUser?.user?.id || params.userId;

      // 1. Try atomic PostgreSQL RPC first
      const { data, error } = await supabase.rpc('record_bottle_usage', {
        p_bottle_id: params.bottleId,
        p_quantity: params.quantityUsed,
        p_user_id: sessionUserId,
        p_purpose: params.purpose || null,
        p_project: params.projectName || null,
        p_notes: params.notes || null,
      });

      if (!error && data) {
        return { success: true, data };
      }

      if (error && error.code !== '42883') {
        // Business exception raised by PostgreSQL RPC (e.g. insufficient quantity, unauthorized)
        throw new Error(error.message);
      }

      // If function is truly missing (code 42883), fall back to client-side transaction
      console.warn('RPC record_bottle_usage not found (code 42883), running client-side fallback:', error?.message);

      // 2. Client-side verified transaction
      // Fetch latest fresh bottle state
      const { data: bottle, error: bottleErr } = await supabase
        .from('bottles')
        .select('*')
        .eq('id', params.bottleId)
        .single();

      if (bottleErr || !bottle) {
        throw new Error('Không tìm thấy chai hóa chất trong cơ sở dữ liệu');
      }

      const currentQty = Number(bottle.current_quantity) || 0;
      if (currentQty < params.quantityUsed) {
        throw new Error(`Số lượng tồn hiện tại (${currentQty} ${bottle.unit}) không đủ để sử dụng ${params.quantityUsed} ${bottle.unit}!`);
      }

      const newQty = Math.max(0, currentQty - params.quantityUsed);
      const newStatus = newQty <= 0 ? 'EMPTY' : 'IN_USE';

      // Update bottle
      const { error: updateErr } = await supabase
        .from('bottles')
        .update({
          current_quantity: newQty,
          status: newStatus,
          opened_date: bottle.opened_date || new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.bottleId);

      if (updateErr) throw updateErr;

      // Insert usage transaction
      const { data: tx, error: txErr } = await supabase
        .from('usage_transactions')
        .insert({
          user_id: params.userId,
          user_name: params.userName,
          chemical_id: bottle.chemical_id,
          chemical_name: params.chemicalName || 'Chemical',
          bottle_id: bottle.id,
          bottle_code: bottle.bottle_code,
          quantity_used: params.quantityUsed,
          unit: bottle.unit,
          quantity_before: currentQty,
          quantity_after: newQty,
          usage_purpose: params.purpose || null,
          project_name: params.projectName || null,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (txErr) console.warn('Could not record usage_transaction row:', txErr.message);

      return {
        success: true,
        data: {
          quantity_before: currentQty,
          quantity_after: newQty,
          new_status: newStatus,
          transaction: tx ? rowToUsageTransaction(tx) : undefined,
        },
      };
    } catch (err: any) {
      console.error('usageService.recordUsage error:', err);
      return { success: false, error: err };
    }
  },

  async fetchUsageTransactions(): Promise<{ data: InventoryTransaction[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('usage_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      const transactions = (data || []).map(rowToUsageTransaction);
      return { data: transactions, error: null };
    } catch (err: any) {
      if (err?.code !== '42501') {
        console.error('usageService.fetchUsageTransactions error:', err);
      } else {
        console.warn('usageService.fetchUsageTransactions (permission denied or unauthenticated):', err.message);
      }
      return { data: null, error: err };
    }
  },
};

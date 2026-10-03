import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChemicalUnit } from '../types';

export interface StockTransactionRecord {
  id: string;
  userId: string;
  userName?: string;
  chemicalId: string;
  chemicalName?: string;
  bottleId?: string;
  bottleCode?: string;
  transactionType: 'STOCK_IN' | 'ADJUSTMENT' | 'DISPOSAL' | 'TRANSFER' | 'RESTORE';
  quantity: number;
  unit: ChemicalUnit;
  lotNumber?: string;
  notes?: string;
  createdAt: string;
}

export const stockService = {
  async recordTransaction(params: {
    userId: string;
    userName?: string;
    chemicalId: string;
    chemicalName?: string;
    bottleId?: string;
    bottleCode?: string;
    transactionType: 'STOCK_IN' | 'ADJUSTMENT' | 'DISPOSAL' | 'TRANSFER' | 'RESTORE';
    quantity: number;
    unit: ChemicalUnit;
    lotNumber?: string;
    notes?: string;
  }): Promise<{ data: StockTransactionRecord | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload = {
        user_id: params.userId,
        user_name: params.userName || null,
        chemical_id: params.chemicalId,
        chemical_name: params.chemicalName || null,
        bottle_id: params.bottleId || null,
        bottle_code: params.bottleCode || null,
        transaction_type: params.transactionType,
        quantity: params.quantity,
        unit: params.unit,
        lot_number: params.lotNumber || null,
        notes: params.notes || null,
      };

      const { data, error } = await supabase
        .from('stock_transactions')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return {
        data: {
          id: data.id,
          userId: data.user_id,
          userName: data.user_name,
          chemicalId: data.chemical_id,
          chemicalName: data.chemical_name,
          bottleId: data.bottle_id,
          bottleCode: data.bottle_code,
          transactionType: data.transaction_type,
          quantity: Number(data.quantity) || 0,
          unit: data.unit,
          lotNumber: data.lot_number,
          notes: data.notes,
          createdAt: data.created_at,
        },
        error: null,
      };
    } catch (err: any) {
      console.error('stockService.recordTransaction error:', err);
      return { data: null, error: err };
    }
  },

  async fetchRecent(limit = 100): Promise<{ data: StockTransactionRecord[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const formatted: StockTransactionRecord[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        chemicalId: row.chemical_id,
        chemicalName: row.chemical_name,
        bottleId: row.bottle_id,
        bottleCode: row.bottle_code,
        transactionType: row.transaction_type,
        quantity: Number(row.quantity) || 0,
        unit: row.unit,
        lotNumber: row.lot_number,
        notes: row.notes,
        createdAt: row.created_at,
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      console.error('stockService.fetchRecent error:', err);
      return { data: null, error: err };
    }
  },
};

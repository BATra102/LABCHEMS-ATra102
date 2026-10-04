import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Bottle, BottleStatus, StorageLocation } from '../types';

export const rowToBottle = (row: any): Bottle => {
  let loc: StorageLocation = {
    building: 'Building A',
    room: 'Room 302',
    cabinet: row.cabinet_id || 'Cabinet C1',
    shelf: row.cabinet_shelf || 'Shelf 1',
  };
  if (row.storage_location && typeof row.storage_location === 'string') {
    try {
      if (row.storage_location.startsWith('{')) {
        loc = { ...loc, ...JSON.parse(row.storage_location) };
      } else {
        loc.cabinet = row.storage_location;
      }
    } catch {
      loc.cabinet = row.storage_location;
    }
  }

  return {
    id: row.id,
    chemicalId: row.chemical_id,
    bottleCode: row.bottle_code,
    qrId: row.qr_code || row.bottle_code,
    lotNumber: row.lot_number || '',
    initialVolume: Number(row.original_quantity) || 0,
    currentVolume: Number(row.current_quantity) || 0,
    unit: row.unit || 'mL',
    openedDate: row.opened_date || undefined,
    expiryDate: row.expiry_date || '2028-12-31',
    receivedDate: row.created_at ? row.created_at.split('T')[0] : '2026-08-01',
    location: loc,
    status: (row.status === 'SEALED' ? 'FULL' : row.status) as BottleStatus,
    barcode: row.bottle_code,
  };
};

export const bottleService = {
  async fetchAll(): Promise<{ data: Bottle[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('bottles')
        .select('*')
        .order('bottle_code', { ascending: true });

      if (error) throw error;
      const formatted = (data || []).map(rowToBottle);
      return { data: formatted, error: null };
    } catch (error: any) {
      console.error('bottleService.fetchAll error:', error);
      return { data: null, error };
    }
  },

  async findByQrOrCode(codeOrQr: string): Promise<{ data: Bottle | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const trimmed = codeOrQr.trim();
      const clean = trimmed.replace(/^(LABCHEM:BOTTLE:|LABCHEM:CHEMICAL:|BOTTLE:|CHEM:)/i, '').trim();

      // 1. Exact match first
      const { data: exactData, error: exactError } = await supabase
        .from('bottles')
        .select('*')
        .or(`qr_code.ilike.${clean},bottle_code.ilike.${clean},qr_code.ilike.${trimmed},bottle_code.ilike.${trimmed}`)
        .limit(1)
        .maybeSingle();

      if (exactData) {
        return { data: rowToBottle(exactData), error: null };
      }

      // 2. Try prefix variants (LAB-XXX or without LAB-)
      const strippedLab = clean.startsWith('LAB-') ? clean.replace(/^LAB-/i, '') : clean;
      const prefixedLab = `LAB-${clean}`;

      const { data: variantData, error: variantError } = await supabase
        .from('bottles')
        .select('*')
        .or(`bottle_code.ilike.${strippedLab},qr_code.ilike.${strippedLab},bottle_code.ilike.${prefixedLab},qr_code.ilike.${prefixedLab}`)
        .limit(1)
        .maybeSingle();

      if (variantData) {
        return { data: rowToBottle(variantData), error: null };
      }

      // If uuid match
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
        const { data: uuidData } = await supabase
          .from('bottles')
          .select('*')
          .eq('id', clean)
          .maybeSingle();
        if (uuidData) {
          return { data: rowToBottle(uuidData), error: null };
        }
      }

      return { data: null, error: exactError || variantError || null };
    } catch (error: any) {
      console.error('bottleService.findByQrOrCode error:', error);
      return { data: null, error };
    }
  },

  async insert(bottle: Omit<Bottle, 'id'>): Promise<{ data: Bottle | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload = {
        chemical_id: bottle.chemicalId,
        bottle_code: bottle.bottleCode,
        qr_code: bottle.qrId || bottle.bottleCode,
        lot_number: bottle.lotNumber || null,
        original_quantity: bottle.initialVolume,
        current_quantity: bottle.currentVolume,
        unit: bottle.unit || 'mL',
        opened_date: bottle.openedDate || null,
        expiry_date: bottle.expiryDate,
        storage_location: JSON.stringify(bottle.location),
        cabinet_id: bottle.location?.cabinet || 'Cabinet C1',
        cabinet_shelf: bottle.location?.shelf || 'Shelf 1',
        status: bottle.status === 'FULL' ? 'SEALED' : bottle.status,
      };

      const { data, error } = await supabase
        .from('bottles')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { data: rowToBottle(data), error: null };
    } catch (error: any) {
      console.error('bottleService.insert error:', error);
      return { data: null, error };
    }
  },

  async updateQuantity(bottleId: string, newQuantity: number, newStatus?: BottleStatus): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload: any = {
        current_quantity: newQuantity,
        updated_at: new Date().toISOString(),
      };
      if (newStatus) {
        payload.status = newStatus === 'FULL' ? 'SEALED' : newStatus;
      }

      const { error } = await supabase
        .from('bottles')
        .update(payload)
        .eq('id', bottleId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: any) {
      console.error('bottleService.updateQuantity error:', error);
      return { success: false, error };
    }
  },

  async softDelete(bottleId: string, deletedBy: string, deletedByName: string, reason?: string): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { error } = await supabase
        .from('bottles')
        .update({
          status: 'DELETED',
          deleted_at: new Date().toISOString(),
          deleted_by_name: deletedByName,
          deletion_reason: reason || 'Xóa chai hóa chất',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bottleId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: any) {
      console.error('bottleService.softDelete error:', error);
      return { success: false, error };
    }
  },
};

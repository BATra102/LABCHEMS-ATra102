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
      if (error?.code !== '42501') {
        console.error('bottleService.fetchAll error:', error);
      } else {
        console.warn('bottleService.fetchAll (permission denied or unauthenticated):', error.message);
      }
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

      // Safe string for PostgREST or query (remove commas and parens)
      const safeClean = clean.replace(/[,()]/g, '');
      const safeTrimmed = trimmed.replace(/[,()]/g, '');

      // 1. Exact match first across qr_code, bottle_code, barcode
      const { data: exactData, error: exactError } = await supabase
        .from('bottles')
        .select('*')
        .or(`qr_code.ilike.${safeClean},bottle_code.ilike.${safeClean},barcode.ilike.${safeClean},qr_code.ilike.${safeTrimmed},bottle_code.ilike.${safeTrimmed}`)
        .limit(1)
        .maybeSingle();

      if (exactData) {
        return { data: rowToBottle(exactData), error: null };
      }

      // 2. Try prefix variants (LAB-XXX or without LAB-)
      const strippedLab = clean.startsWith('LAB-') ? clean.replace(/^LAB-/i, '') : clean;
      const prefixedLab = `LAB-${clean}`;
      const safeStripped = strippedLab.replace(/[,()]/g, '');
      const safePrefixed = prefixedLab.replace(/[,()]/g, '');

      const { data: variantData, error: variantError } = await supabase
        .from('bottles')
        .select('*')
        .or(`bottle_code.ilike.${safeStripped},qr_code.ilike.${safeStripped},bottle_code.ilike.${safePrefixed},qr_code.ilike.${safePrefixed}`)
        .limit(1)
        .maybeSingle();

      if (variantData) {
        return { data: rowToBottle(variantData), error: null };
      }

      // 3. If uuid match
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

  async insert(bottle: Omit<Bottle, 'id'> & { id?: string }): Promise<{ data: Bottle | null; error: any }> {
    const isUuid = (val?: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || '');

    // 1. Try server-side API first (bypasses RLS issues and handles constraints safely)
    try {
      let authToken: string | undefined = undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        authToken = sessionData?.session?.access_token;
      } catch (_) {}

      const response = await fetch('/api/stock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          chemicalId: bottle.chemicalId,
          bottleCode: bottle.bottleCode,
          qrCode: bottle.qrId || bottle.bottleCode,
          lotNumber: bottle.lotNumber,
          quantity: bottle.initialVolume,
          unit: bottle.unit,
          expiryDate: bottle.expiryDate,
          storageLocation: bottle.location,
          notes: bottle.notes,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.bottle) {
          return { data: json.bottle, error: null };
        }
      }
    } catch (_) {
      // API call failed (e.g. static preview without server), fallback to direct Supabase
    }

    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    // 2. Try Supabase RPC stock_in_bottle (Security Definer function)
    try {
      const locStr = typeof bottle.location === 'object' && bottle.location !== null
        ? JSON.stringify(bottle.location)
        : '{"building":"Building A","room":"Room 302","cabinet":"Cabinet C1","shelf":"Shelf 1"}';

      const { data: rpcData, error: rpcError } = await supabase.rpc('stock_in_bottle', {
        p_chemical_id: isUuid(bottle.chemicalId) ? bottle.chemicalId : undefined,
        p_bottle_code: bottle.bottleCode || undefined,
        p_qr_code: bottle.qrId || bottle.bottleCode || undefined,
        p_lot_number: bottle.lotNumber || undefined,
        p_quantity: Number(bottle.initialVolume) || 500,
        p_unit: bottle.unit || 'mL',
        p_expiry_date: bottle.expiryDate || new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0],
        p_storage_location: locStr,
        p_cabinet_id: bottle.location?.cabinet || 'Cabinet C1',
        p_cabinet_shelf: bottle.location?.shelf || 'Shelf 1',
        p_notes: bottle.notes || 'Nhập kho qua quét mã QR',
      });

      if (!rpcError && rpcData && rpcData.success && rpcData.bottle) {
        return { data: rowToBottle(rpcData.bottle), error: null };
      }
    } catch (_) {
      // RPC not yet deployed or error, fallback to direct insert
    }

    try {
      // Status mapping for PostgreSQL CHECK (status IN ('SEALED', 'IN_USE', 'EMPTY', 'EXPIRED', 'DISPOSED', 'DELETED'))
      let dbStatus = 'SEALED';
      if (bottle.status === 'FULL') dbStatus = 'SEALED';
      else if (bottle.status === 'IN_USE' || (bottle.status as any) === 'LOW') dbStatus = 'IN_USE';
      else if (bottle.status === 'EMPTY') dbStatus = 'EMPTY';
      else if (bottle.status === 'EXPIRED') dbStatus = 'EXPIRED';
      else if (bottle.status === 'DISPOSED' || (bottle.status as any) === 'ARCHIVED') dbStatus = 'DISPOSED';

      const locStr = typeof bottle.location === 'object' && bottle.location !== null
        ? JSON.stringify(bottle.location)
        : '{"building":"Building A","room":"Room 302","cabinet":"Cabinet C1","shelf":"Shelf 1"}';

      const payload: any = {
        chemical_id: bottle.chemicalId,
        bottle_code: bottle.bottleCode,
        qr_code: bottle.qrId || bottle.bottleCode,
        lot_number: bottle.lotNumber || null,
        original_quantity: Number(bottle.initialVolume) || 0,
        current_quantity: Number(bottle.currentVolume) || 0,
        unit: bottle.unit || 'mL',
        opened_date: bottle.openedDate || null,
        expiry_date: bottle.expiryDate || new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0],
        storage_location: locStr,
        cabinet_id: bottle.location?.cabinet || 'Cabinet C1',
        cabinet_shelf: bottle.location?.shelf || 'Shelf 1',
        status: dbStatus,
      };

      // Only pass ID if it is a valid UUID
      if (bottle.id && isUuid(bottle.id)) {
        payload.id = bottle.id;
      }

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

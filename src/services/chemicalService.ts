import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Chemical, StorageLocation, ChemicalSafety, ChemicalStatus } from '../types';

export const rowToChemical = (row: any): Chemical => {
  let loc: StorageLocation = {
    building: 'Building A',
    room: 'Room 302',
    cabinet: 'Cabinet C1',
    shelf: 'Shelf 1',
  };
  if (row.storage_location) {
    try {
      if (typeof row.storage_location === 'string' && row.storage_location.startsWith('{')) {
        loc = { ...loc, ...JSON.parse(row.storage_location) };
      } else if (typeof row.storage_location === 'object') {
        loc = { ...loc, ...row.storage_location };
      } else {
        loc.cabinet = String(row.storage_location);
      }
    } catch {
      loc.cabinet = String(row.storage_location);
    }
  }

  const safetyInfo: ChemicalSafety = {
    ghsPictograms: Array.isArray(row.ghs_symbols) && row.ghs_symbols.length > 0 ? row.ghs_symbols : ['irritant'],
    hazardClass: row.hazard_class || 'H315, H319',
    ppe: ['Găng tay Nitrile', 'Kính bảo hộ'],
    incompatibilities: 'Chất oxy hóa mạnh',
    sdsUrl: row.sds_url || '',
  };

  const minStock = Number(row.minimum_stock) || 0;
  const warnStock = Number(row.warning_stock) || minStock * 1.5;

  return {
    id: row.id,
    code: row.catalog_number || row.cas_number || (row.id ? String(row.id).slice(0, 8).toUpperCase() : 'CHEM'),
    name: row.name,
    englishName: row.description || row.name,
    casNumber: row.cas_number || 'N/A',
    chemicalFormula: row.concentration || '',
    grade: (row.purity || 'AR') as any,
    category: row.category as any,
    physicalForm: 'liquid',
    primaryUnit: row.unit || 'mL',
    manufacturer: row.manufacturer || 'Lab Standard',
    catalogNumber: row.catalog_number || '',
    minimumStock: minStock,
    warningStock: warnStock,
    targetStock: minStock * 2 || 1000,
    unitPrice: 100000,
    storageLocation: loc,
    storageConditions: row.storage_requirements || 'Nơi thoáng mát, nhiệt độ phòng 20-25°C',
    safetyInfo,
    responsiblePerson: 'Lab Manager',
    notes: row.description || '',
    status: (row.status || 'ACTIVE') as ChemicalStatus,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by_name || row.deleted_by,
    deletionReason: row.deletion_reason,
  };
};

export const chemicalService = {
  async fetchAll(): Promise<{ data: Chemical[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('chemicals')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      const formatted = (data || []).map(rowToChemical);
      return { data: formatted, error: null };
    } catch (error: any) {
      if (error?.code !== '42501') {
        console.error('chemicalService.fetchAll error:', error);
      } else {
        console.warn('chemicalService.fetchAll (permission denied or unauthenticated):', error.message);
      }
      return { data: null, error };
    }
  },

  async fetchById(id: string): Promise<{ data: Chemical | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('chemicals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { data: null, error: null };
      return { data: rowToChemical(data), error: null };
    } catch (error: any) {
      console.error('chemicalService.fetchById error:', error);
      return { data: null, error };
    }
  },

  async insert(chemical: Omit<Chemical, 'id'>): Promise<{ data: Chemical | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload = {
        name: chemical.name,
        cas_number: chemical.casNumber,
        category: chemical.category,
        concentration: chemical.chemicalFormula || null,
        purity: chemical.grade || null,
        manufacturer: chemical.manufacturer || null,
        catalog_number: chemical.catalogNumber || chemical.code || null,
        unit: chemical.primaryUnit || 'mL',
        minimum_stock: chemical.minimumStock || 0,
        warning_stock: chemical.warningStock || 0,
        hazard_class: chemical.safetyInfo?.hazardClass || null,
        ghs_symbols: chemical.safetyInfo?.ghsPictograms || [],
        storage_location: JSON.stringify(chemical.storageLocation),
        storage_requirements: chemical.storageConditions || null,
        description: chemical.notes || chemical.englishName || null,
        sds_url: chemical.safetyInfo?.sdsUrl || null,
        status: chemical.status || 'ACTIVE',
      };

      const { data, error } = await supabase
        .from('chemicals')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { data: rowToChemical(data), error: null };
    } catch (error: any) {
      console.error('chemicalService.insert error:', error);
      return { data: null, error };
    }
  },

  async update(id: string, updates: Partial<Chemical>): Promise<{ success: boolean; error: any }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.casNumber !== undefined) payload.cas_number = updates.casNumber;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.chemicalFormula !== undefined) payload.concentration = updates.chemicalFormula;
      if (updates.grade !== undefined) payload.purity = updates.grade;
      if (updates.manufacturer !== undefined) payload.manufacturer = updates.manufacturer;
      if (updates.catalogNumber !== undefined) payload.catalog_number = updates.catalogNumber;
      if (updates.primaryUnit !== undefined) payload.unit = updates.primaryUnit;
      if (updates.minimumStock !== undefined) payload.minimum_stock = updates.minimumStock;
      if (updates.warningStock !== undefined) payload.warning_stock = updates.warningStock;
      if (updates.storageLocation !== undefined) payload.storage_location = JSON.stringify(updates.storageLocation);
      if (updates.storageConditions !== undefined) payload.storage_requirements = updates.storageConditions;
      if (updates.notes !== undefined) payload.description = updates.notes;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.deletedAt !== undefined) payload.deleted_at = updates.deletedAt;
      if (updates.deletedBy !== undefined) payload.deleted_by_name = updates.deletedBy;
      if (updates.deletionReason !== undefined) payload.deletion_reason = updates.deletionReason;

      payload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('chemicals')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: any) {
      console.error('chemicalService.update error:', error);
      return { success: false, error };
    }
  },

  async softDelete(id: string, deletedBy: string, deletedByName: string, reason?: string): Promise<{ success: boolean; error: any }> {
    return this.update(id, {
      status: 'ARCHIVED',
      deletedAt: new Date().toISOString(),
      deletedBy: deletedByName,
      deletionReason: reason || 'Quản lý thực hiện xóa hóa chất',
    });
  },

  async restore(id: string): Promise<{ success: boolean; error: any }> {
    return this.update(id, {
      status: 'ACTIVE',
      deletedAt: undefined,
      deletedBy: undefined,
      deletionReason: undefined,
    });
  },
};

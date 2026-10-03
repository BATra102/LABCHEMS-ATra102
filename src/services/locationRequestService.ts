import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LocationChangeRequest, LocationRequestStatus } from '../types';

export const rowToLocationRequest = (row: any): LocationChangeRequest => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name || row.profiles?.full_name,
  userEmail: row.profiles?.google_email,
  bottleId: row.bottle_id,
  bottleCode: row.bottle_code || row.bottles?.bottle_code,
  chemicalId: row.chemical_id,
  chemicalName: row.chemical_name,
  currentLocation: row.current_location || '',
  requestedLocation: row.requested_location || '',
  reason: row.reason || '',
  status: row.status as LocationRequestStatus,
  managerId: row.manager_id,
  createdAt: row.created_at || new Date().toISOString(),
  reviewedAt: row.reviewed_at,
});

export const locationRequestService = {
  async fetchAll(): Promise<{ data: LocationChangeRequest[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const { data, error } = await supabase
        .from('location_change_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: (data || []).map(rowToLocationRequest), error: null };
    } catch (err: any) {
      console.error('locationRequestService.fetchAll error:', err);
      return { data: null, error: err };
    }
  },

  async createRequest(params: {
    userId: string;
    userName?: string;
    bottleId: string;
    bottleCode?: string;
    chemicalId?: string;
    chemicalName?: string;
    currentLocation: string;
    requestedLocation: string;
    reason?: string;
  }): Promise<{ data: LocationChangeRequest | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      const payload = {
        user_id: params.userId,
        bottle_id: params.bottleId,
        current_location: params.currentLocation,
        requested_location: params.requestedLocation,
        reason: params.reason || null,
        status: 'PENDING',
      };

      const { data, error } = await supabase
        .from('location_change_requests')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      const formatted: LocationChangeRequest = {
        ...rowToLocationRequest(data),
        userName: params.userName,
        bottleCode: params.bottleCode,
        chemicalId: params.chemicalId,
        chemicalName: params.chemicalName,
      };
      return { data: formatted, error: null };
    } catch (err: any) {
      console.error('locationRequestService.createRequest error:', err);
      return { data: null, error: err };
    }
  },

  async reviewRequest(
    requestId: string,
    action: 'APPROVED' | 'REJECTED',
    managerId: string
  ): Promise<{ success: boolean; error: any; updatedBottleLocation?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: new Error('Supabase chưa cấu hình') };
    }

    try {
      // Ensure p_manager_id matches authenticated session uid
      const { data: authUser } = await supabase.auth.getUser();
      const effectiveManagerId = authUser?.user?.id || managerId;

      // 1. Try PostgreSQL RPC first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('resolve_location_change_request', {
        p_request_id: requestId,
        p_action: action,
        p_manager_id: effectiveManagerId,
      });

      if (!rpcErr && rpcData) {
        return {
          success: true,
          error: null,
          updatedBottleLocation: rpcData.new_location,
        };
      }

      // 2. Client-side fallback if RPC is not deployed yet
      const { data: req, error: fetchErr } = await supabase
        .from('location_change_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchErr || !req) throw new Error('Không tìm thấy yêu cầu đổi vị trí');

      // Update request status
      const { error: updateErr } = await supabase
        .from('location_change_requests')
        .update({
          status: action,
          manager_id: managerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateErr) throw updateErr;

      // If approved, update bottle location automatically!
      if (action === 'APPROVED') {
        const { error: bottleErr } = await supabase
          .from('bottles')
          .update({
            storage_location: req.requested_location,
            updated_at: new Date().toISOString(),
          })
          .eq('id', req.bottle_id);

        if (bottleErr) console.warn('Could not auto-update bottle location:', bottleErr.message);
      }

      return {
        success: true,
        error: null,
        updatedBottleLocation: action === 'APPROVED' ? req.requested_location : undefined,
      };
    } catch (err: any) {
      console.error('locationRequestService.reviewRequest error:', err);
      return { success: false, error: err };
    }
  },
};

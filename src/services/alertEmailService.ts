// ==============================================================================
// SERVICE: alertEmailService
// Tự động kiểm tra ngưỡng tồn kho sau giao dịch và gửi email cảnh báo tới Người quản lý cao cấp
// Người nhận mặc định: buiantra2021@gmail.com / buianhtra2021@gmail.com
// ==============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PRIMARY_SENIOR_MANAGER_EMAIL } from '../utils/roleUtils';

export const TARGET_ALERT_EMAIL = PRIMARY_SENIOR_MANAGER_EMAIL; // 'buiantra2021@gmail.com'

export interface StockAlertLog {
  id: string;
  chemicalId: string;
  chemicalName: string;
  bottleId?: string;
  bottleCode?: string;
  lotNumber?: string;
  casNumber?: string;
  alertType: 'LOW' | 'CRITICAL';
  currentQuantity: number;
  thresholdQuantity: number;
  unit: string;
  recipientEmail: string;
  subject: string;
  contentSnippet?: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  errorMessage?: string;
  isActive: boolean;
  sentAt: string;
  resolvedAt?: string;
}

export const alertEmailService = {
  /**
   * Kiểm tra tồn kho sau khi Xuất dùng / Nhập kho / Điều chỉnh và kích hoạt Edge Function
   */
  async checkStockAndTriggerAlert({
    chemicalId,
    bottleId,
    recipientEmail = TARGET_ALERT_EMAIL,
  }: {
    chemicalId: string;
    bottleId?: string;
    recipientEmail?: string;
  }): Promise<{ success: boolean; action?: string; message?: string }> {
    if (!isSupabaseConfigured() || !chemicalId) {
      return { success: false, message: 'Supabase chưa kết nối.' };
    }

    try {
      // Ưu tiên gọi send-stock-alert, fallback sang send-low-stock-alert
      let response = await supabase.functions.invoke('send-stock-alert', {
        body: {
          chemical_id: chemicalId,
          bottle_id: bottleId,
          recipient_email: recipientEmail,
          trigger_source: 'TRANSACTION',
        },
      });

      if (response.error && response.error.message?.includes('not found')) {
        response = await supabase.functions.invoke('send-low-stock-alert', {
          body: {
            chemical_id: chemicalId,
            bottle_id: bottleId,
            recipient_email: recipientEmail,
            trigger_source: 'TRANSACTION',
          },
        });
      }

      if (response.error) {
        console.warn('send-stock-alert Edge Function call notice:', response.error.message);
        return { success: false, message: response.error.message };
      }

      return {
        success: true,
        action: response.data?.action || response.data?.status,
        message: response.data?.message,
      };
    } catch (err: any) {
      console.warn('alertEmailService.checkStockAndTriggerAlert error:', err);
      return { success: false, message: err.message };
    }
  },

  /**
   * Gửi email test theo yêu cầu (vd: n-Hexane / HEX-001)
   */
  async sendTestAlert({
    recipientEmail = TARGET_ALERT_EMAIL,
    chemicalName = 'n-Hexane',
    bottleCode = 'HEX-001',
    lotNumber = 'A12345',
    currentStock = 450,
    minimumStock = 600,
    criticalStock = 200,
    unit = 'mL',
  }: {
    recipientEmail?: string;
    chemicalName?: string;
    bottleCode?: string;
    lotNumber?: string;
    currentStock?: number;
    minimumStock?: number;
    criticalStock?: number;
    unit?: string;
  }): Promise<{ success: boolean; message: string; details?: any }> {
    if (!isSupabaseConfigured()) {
      return {
        success: true,
        message: `[Mô phỏng gửi] Đã gửi email cảnh báo thử nghiệm tới ${recipientEmail}.`,
      };
    }

    try {
      let response = await supabase.functions.invoke('send-stock-alert', {
        body: {
          force_test: true,
          recipient_email: recipientEmail,
          test_chemical_name: chemicalName,
          test_bottle_code: bottleCode,
          test_lot_number: lotNumber,
          test_current_stock: currentStock,
          test_minimum_stock: minimumStock,
          test_critical_stock: criticalStock,
          test_unit: unit,
          trigger_source: 'MANUAL_TEST',
        },
      });

      if (response.error && response.error.message?.includes('not found')) {
        response = await supabase.functions.invoke('send-low-stock-alert', {
          body: {
            force_test: true,
            recipient_email: recipientEmail,
            test_chemical_name: chemicalName,
            test_bottle_code: bottleCode,
            test_lot_number: lotNumber,
            test_current_stock: currentStock,
            test_minimum_stock: minimumStock,
            test_critical_stock: criticalStock,
            test_unit: unit,
            trigger_source: 'MANUAL_TEST',
          },
        });
      }

      if (response.error) {
        throw response.error;
      }

      return {
        success: true,
        message: `Đã kích hoạt gửi email cảnh báo tới ${recipientEmail}!`,
        details: response.data,
      };
    } catch (err: any) {
      console.warn('sendTestAlert notice:', err);
      return {
        success: true,
        message: `Đã ghi nhận yêu cầu gửi email cảnh báo tới ${recipientEmail}. (Lưu ý: Cần deploy Edge Function trên Supabase)`,
      };
    }
  },

  /**
   * Lấy lịch sử email cảnh báo từ bảng stock_alert_notifications
   */
  async fetchAlertLogs(limit = 50): Promise<{ data: StockAlertLog[] | null; error: any }> {
    if (!isSupabaseConfigured()) {
      return { data: null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('stock_alert_notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { data: null, error };
      }

      const formatted: StockAlertLog[] = (data || []).map((row: any) => ({
        id: row.id,
        chemicalId: row.chemical_id,
        chemicalName: row.chemical_name,
        bottleId: row.bottle_id,
        bottleCode: row.bottle_code,
        lotNumber: row.lot_number,
        casNumber: row.cas_number,
        alertType: row.alert_type,
        currentQuantity: Number(row.current_quantity),
        thresholdQuantity: Number(row.threshold_quantity),
        unit: row.unit,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        contentSnippet: row.content_snippet,
        status: row.status,
        errorMessage: row.error_message,
        isActive: !!row.is_active,
        sentAt: row.sent_at,
        resolvedAt: row.resolved_at,
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Lấy số lượng cảnh báo tồn kho đang active (chưa được giải quyết bằng nhập kho)
   */
  async fetchActiveAlertsCount(): Promise<number> {
    if (!isSupabaseConfigured()) return 0;
    try {
      const { count, error } = await supabase
        .from('stock_alert_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  },
};

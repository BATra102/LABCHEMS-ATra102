// ==============================================================================
// SUPABASE EDGE FUNCTION: send-stock-alert
// Tự động gửi email cảnh báo tồn kho hóa chất sắp hết / nguy cấp tới Người quản lý cao cấp
// Người nhận mặc định: buiantra2021@gmail.com / buianhtra2021@gmail.com
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_RECIPIENT = 'buiantra2021@gmail.com';

interface RequestPayload {
  chemical_id?: string;
  bottle_id?: string;
  recipient_email?: string;
  force_test?: boolean;
  trigger_source?: 'TRANSACTION' | 'MANUAL_TEST' | 'CRON';
  test_chemical_name?: string;
  test_bottle_code?: string;
  test_lot_number?: string;
  test_current_stock?: number;
  test_minimum_stock?: number;
  test_critical_stock?: number;
  test_unit?: string;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let payload: RequestPayload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const recipient = payload.recipient_email?.trim() || DEFAULT_RECIPIENT;

    // =========================================================================
    // CASE A: TEST GỬI EMAIL THỦ CÔNG (MANUAL TEST)
    // =========================================================================
    if (payload.force_test) {
      const chemName = payload.test_chemical_name || 'n-Hexane';
      const bottleCode = payload.test_bottle_code || 'HEX-001';
      const lotNumber = payload.test_lot_number || 'A12345';
      const currentStock = payload.test_current_stock ?? 450;
      const minStock = payload.test_minimum_stock ?? 600;
      const critStock = payload.test_critical_stock ?? 200;
      const unit = payload.test_unit || 'mL';

      const isCritical = currentStock <= critStock && critStock > 0;
      const alertType: 'LOW' | 'CRITICAL' = isCritical ? 'CRITICAL' : 'LOW';

      const subject = isCritical
        ? `[LabChem] CẢNH BÁO NGUY CẤP - ${chemName}`
        : `[LabChem] Cảnh báo hóa chất sắp hết - ${chemName}`;

      let emailText = '';
      if (isCritical) {
        emailText = `--------------------------------
CẢNH BÁO NGUY CẤP

Hóa chất:
${chemName}

CAS:
110-54-3

Mã chai:
${bottleCode}

Số lô:
${lotNumber}

Tồn kho hiện tại:
${currentStock} ${unit}

Mức nguy cấp:
${critStock} ${unit}

Trạng thái:
NGUY CẤP

Vị trí:
Cabinet C2

Nhà sản xuất:
Merck
--------------------------------
Đề nghị kiểm tra và bổ sung hóa chất.

LabChem
Hệ thống quản lý hóa chất phòng thí nghiệm.`;
      } else {
        emailText = `--------------------------------
CẢNH BÁO HÓA CHẤT SẮP HẾT

Hóa chất:
${chemName}

CAS:
110-54-3

Mã chai:
${bottleCode}

Số lô:
${lotNumber}

Tồn kho hiện tại:
${currentStock} ${unit}

Mức cảnh báo:
${minStock} ${unit}

Trạng thái:
SẮP HẾT

Vị trí:
Cabinet C2

Nhà sản xuất:
Merck
--------------------------------
Vui lòng kiểm tra và bổ sung hóa chất khi cần.

LabChem
Hệ thống quản lý hóa chất phòng thí nghiệm.`;
      }

      const sendResult = await sendEmailViaProvider({
        resendApiKey,
        to: recipient,
        subject,
        text: emailText,
      });

      // Lưu nhật ký vào stock_alert_notifications
      try {
        await supabase.from('stock_alert_notifications').insert({
          chemical_name: chemName,
          chemical_id: payload.chemical_id || '00000000-0000-0000-0000-000000000001',
          bottle_code: bottleCode,
          lot_number: lotNumber,
          cas_number: '110-54-3',
          alert_type: alertType,
          current_quantity: currentStock,
          threshold_quantity: isCritical ? critStock : minStock,
          unit,
          recipient_email: recipient,
          subject,
          content_snippet: emailText,
          status: sendResult.success ? 'SENT' : 'FAILED',
          error_message: sendResult.error || null,
          is_active: true,
        });
      } catch (dbErr) {
        console.warn('DB log error:', dbErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'TEST_ALERT_SENT',
          alert_type: alertType,
          recipient,
          provider_result: sendResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // CASE B: KIỂM TRA TỒN KHO THẬT THEO CHEMICAL_ID (Sau giao dịch)
    // =========================================================================
    if (!payload.chemical_id) {
      return new Response(
        JSON.stringify({ error: 'chemical_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Lấy thông tin hóa chất
    const { data: chemical, error: chemErr } = await supabase
      .from('chemicals')
      .select('*')
      .eq('id', payload.chemical_id)
      .single();

    if (chemErr || !chemical) {
      return new Response(
        JSON.stringify({ error: 'Chemical not found', details: chemErr }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Tính tổng tồn kho hiện tại từ tất cả các chai chưa thanh lý
    const { data: bottles, error: bErr } = await supabase
      .from('bottles')
      .select('*')
      .eq('chemical_id', payload.chemical_id)
      .neq('status', 'DISPOSED')
      .neq('status', 'DELETED');

    if (bErr) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bottles', details: bErr }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentTotalStock = (bottles || []).reduce(
      (sum, b) => sum + (Number(b.current_quantity) || 0),
      0
    );

    const minStock = Number(chemical.minimum_stock) || 0;
    const critStock = Number(chemical.critical_stock) || Math.round(minStock * 0.35);

    // -------------------------------------------------------------------------
    // RULE 1: NẾU TỒN KHO ĐÃ TRỞ LẠI BÌNH THƯỜNG (> minimum_stock)
    // Reset các cảnh báo trước đó -> NORMAL
    // -------------------------------------------------------------------------
    if (currentTotalStock > minStock) {
      await supabase
        .from('stock_alert_notifications')
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq('chemical_id', chemical.id)
        .eq('is_active', true);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'NORMAL',
          message: `Hóa chất ${chemical.name} ở mức an toàn (${currentTotalStock} ${chemical.unit} > ${minStock}). Đã reset trạng thái cảnh báo.`,
          current_stock: currentTotalStock,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Xác định mức cảnh báo hiện tại: CRITICAL hoặc LOW
    const isCritical = currentTotalStock <= critStock && critStock > 0;
    const currentAlertType: 'CRITICAL' | 'LOW' = isCritical ? 'CRITICAL' : 'LOW';

    // -------------------------------------------------------------------------
    // RULE 2: CHỐNG GỬI TRÙNG (DEDUPLICATION)
    // -------------------------------------------------------------------------
    const { data: activeAlerts } = await supabase
      .from('stock_alert_notifications')
      .select('*')
      .eq('chemical_id', chemical.id)
      .eq('is_active', true);

    const existingAlerts = activeAlerts || [];
    const hasActiveCritical = existingAlerts.some((a) => a.alert_type === 'CRITICAL');
    const hasActiveLow = existingAlerts.some((a) => a.alert_type === 'LOW');

    // Nếu đang ở CRITICAL và đã gửi CRITICAL rồi -> BỎ QUA
    if (isCritical && hasActiveCritical) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'SKIPPED_DUPLICATE',
          message: `Cảnh báo NGUY CẤP cho hóa chất ${chemical.name} đã được gửi trước đó, không gửi lặp.`,
          current_stock: currentTotalStock,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Nếu đang ở LOW và đã có active LOW (hoặc đã ở CRITICAL) -> BỎ QUA
    if (!isCritical && (hasActiveLow || hasActiveCritical)) {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'SKIPPED_DUPLICATE',
          message: `Cảnh báo SẮP HẾT cho hóa chất ${chemical.name} đã được gửi trước đó, không gửi lặp.`,
          current_stock: currentTotalStock,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // RULE 3: TIẾN HÀNH SOẠN THẢO VÀ GỬI EMAIL
    // -------------------------------------------------------------------------
    const subject = isCritical
      ? `[LabChem] CẢNH BÁO NGUY CẤP - ${chemical.name}`
      : `[LabChem] Cảnh báo hóa chất sắp hết - ${chemical.name}`;

    // Lấy thông tin chai đầu tiên hoặc chai có liên quan
    const matchedBottle = payload.bottle_id
      ? (bottles || []).find((b) => b.id === payload.bottle_id)
      : (bottles || [])[0];

    const bottleCode = matchedBottle?.bottle_code || 'N/A';
    const lotNumber = matchedBottle?.lot_number || 'N/A';
    const storageLocation = matchedBottle?.storage_location || chemical.storage_location || 'N/A';
    const manufacturer = chemical.manufacturer || 'N/A';

    let emailBody = '';
    if (isCritical) {
      emailBody = `--------------------------------
CẢNH BÁO NGUY CẤP

Hóa chất:
${chemical.name}

CAS:
${chemical.cas_number || 'N/A'}

Mã chai:
${bottleCode}

Số lô:
${lotNumber}

Tồn kho hiện tại:
${currentTotalStock} ${chemical.unit}

Mức nguy cấp:
${critStock} ${chemical.unit}

Trạng thái:
NGUY CẤP

Vị trí:
${storageLocation}

Nhà sản xuất:
${manufacturer}
--------------------------------
Đề nghị kiểm tra và bổ sung hóa chất.

LabChem
Hệ thống quản lý hóa chất phòng thí nghiệm.`;
    } else {
      emailBody = `--------------------------------
CẢNH BÁO HÓA CHẤT SẮP HẾT

Hóa chất:
${chemical.name}

CAS:
${chemical.cas_number || 'N/A'}

Mã chai:
${bottleCode}

Số lô:
${lotNumber}

Tồn kho hiện tại:
${currentTotalStock} ${chemical.unit}

Mức cảnh báo:
${minStock} ${chemical.unit}

Trạng thái:
SẮP HẾT

Vị trí:
${storageLocation}

Nhà sản xuất:
${manufacturer}
--------------------------------
Vui lòng kiểm tra và bổ sung hóa chất khi cần.

LabChem
Hệ thống quản lý hóa chất phòng thí nghiệm.`;
    }

    const sendResult = await sendEmailViaProvider({
      resendApiKey,
      to: recipient,
      subject,
      text: emailBody,
    });

    // 4. Ghi nhận vào bảng stock_alert_notifications
    const { error: insertErr } = await supabase
      .from('stock_alert_notifications')
      .insert({
        chemical_id: chemical.id,
        chemical_name: chemical.name,
        bottle_id: matchedBottle?.id || null,
        bottle_code: bottleCode,
        lot_number: lotNumber,
        cas_number: chemical.cas_number,
        alert_type: currentAlertType,
        current_quantity: currentTotalStock,
        threshold_quantity: isCritical ? critStock : minStock,
        unit: chemical.unit,
        recipient_email: recipient,
        subject,
        content_snippet: emailBody,
        status: sendResult.success ? 'SENT' : 'FAILED',
        error_message: sendResult.error || null,
        is_active: true,
      });

    if (insertErr) {
      console.warn('Failed to insert stock alert notification log:', insertErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'EMAIL_DISPATCHED',
        alert_type: currentAlertType,
        recipient,
        current_stock: currentTotalStock,
        threshold: isCritical ? critStock : minStock,
        send_status: sendResult.success ? 'SENT' : 'FAILED',
        details: sendResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Gửi email qua Resend API hoặc SMTP/HTTPS Provider
 */
async function sendEmailViaProvider({
  resendApiKey,
  to,
  subject,
  text,
}: {
  resendApiKey?: string;
  to: string;
  subject: string;
  text: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (resendApiKey && resendApiKey.startsWith('re_')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'LabChem Alerts <alerts@resend.dev>',
          to: [to],
          subject,
          text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || JSON.stringify(data) };
      }
      return { success: true, id: data.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Standby / Dry-run khi chưa cấu hình RESEND_API_KEY
  console.log(`[Email Dispatch Standby] To: ${to} | Subject: ${subject}`);
  return {
    success: true,
    id: `standby-${Date.now()}`,
    error: undefined,
  };
}

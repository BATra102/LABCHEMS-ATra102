-- ====================================================================
-- MIGRATION: stock_alert_notifications & chemical critical_stock
-- Description: Hệ thống cảnh báo tồn kho tự động qua Email
-- ====================================================================

-- 1. Thêm cột critical_stock vào bảng chemicals nếu chưa có
ALTER TABLE public.chemicals ADD COLUMN IF NOT EXISTS critical_stock NUMERIC DEFAULT 0 CHECK (critical_stock >= 0);

-- 2. Bảng lưu trữ lịch sử và trạng thái cảnh báo tồn kho (chống gửi trùng)
CREATE TABLE IF NOT EXISTS public.stock_alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
  chemical_name TEXT NOT NULL,
  bottle_id UUID REFERENCES public.bottles(id) ON DELETE SET NULL,
  bottle_code TEXT,
  lot_number TEXT,
  cas_number TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('LOW', 'CRITICAL')),
  current_quantity NUMERIC NOT NULL,
  threshold_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'mL',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
  error_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes tối ưu tra cứu nhanh & deduplication
CREATE INDEX IF NOT EXISTS idx_stock_alerts_chem_active 
  ON public.stock_alert_notifications (chemical_id, alert_type, is_active);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_bottle_active 
  ON public.stock_alert_notifications (bottle_id, alert_type, is_active);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_sent_at 
  ON public.stock_alert_notifications (sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_recipient 
  ON public.stock_alert_notifications (recipient_email);

-- 3. Row Level Security
ALTER TABLE public.stock_alert_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_alerts_select" ON public.stock_alert_notifications;
CREATE POLICY "stock_alerts_select" ON public.stock_alert_notifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_alerts_insert" ON public.stock_alert_notifications;
CREATE POLICY "stock_alerts_insert" ON public.stock_alert_notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "stock_alerts_update" ON public.stock_alert_notifications;
CREATE POLICY "stock_alerts_update" ON public.stock_alert_notifications
  FOR UPDATE TO authenticated USING (true);

-- 4. Hàm RPC reset cảnh báo khi hóa chất được nhập kho bổ sung (LOW/CRITICAL -> NORMAL)
CREATE OR REPLACE FUNCTION public.reset_stock_alerts(p_chemical_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stock_alert_notifications
  SET is_active = false,
      resolved_at = now()
  WHERE chemical_id = p_chemical_id
    AND is_active = true;
END;
$$;

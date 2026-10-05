-- ====================================================================
-- MIGRATION: 20261005000000_auth_audit_logs.sql
-- Description: Mở rộng audit_logs để hỗ trợ các sự kiện xác thực quan trọng:
-- LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, ACCESS_DENIED
-- Tuyệt đối không lưu mật khẩu của người dùng.
-- ====================================================================

-- 1. Cập nhật Check Constraint trên cột action của audit_logs
DO $$
BEGIN
  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
  ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
    'LOGIN', 'LOGOUT',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCESS_DENIED',
    'CREATE_CHEMICAL', 'UPDATE_CHEMICAL', 'DELETE_CHEMICAL', 'RESTORE_CHEMICAL',
    'STOCK_IN', 'USAGE', 'ADJUSTMENT', 'DISPOSAL',
    'CREATE_USER', 'UPDATE_USER', 'LOCK_USER', 'UNLOCK_USER',
    'CHANGE_ROLE', 'CHANGE_DEPARTMENT', 'CHANGE_LIMIT',
    'APPROVE_LOCATION', 'REJECT_LOCATION'
  ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Đảm bảo chính sách RLS cho phép ghi nhật ký sự kiện xác thực (kể cả trước khi session được tạo)
DROP POLICY IF EXISTS "audit_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_insert_policy" ON public.audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 3. Function RPC an toàn log_auth_audit để tự động lọc mật khẩu và ghi nhận
CREATE OR REPLACE FUNCTION public.log_auth_audit(
  p_action TEXT,
  p_actor_email TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_name TEXT;
  v_log_id UUID;
  v_clean_data JSONB := p_new_data;
BEGIN
  -- Lấy actor_id từ auth.uid() nếu có
  v_actor_id := auth.uid();

  -- Nếu auth.uid() chưa có, cố gắng tra cứu qua email
  IF v_actor_id IS NULL AND p_actor_email IS NOT NULL AND p_actor_email <> '' THEN
    SELECT id, full_name INTO v_actor_id, v_actor_name
    FROM public.profiles
    WHERE lower(email) = lower(p_actor_email)
    LIMIT 1;
  ELSIF v_actor_id IS NOT NULL THEN
    SELECT full_name INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;
  END IF;

  v_actor_name := COALESCE(v_actor_name, p_actor_name, p_actor_email, 'Khách / Ẩn danh');

  -- Lọc bỏ triệt để các trường nhạy cảm nếu có trong new_data
  IF v_clean_data IS NOT NULL THEN
    v_clean_data := v_clean_data - 'password' - 'pass' - 'pwd' - 'secret' - 'token' - 'access_token';
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    actor_user_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    description,
    new_data,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_id,
    v_actor_name,
    p_action,
    'USER',
    COALESCE(p_entity_id, v_actor_id::text, p_actor_email),
    p_description,
    v_clean_data,
    now()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_auth_audit TO anon, authenticated, service_role;

-- ====================================================================
-- MIGRATION: 20261005010000_user_provisioning.sql
-- Description: Mở rộng audit_logs và hỗ trợ tính năng CẤP TÀI KHOẢN NGƯỜI DÙNG:
-- ACCOUNT_CREATED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DELETED, 
-- ACCOUNT_ROLE_CHANGED, PASSWORD_RESET
-- Bảo vệ tuyệt đối Người quản lý cao cấp (buiantra2021@gmail.com / buianhtra2021@gmail.com)
-- ====================================================================

-- 1. Cập nhật Check Constraint trên action của public.audit_logs
DO $$
BEGIN
  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
  ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
    'LOGIN', 'LOGOUT',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'ACCESS_DENIED',
    'ACCOUNT_CREATED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 
    'ACCOUNT_DELETED', 'ACCOUNT_ROLE_CHANGED', 'PASSWORD_RESET',
    'CREATE_CHEMICAL', 'UPDATE_CHEMICAL', 'DELETE_CHEMICAL', 'RESTORE_CHEMICAL',
    'STOCK_IN', 'USAGE', 'ADJUSTMENT', 'DISPOSAL',
    'CREATE_USER', 'UPDATE_USER', 'LOCK_USER', 'UNLOCK_USER',
    'CHANGE_ROLE', 'CHANGE_DEPARTMENT', 'CHANGE_LIMIT',
    'APPROVE_LOCATION', 'REJECT_LOCATION'
  ));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Cập nhật Check Constraint trên role và status của profiles
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('SENIOR_MANAGER', 'MANAGER', 'STAFF', 'VIEWER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('ACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED', 'DEACTIVATED', 'DELETED', 'INACTIVE'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Đảm bảo bảo vệ Người quản lý cao cấp khỏi việc bị sửa / khóa / xóa bởi người khác
CREATE OR REPLACE FUNCTION public.check_senior_manager_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  v_caller_email := lower(COALESCE(auth.jwt()->>'email', ''));

  -- Nếu đối tượng bị tác động là Người quản lý cao cấp
  IF lower(OLD.email) IN ('buiantra2021@gmail.com', 'buianhtra2021@gmail.com', 'buianhtraa2021@gmail.com') OR OLD.is_senior_manager = true THEN
    -- Nếu người gọi không phải chính Người quản lý cao cấp
    IF v_caller_email NOT IN ('buiantra2021@gmail.com', 'buianhtra2021@gmail.com', 'buianhtraa2021@gmail.com') THEN
      RAISE EXCEPTION 'VIOLATION: Bạn không có quyền tác động lên tài khoản Người quản lý cao cấp!';
    END IF;

    -- Không bao giờ được phép xóa tài khoản Người quản lý cao cấp
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'VIOLATION: Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể xóa!';
    END IF;

    -- Không bao giờ được hạ quyền của Người quản lý cao cấp
    IF NEW.role NOT IN ('SENIOR_MANAGER', 'MANAGER') THEN
      RAISE EXCEPTION 'VIOLATION: Không được phép hạ quyền của Người quản lý cao cấp!';
    END IF;

    -- Không được đổi trạng thái khỏi ACTIVE
    IF NEW.status IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'VIOLATION: Không được phép khóa hoặc vô hiệu hóa tài khoản Người quản lý cao cấp!';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_senior_manager_protection ON public.profiles;
CREATE TRIGGER trg_check_senior_manager_protection
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_senior_manager_protection();

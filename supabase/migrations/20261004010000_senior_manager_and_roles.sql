-- ====================================================================
-- MIGRATION: 20261004010000_senior_manager_and_roles.sql
-- Description: Bảo vệ tuyệt đối Người quản lý cao cấp (buianhtra2021@gmail.com / buiantra2021@gmail.com)
-- Phân cấp quyền: Người quản lý cao cấp > Người quản lý (MANAGER) > Nhân viên (STAFF) > Người xem (VIEWER)
-- ====================================================================

-- 1. Mở rộng enum/check constraint cho role nếu cần
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
  ALTER TABLE public.system_roles_whitelist DROP CONSTRAINT IF EXISTS system_roles_whitelist_role_check;
  ALTER TABLE public.system_roles_whitelist ADD CONSTRAINT system_roles_whitelist_role_check 
    CHECK (role IN ('SENIOR_MANAGER', 'MANAGER', 'STAFF', 'VIEWER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Thêm cột is_senior_manager vào profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_senior_manager BOOLEAN NOT NULL DEFAULT false;

-- 3. Whitelist email Người quản lý cao cấp
INSERT INTO public.system_roles_whitelist (email, role, notes) VALUES
  ('buianhtra2021@gmail.com', 'SENIOR_MANAGER', 'Người quản lý cao cấp toàn hệ thống LabChem'),
  ('buiantra2021@gmail.com', 'SENIOR_MANAGER', 'Người quản lý cao cấp toàn hệ thống LabChem'),
  ('buianhtraa2021@gmail.com', 'SENIOR_MANAGER', 'Người quản lý cao cấp toàn hệ thống LabChem')
ON CONFLICT (email) DO UPDATE SET 
  role = 'SENIOR_MANAGER',
  notes = 'Người quản lý cao cấp toàn hệ thống LabChem';

-- Cập nhật profiles nếu đã tồn tại
UPDATE public.profiles
SET is_senior_manager = true,
    role = 'SENIOR_MANAGER',
    status = 'ACTIVE'
WHERE lower(email) IN ('buianhtra2021@gmail.com', 'buiantra2021@gmail.com', 'buianhtraa2021@gmail.com');

-- 4. Trigger bảo vệ bất khả xâm phạm: Không thể xóa, khóa, đổi email, hạ quyền
CREATE OR REPLACE FUNCTION public.protect_senior_manager_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nếu đối tượng bị tác động là Người quản lý cao cấp
  IF lower(OLD.email) IN ('buianhtra2021@gmail.com', 'buiantra2021@gmail.com', 'buianhtraa2021@gmail.com') OR OLD.is_senior_manager = true THEN
    -- A. Cấm xóa hoàn toàn
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'VIOLATION: Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể xóa!';
    END IF;

    -- B. Cấm đổi email
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'VIOLATION: Không được phép thay đổi email của Người quản lý cao cấp!';
    END IF;

    -- C. Cấm khóa hoặc hạ trạng thái (phải luôn ACTIVE)
    IF NEW.status IS DISTINCT FROM 'ACTIVE' THEN
      RAISE EXCEPTION 'VIOLATION: Không thể khóa hoặc vô hiệu hóa tài khoản Người quản lý cao cấp!';
    END IF;

    -- D. Cấm hạ quyền
    IF NEW.role NOT IN ('SENIOR_MANAGER', 'MANAGER') THEN
      RAISE EXCEPTION 'VIOLATION: Không thể hạ quyền của Người quản lý cao cấp!';
    END IF;

    NEW.is_senior_manager := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_senior_manager ON public.profiles;
CREATE TRIGGER trg_protect_senior_manager
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_senior_manager_profile();

-- 5. RLS: Ẩn tài khoản Người quản lý cao cấp khỏi những người dùng khác
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Chính người quản lý cao cấp đang đăng nhập thì thấy tất cả
    (lower(auth.jwt()->>'email') IN ('buianhtra2021@gmail.com', 'buiantra2021@gmail.com', 'buianhtraa2021@gmail.com'))
    OR
    -- Người dùng khác chỉ thấy những tài khoản thông thường (không phải Senior Manager)
    (lower(email) NOT IN ('buianhtra2021@gmail.com', 'buiantra2021@gmail.com', 'buianhtraa2021@gmail.com') AND is_senior_manager = false)
    OR
    -- Người dùng luôn thấy chính hồ sơ của mình
    (auth.uid() = id)
  );

-- 6. Trigger tự động gán Người quản lý cao cấp khi đăng nhập lần đầu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := 'USER';
  v_status TEXT := 'PENDING';
  v_is_senior BOOLEAN := false;
  v_email TEXT;
BEGIN
  v_email := lower(COALESCE(NEW.email, ''));

  IF v_email IN ('buianhtra2021@gmail.com', 'buiantra2021@gmail.com', 'buianhtraa2021@gmail.com') THEN
    v_role := 'SENIOR_MANAGER';
    v_status := 'ACTIVE';
    v_is_senior := true;
  ELSIF EXISTS (SELECT 1 FROM public.system_roles_whitelist w WHERE lower(w.email) = v_email AND w.role IN ('MANAGER', 'ADMIN', 'LAB_MANAGER', 'SENIOR_MANAGER')) THEN
    v_role := 'MANAGER';
    v_status := 'ACTIVE';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    status,
    is_senior_manager,
    department,
    created_at,
    updated_at,
    last_login_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    v_role,
    v_status,
    v_is_senior,
    'Bộ môn Dược liệu & Chiết xuất',
    now(),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    last_login_at = now();

  RETURN NEW;
END;
$$;

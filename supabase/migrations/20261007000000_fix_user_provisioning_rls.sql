-- ====================================================================
-- MIGRATION: 20261007000000_fix_user_provisioning_rls.sql
-- Mô tả: Sửa triệt để lỗi "permission denied for table profiles" khi cấp tài khoản
-- 1. Bổ sung role 'SENIOR_MANAGER' vào hàm public.is_manager()
-- 2. Cấp đầy đủ quyền INSERT, SELECT, UPDATE, DELETE cho authenticated & service_role
-- 3. Chỉ cấp SELECT cho anon (phục vụ đăng nhập/tra cứu username, không cấp INSERT/UPDATE)
-- 4. Giữ nguyên Row Level Security (RLS) với policy profiles_manager_all đúng chuẩn WITH CHECK
-- ====================================================================

-- 1. Cập nhật hàm is_manager() để bao gồm SENIOR_MANAGER và các vai trò Quản lý
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('SENIOR_MANAGER', 'MANAGER', 'ADMIN', 'LAB_MANAGER') 
      AND p.status = 'ACTIVE'
      AND (
        NOT EXISTS (SELECT 1 FROM public.system_roles_whitelist)
        OR EXISTS (
          SELECT 1 FROM public.system_roles_whitelist w
          WHERE (LOWER(w.email) = LOWER(p.email) OR LOWER(w.email) = LOWER(COALESCE(p.google_email, '')))
            AND w.role IN ('SENIOR_MANAGER', 'MANAGER', 'ADMIN', 'LAB_MANAGER')
        )
      )
  );
$$;

-- 2. Đảm bảo các cột username và must_change_password tồn tại trên public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- 3. Cập nhật Check Constraint trên role và status
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

-- 4. Bật Row Level Security (RLS) trên bảng profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Cập nhật RLS Policy cho public.profiles
-- Policy đọc: Cho phép authenticated và anon đọc thông tin cơ bản
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles 
  FOR SELECT TO authenticated, anon 
  USING (true);

-- Policy toàn quyền cho Quản lý (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "profiles_manager_all" ON public.profiles;
CREATE POLICY "profiles_manager_all" ON public.profiles 
  FOR ALL TO authenticated 
  USING (public.is_manager()) 
  WITH CHECK (public.is_manager());

-- 6. Cấp quyền truy cập bảng (Table-level GRANTs)
-- anon chỉ được SELECT (không được cấp INSERT/UPDATE để bảo mật)
GRANT SELECT ON public.profiles TO anon;

-- authenticated và service_role được đầy đủ quyền (được kiểm soát bởi RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;

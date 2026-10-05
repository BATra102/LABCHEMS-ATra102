-- ====================================================================
-- MIGRATION: 20261005020000_add_must_change_password.sql
-- Thêm cột must_change_password vào bảng profiles
-- ====================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Cấp quyền truy cập
GRANT SELECT, UPDATE ON public.profiles TO anon, authenticated, service_role;

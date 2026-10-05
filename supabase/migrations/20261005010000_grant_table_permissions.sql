-- ====================================================================
-- MIGRATION: 20261005010000_grant_table_permissions.sql
-- Description: Cấp quyền bảng cho anon, authenticated, service_role
-- Giải quyết lỗi 42501 (permission denied for table chemicals, bottles, etc.)
-- ====================================================================

-- 1. Cấp quyền USAGE trên schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Cấp quyền truy cập trên các bảng công khai và kiểm soát qua RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Cấp quyền sequence cho ID tự tăng
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Cấp quyền thực thi các hàm trong schema public
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Thiết lập mặc định cho các bảng và hàm tạo trong tương lai
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON ROUTINES TO anon, authenticated, service_role;

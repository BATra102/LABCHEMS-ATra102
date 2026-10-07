-- ====================================================================
-- MIGRATION: 20261006000000_add_username_to_profiles.sql
-- Thêm cột 'username' vào bảng 'profiles'
-- Đảm bảo mỗi tài khoản có Tên đăng nhập (username) duy nhất
-- Không phân biệt chữ hoa/thường, liên kết profiles.id = auth.users.id
-- ====================================================================

-- 1. Thêm cột username vào bảng profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Đồng bộ username cho các tài khoản hiện có nếu chưa có username
UPDATE public.profiles 
SET username = lower(COALESCE(NULLIF(username, ''), split_part(COALESCE(google_email, email, 'user'), '@', 1)))
WHERE username IS NULL OR username = '';

-- 3. Gán username cố định cho tài khoản Người quản lý
UPDATE public.profiles
SET username = 'buiantra'
WHERE lower(email) = 'buiantra2021@gmail.com' OR lower(google_email) = 'buiantra2021@gmail.com';

UPDATE public.profiles
SET username = 'labmanager'
WHERE lower(email) = 'jasminebee279@gmail.com' OR lower(google_email) = 'jasminebee279@gmail.com';

-- 4. Tạo Unique Index không phân biệt hoa thường
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

-- 5. Bổ sung Unique Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 6. Cập nhật quyền hạn truy cập
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated, service_role;

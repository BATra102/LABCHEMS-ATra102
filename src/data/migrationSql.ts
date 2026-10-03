// Full SQL Migration text exported for instant clipboard copying in SupabaseConfigModal
export const LABCHEM_MIGRATION_SQL = `-- ====================================================================
-- LABCHEM INVENTORY - SUPABASE COMPLETE PRODUCTION MIGRATION
-- Production-Ready Schema with Strict RLS, Atomic RPC, Audit & Realtime
-- Copy and paste this ENTIRE file into: Supabase -> SQL Editor -> Run
-- ====================================================================

-- ====================================================================
-- SECTION 1: EXTENSIONS
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- SECTION 2: SYSTEM ROLES WHITELIST (SECURE BOOTSTRAP)
-- Bật RLS và khóa hoàn toàn việc can thiệp từ client
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.system_roles_whitelist (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'MANAGER' CHECK (role IN ('MANAGER', 'USER', 'ADMIN', 'LAB_MANAGER')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-seed designated manager emails (Edit or add emails as needed)
INSERT INTO public.system_roles_whitelist (email, role, notes) VALUES
  ('jasminebee279@gmail.com', 'MANAGER', 'Chủ nhiệm / Quản lý Lab chính'),
  ('buianhtra2021@gmail.com', 'MANAGER', 'Quản lý Lab Dược liệu & Chiết xuất')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- ====================================================================
-- SECTION 3: TABLE: departments
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments (name);

-- ====================================================================
-- SECTION 4: TABLE: profiles (Linked with Supabase auth.users)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  google_email TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('MANAGER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER')),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  department TEXT NOT NULL DEFAULT 'Bộ môn Dược liệu & Chiết xuất',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  manager_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'DEACTIVATED', 'DELETED')),
  daily_usage_limit NUMERIC DEFAULT 500,
  single_usage_limit NUMERIC DEFAULT 100,
  job_title TEXT,
  phone TEXT,
  member_code TEXT,
  notes TEXT,
  limits JSONB NOT NULL DEFAULT '{
    "maxUsagePerTransaction": 100,
    "dailyUsageLimit": 500,
    "dailyTransactionCount": 10,
    "maxStockInQuantity": 5
  }'::jsonb,
  permissions JSONB NOT NULL DEFAULT '{
    "viewInventory": true,
    "addChemical": false,
    "editChemical": false,
    "archiveChemical": false,
    "deleteChemical": false,
    "recordUsage": false,
    "viewAllUsageHistory": false,
    "createStockIn": false,
    "adjustStock": false,
    "importExcel": false,
    "viewReports": false,
    "manageUsers": false
  }'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  deleted_by_name TEXT,
  deletion_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles (department_id);

-- ====================================================================
-- SECTION 5: TABLE: chemicals
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.chemicals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cas_number TEXT NOT NULL,
  category TEXT NOT NULL,
  concentration TEXT,
  purity TEXT,
  manufacturer TEXT,
  catalog_number TEXT,
  hazard_classification TEXT,
  hazard_class TEXT,
  unit TEXT NOT NULL DEFAULT 'mL',
  minimum_stock NUMERIC NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  warning_stock NUMERIC NOT NULL DEFAULT 0 CHECK (warning_stock >= 0),
  ghs_symbols TEXT[] DEFAULT '{}',
  storage_location TEXT,
  storage_requirements TEXT,
  description TEXT,
  sds_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DISPOSED', 'DELETED', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  deleted_by_name TEXT,
  deletion_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_chemicals_cas ON public.chemicals (cas_number);
CREATE INDEX IF NOT EXISTS idx_chemicals_status ON public.chemicals (status);
CREATE INDEX IF NOT EXISTS idx_chemicals_name ON public.chemicals (name);
CREATE INDEX IF NOT EXISTS idx_chemicals_category ON public.chemicals (category);

-- ====================================================================
-- SECTION 6: TABLE: bottles (Mỗi chai/lọ là một record riêng biệt)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id UUID NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
  bottle_code TEXT NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  lot_number TEXT,
  original_quantity NUMERIC NOT NULL CHECK (original_quantity >= 0),
  current_quantity NUMERIC NOT NULL CHECK (current_quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'mL',
  opened_date DATE,
  expiry_date DATE NOT NULL,
  storage_location TEXT NOT NULL,
  cabinet_id TEXT,
  cabinet_shelf TEXT,
  status TEXT NOT NULL DEFAULT 'SEALED' CHECK (status IN ('SEALED', 'IN_USE', 'EMPTY', 'EXPIRED', 'DISPOSED', 'DELETED')),
  purchase_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  deleted_by_name TEXT,
  deletion_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_bottles_chemical_id ON public.bottles (chemical_id);
CREATE INDEX IF NOT EXISTS idx_bottles_code ON public.bottles (bottle_code);
CREATE INDEX IF NOT EXISTS idx_bottles_qr ON public.bottles (qr_code);
CREATE INDEX IF NOT EXISTS idx_bottles_expiry ON public.bottles (expiry_date);
CREATE INDEX IF NOT EXISTS idx_bottles_status ON public.bottles (status);

-- ====================================================================
-- SECTION 7: TABLE: usage_transactions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.usage_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_name TEXT,
  chemical_id UUID NOT NULL REFERENCES public.chemicals(id),
  chemical_name TEXT,
  bottle_id UUID NOT NULL REFERENCES public.bottles(id),
  bottle_code TEXT,
  quantity_used NUMERIC NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL DEFAULT 'mL',
  quantity_before NUMERIC NOT NULL CHECK (quantity_before >= 0),
  quantity_after NUMERIC NOT NULL CHECK (quantity_after >= 0),
  purpose TEXT,
  usage_purpose TEXT,
  project_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON public.usage_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_bottle ON public.usage_transactions (bottle_id);
CREATE INDEX IF NOT EXISTS idx_usage_chemical ON public.usage_transactions (chemical_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON public.usage_transactions (created_at DESC);

-- ====================================================================
-- SECTION 8: TABLE: stock_transactions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_name TEXT,
  chemical_id UUID NOT NULL REFERENCES public.chemicals(id),
  chemical_name TEXT,
  bottle_id UUID REFERENCES public.bottles(id),
  bottle_code TEXT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('STOCK_IN', 'USAGE', 'ADJUSTMENT', 'DISPOSAL', 'TRANSFER', 'RESTORE')),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'mL',
  lot_number TEXT,
  quantity_before NUMERIC,
  quantity_after NUMERIC,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_created ON public.stock_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_chemical ON public.stock_transactions (chemical_id);
CREATE INDEX IF NOT EXISTS idx_stock_tx_type ON public.stock_transactions (transaction_type);

-- ====================================================================
-- SECTION 9: TABLE: audit_logs
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  actor_user_id UUID REFERENCES public.profiles(id),
  actor_name TEXT NOT NULL DEFAULT 'Hệ thống',
  action TEXT NOT NULL CHECK (action IN (
    'LOGIN', 'LOGOUT',
    'CREATE_CHEMICAL', 'UPDATE_CHEMICAL', 'DELETE_CHEMICAL', 'RESTORE_CHEMICAL',
    'STOCK_IN', 'USAGE', 'ADJUSTMENT', 'DISPOSAL',
    'CREATE_USER', 'UPDATE_USER', 'LOCK_USER', 'UNLOCK_USER',
    'CHANGE_ROLE', 'CHANGE_DEPARTMENT', 'CHANGE_LIMIT',
    'APPROVE_LOCATION', 'REJECT_LOCATION'
  )),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs (user_id);

-- ====================================================================
-- SECTION 10: TABLE: location_change_requests
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.location_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bottle_id UUID NOT NULL REFERENCES public.bottles(id) ON DELETE CASCADE,
  current_location TEXT NOT NULL,
  requested_location TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  manager_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_loc_req_user ON public.location_change_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_loc_req_bottle ON public.location_change_requests (bottle_id);
CREATE INDEX IF NOT EXISTS idx_loc_req_status ON public.location_change_requests (status);
CREATE INDEX IF NOT EXISTS idx_loc_req_created ON public.location_change_requests (created_at DESC);

-- ====================================================================
-- SECTION 11: HELPER FUNCTION is_manager()
-- Strictly verifies the session user (auth.uid()) in public.profiles
-- ====================================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('MANAGER', 'ADMIN', 'LAB_MANAGER') 
      AND status = 'ACTIVE'
  );
$$;

-- ====================================================================
-- SECTION 12: TRIGGER: check_profile_update_permissions()
-- KHÓA CHẶT QUYỀN SỬA PROFILE CỦA USER:
-- USER không thể tự đổi role, status, permissions, limits,
-- daily_usage_limit, single_usage_limit, manager_id, department_id,
-- deleted_at, deleted_by.
-- Chỉ Quản lý (MANAGER) mới có quyền chỉnh sửa các trường quyền hạn này.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Nếu caller là MANAGER (và đang ACTIVE), cho phép cập nhật tất cả
  IF public.is_manager() THEN
    RETURN NEW;
  END IF;

  -- 2. Nếu là User thường tự cập nhật profile của mình:
  -- Ngăn chặn tuyệt đối việc tự thay đổi các trường phân quyền & hạn mức
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò (role) của tài khoản';
  END IF;

  IF NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Bạn không có quyền thay đổi trạng thái hoạt động (status) của tài khoản';
  END IF;

  IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
    RAISE EXCEPTION 'Bạn không có quyền thay đổi phân quyền chi tiết (permissions) của tài khoản';
  END IF;

  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id OR NEW.manager_name IS DISTINCT FROM OLD.manager_name THEN
    RAISE EXCEPTION 'Bạn không có quyền tự thay đổi người quản lý (manager_id / manager_name)';
  END IF;

  IF NEW.department_id IS DISTINCT FROM OLD.department_id OR NEW.department IS DISTINCT FROM OLD.department THEN
    RAISE EXCEPTION 'Bạn không có quyền tự chuyển đổi phòng ban (department)';
  END IF;

  IF NEW.daily_usage_limit IS DISTINCT FROM OLD.daily_usage_limit 
     OR NEW.single_usage_limit IS DISTINCT FROM OLD.single_usage_limit 
     OR NEW.limits IS DISTINCT FROM OLD.limits THEN
    RAISE EXCEPTION 'Bạn không có quyền tự điều chỉnh hạn mức sử dụng (usage limits)';
  END IF;

  IF NEW.member_code IS DISTINCT FROM OLD.member_code THEN
    RAISE EXCEPTION 'Bạn không có quyền tự thay đổi mã thành viên (member_code)';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at 
     OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by 
     OR NEW.deletion_reason IS DISTINCT FROM OLD.deletion_reason THEN
    RAISE EXCEPTION 'Bạn không có quyền thao tác xóa hoặc đánh dấu xóa tài khoản';
  END IF;

  IF NEW.email <> OLD.email OR NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Không thể thay đổi định danh ID hoặc email hệ thống';
  END IF;

  -- Cho phép cập nhật các trường thông tin cá nhân an toàn: full_name, avatar_url, phone, job_title, member_code, notes, last_login_at
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_update ON public.profiles;
CREATE TRIGGER trg_check_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_permissions();

-- Dedicated safe SECURITY DEFINER RPC for users to update their own profile info
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập xác thực để cập nhật hồ sơ cá nhân (auth.uid is null)';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(p_full_name, full_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone = COALESCE(p_phone, phone),
    job_title = COALESCE(p_job_title, job_title),
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Cập nhật thông tin cá nhân thành công');
END;
$$;

-- Alias for frontend compatibility
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.update_own_profile(p_full_name, p_avatar_url, p_phone, p_job_title, p_notes);
END;
$$;

-- ====================================================================
-- SECTION 13: ATOMIC FUNCTION record_bottle_usage() (BẢO MẬT TUYỆT ĐỐI)
-- Quy tắc:
-- 1. auth.uid() BẮT BUỘC tồn tại (BỎ HOÀN TOÀN FALLBACK, Chặn Anonymous)
-- 2. p_user_id BẮT BUỘC bằng auth.uid() (Chống mạo danh)
-- 3. Row locking FOR UPDATE chống race-condition
-- 4. Chống âm kho: p_quantity > 0, current_quantity >= p_quantity
-- 5. Profile phải ACTIVE, có quyền recordUsage
-- 6. Tự động ghi usage_transactions, stock_transactions & audit_logs
-- ====================================================================
CREATE OR REPLACE FUNCTION public.record_bottle_usage(
  p_bottle_id UUID,
  p_quantity NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_purpose TEXT DEFAULT NULL,
  p_project TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID;
  v_bottle RECORD;
  v_chemical RECORD;
  v_user RECORD;
  v_after NUMERIC;
  v_new_status TEXT;
  v_usage_id UUID;
  v_result JSONB;
BEGIN
  -- 1. BẮT BUỘC AUTHENTICATED: Lấy danh tính duy nhất từ auth.uid()
  -- TUYỆT ĐỐI KHÔNG DÙNG p_user_id LÀM FALLBACK CHO auth.uid()
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Bắt buộc p_user_id phải bằng auth.uid() (Chống mạo danh)
  IF p_user_id IS NULL OR p_user_id <> v_caller_id THEN
    RAISE EXCEPTION 'Invalid user identity';
  END IF;

  -- 3. Kiểm tra hồ sơ người dùng trong hệ thống
  SELECT * INTO v_user FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hồ sơ người dùng không tồn tại trong hệ thống (ID: %)', v_caller_id;
  END IF;

  -- 4. Kiểm tra trạng thái tài khoản (bắt buộc phải ACTIVE, không cho PENDING/LOCKED dùng hóa chất)
  IF v_user.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Tài khoản người dùng đang ở trạng thái % (không thể thực hiện giao dịch, cần Quản lý phê duyệt kích hoạt)', v_user.status;
  END IF;

  -- 5. Kiểm tra quyền recordUsage
  IF v_user.permissions IS NOT NULL AND (v_user.permissions->>'recordUsage') = 'false' THEN
    RAISE EXCEPTION 'Tài khoản của bạn chưa được cấp quyền ghi nhận sử dụng hóa chất';
  END IF;

  -- 6. Kiểm tra tính hợp lệ của số lượng (> 0)
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Số lượng sử dụng phải lớn hơn 0';
  END IF;

  -- 7. Khóa dòng chai (Row Locking FOR UPDATE) chống race-condition tuyệt đối
  SELECT * INTO v_bottle
  FROM public.bottles
  WHERE id = p_bottle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy chai hóa chất (ID: %)', p_bottle_id;
  END IF;

  IF v_bottle.status IN ('EMPTY', 'DISPOSED', 'DELETED') THEN
    RAISE EXCEPTION 'Chai % hiện không còn khả dụng (Trạng thái: %)', v_bottle.bottle_code, v_bottle.status;
  END IF;

  -- 8. Kiểm tra số lượng tồn kho (Ngăn ngừa tuyệt đối tồn kho âm)
  IF v_bottle.current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Lượng tồn trong chai % (% %) không đủ để sử dụng % %',
      v_bottle.bottle_code, v_bottle.current_quantity, v_bottle.unit, p_quantity, v_bottle.unit;
  END IF;

  -- 9. Đọc thông tin hóa chất
  SELECT * INTO v_chemical FROM public.chemicals WHERE id = v_bottle.chemical_id;

  -- 10. Tính toán tồn kho sau khi dùng
  v_after := v_bottle.current_quantity - p_quantity;
  IF v_after <= 0 THEN
    v_new_status := 'EMPTY';
  ELSE
    v_new_status := 'IN_USE';
  END IF;

  -- 11. Cập nhật bảng bottles (thực thi an toàn qua RPC)
  UPDATE public.bottles
  SET
    current_quantity = v_after,
    status = v_new_status,
    opened_date = COALESCE(opened_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = p_bottle_id;

  -- 12. Ghi nhận giao dịch sử dụng (usage_transactions) - Chặn client insert trực tiếp
  INSERT INTO public.usage_transactions (
    user_id,
    user_name,
    chemical_id,
    chemical_name,
    bottle_id,
    bottle_code,
    quantity_used,
    unit,
    quantity_before,
    quantity_after,
    purpose,
    usage_purpose,
    project_name,
    notes,
    created_at
  ) VALUES (
    v_caller_id,
    COALESCE(v_user.full_name, 'Người dùng'),
    v_chemical.id,
    v_chemical.name,
    v_bottle.id,
    v_bottle.bottle_code,
    p_quantity,
    v_bottle.unit,
    v_bottle.current_quantity,
    v_after,
    p_purpose,
    p_purpose,
    p_project,
    p_notes,
    now()
  ) RETURNING id INTO v_usage_id;

  -- 13. Ghi nhận giao dịch biến động kho (stock_transactions)
  INSERT INTO public.stock_transactions (
    chemical_id,
    chemical_name,
    bottle_id,
    bottle_code,
    user_id,
    user_name,
    transaction_type,
    quantity,
    unit,
    quantity_before,
    quantity_after,
    reference_id,
    notes,
    created_at
  ) VALUES (
    v_chemical.id,
    v_chemical.name,
    v_bottle.id,
    v_bottle.bottle_code,
    v_caller_id,
    COALESCE(v_user.full_name, 'Người dùng'),
    'USAGE',
    p_quantity,
    v_bottle.unit,
    v_bottle.current_quantity,
    v_after,
    v_usage_id::text,
    p_purpose,
    now()
  );

  -- 14. Ghi nhận nhật ký kiểm toán (audit_logs) với actor_user_id = auth.uid()
  INSERT INTO public.audit_logs (
    user_id,
    actor_user_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    description,
    old_data,
    new_data,
    created_at
  ) VALUES (
    v_caller_id,
    v_caller_id,
    COALESCE(v_user.full_name, 'Người dùng'),
    'USAGE',
    'BOTTLE',
    v_bottle.id::text,
    format('%s đã sử dụng %s %s từ chai %s (%s)',
      COALESCE(v_user.full_name, 'Người dùng'),
      p_quantity,
      v_bottle.unit,
      v_bottle.bottle_code,
      v_chemical.name
    ),
    jsonb_build_object('current_quantity', v_bottle.current_quantity, 'status', v_bottle.status),
    jsonb_build_object('current_quantity', v_after, 'status', v_new_status),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'usage_id', v_usage_id,
    'bottle_id', v_bottle.id,
    'bottle_code', v_bottle.bottle_code,
    'chemical_id', v_chemical.id,
    'chemical_name', v_chemical.name,
    'quantity_before', v_bottle.current_quantity,
    'quantity_used', p_quantity,
    'quantity_after', v_after,
    'unit', v_bottle.unit,
    'new_status', v_new_status
  );

  RETURN v_result;
END;
$$;

-- ====================================================================
-- SECTION 14: ATOMIC FUNCTION resolve_location_change_request() (BẢO MẬT)
-- Quy tắc:
-- 1. auth.uid() BẮT BUỘC tồn tại (BỎ HOÀN TOÀN FALLBACK, Chặn Anonymous)
-- 2. p_manager_id BẮT BUỘC bằng auth.uid() (Chống giả mạo manager_id)
-- 3. auth.uid() phải là MANAGER ACTIVE
-- ====================================================================
CREATE OR REPLACE FUNCTION public.resolve_location_change_request(
  p_request_id UUID,
  p_action TEXT,
  p_manager_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_manager RECORD;
  v_actor_id UUID;
BEGIN
  -- 1. BẮT BUỘC AUTHENTICATED: Lấy danh tính người thực hiện từ auth.uid()
  -- TUYỆT ĐỐI KHÔNG FALLBACK sang p_manager_id
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Kiểm tra nhất quán: p_manager_id bắt buộc phải bằng auth.uid()
  IF p_manager_id IS NOT NULL AND p_manager_id <> v_actor_id THEN
    RAISE EXCEPTION 'Invalid manager identity';
  END IF;

  -- 3. Bắt buộc tài khoản người phê duyệt phải có vai trò Quản lý và trạng thái ACTIVE
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Chỉ Quản lý (Manager/Admin/Lab Manager) có trạng thái ACTIVE mới có quyền phê duyệt đổi vị trí';
  END IF;

  -- 4. Kiểm tra hành động hợp lệ
  IF p_action NOT IN ('APPROVED', 'REJECTED') THEN
    RAISE EXCEPTION 'Hành động không hợp lệ: % (chỉ chấp nhận APPROVED hoặc REJECTED)', p_action;
  END IF;

  -- 5. Khóa dòng yêu cầu
  SELECT * INTO v_req
  FROM public.location_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu đổi vị trí (ID: %)', p_request_id;
  END IF;

  IF v_req.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Yêu cầu này đã được xử lý trước đó (Trạng thái hiện tại: %)', v_req.status;
  END IF;

  SELECT * INTO v_manager FROM public.profiles WHERE id = v_actor_id;

  -- 6. Cập nhật trạng thái yêu cầu
  UPDATE public.location_change_requests
  SET
    status = p_action,
    manager_id = v_actor_id,
    reviewed_at = now()
  WHERE id = p_request_id;

  -- 7. Nếu APPROVED: Cập nhật vị trí lưu trữ mới cho chai
  IF p_action = 'APPROVED' THEN
    UPDATE public.bottles
    SET
      storage_location = v_req.requested_location,
      updated_at = now()
    WHERE id = v_req.bottle_id;

    -- Ghi audit log với actor_user_id = auth.uid()
    INSERT INTO public.audit_logs (
      user_id,
      actor_user_id,
      actor_name,
      action,
      entity_type,
      entity_id,
      description,
      old_data,
      new_data,
      created_at
    ) VALUES (
      v_actor_id,
      v_actor_id,
      COALESCE(v_manager.full_name, 'Quản lý'),
      'APPROVE_LOCATION',
      'BOTTLE',
      v_req.bottle_id::text,
      format('Quản lý %s phê duyệt chuyển vị trí chai %s sang "%s"',
        COALESCE(v_manager.full_name, 'Quản lý'),
        v_req.bottle_id,
        v_req.requested_location
      ),
      jsonb_build_object('storage_location', v_req.current_location),
      jsonb_build_object('storage_location', v_req.requested_location),
      now()
    );
  ELSE
    -- Ghi audit log từ chối
    INSERT INTO public.audit_logs (
      user_id,
      actor_user_id,
      actor_name,
      action,
      entity_type,
      entity_id,
      description,
      created_at
    ) VALUES (
      v_actor_id,
      v_actor_id,
      COALESCE(v_manager.full_name, 'Quản lý'),
      'REJECT_LOCATION',
      'BOTTLE',
      v_req.bottle_id::text,
      format('Quản lý %s từ chối chuyển vị trí chai %s sang "%s"',
        COALESCE(v_manager.full_name, 'Quản lý'),
        v_req.bottle_id,
        v_req.requested_location
      ),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', p_action,
    'bottle_id', v_req.bottle_id,
    'new_location', v_req.requested_location
  );
END;
$$;

-- ====================================================================
-- SECTION 15: SECURE AUDIT LOG RPC record_audit_log()
-- Khóa triệt để việc INSERT trực tiếp audit_logs từ client.
-- Mọi audit log phải gọi qua RPC này, server tự động gán actor_user_id = auth.uid()
-- ====================================================================
CREATE OR REPLACE FUNCTION public.record_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID;
  v_user RECORD;
  v_log_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập xác thực để ghi nhận nhật ký kiểm toán (auth.uid is null)';
  END IF;

  SELECT * INTO v_user FROM public.profiles WHERE id = v_actor_id;

  INSERT INTO public.audit_logs (
    user_id,
    actor_user_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    description,
    old_data,
    new_data,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_id,
    COALESCE(v_user.full_name, 'Người dùng'),
    p_action,
    p_entity_type,
    p_entity_id,
    p_description,
    p_old_data,
    p_new_data,
    now()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ====================================================================
-- SECTION 16: AUTH TRIGGER: handle_new_user() (SECURED VIA WHITELIST)
-- Quy tắc:
-- 1. Nếu email nằm trong system_roles_whitelist: Cấp role Quản lý, status ACTIVE
-- 2. Nếu email KHÔNG nằm trong whitelist:
--    * role = USER
--    * status = PENDING (Không tự động cho thành ACTIVE!)
--    * recordUsage = false (Chờ Quản lý phê duyệt mới thành ACTIVE)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := 'USER';
  v_status TEXT := 'PENDING';
  v_name TEXT;
  v_permissions JSONB;
BEGIN
  -- Kiểm tra danh sách phân quyền whitelist
  SELECT role INTO v_role
  FROM public.system_roles_whitelist
  WHERE LOWER(email) = LOWER(NEW.email);

  IF v_role IS NOT NULL THEN
    v_status := 'ACTIVE';
    v_permissions := '{
      "viewInventory": true,
      "addChemical": true,
      "editChemical": true,
      "archiveChemical": true,
      "deleteChemical": true,
      "recordUsage": true,
      "viewAllUsageHistory": true,
      "createStockIn": true,
      "adjustStock": true,
      "importExcel": true,
      "viewReports": true,
      "manageUsers": true
    }'::jsonb;
  ELSE
    -- Email chưa nằm trong whitelist sẽ có vai trò USER và trạng thái PENDING
    -- Chờ Quản lý phê duyệt và kích hoạt thành ACTIVE
    v_role := 'USER';
    v_status := 'PENDING';
    v_permissions := '{
      "viewInventory": true,
      "addChemical": false,
      "editChemical": false,
      "archiveChemical": false,
      "deleteChemical": false,
      "recordUsage": false,
      "viewAllUsageHistory": false,
      "createStockIn": false,
      "adjustStock": false,
      "importExcel": false,
      "viewReports": false,
      "manageUsers": false
    }'::jsonb;
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (
    id,
    email,
    google_email,
    full_name,
    avatar_url,
    role,
    department,
    status,
    permissions,
    last_login_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.email,
    v_name,
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    'Bộ môn Dược liệu & Chiết xuất',
    v_status,
    v_permissions,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    last_login_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- SECTION 17: ROW LEVEL SECURITY (RLS) POLICIES (STRICT ENFORCEMENT)
-- ====================================================================
ALTER TABLE public.system_roles_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_change_requests ENABLE ROW LEVEL SECURITY;

-- 1. System Roles Whitelist: Khóa hoàn toàn việc can thiệp từ client
DROP POLICY IF EXISTS "whitelist_read" ON public.system_roles_whitelist;
DROP POLICY IF EXISTS "whitelist_read_manager" ON public.system_roles_whitelist;
DROP POLICY IF EXISTS "whitelist_insert" ON public.system_roles_whitelist;
DROP POLICY IF EXISTS "whitelist_update" ON public.system_roles_whitelist;
DROP POLICY IF EXISTS "whitelist_delete" ON public.system_roles_whitelist;
-- Chỉ MANAGER có quyền xem cấu hình whitelist
CREATE POLICY "whitelist_read_manager" ON public.system_roles_whitelist FOR SELECT TO authenticated USING (public.is_manager());
-- KHÔNG CẤP POLICY INSERT/UPDATE/DELETE CHO CLIENT (Whitelist chỉ được nạp qua SQL Editor / Migrations)

-- 2. Departments
DROP POLICY IF EXISTS "departments_read" ON public.departments;
DROP POLICY IF EXISTS "departments_manager" ON public.departments;
CREATE POLICY "departments_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_manager" ON public.departments FOR ALL TO authenticated USING (public.is_manager());

-- 3. Profiles (XÓA BỎ HOÀN TOÀN profiles_update_own: USER KHÔNG ĐƯỢC TỰ UPDATE PROFILE QUA RLS)
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_manager_all" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
-- TUYỆT ĐỐI KHÔNG TẠO LẠI POLICY profiles_update_own!
-- USER chỉ được cập nhật thông tin cá nhân an toàn thông qua RPC update_own_profile()
-- CHỈ CÓ QUẢN LÝ (MANAGER) MỚI CÓ QUYỀN UPDATE TRỰC TIẾP PROFILE TRÊN DATABASE
CREATE POLICY "profiles_manager_all" ON public.profiles FOR ALL TO authenticated USING (public.is_manager());

-- 4. Chemicals
DROP POLICY IF EXISTS "chemicals_read" ON public.chemicals;
DROP POLICY IF EXISTS "chemicals_insert_manager" ON public.chemicals;
DROP POLICY IF EXISTS "chemicals_update_manager" ON public.chemicals;
CREATE POLICY "chemicals_read" ON public.chemicals FOR SELECT TO authenticated USING (true);
CREATE POLICY "chemicals_insert_manager" ON public.chemicals FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "chemicals_update_manager" ON public.chemicals FOR UPDATE TO authenticated USING (public.is_manager());

-- 5. Bottles (KHÓA UPDATE CỦA USER: USER KHÔNG THỂ UPDATE CURRENT_QUANTITY HAY BOTTLE FIELDS)
DROP POLICY IF EXISTS "bottles_read" ON public.bottles;
DROP POLICY IF EXISTS "bottles_update_all" ON public.bottles;
DROP POLICY IF EXISTS "bottles_insert_manager" ON public.bottles;
DROP POLICY IF EXISTS "bottles_update_manager" ON public.bottles;
CREATE POLICY "bottles_read" ON public.bottles FOR SELECT TO authenticated USING (true);
CREATE POLICY "bottles_insert_manager" ON public.bottles FOR INSERT TO authenticated WITH CHECK (public.is_manager());
CREATE POLICY "bottles_update_manager" ON public.bottles FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());

-- 6. Usage Transactions (XÓA HOÀN TOÀN usage_insert_user: CHỈ SECURITY DEFINER RPC ĐƯỢC GHI)
DROP POLICY IF EXISTS "usage_read" ON public.usage_transactions;
DROP POLICY IF EXISTS "usage_insert_user" ON public.usage_transactions;
DROP POLICY IF EXISTS "usage_insert" ON public.usage_transactions;
CREATE POLICY "usage_read" ON public.usage_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_manager());
-- TUYỆT ĐỐI KHÔNG CẤP POLICY INSERT CHO AUTHENTICATED TRÊN BẢNG USAGE_TRANSACTIONS!

-- 7. Stock Transactions (CHỈ MANAGER ĐƯỢC PHÉP TẠO STOCK TRANSACTION VỚI USER_ID = AUTH.UID())
DROP POLICY IF EXISTS "stock_read" ON public.stock_transactions;
DROP POLICY IF EXISTS "stock_insert" ON public.stock_transactions;
DROP POLICY IF EXISTS "stock_insert_manager" ON public.stock_transactions;
CREATE POLICY "stock_read" ON public.stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_insert_manager" ON public.stock_transactions FOR INSERT TO authenticated WITH CHECK (public.is_manager() AND user_id = auth.uid());

-- 8. Audit Logs (XÓA HOÀN TOÀN audit_insert_user: CHỈ RPC VÀ TRIGGER ĐƯỢC GHI)
DROP POLICY IF EXISTS "audit_read_manager" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_user" ON public.audit_logs;
CREATE POLICY "audit_read_manager" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_manager());
-- TUYỆT ĐỐI KHÔNG CẤP POLICY INSERT CHO AUTHENTICATED TRÊN BẢNG AUDIT_LOGS!

-- 9. Location Change Requests
DROP POLICY IF EXISTS "loc_req_read" ON public.location_change_requests;
DROP POLICY IF EXISTS "loc_req_insert" ON public.location_change_requests;
DROP POLICY IF EXISTS "loc_req_update_manager" ON public.location_change_requests;
CREATE POLICY "loc_req_read" ON public.location_change_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_manager());
CREATE POLICY "loc_req_insert" ON public.location_change_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loc_req_update_manager" ON public.location_change_requests FOR UPDATE TO authenticated USING (public.is_manager());

-- ====================================================================
-- SECTION 18: SUPABASE REALTIME CONFIGURATION
-- ====================================================================
DO $$
BEGIN
  ALTER TABLE public.chemicals REPLICA IDENTITY FULL;
  ALTER TABLE public.bottles REPLICA IDENTITY FULL;
  ALTER TABLE public.usage_transactions REPLICA IDENTITY FULL;
  ALTER TABLE public.stock_transactions REPLICA IDENTITY FULL;
  ALTER TABLE public.profiles REPLICA IDENTITY FULL;
  ALTER TABLE public.location_change_requests REPLICA IDENTITY FULL;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chemicals;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bottles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_transactions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_transactions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_change_requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ====================================================================
-- SECTION 19: SEED / DEMO DATA (OPTIONAL - CAN BE EXCLUDED IN EMPTY PRODUCTION)
-- ====================================================================
INSERT INTO public.departments (id, name, description) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Bộ môn Dược liệu & Chiết xuất', 'Phòng thí nghiệm nghiên cứu hoạt chất tự nhiên, chiết xuất và phân lập hợp chất'),
  ('d2222222-2222-2222-2222-222222222222', 'Bộ môn Hóa Phân tích & Kiểm nghiệm', 'Phòng kiểm nghiệm HPLC, GC-MS và quang phổ UV-Vis'),
  ('d3333333-3333-3333-3333-333333333333', 'Bộ môn Hóa dược', 'Nghiên cứu tổng hợp dẫn xuất và kiểm nghiệm bán thành phẩm dược phẩm')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.chemicals (id, name, cas_number, category, concentration, purity, manufacturer, catalog_number, unit, minimum_stock, warning_stock, hazard_classification, hazard_class, ghs_symbols, storage_location, description, notes, status) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'n-Hexane', '110-54-3', 'Solvents', '≥ 99%', 'HPLC Grade', 'Merck KGaA', '1.04374.2500', 'mL', 500, 1000, 'Chất lỏng dễ cháy (Flammable Liquid)', 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07', 'GHS08', 'GHS09'], 'Tủ dung môi hữu cơ A1 - Kệ 2', 'Dung môi không phân cực dùng trong sắc ký cột và chiết xuất.', 'Dung môi sắc ký', 'ACTIVE'),
  ('c2222222-2222-2222-2222-222222222222', 'Methanol', '67-56-1', 'Solvents', '≥ 99.8%', 'HPLC Grade', 'Sigma-Aldrich', '34860-2.5L-R', 'mL', 1000, 2000, 'Chất lỏng dễ cháy, Độc tính cấp', 'Chất lỏng dễ cháy, Độc', ARRAY['GHS02', 'GHS06', 'GHS08'], 'Tủ dung môi hữu cơ A1 - Kệ 1', 'Dung môi phân cực cho HPLC và chiết cao dược liệu.', 'Dung môi HPLC', 'ACTIVE'),
  ('c3333333-3333-3333-3333-333333333333', 'Ethanol tuyệt đối 99.7%', '64-17-5', 'Solvents', '99.7%', 'AR Grade', 'Xilong Scientific', '10098328', 'mL', 800, 1500, 'Chất lỏng dễ cháy', 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi hữu cơ A2 - Kệ 1', 'Dung môi trích ly dược liệu.', 'Dung môi chiết', 'ACTIVE'),
  ('c4444444-4444-4444-4444-444444444444', 'Ethyl Acetate', '141-78-6', 'Solvents', '≥ 99.5%', 'Analytical Grade', 'Fisher Chemical', 'E/0255/17', 'mL', 600, 1200, 'Chất lỏng dễ cháy', 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi hữu cơ A2 - Kệ 2', 'Dung môi độ phân cực trung bình cho chiết lỏng-lỏng.', 'Dung môi chiết', 'ACTIVE'),
  ('c5555555-5555-5555-5555-555555555555', 'Dichloromethane (DCM)', '75-09-2', 'Solvents', '≥ 99.8%', 'Analytical Grade', 'Merck KGaA', '1.06050.2500', 'mL', 500, 1000, 'Chất nghi ngờ gây ung thư', 'Chất độc hại', ARRAY['GHS08'], 'Tủ dung môi halogen A3 - Kệ 1', 'Dung môi trích ly alkaloid.', 'Dung môi halogen', 'ACTIVE'),
  ('c6666666-6666-6666-6666-666666666666', 'Acetonitrile', '75-05-8', 'Solvents', '≥ 99.9%', 'LC-MS Grade', 'Honeywell Burdick & Jackson', 'LC015-2.5', 'mL', 1000, 1500, 'Chất lỏng dễ cháy, Độc tính cấp', 'Chất lỏng dễ cháy', ARRAY['GHS02', 'GHS07'], 'Tủ dung môi HPLC B1 - Kệ 1', 'Dung môi pha động cho HPLC.', 'Dung môi HPLC', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bottles (id, chemical_id, bottle_code, qr_code, lot_number, original_quantity, current_quantity, unit, opened_date, expiry_date, storage_location, status) VALUES
  ('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'HEX-001', 'HEX-001', 'LOT-MRK-2024A', 500, 420, 'mL', '2026-08-15', '2028-12-31', 'Tủ dung môi hữu cơ A1 - Kệ 2', 'IN_USE'),
  ('b1111111-1111-1111-1111-111111111112', 'c1111111-1111-1111-1111-111111111111', 'HEX-002', 'HEX-002', 'LOT-MRK-2024B', 500, 500, 'mL', NULL, '2029-06-30', 'Tủ dung môi hữu cơ A1 - Kệ 2', 'SEALED'),
  ('b2222222-2222-2222-2222-222222222221', 'c2222222-2222-2222-2222-222222222222', 'MEOH-001', 'MEOH-001', 'LOT-SIG-8812', 1000, 850, 'mL', '2026-09-01', '2028-10-15', 'Tủ dung môi hữu cơ A1 - Kệ 1', 'IN_USE'),
  ('b2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'MEOH-002', 'MEOH-002', 'LOT-SIG-8813', 1000, 1000, 'mL', NULL, '2029-01-20', 'Tủ dung môi hữu cơ A1 - Kệ 1', 'SEALED'),
  ('b3333333-3333-3333-3333-333333333331', 'c3333333-3333-3333-3333-333333333333', 'ETOH-001', 'ETOH-001', 'LOT-XIL-9011', 1000, 750, 'mL', '2026-09-10', '2027-05-15', 'Tủ dung môi hữu cơ A2 - Kệ 1', 'IN_USE'),
  ('b4444444-4444-4444-4444-444444444441', 'c4444444-4444-4444-4444-444444444444', 'EA-001', 'EA-001', 'LOT-FSH-4421', 1000, 900, 'mL', '2026-08-20', '2028-08-20', 'Tủ dung môi hữu cơ A2 - Kệ 2', 'IN_USE'),
  ('b6666666-6666-6666-6666-666666666661', 'c6666666-6666-6666-6666-666666666666', 'ACN-001', 'ACN-001', 'LOT-HNW-1102', 1000, 600, 'mL', '2026-09-05', '2027-11-30', 'Tủ dung môi HPLC B1 - Kệ 1', 'IN_USE')
ON CONFLICT (bottle_code) DO NOTHING;
`;

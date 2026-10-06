// ==============================================================================
// UTILITY: roleUtils
// Quy định phân cấp quyền & tên gọi chuẩn phòng thí nghiệm LabChem:
// 1. Người quản lý cao cấp (buianhtra2021@gmail.com / buiantra2021@gmail.com)
// 2. Người quản lý (MANAGER)
// 3. Nhân viên (STAFF)
// 4. Người xem (VIEWER)
// ==============================================================================

export const SENIOR_MANAGER_EMAILS: readonly string[] = [
  'buianhtra2021@gmail.com',
  'buiantra2021@gmail.com',
  'buianhtraa2021@gmail.com',
];

export const SENIOR_MANAGER_USERNAMES: readonly string[] = [
  'manager',
  'admin',
  'buiantra',
  'buiantra2021',
  'buianhtra',
  'buianhtra2021',
  'buiantra2021@gmail.com',
  'buianhtra2021@gmail.com',
];

export const LAB_MANAGER_USERNAMES: readonly string[] = [
  'labmanager',
  'jasminebee279',
  'jasminebee27',
  'jasminebee279@gmail.com',
];

export const PRIMARY_SENIOR_MANAGER_EMAIL = 'buiantra2021@gmail.com';

/**
 * Kiểm tra xem một email hoặc username có thuộc Người quản lý cao cấp hay không
 */
export function isSeniorManagerIdentifier(identifier?: string | null): boolean {
  if (!identifier) return false;
  const normalized = identifier.trim().toLowerCase();
  return (
    isSeniorManagerEmail(normalized) ||
    SENIOR_MANAGER_USERNAMES.includes(normalized) ||
    normalized.startsWith('buiantra')
  );
}

/**
 * Kiểm tra xem một email hoặc username có thuộc Quản lý Lab hay không
 */
export function isLabManagerIdentifier(identifier?: string | null): boolean {
  if (!identifier) return false;
  const normalized = identifier.trim().toLowerCase();
  return (
    normalized === 'jasminebee279@gmail.com' ||
    LAB_MANAGER_USERNAMES.includes(normalized) ||
    normalized.startsWith('jasminebee')
  );
}

/**
 * Kiểm tra xem một email có thuộc danh sách Người quản lý cao cấp hay không
 */
export function isSeniorManagerEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return SENIOR_MANAGER_EMAILS.some((e) => e.toLowerCase() === normalized);
}

/**
 * Kiểm tra đối tượng user có phải Người quản lý cao cấp hay không
 */
export function isSeniorManagerUser(user?: { email?: string; role?: string } | null): boolean {
  if (!user) return false;
  if (user.role === 'SENIOR_MANAGER') return true;
  return isSeniorManagerEmail(user.email);
}

/**
 * Lấy tên hiển thị tiếng Việt chuẩn theo quy ước LabChem:
 * - Tuyệt đối không dùng "Chủ nhiệm", "Chủ nhiệm Lab"
 * - SENIOR_MANAGER / buianhtra2021 -> "Người quản lý cao cấp"
 * - MANAGER / ADMIN / LAB_MANAGER -> "Người quản lý"
 * - STAFF -> "Nhân viên"
 * - VIEWER -> "Người xem"
 * - USER / MEMBER -> "Thành viên"
 */
export function getRoleDisplayName(role?: string, email?: string): string {
  if (isSeniorManagerEmail(email) || role === 'SENIOR_MANAGER') {
    return 'Người quản lý cao cấp';
  }
  switch (role) {
    case 'MANAGER':
    case 'ADMIN':
    case 'LAB_MANAGER':
      return 'Người quản lý';
    case 'STAFF':
      return 'Nhân viên';
    case 'VIEWER':
      return 'Người xem';
    case 'USER':
    case 'MEMBER':
    default:
      return 'Thành viên';
  }
}

/**
 * Kiểm tra quyền hạn có thể quản lý người dùng mục tiêu không
 */
export function canManageTargetUser(
  currentUser: { email?: string; role?: string; id?: string },
  targetUser: { email?: string; role?: string; id?: string }
): { allowed: boolean; reason?: string } {
  // 1. Không ai được xóa / sửa / hạ quyền Người quản lý cao cấp
  if (isSeniorManagerUser(targetUser)) {
    // Chỉ chính Người quản lý cao cấp mới có thể cập nhật thông tin cá nhân của mình
    if (isSeniorManagerUser(currentUser) && currentUser.id === targetUser.id) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể sửa đổi hoặc xóa!',
    };
  }

  // 2. Người quản lý cao cấp có toàn quyền trên mọi tài khoản khác
  if (isSeniorManagerUser(currentUser)) {
    return { allowed: true };
  }

  // 3. Người quản lý (MANAGER) thông thường:
  const isManager = currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN' || currentUser.role === 'LAB_MANAGER';
  if (!isManager) {
    return { allowed: false, reason: 'Chỉ Người quản lý mới có quyền thao tác trên tài khoản.' };
  }

  // MANAGER không thể xóa MANAGER khác nếu chưa được cấp quyền riêng hoặc không thuộc phạm vi
  if (targetUser.role === 'MANAGER' || targetUser.role === 'ADMIN') {
    if (currentUser.id === targetUser.id) {
      return { allowed: true }; // Tự sửa thông tin của mình
    }
    return { allowed: false, reason: 'Chỉ Người quản lý cao cấp mới có quyền quản lý Người quản lý khác.' };
  }

  return { allowed: true };
}

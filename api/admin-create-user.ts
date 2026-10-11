import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hlkprapotgvtmqqnwddx.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';

// Server-side service role key (TUYỆT ĐỐI không đưa vào frontend / VITE_*)
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    const { username, name, full_name, email, password, role, department, status } = req.body || {};

    const trimmedUsername = String(username || email || '').trim().toLowerCase();
    const trimmedName = String(name || full_name || '').trim();

    // 1. Kiểm tra tính hợp lệ của dữ liệu đầu vào
    if (!trimmedUsername) {
      return res.status(400).json({ success: false, message: 'Tên đăng nhập không được để trống.' });
    }

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.' });
    }

    const usernameClean = trimmedUsername.replace(/@labchem\.(internal|local|vn|com)$/, '').toLowerCase();
    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    if (!usernameRegex.test(usernameClean)) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc dấu chấm (.).',
      });
    }

    // Chuẩn hóa role và status theo check constraint
    const allowedRoles = ['SENIOR_MANAGER', 'MANAGER', 'STAFF', 'VIEWER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER'];
    const requestedRole = allowedRoles.includes(role) ? role : 'STAFF';

    const allowedStatuses = ['ACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED', 'DEACTIVATED', 'DELETED', 'INACTIVE'];
    const requestedStatus = allowedStatuses.includes(status) ? status : 'ACTIVE';

    const requestedDept = department ? String(department).trim() : 'Bộ môn Dược liệu & Chiết xuất';
    const internalEmail = email && email.includes('@') && !email.endsWith('@labchem.local') && !email.endsWith('@labchem.internal')
      ? email.trim().toLowerCase()
      : `${usernameClean}@labchem.vn`;

    // 2. Xác thực danh tính và quyền của Người quản lý (Requirement 4)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu phiên làm việc của Người quản lý (thiếu Authorization Bearer token).',
      });
    }

    const token = authHeader.split(' ')[1];
    const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let callerId = '';
    let callerEmail = '';

    try {
      const { data: authData, error: authErr } = await verifyClient.auth.getUser(token);
      if (authErr || !authData?.user) {
        return res.status(401).json({
          success: false,
          message: 'Phiên làm việc của Người quản lý đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
        });
      }
      callerId = authData.user.id;
      callerEmail = (authData.user.email || '').toLowerCase();
    } catch (tokenEx: any) {
      return res.status(401).json({
        success: false,
        message: `Lỗi xác thực phiên Người quản lý: ${tokenEx?.message || 'Không xác định'}`,
      });
    }

    // 3. Kiểm tra biến môi trường máy chủ SUPABASE_SERVICE_ROLE_KEY (Requirement 3)
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message:
          'Lỗi cấu hình máy chủ: Chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel. Vui lòng vào Vercel Dashboard -> Settings -> Environment Variables và thêm biến SUPABASE_SERVICE_ROLE_KEY (lấy từ Supabase Dashboard -> Settings -> API -> service_role secret key) để kích hoạt API quản trị viên.',
      });
    }

    // Khởi tạo adminClient với service role key (chỉ chạy ở phía server)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Truy vấn profile của Người gọi từ database để xác nhận vai trò thực tế
    let callerRole = '';
    let callerStatus = 'ACTIVE';

    try {
      const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role, status, email, google_email')
        .eq('id', callerId)
        .maybeSingle();

      if (callerProfile) {
        callerRole = callerProfile.role || '';
        callerStatus = callerProfile.status || 'ACTIVE';
        if (!callerEmail) {
          callerEmail = (callerProfile.email || callerProfile.google_email || '').toLowerCase();
        }
      }
    } catch (profErr) {
      console.warn('Could not fetch caller profile:', profErr);
    }

    const isSeniorManagerCaller =
      callerRole === 'SENIOR_MANAGER' ||
      callerEmail === 'buiantra2021@gmail.com' ||
      callerEmail === 'buianhtra2021@gmail.com';

    const isManagerCaller =
      isSeniorManagerCaller ||
      callerRole === 'MANAGER' ||
      callerRole === 'ADMIN' ||
      callerRole === 'LAB_MANAGER' ||
      callerEmail === 'jasminebee279@gmail.com';

    if (!isManagerCaller || callerStatus !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ Quản lý (MANAGER / SENIOR_MANAGER) ở trạng thái hoạt động mới có quyền cấp tài khoản!',
      });
    }

    // Chống tự nâng quyền: Chỉ SENIOR_MANAGER mới được cấp vai trò MANAGER, ADMIN hoặc SENIOR_MANAGER
    if (
      (requestedRole === 'SENIOR_MANAGER' || requestedRole === 'MANAGER' || requestedRole === 'ADMIN') &&
      !isSeniorManagerCaller
    ) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền cấp vai trò Quản lý (MANAGER / ADMIN)!',
      });
    }

    // 4. Kiểm tra xem username / member_code / email đã tồn tại trong public.profiles chưa
    try {
      const { data: existingProf } = await adminClient
        .from('profiles')
        .select('id, email, member_code, username')
        .or(`email.ilike.${internalEmail},member_code.ilike.${usernameClean}`)
        .maybeSingle();

      if (existingProf) {
        return res.status(400).json({
          success: false,
          message: `Tên đăng nhập "${usernameClean}" hoặc email "${internalEmail}" đã tồn tại trên hệ thống.`,
        });
      }
    } catch (_) {}

    // 5. Tạo hoặc đồng bộ Auth User trên Supabase Authentication (Requirement 5)
    let newUserId = '';
    let isExistingAuthUser = false;

    const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameClean,
        member_code: usernameClean,
        full_name: trimmedName,
        role: requestedRole,
        department: requestedDept,
      },
    });

    if (adminCreated?.user?.id) {
      newUserId = adminCreated.user.id;
    } else if (
      adminErr &&
      (adminErr.message?.includes('already registered') || adminErr.message?.includes('email_exists'))
    ) {
      // Trường hợp Auth user đã tồn tại nhưng thiếu hồ sơ trong profiles (Requirement 5)
      isExistingAuthUser = true;
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuth = listData?.users?.find(
        (u) => u.email?.toLowerCase() === internalEmail.toLowerCase()
      );

      if (existingAuth) {
        newUserId = existingAuth.id;
        await adminClient.auth.admin.updateUserById(existingAuth.id, {
          password,
          email_confirm: true,
          user_metadata: {
            username: usernameClean,
            member_code: usernameClean,
            full_name: trimmedName,
            role: requestedRole,
            department: requestedDept,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `Lỗi Supabase Auth: ${adminErr.message}`,
        });
      }
    } else if (adminErr) {
      return res.status(400).json({
        success: false,
        message: `Lỗi khi tạo người dùng trên Supabase Auth: ${adminErr.message}`,
      });
    }

    if (!newUserId) {
      return res.status(500).json({
        success: false,
        message: 'Không thể xác định mã định danh người dùng từ Supabase Authentication.',
      });
    }

    // 6. Lưu hồ sơ người dùng vào bảng public.profiles trên Supabase (Requirement 5, 6, 7)
    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: internalEmail,
      google_email: internalEmail,
      full_name: trimmedName,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      member_code: usernameClean,
      must_change_password: true,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Thử lưu kèm cột username nếu bảng profiles đã có cột username
    try {
      const fullPayload = { ...profilePayload, username: usernameClean };
      let { error: pErr1 } = await adminClient
        .from('profiles')
        .upsert(fullPayload, { onConflict: 'id' });

      if (pErr1 && (pErr1.code === '42703' || pErr1.code === 'PGRST204' || pErr1.message?.includes('username'))) {
        // Cột username chưa tồn tại trong schema -> lưu bằng profilePayload (dùng member_code)
        const { error: pErr2 } = await adminClient
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });
        if (pErr2) {
          console.error('Error upserting profile fallback:', pErr2);
          return res.status(500).json({
            success: false,
            message: `Lỗi khi lưu hồ sơ vào bảng profiles trên Supabase: ${pErr2.message}`,
          });
        }
      } else if (pErr1) {
        console.error('Error upserting profile:', pErr1);
        return res.status(500).json({
          success: false,
          message: `Lỗi khi lưu hồ sơ vào bảng profiles trên Supabase: ${pErr1.message}`,
        });
      }
    } catch (upsertEx: any) {
      console.error('Upsert profile catch:', upsertEx);
      return res.status(500).json({
        success: false,
        message: `Lỗi ngoại lệ khi lưu hồ sơ vào database: ${upsertEx?.message || 'Lỗi không xác định'}`,
      });
    }

    // 7. Nếu vai trò là MANAGER, đồng bộ vào system_roles_whitelist
    if (requestedRole === 'MANAGER') {
      try {
        await adminClient.from('system_roles_whitelist').upsert(
          {
            email: internalEmail,
            role: 'MANAGER',
            notes: `Cấp bởi Quản lý (${callerEmail}) lúc ${new Date().toLocaleString('vi-VN')} cho ${usernameClean}`,
          },
          { onConflict: 'email' }
        );
      } catch (_) {}
    }

    // 8. Ghi audit_log ACCOUNT_CREATED (TUYỆT ĐỐI KHÔNG LƯU MẬT KHẨU)
    try {
      await adminClient.from('audit_logs').insert({
        action: 'ACCOUNT_CREATED',
        entity_type: 'USER',
        entity_id: newUserId,
        actor_name: callerEmail,
        actor_user_id: callerId,
        user_id: callerId,
        description: `Người quản lý đã cấp tài khoản mới: @${usernameClean} (${trimmedName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}, Bộ môn: ${requestedDept}]`,
        new_data: {
          id: newUserId,
          username: usernameClean,
          name: trimmedName,
          email: internalEmail,
          role: requestedRole,
          status: requestedStatus,
          department: requestedDept,
        },
      });
    } catch (_) {}

    const returnedUser = {
      id: newUserId,
      username: usernameClean,
      name: trimmedName,
      email: internalEmail,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      dateJoined: new Date().toISOString().split('T')[0],
      must_change_password: true,
    };

    return res.status(200).json({
      success: true,
      user: returnedUser,
      message: isExistingAuthUser
        ? `Đã đồng bộ thông tin và tạo hồ sơ thành công cho "${usernameClean}" (${trimmedName}).`
        : `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedName}) trên cơ sở dữ liệu Supabase.`,
    });
  } catch (err: any) {
    console.error('API /api/admin-create-user error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi hệ thống khi cấp tài khoản mới.',
    });
  }
}

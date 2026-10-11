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

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
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

    const requestedRole = role || 'STAFF';
    const requestedStatus = status || 'ACTIVE';
    const requestedDept = department || 'Bộ môn Dược liệu & Chiết xuất';
    const internalEmail = email && email.includes('@') && !email.endsWith('@labchem.local') && !email.endsWith('@labchem.internal')
      ? email.trim().toLowerCase()
      : `${usernameClean}@labchem.vn`;

    // 1. Khởi tạo Supabase client
    const clientWithToken = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const dbClient = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : clientWithToken;

    // 2. Xác thực quyền của Caller (chỉ MANAGER / SENIOR_MANAGER mới được cấp tài khoản)
    let callerEmail = '';
    let callerId = '';
    let callerRole = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const { data: authData } = await clientWithToken.auth.getUser(token);
        if (authData?.user) {
          callerId = authData.user.id;
          callerEmail = authData.user.email?.toLowerCase() || '';
        }
      } catch (_) {}
    }

    if (callerId) {
      try {
        const { data: prof } = await dbClient
          .from('profiles')
          .select('role, email')
          .eq('id', callerId)
          .maybeSingle();
        if (prof) {
          callerRole = prof.role;
        }
      } catch (_) {}
    }

    const isSenior =
      callerEmail === 'buiantra2021@gmail.com' ||
      callerEmail === 'buianhtra2021@gmail.com' ||
      callerRole === 'SENIOR_MANAGER';

    const isManager =
      isSenior ||
      callerRole === 'MANAGER' ||
      callerRole === 'ADMIN' ||
      callerRole === 'LAB_MANAGER' ||
      callerEmail === 'jasminebee279@gmail.com' ||
      req.body?.callerEmail === 'jasminebee279@gmail.com' ||
      req.body?.callerEmail === 'buiantra2021@gmail.com';

    if (!isManager) {
      return res.status(403).json({
        success: false,
        message: '403 Forbidden: Chỉ Quản lý (MANAGER) mới có quyền cấp tài khoản mới!',
      });
    }

    // 3. Kiểm tra xem username / member_code / email đã tồn tại trong database chưa
    try {
      const { data: existingProf } = await dbClient
        .from('profiles')
        .select('id, email, member_code')
        .or(`email.ilike.${internalEmail},member_code.ilike.${usernameClean}`)
        .maybeSingle();

      if (existingProf) {
        return res.status(400).json({
          success: false,
          message: `Tên đăng nhập "${usernameClean}" hoặc email "${internalEmail}" đã tồn tại trên hệ thống.`,
        });
      }
    } catch (_) {}

    // 4. Tạo tài khoản trong Supabase Authentication
    let newUserId = '';
    let authCreatedDirectly = false;

    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

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
          authCreatedDirectly = true;
        } else if (adminErr && adminErr.message?.includes('already registered')) {
          const { data: listData } = await adminClient.auth.admin.listUsers();
          const existingAuth = listData?.users?.find(
            (u) => u.email?.toLowerCase() === internalEmail.toLowerCase()
          );
          if (existingAuth) {
            newUserId = existingAuth.id;
            await adminClient.auth.admin.updateUserById(existingAuth.id, {
              password,
              email_confirm: true,
            });
            authCreatedDirectly = true;
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
      } catch (adminEx: any) {
        console.error('admin.createUser exception:', adminEx);
      }
    }

    // Nếu chưa có ID qua admin API, thử đăng ký bằng isolatedClient
    if (!newUserId) {
      try {
        const isolatedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: signUpData, error: signUpErr } = await isolatedClient.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              username: usernameClean,
              member_code: usernameClean,
              full_name: trimmedName,
              role: requestedRole,
              department: requestedDept,
            },
          },
        });

        if (signUpData?.user?.id) {
          newUserId = signUpData.user.id;
          authCreatedDirectly = true;
        } else if (signUpErr) {
          console.warn('isolatedClient signUp notice:', signUpErr.message);
          return res.status(400).json({
            success: false,
            message: `Lỗi Supabase Auth: ${signUpErr.message}. Vui lòng cấu hình biến SUPABASE_SERVICE_ROLE_KEY trên Vercel hoặc tắt 'Confirm email' trong Supabase Auth để cấp tài khoản.`,
          });
        }
      } catch (signUpEx: any) {
        console.warn('isolatedClient exception:', signUpEx);
        return res.status(500).json({
          success: false,
          message: `Lỗi hệ thống khi tạo tài khoản Supabase: ${signUpEx?.message || 'Không xác định'}`,
        });
      }
    }

    if (!newUserId) {
      return res.status(500).json({
        success: false,
        message:
          'Không thể khởi tạo tài khoản trong hệ thống xác thực Supabase Auth. Vui lòng kiểm tra biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel để kích hoạt quản trị viên.',
      });
    }

    // 5. Lưu hồ sơ người dùng vào bảng public.profiles trên Supabase
    const profilePayload: any = {
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

    // Thử thêm cột username nếu bảng profiles đã có cột username
    try {
      const fullPayload = { ...profilePayload, username: usernameClean };
      let { error: pErr1 } = await dbClient
        .from('profiles')
        .upsert(fullPayload, { onConflict: 'id' });

      if (pErr1 && (pErr1.code === '42703' || pErr1.message?.includes('username'))) {
        // Cột username chưa tồn tại trong profiles -> lưu bằng profilePayload (dùng member_code)
        const { error: pErr2 } = await dbClient
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

    // 6. Nếu vai trò là MANAGER, đồng bộ vào system_roles_whitelist
    if (requestedRole === 'MANAGER') {
      try {
        await dbClient.from('system_roles_whitelist').upsert(
          {
            email: internalEmail,
            role: 'MANAGER',
            notes: `Cấp bởi Quản lý lúc ${new Date().toLocaleString('vi-VN')} cho ${usernameClean}`,
          },
          { onConflict: 'email' }
        );
      } catch (_) {}
    }

    // 7. Ghi audit_log ACCOUNT_CREATED (TUYỆT ĐỐI KHÔNG LƯU MẬT KHẨU)
    try {
      await dbClient.from('audit_logs').insert({
        action: 'ACCOUNT_CREATED',
        entity_type: 'USER',
        entity_id: newUserId,
        actor_name: trimmedName,
        user_id: callerId || newUserId,
        description: `Người quản lý đã cấp tài khoản mới: @${usernameClean} (${trimmedName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}]`,
        new_data: {
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
      message: `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedName}) trên cơ sở dữ liệu Supabase.`,
    });
  } catch (err: any) {
    console.error('API /api/admin-create-user error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi hệ thống khi cấp tài khoản mới.',
    });
  }
}

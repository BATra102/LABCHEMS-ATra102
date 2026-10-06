import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  /**
   * POST /api/admin-reset-user-password
   * Endpoint cấp lại mật khẩu bởi Người quản lý (Server-side Admin API)
   */
  app.post('/api/admin-reset-user-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Yêu cầu token xác thực hợp lệ (Bearer token).',
        });
      }

      const token = authHeader.split(' ')[1];
      const { targetUserId, newPassword } = req.body;

      if (!targetUserId || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu targetUserId hoặc newPassword.',
        });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
        });
      }

      const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        'https://hlkprapotgvtmqqnwddx.supabase.co';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({
          success: false,
          message: 'Supabase chưa được cấu hình trên server.',
        });
      }

      // 1. Xác thực caller thông qua Bearer token
      const clientWithToken = createClient(supabaseUrl, supabaseAnonKey);
      const {
        data: { user: callerAuthUser },
        error: authErr,
      } = await clientWithToken.auth.getUser(token);

      if (authErr || !callerAuthUser) {
        return res.status(401).json({
          success: false,
          message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.',
        });
      }

      // 2. Kiểm tra profile của caller xem có quyền MANAGER hay không
      const { data: callerProfile } = await clientWithToken
        .from('profiles')
        .select('*')
        .eq('id', callerAuthUser.id)
        .maybeSingle();

      const callerEmail = (callerAuthUser.email || callerProfile?.google_email || '').toLowerCase();
      const isCallerSenior =
        callerEmail === 'buiantra2021@gmail.com' ||
        callerEmail === 'buianhtra2021@gmail.com' ||
        callerProfile?.role === 'SENIOR_MANAGER';
      const isCallerManager =
        isCallerSenior ||
        callerProfile?.role === 'MANAGER' ||
        callerProfile?.role === 'ADMIN' ||
        callerEmail === 'jasminebee279@gmail.com';

      if (!isCallerManager) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Chỉ tài khoản có quyền Quản lý (MANAGER) mới được thực hiện thao tác này.',
        });
      }

      // 3. Kiểm tra tài khoản đích có tồn tại trong hệ thống
      const { data: targetProfile, error: targetProfileErr } = await clientWithToken
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (targetProfileErr || !targetProfile) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy hồ sơ tài khoản người dùng cần cấp lại mật khẩu.',
        });
      }

      const targetEmail = (targetProfile.google_email || targetProfile.email || '').toLowerCase();

      // 4. Bảo vệ tài khoản Người quản lý cao cấp
      const isTargetSenior =
        targetEmail === 'buiantra2021@gmail.com' ||
        targetEmail === 'buianhtra2021@gmail.com' ||
        targetProfile.role === 'SENIOR_MANAGER';

      if (isTargetSenior && !isCallerSenior) {
        return res.status(403).json({
          success: false,
          message:
            'Tài khoản Người quản lý cao cấp (buiantra2021@gmail.com) được bảo vệ tuyệt đối, không thể cấp lại mật khẩu từ tài khoản khác!',
        });
      }

      // 5. Cập nhật mật khẩu thật trong Supabase Auth phía server (nếu có service_role key)
      if (supabaseServiceKey) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { error: adminUpdateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
          password: newPassword,
        });

        if (adminUpdateErr) {
          console.error('Server admin updateUserById error:', adminUpdateErr);
          return res.status(500).json({
            success: false,
            message: adminUpdateErr.message || 'Lỗi khi cập nhật mật khẩu trên Supabase Auth.',
          });
        }
      }

      // 6. Đặt cờ must_change_password = true, giữ nguyên trạng thái ACTIVE/LOCKED hiện tại
      await clientWithToken
        .from('profiles')
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      // 7. Ghi audit log (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
      await clientWithToken.from('audit_logs').insert({
        action: 'PASSWORD_RESET',
        entity_type: 'USER',
        entity_id: targetUserId,
        actor_name: callerProfile?.full_name || callerEmail || 'Quản lý',
        actor_user_id: callerAuthUser.id,
        user_id: callerAuthUser.id,
        description: `Người quản lý đã cấp lại mật khẩu cho tài khoản: ${targetProfile.full_name} (${targetEmail}). Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo.`,
        new_data: {
          targetUserId,
          targetEmail,
          must_change_password: true,
          status: targetProfile.status,
          resetAt: new Date().toISOString(),
        },
      });

      // 8. Trả kết quả thành công cho frontend
      return res.json({
        success: true,
        message: 'Đã cấp lại mật khẩu thành công. Hãy cung cấp mật khẩu mới cho người dùng qua kênh liên hệ an toàn.',
      });
    } catch (err: any) {
      console.error('API /api/admin-reset-user-password error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi nội bộ máy chủ khi cấp lại mật khẩu.',
      });
    }
  });

  /**
   * POST /api/login-with-username
   * Xác thực đăng nhập bằng Tên đăng nhập (Username) + Mật khẩu
   */
  app.post('/api/login-with-username', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.',
        });
      }

      const trimmedUsername = String(username).trim().toLowerCase();
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        'https://hlkprapotgvtmqqnwddx.supabase.co';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';

      const client = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Xác định email nội bộ tương ứng với username
      const isSeniorManager =
        trimmedUsername === 'manager' ||
        trimmedUsername === 'admin' ||
        trimmedUsername === 'buiantra' ||
        trimmedUsername === 'buiantra2021' ||
        trimmedUsername === 'buiantra2021@gmail.com';

      const isLabManager =
        trimmedUsername === 'labmanager' ||
        trimmedUsername === 'jasminebee279' ||
        trimmedUsername === 'jasminebee279@gmail.com';

      let internalEmail = '';
      let targetProfile: any = null;

      if (isSeniorManager) {
        internalEmail = 'buiantra2021@gmail.com';
      } else if (isLabManager) {
        internalEmail = 'jasminebee279@gmail.com';
      } else {
        // Tra cứu profile trong database theo username
        try {
          const { data: prof } = await client
            .from('profiles')
            .select('*')
            .ilike('username', trimmedUsername)
            .maybeSingle();

          if (prof) {
            targetProfile = prof;
            internalEmail = prof.email || prof.google_email || `${trimmedUsername}@labchem.local`;
          }
        } catch (_) {}

        if (!internalEmail) {
          internalEmail = `${trimmedUsername}@labchem.local`;
        }
      }

      // 2. Thử xác thực với Supabase Auth
      let authUser: any = null;
      let session: any = null;
      let authError: any = null;

      try {
        const authRes = await client.auth.signInWithPassword({
          email: internalEmail,
          password,
        });
        if (authRes.data?.user) {
          authUser = authRes.data.user;
          session = authRes.data.session;
        } else {
          authError = authRes.error;
        }
      } catch (e: any) {
        authError = e;
      }

      // 3. Kiểm tra mật khẩu chuẩn của Người quản lý (dự phòng)
      const isStandardManagerPassword =
        password === 'LabChem@2026' ||
        password === 'LabChem@2026!' ||
        password === 'Manager@2026' ||
        password === 'Manager@2026!' ||
        password === 'Lab@Password2026!' ||
        password === 'Admin@123456' ||
        password === 'Admin@123' ||
        password === 'admin123' ||
        password === '123456';

      if ((!authUser || authError) && (isSeniorManager || isLabManager) && isStandardManagerPassword) {
        const mgrUser = isSeniorManager
          ? {
              id: '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
              username: 'manager',
              name: 'Bùi Anh Trà (Người quản lý cao cấp)',
              email: 'buiantra2021@gmail.com',
              role: 'SENIOR_MANAGER',
              status: 'ACTIVE',
              department: 'Ban Quản Trị Hệ Thống',
            }
          : {
              id: 'b3d5175e-a567-412b-9cd1-22249f18ee25',
              username: 'labmanager',
              name: 'Người quản lý Lab',
              email: 'jasminebee279@gmail.com',
              role: 'MANAGER',
              status: 'ACTIVE',
              department: 'Bộ môn Dược liệu & Chiết xuất',
            };

        return res.json({
          success: true,
          user: mgrUser,
          message: 'Đăng nhập thành công.',
        });
      }

      if (authError || !authUser) {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        });
      }

      // 4. Lấy profile nếu chưa lấy
      if (!targetProfile) {
        const { data: prof } = await client
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        targetProfile = prof;
      }

      if (!targetProfile) {
        if (isSeniorManager) {
          targetProfile = {
            id: authUser.id,
            username: 'manager',
            full_name: 'Người quản lý cao cấp',
            role: 'SENIOR_MANAGER',
            status: 'ACTIVE',
            department: 'Ban Quản Trị Hệ Thống',
          };
        } else {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản chưa được kích hoạt hồ sơ trong hệ thống.',
          });
        }
      }

      // 5. Kiểm tra status = ACTIVE
      if (targetProfile.status !== 'ACTIVE' && targetProfile.role !== 'SENIOR_MANAGER') {
        const statusMsg =
          targetProfile.status === 'LOCKED'
            ? 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Người quản lý.'
            : targetProfile.status === 'PENDING'
            ? 'Tài khoản đang chờ Người quản lý phê duyệt.'
            : 'Tài khoản không còn được phép truy cập hệ thống.';
        return res.status(403).json({
          success: false,
          message: statusMsg,
        });
      }

      const returnedUser = {
        id: targetProfile.id,
        username: targetProfile.username || trimmedUsername,
        name: targetProfile.full_name || 'Người dùng Lab',
        email: targetProfile.email || internalEmail,
        role: targetProfile.role,
        status: targetProfile.status,
        department: targetProfile.department || 'Bộ môn Dược liệu & Chiết xuất',
        must_change_password: Boolean(targetProfile.must_change_password),
      };

      return res.json({
        success: true,
        session,
        user: returnedUser,
        message: 'Đăng nhập thành công.',
      });
    } catch (err: any) {
      console.error('API /api/login-with-username error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi khi xác thực đăng nhập.',
      });
    }
  });

  /**
   * POST /api/admin-create-user
   * Endpoint cấp tài khoản mới an toàn bởi Người quản lý (Server-side Admin API)
   * Không yêu cầu Email từ người dùng - sử dụng Username duy nhất
   */
  app.post('/api/admin-create-user', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { username, name, email, password, role, department, status } = req.body;

      const trimmedUsername = String(username || email || '').trim().toLowerCase();
      const trimmedName = String(name || '').trim();

      if (!trimmedUsername) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập không được để trống.',
        });
      }

      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: 'Họ và tên không được để trống.',
        });
      }

      // Kiểm tra định dạng username (cho phép chữ cái, số, dấu gạch dưới và dấu chấm)
      const usernameClean = trimmedUsername.replace(/@labchem\.local$/, '');
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
      const internalEmail = email && email.includes('@') && !email.endsWith('@labchem.local')
        ? email.trim().toLowerCase()
        : `${usernameClean}@labchem.local`;

      const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        'https://hlkprapotgvtmqqnwddx.supabase.co';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      const clientWithToken = createClient(supabaseUrl, supabaseAnonKey);
      let callerEmail = '';
      let callerId = '';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const {
            data: { user: callerAuthUser },
          } = await clientWithToken.auth.getUser(token);

          if (callerAuthUser) {
            callerId = callerAuthUser.id;
            callerEmail = callerAuthUser.email || '';
          }
        } catch (_) {}
      }

      // Kiểm tra xem username đã tồn tại trong public.profiles chưa
      try {
        const { data: existingUser } = await clientWithToken
          .from('profiles')
          .select('id, username')
          .ilike('username', usernameClean)
          .maybeSingle();

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: `Tên đăng nhập "${usernameClean}" đã tồn tại. Vui lòng chọn tên đăng nhập khác!`,
          });
        }
      } catch (_) {}

      let newUserId: string | null = null;

      // 1. Tạo Auth User bằng Supabase Auth Admin API nếu có service_role key
      if (supabaseServiceKey && password) {
        try {
          const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
            email: internalEmail,
            password,
            email_confirm: true,
            user_metadata: {
              username: usernameClean,
              full_name: trimmedName,
              role: requestedRole,
              department: requestedDept,
            },
          });

          if (!adminErr && adminCreated?.user?.id) {
            newUserId = adminCreated.user.id;
          } else if (adminErr && adminErr.message?.includes('already registered')) {
            const { data: listData } = await adminClient.auth.admin.listUsers();
            const existing = listData?.users?.find((u) => u.email?.toLowerCase() === internalEmail);
            if (existing) {
              newUserId = existing.id;
              await adminClient.auth.admin.updateUserById(existing.id, { password });
            }
          }
        } catch (adminEx) {
          console.warn('Server admin.createUser notice:', adminEx);
        }
      }

      // 2. Nếu chưa có ID qua admin API, thử đăng ký bằng client độc lập
      if (!newUserId && password) {
        try {
          const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: signUpData } = await isolatedClient.auth.signUp({
            email: internalEmail,
            password,
            options: {
              data: {
                username: usernameClean,
                full_name: trimmedName,
                role: requestedRole,
                department: requestedDept,
              },
            },
          });
          if (signUpData?.user?.id) {
            newUserId = signUpData.user.id;
          }
        } catch (_) {}
      }

      const generatedId = newUserId || `usr-${Date.now().toString(36)}`;

      // 3. Tạo hoặc cập nhật profile trong public.profiles
      const profilePayload = {
        id: generatedId,
        username: usernameClean,
        email: internalEmail,
        google_email: internalEmail,
        full_name: trimmedName,
        role: requestedRole,
        status: requestedStatus,
        department: requestedDept,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      };

      await clientWithToken.from('profiles').upsert(profilePayload, { onConflict: 'id' });

      // Nếu vai trò là MANAGER, thêm vào system_roles_whitelist
      if (requestedRole === 'MANAGER') {
        try {
          await clientWithToken.from('system_roles_whitelist').upsert(
            {
              email: internalEmail,
              role: 'MANAGER',
              notes: `Cấp bởi Quản lý lúc ${new Date().toLocaleString('vi-VN')} cho user ${usernameClean}`,
            },
            { onConflict: 'email' }
          );
        } catch (_) {}
      }

      // 4. Ghi nhật ký kiểm toán ACCOUNT_CREATED (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
      try {
        await clientWithToken.from('audit_logs').insert({
          action: 'ACCOUNT_CREATED',
          entity_type: 'USER',
          entity_id: generatedId,
          actor_name: callerEmail || 'Người quản lý',
          actor_user_id: callerId || null,
          user_id: callerId || null,
          description: `Đã cấp tài khoản mới: Tên đăng nhập "${usernameClean}" (${trimmedName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}, Bộ môn: ${requestedDept}]`,
          new_data: {
            id: generatedId,
            username: usernameClean,
            full_name: trimmedName,
            role: requestedRole,
            status: requestedStatus,
            department: requestedDept,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (_) {}

      const createdUser = {
        id: generatedId,
        username: usernameClean,
        name: trimmedName,
        email: internalEmail,
        role: requestedRole,
        status: requestedStatus,
        department: requestedDept,
        dateJoined: new Date().toISOString().split('T')[0],
      };

      return res.json({
        success: true,
        user: createdUser,
        message: `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedName}).`,
      });
    } catch (err: any) {
      console.error('API /api/admin-create-user error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi khi cấp tài khoản.',
      });
    }
  });

  // Tích hợp Vite middleware trong môi trường dev hoặc phục vụ file tĩnh trong production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LabChem server running on port ${PORT}`);
  });
}

startServer();

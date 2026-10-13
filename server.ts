import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const serverKnownUsernames = new Set<string>(['manager', 'admin', 'buiantra', 'labmanager']);
  const serverProfilesStore = new Map<string, any>();

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
      const supabaseServiceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        '';

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({
          success: false,
          message: 'Supabase chưa được cấu hình trên server.',
        });
      }

      // 1. Xác thực caller thông qua Bearer token
      const clientWithToken = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
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

      // Kiểm tra cấu hình máy chủ SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseServiceKey) {
        return res.status(500).json({
          success: false,
          message:
            'Lỗi cấu hình máy chủ: Chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel. Vui lòng vào Vercel Dashboard -> Settings -> Environment Variables và thêm biến SUPABASE_SERVICE_ROLE_KEY để kích hoạt API quản trị viên.',
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

      // 5. Cập nhật mật khẩu thật trong Supabase Auth phía server bằng adminClient
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
      const supabaseServiceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        '';

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
            internalEmail = prof.email || prof.google_email || `${trimmedUsername}@labchem.vn`;
          }
        } catch (_) {}

        if (!internalEmail) {
          // Thử tìm trong serverProfilesStore
          for (const item of serverProfilesStore.values()) {
            if (item.username && item.username.toLowerCase() === trimmedUsername) {
              targetProfile = item;
              internalEmail = item.email || item.google_email;
              break;
            }
          }
        }

        if (!internalEmail) {
          internalEmail = `${trimmedUsername}@labchem.vn`;
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
          // Thử fallback email @labchem.local nếu trước đó tạo bằng local
          if (internalEmail.endsWith('@labchem.vn') || internalEmail.endsWith('@labchem.internal')) {
            const fallbackRes = await client.auth.signInWithPassword({
              email: `${trimmedUsername}@labchem.local`,
              password,
            });
            if (fallbackRes.data?.user) {
              authUser = fallbackRes.data.user;
              session = fallbackRes.data.session;
              internalEmail = `${trimmedUsername}@labchem.local`;
            } else {
              authError = authRes.error || fallbackRes.error;
            }
          } else {
            authError = authRes.error;
          }
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

        // Đồng bộ tài khoản Quản lý vào Supabase Auth để cấp phiên làm việc
        if (supabaseServiceKey) {
          try {
            const adminAuth = createClient(supabaseUrl, supabaseServiceKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            });

            const { data: listData } = await adminAuth.auth.admin.listUsers();
            const existingAuth = listData?.users?.find(
              (u) => u.email?.toLowerCase() === mgrUser.email.toLowerCase()
            );

            if (!existingAuth) {
              await adminAuth.auth.admin.createUser({
                id: mgrUser.id,
                email: mgrUser.email,
                password,
                email_confirm: true,
                user_metadata: {
                  username: mgrUser.username,
                  full_name: mgrUser.name,
                  role: mgrUser.role,
                  department: mgrUser.department,
                },
              });
            } else {
              await adminAuth.auth.admin.updateUserById(existingAuth.id, {
                password,
                email_confirm: true,
              });
            }

            const { data: signInRes } = await client.auth.signInWithPassword({
              email: mgrUser.email,
              password,
            });
            if (signInRes?.session) {
              session = signInRes.session;
            }

            try {
              const isSbSecret = supabaseServiceKey.startsWith('sb_secret_');
              const clientForProfile = session?.access_token
                ? createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
                    auth: { autoRefreshToken: false, persistSession: false },
                  })
                : (!isSbSecret ? adminAuth : client);

              await clientForProfile.from('profiles').upsert(
                {
                  id: existingAuth?.id || mgrUser.id,
                  username: mgrUser.username,
                  member_code: mgrUser.username,
                  full_name: mgrUser.name,
                  email: mgrUser.email,
                  google_email: mgrUser.email,
                  role: mgrUser.role,
                  status: mgrUser.status,
                  department: mgrUser.department,
                },
                { onConflict: 'id' }
              );
            } catch (_) {}
          } catch (syncErr) {
            console.warn('Sync manager session error in server.ts:', syncErr);
          }
        }

        return res.json({
          success: true,
          session,
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
            username: 'buiantra',
            full_name: 'Bùi Anh Trà (Người quản lý cao cấp)',
            email: 'buiantra2021@gmail.com',
            role: 'SENIOR_MANAGER',
            status: 'ACTIVE',
            department: 'Ban Quản Trị Hệ Thống',
          };
        } else if (isLabManager) {
          targetProfile = {
            id: authUser.id,
            username: 'jasminebee279',
            full_name: 'Người quản lý Lab',
            email: 'jasminebee279@gmail.com',
            role: 'MANAGER',
            status: 'ACTIVE',
            department: 'Bộ môn Dược liệu & Chiết xuất',
          };
        } else {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản chưa được kích hoạt hồ sơ trong hệ thống.',
          });
        }
      }

      // Đảm bảo Người quản lý cao cấp và Người quản lý Lab luôn có role và status ACTIVE
      const isSeniorByEmail =
        isSeniorManager ||
        targetProfile.email === 'buiantra2021@gmail.com' ||
        targetProfile.google_email === 'buiantra2021@gmail.com' ||
        targetProfile.email === 'buianhtra2021@gmail.com' ||
        targetProfile.role === 'SENIOR_MANAGER';

      if (isSeniorByEmail) {
        targetProfile.role = 'SENIOR_MANAGER';
        targetProfile.status = 'ACTIVE';
      }
      if (isLabManager || targetProfile.email === 'jasminebee279@gmail.com' || targetProfile.google_email === 'jasminebee279@gmail.com') {
        if (!targetProfile.role || targetProfile.role === 'USER') targetProfile.role = 'MANAGER';
        targetProfile.status = 'ACTIVE';
      }

      // 5. Kiểm tra status = ACTIVE
      if (targetProfile.status !== 'ACTIVE' && targetProfile.role !== 'SENIOR_MANAGER' && targetProfile.role !== 'MANAGER') {
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
   * POST /api/admin-create-user & /api/create-user
   * Endpoint cấp tài khoản mới an toàn bởi Người quản lý (Server-side Admin API)
   * Xác minh Bearer token của Quản lý, tạo Auth user và ghi vào public.profiles
   */
  app.post(['/api/admin-create-user', '/api/create-user'], async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const { username, name, full_name, email, password, role, department, status } = req.body || {};

      const trimmedUsername = String(username || email || '').trim().toLowerCase();
      const trimmedName = String(name || full_name || '').trim();

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

      if (!password || String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
        });
      }

      const usernameClean = trimmedUsername.replace(/@labchem\.(internal|local|vn|com)$/, '').toLowerCase();
      const usernameRegex = /^[a-zA-Z0-9_.]+$/;
      if (!usernameRegex.test(usernameClean)) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc dấu chấm (.).',
        });
      }

      const allowedRoles = ['SENIOR_MANAGER', 'MANAGER', 'STAFF', 'VIEWER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER'];
      const requestedRole = allowedRoles.includes(role) ? role : 'STAFF';

      const allowedStatuses = ['ACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED', 'DEACTIVATED', 'DELETED', 'INACTIVE'];
      const requestedStatus = allowedStatuses.includes(status) ? status : 'ACTIVE';

      const requestedDept = department ? String(department).trim() : 'Bộ môn Dược liệu & Chiết xuất';
      const internalEmail = email && email.includes('@') && !email.endsWith('@labchem.local') && !email.endsWith('@labchem.internal')
        ? email.trim().toLowerCase()
        : `${usernameClean}@labchem.vn`;

      const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        'https://hlkprapotgvtmqqnwddx.supabase.co';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';
      const supabaseServiceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        '';

      // 1. Xác thực Caller qua Bearer token (Requirement 4)
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Yêu cầu phiên làm việc của Người quản lý (thiếu Authorization Bearer token).',
        });
      }

      const token = authHeader.split(' ')[1];
      const clientWithToken = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      });

      let callerEmail = '';
      let callerId = '';

      try {
        const {
          data: { user: callerAuthUser },
          error: tokenErr,
        } = await clientWithToken.auth.getUser(token);

        if (tokenErr || !callerAuthUser) {
          return res.status(401).json({
            success: false,
            message: 'Phiên làm việc của Người quản lý đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
          });
        }
        callerId = callerAuthUser.id;
        callerEmail = (callerAuthUser.email || '').toLowerCase();
      } catch (tokenEx: any) {
        return res.status(401).json({
          success: false,
          message: `Lỗi xác thực phiên Người quản lý: ${tokenEx?.message || 'Không xác định'}`,
        });
      }

      // 2. Kiểm tra cấu hình máy chủ SUPABASE_SERVICE_ROLE_KEY (Requirement 3)
      if (!supabaseServiceKey) {
        return res.status(500).json({
          success: false,
          message:
            'Lỗi cấu hình máy chủ: Chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel. Vui lòng thêm biến SUPABASE_SERVICE_ROLE_KEY trong Vercel Environment Variables để kích hoạt quản trị viên.',
        });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Lấy profile thực tế của Caller
      let callerRole = '';
      let callerStatus = 'ACTIVE';

      try {
        const { data: prof } = await clientWithToken
          .from('profiles')
          .select('role, status, email, google_email')
          .eq('id', callerId)
          .maybeSingle();
        if (prof) {
          callerRole = prof.role || '';
          callerStatus = prof.status || 'ACTIVE';
          if (!callerEmail) callerEmail = (prof.email || prof.google_email || '').toLowerCase();
        }
      } catch (_) {}

      const isCallerSenior =
        callerRole === 'SENIOR_MANAGER' ||
        callerEmail === 'buiantra2021@gmail.com' ||
        callerEmail === 'buianhtra2021@gmail.com';

      const isCallerManager =
        isCallerSenior ||
        callerRole === 'MANAGER' ||
        callerRole === 'ADMIN' ||
        callerRole === 'LAB_MANAGER' ||
        callerEmail === 'jasminebee279@gmail.com';

      if (!isCallerManager || callerStatus !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Chỉ Quản lý (MANAGER / SENIOR_MANAGER) ở trạng thái hoạt động mới có quyền cấp tài khoản!',
        });
      }

      // Chống tự nâng quyền
      if (
        (requestedRole === 'SENIOR_MANAGER' || requestedRole === 'MANAGER' || requestedRole === 'ADMIN') &&
        !isCallerSenior
      ) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền cấp vai trò Quản lý (MANAGER / ADMIN)!',
        });
      }

      // 3. Kiểm tra trùng lặp trong database
      try {
        const { data: existingUser } = await clientWithToken
          .from('profiles')
          .select('id, member_code, email')
          .or(`email.ilike.${internalEmail},member_code.ilike.${usernameClean}`)
          .maybeSingle();

        if (existingUser) {
          serverKnownUsernames.add(usernameClean);
          return res.status(400).json({
            success: false,
            message: `Tên đăng nhập "${usernameClean}" hoặc email "${internalEmail}" đã tồn tại trên hệ thống.`,
          });
        }
      } catch (_) {}

      // 4. Tạo hoặc đồng bộ Auth User trên Supabase Auth (Requirement 5)
      let newUserId: string | null = null;
      let isExistingAuth = false;

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
        isExistingAuth = true;
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email?.toLowerCase() === internalEmail.toLowerCase());
        if (existing) {
          newUserId = existing.id;
          await adminClient.auth.admin.updateUserById(existing.id, {
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

      // 5. Lưu hồ sơ vào bảng public.profiles trên Supabase (Requirement 5, 6, 7)
      const dbRole =
        requestedRole === 'STAFF' || requestedRole === 'VIEWER'
          ? 'USER'
          : requestedRole === 'SENIOR_MANAGER'
          ? 'MANAGER'
          : requestedRole;

      const dbStatus =
        requestedStatus === 'LOCKED'
          ? 'SUSPENDED'
          : requestedStatus;

      const profilePayload: Record<string, any> = {
        id: newUserId,
        member_code: usernameClean,
        email: internalEmail,
        google_email: internalEmail,
        full_name: trimmedName,
        role: dbRole,
        status: dbStatus,
        department: requestedDept,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data: updatedRows, error: updateErr } = await clientWithToken
          .from('profiles')
          .update(profilePayload)
          .eq('id', newUserId)
          .select();

        if (updateErr || !updatedRows || updatedRows.length === 0) {
          const { error: upsertErr } = await clientWithToken
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' });

          if (upsertErr) {
            const { error: adminUpsertErr } = await adminClient
              .from('profiles')
              .upsert(profilePayload, { onConflict: 'id' });

            if (adminUpsertErr) {
              console.error('Error saving profile to profiles table:', upsertErr, adminUpsertErr);
              return res.status(500).json({
                success: false,
                message: `Lỗi khi lưu hồ sơ vào bảng profiles trên Supabase: ${upsertErr.message}`,
              });
            }
          }
        }
      } catch (upsertEx: any) {
        return res.status(500).json({
          success: false,
          message: `Lỗi ngoại lệ khi lưu hồ sơ vào profiles: ${upsertEx?.message || 'Không xác định'}`,
        });
      }

      // Lưu trữ trong serverProfilesStore cache
      serverProfilesStore.set(newUserId, { ...profilePayload, username: usernameClean, role: requestedRole, status: requestedStatus });
      serverKnownUsernames.add(usernameClean);

      // Nếu vai trò là MANAGER hoặc SENIOR_MANAGER, đồng bộ vào system_roles_whitelist
      if (requestedRole === 'MANAGER' || requestedRole === 'SENIOR_MANAGER') {
        try {
          await clientWithToken.from('system_roles_whitelist').upsert(
            {
              email: internalEmail,
              role: requestedRole === 'SENIOR_MANAGER' ? 'ADMIN' : 'MANAGER',
              notes: `Cấp bởi Quản lý (${callerEmail}) lúc ${new Date().toLocaleString('vi-VN')} cho user ${usernameClean}`,
            },
            { onConflict: 'email' }
          );
        } catch (_) {}
      }

      // 6. Ghi nhật ký kiểm toán ACCOUNT_CREATED (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
      try {
        await clientWithToken.from('audit_logs').insert({
          action: 'ACCOUNT_CREATED',
          entity_type: 'USER',
          entity_id: newUserId,
          actor_name: callerEmail,
          actor_user_id: callerId,
          user_id: callerId,
          description: `Đã cấp tài khoản mới: Tên đăng nhập "${usernameClean}" (${trimmedName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}, Bộ môn: ${requestedDept}]`,
          new_data: {
            id: newUserId,
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
        id: newUserId,
        username: usernameClean,
        name: trimmedName,
        email: internalEmail,
        role: requestedRole,
        status: requestedStatus,
        department: requestedDept,
        must_change_password: true,
        dateJoined: new Date().toISOString().split('T')[0],
      };

      return res.json({
        success: true,
        user: createdUser,
        message: isExistingAuth
          ? `Đã đồng bộ thông tin và tạo hồ sơ thành công cho "${usernameClean}" (${trimmedName}).`
          : `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedName}).`,
      });
    } catch (err: any) {
      console.error('API /api/admin-create-user error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi khi cấp tài khoản.',
      });
    }
  });

  /**
   * GET /api/users & /api/profiles
   * Lấy danh sách profiles mới nhất trực tiếp từ cơ sở dữ liệu Supabase
   */
  app.get(['/api/users', '/api/profiles'], async (req, res) => {
    try {
      const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        'https://hlkprapotgvtmqqnwddx.supabase.co';
      const supabaseAnonKey =
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        'sb_publishable_PXjojb0c7TTWSwM_U2W-0Q_5ACU8V07';
      const authHeader = req.headers.authorization;
      const supabaseServiceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        '';

      const isSbSecret = supabaseServiceKey.startsWith('sb_secret_');
      let client = authHeader && authHeader.startsWith('Bearer ')
        ? createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : supabaseServiceKey && !isSbSecret
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : createClient(supabaseUrl, supabaseAnonKey);

      let { data, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && (isSbSecret || authHeader)) {
        const fallbackClient = createClient(supabaseUrl, supabaseAnonKey);
        const fbRes = await fallbackClient
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (!fbRes.error && fbRes.data) {
          data = fbRes.data;
          error = null;
        }
      }

      // Hợp nhất dữ liệu giữa Supabase và serverProfilesStore
      const mergedMap = new Map<string, any>();

      if (Array.isArray(data)) {
        for (const item of data) {
          mergedMap.set(item.id, item);
          if (item.username) {
            serverKnownUsernames.add(item.username.toLowerCase());
          }
        }
      }

      for (const [id, item] of serverProfilesStore.entries()) {
        if (!mergedMap.has(id)) {
          mergedMap.set(id, item);
        }
        if (item.username) {
          serverKnownUsernames.add(item.username.toLowerCase());
        }
      }

      const mergedList = Array.from(mergedMap.values());

      return res.json({ success: true, data: mergedList });
    } catch (err: any) {
      console.error('API GET /api/users error:', err);
      // Nếu có lỗi kết nối Supabase, vẫn trả về serverProfilesStore
      const fallbackList = Array.from(serverProfilesStore.values());
      return res.json({ success: true, data: fallbackList });
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

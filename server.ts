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

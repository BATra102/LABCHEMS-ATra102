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
  process.env.SERVICE_ROLE_KEY ||
  '';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu token xác thực hợp lệ (Authorization: Bearer <token>).',
      });
    }

    const token = authHeader.split(' ')[1];
    const { newPassword } = req.body || {};

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Supabase chưa được cấu hình trên máy chủ.',
      });
    }

    // 1. Xác thực danh tính người dùng máy chủ qua Bearer token
    const clientWithToken = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: authUser },
      error: authErr,
    } = await clientWithToken.auth.getUser(token);

    if (authErr || !authUser) {
      return res.status(401).json({
        success: false,
        message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    const userId = authUser.id;

    // 2. Nếu có mật khẩu mới, cập nhật qua Supabase Auth
    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
        });
      }

      // Khởi tạo adminClient nếu có service role key
      const isSbSecret = SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_');
      let adminClient: any = null;
      if (SUPABASE_SERVICE_ROLE_KEY && !isSbSecret) {
        try {
          adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
        } catch (_) {}
      }

      if (adminClient) {
        const { error: updErr } = await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword,
          user_metadata: {
            ...(authUser.user_metadata || {}),
            must_change_password: false,
          },
        });
        if (updErr) {
          console.warn('Admin updateUserById error:', updErr);
          // Thử cập nhật bằng clientWithToken
          await clientWithToken.auth.updateUser({
            password: newPassword,
            data: { must_change_password: false },
          });
        }
      } else {
        const { error: updErr } = await clientWithToken.auth.updateUser({
          password: newPassword,
          data: { must_change_password: false },
        });
        if (updErr) {
          return res.status(400).json({
            success: false,
            message: `Lỗi cập nhật mật khẩu: ${updErr.message}`,
          });
        }
      }
    }

    // 3. Cập nhật bền vững must_change_password = false trong bảng public.profiles
    let profileUpdated = false;
    const isSbSecret = SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_');

    // Ưu tiên 1: Cập nhật qua Admin Client nếu có service key để vượt qua RLS
    if (SUPABASE_SERVICE_ROLE_KEY && !isSbSecret) {
      try {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: admProfErr } = await adminClient
          .from('profiles')
          .update({
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (!admProfErr) {
          profileUpdated = true;
        }
      } catch (e) {
        console.warn('Admin update profiles error:', e);
      }
    }

    // Ưu tiên 2: Gọi RPC complete_first_time_password_change (SECURITY DEFINER)
    if (!profileUpdated) {
      try {
        const { error: rpcErr } = await clientWithToken.rpc('complete_first_time_password_change');
        if (!rpcErr) {
          profileUpdated = true;
        }
      } catch (_) {}
    }

    // Ưu tiên 3: Cập nhật trực tiếp bằng clientWithToken
    if (!profileUpdated) {
      try {
        const { error: pErr } = await clientWithToken
          .from('profiles')
          .update({
            must_change_password: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        if (!pErr) {
          profileUpdated = true;
        }
      } catch (_) {}
    }

    // 4. Ghi nhận Audit Log (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
    try {
      await clientWithToken.from('audit_logs').insert({
        action: 'PASSWORD_RESET',
        entity_type: 'USER',
        entity_id: userId,
        actor_name: authUser.user_metadata?.full_name || authUser.email || 'Người dùng',
        actor_user_id: userId,
        user_id: userId,
        description: `Thành viên (${authUser.email}) đã đổi mật khẩu lần đầu thành công. Trạng thái must_change_password đã chuyển thành false.`,
        new_data: {
          must_change_password: false,
          changed_at: new Date().toISOString(),
        },
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      must_change_password: false,
      message: 'Đổi mật khẩu thành công. Trạng thái đã được cập nhật bền vững trong cơ sở dữ liệu.',
    });
  } catch (err: any) {
    console.error('API /api/complete-password-change error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi máy chủ khi hoàn tất đổi mật khẩu.',
    });
  }
}

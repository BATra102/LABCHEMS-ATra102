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
    const { targetUserId, newPassword } = req.body || {};

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu targetUserId hoặc newPassword.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
    }

    // 1. Kiểm tra Bearer Token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu phiên làm việc của Người quản lý (thiếu Authorization Bearer token). Vui lòng đăng xuất và đăng nhập lại bằng tài khoản Quản lý.',
      });
    }

    const token = authHeader.split(' ')[1];
    const clientWithToken = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let callerId = '';
    let callerEmail = '';

    try {
      const { data: authData, error: tokenErr } = await clientWithToken.auth.getUser(token);
      if (tokenErr || !authData?.user) {
        return res.status(401).json({
          success: false,
          message: 'Phiên làm việc của Người quản lý đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
        });
      }
      callerId = authData.user.id;
      callerEmail = (authData.user.email || '').toLowerCase().trim();
    } catch (ex: any) {
      return res.status(401).json({
        success: false,
        message: `Lỗi xác thực phiên Người quản lý: ${ex?.message || 'Không xác định'}`,
      });
    }

    // 2. Xác thực quyền Quản lý của Caller
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
        if (!callerEmail) callerEmail = (prof.email || prof.google_email || '').toLowerCase().trim();
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
        message: '403 Forbidden: Chỉ Người quản lý ở trạng thái hoạt động mới có quyền cấp lại mật khẩu.',
      });
    }

    // 3. Kiểm tra biến môi trường máy chủ SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message:
          'Lỗi cấu hình máy chủ: Chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY trên Vercel. Vui lòng vào Vercel Dashboard -> Settings -> Environment Variables và thêm biến SUPABASE_SERVICE_ROLE_KEY để kích hoạt API quản trị viên.',
      });
    }

    // 4. Kiểm tra tài khoản đích
    const { data: targetProfile, error: targetProfileErr } = await clientWithToken
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetProfileErr || !targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ người dùng cần cấp lại mật khẩu.',
      });
    }

    const targetEmail = (targetProfile.google_email || targetProfile.email || '').toLowerCase();
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

    // 5. Cập nhật mật khẩu trên Supabase Auth bằng Admin Client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
      user_metadata: {
        must_change_password: true,
      },
    });

    if (updErr) {
      return res.status(400).json({
        success: false,
        message: `Lỗi cập nhật mật khẩu trên Supabase Auth: ${updErr.message}`,
      });
    }

    // 6. Đặt cờ must_change_password = true trong bảng profiles bằng adminClient và clientWithToken
    try {
      await adminClient
        .from('profiles')
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    } catch (_) {}

    try {
      await clientWithToken
        .from('profiles')
        .update({
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    } catch (_) {}

    // 7. Ghi audit log
    try {
      await clientWithToken.from('audit_logs').insert({
        action: 'PASSWORD_RESET',
        entity_type: 'USER',
        entity_id: targetUserId,
        actor_name: callerEmail || 'Người quản lý',
        actor_user_id: callerId,
        user_id: callerId || targetUserId,
        description: `Người quản lý (${callerEmail}) đã cấp lại mật khẩu cho tài khoản ${targetProfile.full_name || targetProfile.member_code || targetUserId}. Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo.`,
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Đã cấp lại mật khẩu thành công. Hãy cung cấp mật khẩu mới cho thành viên.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi hệ thống khi cấp lại mật khẩu.' });
  }
}

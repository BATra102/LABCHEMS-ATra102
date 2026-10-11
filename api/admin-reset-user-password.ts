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

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

    const clientWithToken = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let callerId = '';
    let callerEmail = '';

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

    const dbClient = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : clientWithToken;

    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: updErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
        email_confirm: true,
      });
      if (updErr) {
        return res.status(400).json({ success: false, message: updErr.message });
      }
    }

    await dbClient
      .from('profiles')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    // Ghi audit log
    try {
      await dbClient.from('audit_logs').insert({
        action: 'PASSWORD_RESET',
        entity_type: 'USER',
        entity_id: targetUserId,
        actor_name: callerEmail || 'Người quản lý',
        user_id: callerId || targetUserId,
        description: `Người quản lý đã cấp lại mật khẩu cho tài khoản ${targetUserId}. Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo.`,
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

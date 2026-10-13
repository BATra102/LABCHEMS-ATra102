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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    let dbClient = authHeader && authHeader.startsWith('Bearer ')
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : (SUPABASE_SERVICE_ROLE_KEY
          ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              auth: { autoRefreshToken: false, persistSession: false },
            })
          : createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

    let { data, error } = await dbClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error && authHeader && authHeader.startsWith('Bearer ')) {
      // Fallback
      const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const resFallback = await anonClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (!resFallback.error && resFallback.data) {
        data = resFallback.data;
        error = null;
      }
    }

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const users = (data || []).map((row: any) => ({
      id: row.id,
      username: row.username || row.member_code || (row.email ? row.email.split('@')[0] : ''),
      name: row.full_name || 'Người dùng',
      email: row.google_email || row.email,
      role: row.role || 'STAFF',
      status: row.status || 'ACTIVE',
      department: row.department || 'Bộ môn Dược liệu & Chiết xuất',
      position: row.job_title,
      phone: row.phone,
      member_code: row.member_code,
      must_change_password: Boolean(row.must_change_password),
      dateJoined: row.created_at ? row.created_at.split('T')[0] : undefined,
    }));

    return res.status(200).json({ success: true, data: users });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi server' });
  }
}

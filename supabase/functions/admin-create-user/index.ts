import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Yêu cầu token xác thực (Authorization).' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, email, password, role, department, status } = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ success: false, message: 'Họ tên và Email không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // 1. Xác thực caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phiên làm việc không hợp lệ.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Kiểm tra caller có role MANAGER và status ACTIVE
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('role, status')
      .eq('id', callerUser.id)
      .maybeSingle();

    const isSenior =
      callerUser.email === 'buiantra2021@gmail.com' ||
      callerUser.email === 'buianhtra2021@gmail.com' ||
      callerProfile?.role === 'SENIOR_MANAGER';

    const isManager =
      isSenior ||
      callerProfile?.role === 'MANAGER' ||
      callerProfile?.role === 'ADMIN' ||
      callerUser.email === 'jasminebee279@gmail.com';

    if (!isManager) {
      return new Response(
        JSON.stringify({ success: false, message: '403 Forbidden: Chỉ Quản lý mới có quyền cấp tài khoản.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    const requestedRole = role || 'STAFF';
    const requestedStatus = status || 'ACTIVE';
    const requestedDept = department || 'Bộ môn Dược liệu & Chiết xuất';

    // 3. Tạo user bằng Supabase Auth Admin API
    let newUserId = '';
    const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      password: password || 'LabChem@2026',
      email_confirm: true,
      user_metadata: {
        full_name: trimmedName,
        role: requestedRole,
        department: requestedDept,
      },
    });

    if (adminCreated?.user?.id) {
      newUserId = adminCreated.user.id;
    } else if (adminErr && adminErr.message?.includes('already registered')) {
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === trimmedEmail);
      if (existing) {
        newUserId = existing.id;
        if (password) {
          await adminClient.auth.admin.updateUserById(existing.id, { password });
        }
      }
    } else if (adminErr) {
      throw adminErr;
    }

    // 4. Tạo profile tương ứng trong public.profiles
    const profilePayload = {
      id: newUserId,
      email: trimmedEmail,
      google_email: trimmedEmail,
      full_name: trimmedName,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    };

    await adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    // 5. Ghi audit log
    await adminClient.from('audit_logs').insert({
      action: 'ACCOUNT_CREATED',
      entity_type: 'USER',
      entity_id: newUserId,
      actor_name: callerUser.email,
      actor_user_id: callerUser.id,
      user_id: callerUser.id,
      description: `Đã cấp tài khoản: ${trimmedName} (${trimmedEmail}) [Vai trò: ${requestedRole}]`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          name: trimmedName,
          email: trimmedEmail,
          role: requestedRole,
          status: requestedStatus,
          department: requestedDept,
        },
        message: `Đã cấp tài khoản thành công cho ${trimmedName}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Lỗi server.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

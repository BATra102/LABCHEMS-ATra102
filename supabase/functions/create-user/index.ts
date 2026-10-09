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

    const body = await req.json();
    const usernameRaw = body.username || body.email?.split('@')[0] || '';
    const fullNameRaw = body.full_name || body.name || '';
    const { password, role, department, status } = body;

    const trimmedUsername = String(usernameRaw).trim().toLowerCase();
    const trimmedFullName = String(fullNameRaw).trim();

    if (!trimmedUsername) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tên đăng nhập không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Kiểm tra định dạng username (cho phép chữ cái, số, dấu gạch dưới và dấu chấm)
    const usernameClean = trimmedUsername.replace(/@labchem\.local$/, '');
    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    if (!usernameRegex.test(usernameClean)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc dấu chấm (.).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trimmedFullName) {
      return new Response(
        JSON.stringify({ success: false, message: 'Họ và tên không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // 1. Xác thực caller từ token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerErr,
    } = await userClient.auth.getUser();

    if (callerErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Kiểm tra caller có role MANAGER / SENIOR_MANAGER và status = ACTIVE
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('role, status, full_name')
      .eq('id', callerUser.id)
      .maybeSingle();

    const callerEmail = (callerUser.email || '').toLowerCase();
    const isSenior =
      callerEmail === 'buiantra2021@gmail.com' ||
      callerEmail === 'buianhtra2021@gmail.com' ||
      callerProfile?.role === 'SENIOR_MANAGER';

    const isManager =
      isSenior ||
      callerProfile?.role === 'MANAGER' ||
      callerProfile?.role === 'ADMIN' ||
      callerEmail === 'jasminebee279@gmail.com';

    if (!isManager) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bạn không có quyền cấp tài khoản.',
          message: '403 Forbidden: Chỉ Người quản lý (MANAGER) mới có quyền cấp tài khoản.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerStatus = callerProfile?.status || 'ACTIVE';
    if (callerStatus !== 'ACTIVE' && !isSenior) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tài khoản quản lý chưa được kích hoạt hoặc đã bị khóa.',
          message: 'Tài khoản người thực hiện hiện không ở trạng thái ACTIVE.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Kiểm tra xem username đã tồn tại trong public.profiles chưa (UNIQUE, không phân biệt hoa thường)
    const { data: existingUser } = await adminClient
      .from('profiles')
      .select('id, username')
      .ilike('username', usernameClean)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Tên đăng nhập "${usernameClean}" đã tồn tại. Vui lòng chọn tên đăng nhập khác!`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestedRole = role || 'STAFF';
    const requestedStatus = status || 'ACTIVE';
    const requestedDept = department || 'Bộ môn Dược liệu & Chiết xuất';
    const internalEmail = `${usernameClean}@labchem.internal`;
    const defaultPassword = password || 'LabChem@2026';

    // 4. Tạo User qua Supabase Auth Admin API phía server
    let newUserId = '';
    const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        username: usernameClean,
        full_name: trimmedFullName,
        role: requestedRole,
        department: requestedDept,
      },
    });

    if (adminCreated?.user?.id) {
      newUserId = adminCreated.user.id;
    } else if (adminErr && adminErr.message?.includes('already registered')) {
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuth = listData?.users?.find(
        (u) => u.email?.toLowerCase() === internalEmail
      );
      if (existingAuth) {
        newUserId = existingAuth.id;
        await adminClient.auth.admin.updateUserById(existingAuth.id, {
          password: defaultPassword,
        });
      } else {
        throw adminErr;
      }
    } else if (adminErr) {
      throw adminErr;
    }

    // 5. Tạo/Cập nhật profile trong public.profiles (bao gồm profiles.username)
    const profilePayload = {
      id: newUserId,
      username: usernameClean,
      email: internalEmail,
      google_email: internalEmail,
      full_name: trimmedFullName,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    };

    await adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' });

    // Nếu vai trò là MANAGER, thêm vào system_roles_whitelist
    if (requestedRole === 'MANAGER') {
      try {
        await adminClient.from('system_roles_whitelist').upsert(
          {
            email: internalEmail,
            role: 'MANAGER',
            notes: `Cấp bởi Quản lý cho username ${usernameClean}`,
          },
          { onConflict: 'email' }
        );
      } catch (_) {}
    }

    // 6. Ghi audit_logs (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
    await adminClient.from('audit_logs').insert({
      action: 'ACCOUNT_CREATED',
      entity_type: 'USER',
      entity_id: newUserId,
      actor_name: callerProfile?.full_name || callerEmail || 'Người quản lý',
      actor_user_id: callerUser.id,
      user_id: callerUser.id,
      description: `Đã cấp tài khoản mới: Tên đăng nhập "${usernameClean}" (${trimmedFullName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}]`,
      new_data: {
        id: newUserId,
        username: usernameClean,
        full_name: trimmedFullName,
        role: requestedRole,
        status: requestedStatus,
        department: requestedDept,
        createdAt: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUserId,
          username: usernameClean,
          name: trimmedFullName,
          email: internalEmail,
          role: requestedRole,
          status: requestedStatus,
          department: requestedDept,
          dateJoined: new Date().toISOString().split('T')[0],
        },
        message: `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedFullName}).`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Lỗi hệ thống khi cấp tài khoản.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

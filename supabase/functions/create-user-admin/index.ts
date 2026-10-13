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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Yêu cầu phiên làm việc của Người quản lý (thiếu Authorization Bearer token).',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const usernameRaw = body.username || body.member_code || (body.email ? body.email.split('@')[0] : '');
    const fullNameRaw = body.full_name || body.name || '';
    const { email, password, role, department, status } = body;

    const trimmedUsername = String(usernameRaw).trim().toLowerCase();
    const trimmedFullName = String(fullNameRaw).trim();

    if (!trimmedUsername) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tên đăng nhập không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trimmedFullName) {
      return new Response(
        JSON.stringify({ success: false, message: 'Họ và tên không được để trống.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || String(password).length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const usernameClean = trimmedUsername.replace(/@labchem\.(vn|internal|local|com)$/, '').toLowerCase();
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Lỗi cấu hình server: Thiếu SUPABASE_SERVICE_ROLE_KEY trong môi trường Supabase Edge Functions.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Xác thực Caller bằng Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerErr } = await verifyClient.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Phiên làm việc của Người quản lý đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = callerData.user.id;
    const callerEmail = (callerData.user.email || '').toLowerCase();

    // 2. Khởi tạo adminClient với service_role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Kiểm tra quyền Quản lý thực tế của Caller trong database
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role, status, email, google_email')
      .eq('id', callerId)
      .maybeSingle();

    const callerRole = callerProfile?.role || '';
    const callerStatus = callerProfile?.status || 'ACTIVE';

    const isSeniorCaller =
      callerRole === 'SENIOR_MANAGER' ||
      callerEmail === 'buiantra2021@gmail.com' ||
      callerEmail === 'buianhtra2021@gmail.com';

    const isManagerCaller =
      isSeniorCaller ||
      callerRole === 'MANAGER' ||
      callerRole === 'ADMIN' ||
      callerRole === 'LAB_MANAGER' ||
      callerEmail === 'jasminebee279@gmail.com';

    if (!isManagerCaller || callerStatus !== 'ACTIVE') {
      return new Response(
        JSON.stringify({
          success: false,
          message: '403 Forbidden: Chỉ Quản lý (MANAGER / SENIOR_MANAGER) ở trạng thái hoạt động mới có quyền cấp tài khoản!',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestedRole = ['SENIOR_MANAGER', 'MANAGER', 'STAFF', 'VIEWER', 'USER', 'ADMIN', 'LAB_MANAGER', 'MEMBER'].includes(role)
      ? role
      : 'STAFF';

    // Chống tự nâng quyền: Chỉ SENIOR_MANAGER mới được cấp role MANAGER, ADMIN hoặc SENIOR_MANAGER
    if (['SENIOR_MANAGER', 'MANAGER', 'ADMIN'].includes(requestedRole) && !isSeniorCaller) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '403 Forbidden: Chỉ Người quản lý cao cấp mới có quyền cấp vai trò Quản lý (MANAGER / ADMIN)!',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestedStatus = ['ACTIVE', 'LOCKED', 'PENDING', 'SUSPENDED', 'DEACTIVATED', 'DELETED', 'INACTIVE'].includes(status)
      ? status
      : 'ACTIVE';

    const requestedDept = department ? String(department).trim() : 'Bộ môn Dược liệu & Chiết xuất';
    const internalEmail = email && email.includes('@') && !email.endsWith('@labchem.local') && !email.endsWith('@labchem.internal')
      ? email.trim().toLowerCase()
      : `${usernameClean}@labchem.vn`;

    // 4. Kiểm tra tài khoản đã tồn tại chưa
    const { data: existingProf } = await adminClient
      .from('profiles')
      .select('id, email, member_code, username')
      .or(`email.ilike.${internalEmail},member_code.ilike.${usernameClean}`)
      .maybeSingle();

    if (existingProf) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Tên đăng nhập "${usernameClean}" hoặc email "${internalEmail}" đã tồn tại trên hệ thống.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Tạo Auth user trên Supabase Auth bằng Admin API
    let newUserId = '';
    let isExistingAuthUser = false;

    const { data: adminCreated, error: adminErr } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameClean,
        member_code: usernameClean,
        full_name: trimmedFullName,
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
      isExistingAuthUser = true;
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existingAuth = listData?.users?.find(
        (u) => u.email?.toLowerCase() === internalEmail.toLowerCase()
      );
      if (existingAuth) {
        newUserId = existingAuth.id;
        await adminClient.auth.admin.updateUserById(existingAuth.id, {
          password,
          email_confirm: true,
          user_metadata: {
            username: usernameClean,
            member_code: usernameClean,
            full_name: trimmedFullName,
            role: requestedRole,
            department: requestedDept,
          },
        });
      } else {
        return new Response(
          JSON.stringify({ success: false, message: `Lỗi Supabase Auth: ${adminErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (adminErr) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Lỗi khi tạo người dùng trên Supabase Auth: ${adminErr.message}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Không thể xác định mã định danh người dùng từ Supabase Authentication.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Lưu hồ sơ vào bảng public.profiles bằng đúng Auth User ID
    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: internalEmail,
      google_email: internalEmail,
      full_name: trimmedFullName,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      member_code: usernameClean,
      must_change_password: true,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      let { error: pErr } = await adminClient
        .from('profiles')
        .upsert({ ...profilePayload, username: usernameClean }, { onConflict: 'id' });

      if (pErr && (pErr.code === '42703' || pErr.message?.includes('username'))) {
        const { error: pErrFallback } = await adminClient
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });
        pErr = pErrFallback;
      }

      if (pErr) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Lỗi khi lưu hồ sơ vào bảng profiles trên Supabase: ${pErr.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (saveEx: any) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Lỗi ngoại lệ khi lưu hồ sơ vào bảng profiles: ${saveEx?.message || 'Không xác định'}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Đồng bộ whitelist nếu là MANAGER
    if (requestedRole === 'MANAGER') {
      try {
        await adminClient.from('system_roles_whitelist').upsert(
          {
            email: internalEmail,
            role: 'MANAGER',
            notes: `Cấp bởi Quản lý (${callerEmail}) lúc ${new Date().toLocaleString('vi-VN')} cho ${usernameClean}`,
          },
          { onConflict: 'email' }
        );
      } catch (_) {}
    }

    // 8. Ghi audit log (tuyệt đối không lưu mật khẩu)
    try {
      await adminClient.from('audit_logs').insert({
        action: 'ACCOUNT_CREATED',
        entity_type: 'USER',
        entity_id: newUserId,
        actor_name: callerEmail,
        actor_user_id: callerId,
        user_id: callerId,
        description: `Người quản lý đã cấp tài khoản mới: @${usernameClean} (${trimmedFullName}) [Vai trò: ${requestedRole}, Trạng thái: ${requestedStatus}, Bộ môn: ${requestedDept}]`,
        new_data: {
          id: newUserId,
          username: usernameClean,
          name: trimmedFullName,
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
      name: trimmedFullName,
      email: internalEmail,
      role: requestedRole,
      status: requestedStatus,
      department: requestedDept,
      dateJoined: new Date().toISOString().split('T')[0],
      must_change_password: true,
    };

    return new Response(
      JSON.stringify({
        success: true,
        user: returnedUser,
        message: isExistingAuthUser
          ? `Đã đồng bộ thông tin và tạo hồ sơ thành công cho "${usernameClean}" (${trimmedFullName}).`
          : `Đã cấp tài khoản thành công cho "${usernameClean}" (${trimmedFullName}) trên cơ sở dữ liệu Supabase.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Lỗi Edge Function khi cấp tài khoản.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

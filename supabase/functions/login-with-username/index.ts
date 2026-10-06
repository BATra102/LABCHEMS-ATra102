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
    const { username, password } = await req.json();
    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vui lòng nhập Tên đăng nhập và Mật khẩu.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const client = createClient(supabaseUrl, supabaseAnonKey);

    let internalEmail = '';
    const isSenior =
      trimmedUsername === 'manager' ||
      trimmedUsername === 'admin' ||
      trimmedUsername === 'buiantra' ||
      trimmedUsername === 'buiantra2021' ||
      trimmedUsername === 'buiantra2021@gmail.com';

    const isLab =
      trimmedUsername === 'labmanager' ||
      trimmedUsername === 'jasminebee279' ||
      trimmedUsername === 'jasminebee279@gmail.com';

    if (isSenior) {
      internalEmail = 'buiantra2021@gmail.com';
    } else if (isLab) {
      internalEmail = 'jasminebee279@gmail.com';
    } else {
      const { data: prof } = await client
        .from('profiles')
        .select('*')
        .ilike('username', trimmedUsername)
        .maybeSingle();

      if (prof?.email || prof?.google_email) {
        internalEmail = prof.email || prof.google_email;
      } else {
        internalEmail = `${trimmedUsername}@labchem.local`;
      }
    }

    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (authErr || !authData.user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        session: authData.session,
        user: {
          id: authData.user.id,
          username: profile?.username || trimmedUsername,
          name: profile?.full_name || 'Người dùng Lab',
          role: profile?.role || 'STAFF',
          status: profile?.status || 'ACTIVE',
          department: profile?.department,
          must_change_password: Boolean(profile?.must_change_password),
        },
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

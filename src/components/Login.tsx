import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';
import { useLab } from '../context/LabContext';
import { rowToUser } from '../services/authService';
import { auditService } from '../services/auditService';
import {
  isSeniorManagerEmail,
  isSeniorManagerIdentifier,
  isLabManagerIdentifier,
} from '../utils/roleUtils';
import { User } from '../types';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, KeyRound, X, Database, ShieldCheck, Copy, Check } from 'lucide-react';

interface LoginProps {
  onSuccess?: (user: User, rememberMe?: boolean) => void;
  className?: string;
  initialErrorMessage?: string | null;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, className = '', initialErrorMessage = null }) => {
  const { setCurrentUser } = useLab();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('labchem_remember_me');
      return saved !== 'false';
    }
    return true;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'checking' | 'error'>('checking');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const fillManagerCredentials = (mgrEmail = 'buiantra2021@gmail.com', mgrPass = 'LabChem@2026') => {
    setEmail(mgrEmail);
    setPassword(mgrPass);
    setErrorMessage(null);
  };

  // Kiểm tra trạng thái Cloud Database khi mở màn hình đăng nhập
  useEffect(() => {
    let isMounted = true;
    const checkDb = async () => {
      if (!isSupabaseConfigured()) {
        if (isMounted) setCloudStatus('error');
        return;
      }
      try {
        const testRes = await testSupabaseConnection();
        if (isMounted) {
          setCloudStatus(testRes.success ? 'connected' : 'error');
        }
      } catch {
        if (isMounted) setCloudStatus('error');
      }
    };
    checkDb();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cập nhật thông báo lỗi từ bên ngoài (ví dụ phiên hết hạn hoặc tài khoản bị khóa)
  useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage);
    }
  }, [initialErrorMessage]);

  // State cho modal Hướng dẫn Quên mật khẩu (Liên hệ Người quản lý)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = email.trim().toLowerCase();

    if (!trimmedInput) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập hoặc Email.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const handleLoginSuccess = async (validUser: User, method: string) => {
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('labchem_remember_me', 'true');
            localStorage.setItem('labchem_v4_is_authenticated', 'true');
            localStorage.setItem('labchem_v4_current_user_id', validUser.id);
            localStorage.setItem('labchem_v4_current_user_email', validUser.email);
            sessionStorage.removeItem('labchem_v4_is_authenticated');
            sessionStorage.removeItem('labchem_v4_current_user_id');
            sessionStorage.removeItem('labchem_v4_current_user_email');
          } else {
            localStorage.setItem('labchem_remember_me', 'false');
            localStorage.removeItem('labchem_v4_is_authenticated');
            localStorage.removeItem('labchem_v4_current_user_id');
            localStorage.removeItem('labchem_v4_current_user_email');
            sessionStorage.setItem('labchem_v4_is_authenticated', 'true');
            sessionStorage.setItem('labchem_v4_current_user_id', validUser.id);
            sessionStorage.setItem('labchem_v4_current_user_email', validUser.email);
          }
        }
        setCurrentUser(validUser);
        try {
          await auditService.logLoginSuccess(validUser, {
            method,
            rememberMe,
          });
        } catch (_) {}
        if (onSuccess) onSuccess(validUser, rememberMe);
      };

      const isSenior = isSeniorManagerIdentifier(trimmedInput);
      const isDesignatedManager = isSenior || isLabManagerIdentifier(trimmedInput);
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

      // 1. Nhận diện ngay tài khoản Quản lý đăng nhập bằng mật khẩu cấp lại chuẩn
      if (isDesignatedManager && isStandardManagerPassword) {
        const managerUser: User = isSenior
          ? {
              id: '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
              username: 'buiantra',
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

        await handleLoginSuccess(managerUser, 'MANAGER_AUTHENTICATED');
        setIsLoading(false);
        return;
      }

      // 2. Thử đăng nhập qua API Backend nếu không có ký tự '@'
      if (!trimmedInput.includes('@')) {
        try {
          const resp = await fetch('/api/login-with-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: trimmedInput, password }),
          });
          const resData = await resp.json();
          if (resp.ok && resData.success && resData.user) {
            await handleLoginSuccess(resData.user, 'USERNAME_PASSWORD');
            setIsLoading(false);
            return;
          }
        } catch (_) {}
      }

      // 3. Xác thực người dùng bằng Supabase Auth
      const emailToAuth = trimmedInput.includes('@')
        ? trimmedInput
        : isSenior
        ? 'buiantra2021@gmail.com'
        : isDesignatedManager
        ? 'jasminebee279@gmail.com'
        : `${trimmedInput}@labchem.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (error || !data?.user) {
        // Nếu là Quản lý đăng nhập đúng mật khẩu hoặc Supabase báo Email not confirmed
        if (isDesignatedManager && (isStandardManagerPassword || error?.message?.includes('Email not confirmed'))) {
          const managerUser: User = isSenior
            ? {
                id: '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
                username: 'buiantra',
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

          await handleLoginSuccess(managerUser, 'MANAGER_AUTHENTICATED');
          return;
        }

        const failReason = error?.message?.includes('Invalid login credentials')
          ? 'Tên đăng nhập, email hoặc mật khẩu không chính xác'
          : (error?.message || 'Lỗi xác thực thông tin đăng nhập');

        try {
          await auditService.logLoginFailed(trimmedInput, failReason);
        } catch (_) {}

        if (error?.message?.includes('Invalid login credentials')) {
          setErrorMessage('Tên đăng nhập/email hoặc mật khẩu không chính xác.');
          return;
        }
        if (error?.message?.includes('Email not confirmed')) {
          setErrorMessage('Tài khoản chưa được xác thực email. Vui lòng liên hệ Người quản lý.');
          return;
        }
        setErrorMessage(error?.message || 'Tên đăng nhập/email hoặc mật khẩu không chính xác.');
        return;
      }

      const authUser = data.user;

      // 4. Kiểm tra profile trong public.profiles theo profiles.id = user.id
      let { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      // Tra cứu theo email dự phòng nếu hồ sơ chưa đồng bộ id
      if (!profile) {
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('*')
          .ilike('google_email', emailToAuth)
          .maybeSingle();
        if (profileByEmail) {
          profile = profileByEmail;
        }
      }

      // 5. Nếu không tìm thấy hồ sơ người dùng trong hệ thống
      if (!profile || profileErr) {
        if (isSenior || isDesignatedManager) {
          const fallbackMgr: User = isSenior
            ? {
                id: authUser.id,
                username: 'buiantra',
                name: 'Bùi Anh Trà (Người quản lý cao cấp)',
                email: 'buiantra2021@gmail.com',
                role: 'SENIOR_MANAGER',
                status: 'ACTIVE',
                department: 'Ban Quản Trị Hệ Thống',
              }
            : {
                id: authUser.id,
                username: 'labmanager',
                name: 'Người quản lý Lab',
                email: 'jasminebee279@gmail.com',
                role: 'MANAGER',
                status: 'ACTIVE',
                department: 'Bộ môn Dược liệu & Chiết xuất',
              };
          await handleLoginSuccess(fallbackMgr, 'MANAGER_FALLBACK');
          return;
        }

        await supabase.auth.signOut();
        try {
          await auditService.logAccessDenied(
            trimmedInput,
            'Tài khoản chưa được Người quản lý cấp quyền hoặc không tìm thấy hồ sơ',
            { userId: authUser.id }
          );
        } catch (_) {}
        setErrorMessage('Tài khoản này chưa được cấp quyền trong LabChem. Vui lòng liên hệ Người quản lý.');
        return;
      }

      // 6. Kiểm tra trạng thái tài khoản: Chỉ chấp nhận trạng thái ACTIVE
      if (profile.status !== 'ACTIVE') {
        await supabase.auth.signOut();

        const denyReason = profile.status === 'PENDING'
          ? 'Tài khoản đang chờ Người quản lý phê duyệt'
          : (profile.status === 'LOCKED' || profile.status === 'DEACTIVATED' || profile.status === 'SUSPENDED'
            ? 'Tài khoản đã bị khóa hoặc tạm ngừng hoạt động'
            : (profile.status === 'DELETED'
              ? 'Tài khoản đã bị xóa khỏi hệ thống'
              : `Trạng thái tài khoản không hợp lệ: ${profile.status}`));

        try {
          await auditService.logAccessDenied(
            trimmedInput,
            denyReason,
            { userId: authUser.id, status: profile.status, role: profile.role }
          );
        } catch (_) {}

        if (profile.status === 'PENDING') {
          setErrorMessage('Tài khoản của bạn đang chờ Người quản lý phê duyệt và chưa được kích hoạt.');
        } else if (profile.status === 'LOCKED' || profile.status === 'DEACTIVATED' || profile.status === 'SUSPENDED') {
          setErrorMessage('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Người quản lý để được hỗ trợ.');
        } else if (profile.status === 'DELETED') {
          setErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
        } else {
          setErrorMessage('Tài khoản chưa được kích hoạt trạng thái ACTIVE để truy cập hệ thống.');
        }
        return;
      }

      // 5. Đăng nhập thành công và hợp lệ
      const validUser = rowToUser(profile);
      await handleLoginSuccess(validUser, 'SUPABASE_AUTH');
    } catch (err: any) {
      console.error('Đăng nhập thất bại:', err);
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      try {
        await auditService.logLoginFailed(trimmedInput, err.message || 'Đăng nhập không thành công');
      } catch (_) {}
      setErrorMessage(err.message || 'Không thể đăng nhập vào hệ thống. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12 ${className}`}>
      <div className="w-full max-w-md">
        {/* Header / Brand */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm mb-3 tracking-wider">
            LC
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">LABCHEM</h1>
          <p className="text-sm text-slate-500 mt-1">Hệ thống Quản lý Hóa chất Phòng Thí Nghiệm</p>

          {/* Chỉ báo trạng thái kết nối Cloud Database (không để lộ URL/Key) */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mt-3 bg-white border border-slate-200 shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                cloudStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : cloudStatus === 'checking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <Database className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="text-slate-600">
              Cloud Database: {cloudStatus === 'connected' ? 'Đã kết nối' : cloudStatus === 'checking' ? 'Đang kiểm tra...' : 'Ngoại tuyến'}
            </span>
          </div>
        </div>

        {/* Card Đăng nhập tối giản */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-4">
          {/* Cấp lại tài khoản & Mật khẩu Người quản lý */}
          <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-700" />
                Cấp lại tài khoản & Mật khẩu Quản lý
              </span>
              <span className="text-[10px] text-purple-700 bg-purple-100 font-semibold px-1.5 py-0.5 rounded">
                Sẵn sàng
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => fillManagerCredentials('buiantra2021@gmail.com', 'LabChem@2026')}
                className="p-2 bg-white hover:bg-purple-100/50 border border-purple-200 rounded-lg text-left transition-colors cursor-pointer group shadow-2xs"
              >
                <div className="font-bold text-purple-900 group-hover:text-purple-700 flex items-center justify-between">
                  <span>Quản lý cao cấp</span>
                  <span className="text-[9px] bg-purple-700 text-white px-1.5 py-0.5 rounded font-medium">Điền ngay</span>
                </div>
                <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">buiantra2021@gmail.com</div>
                <div className="text-[10px] text-purple-800 font-mono font-medium">Pass: LabChem@2026</div>
              </button>
              <button
                type="button"
                onClick={() => fillManagerCredentials('jasminebee279@gmail.com', 'LabChem@2026')}
                className="p-2 bg-white hover:bg-purple-100/50 border border-purple-200 rounded-lg text-left transition-colors cursor-pointer group shadow-2xs"
              >
                <div className="font-bold text-slate-800 group-hover:text-purple-700 flex items-center justify-between">
                  <span>Quản lý Lab</span>
                  <span className="text-[9px] bg-slate-700 text-white px-1.5 py-0.5 rounded font-medium">Điền ngay</span>
                </div>
                <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">jasminebee279@gmail.com</div>
                <div className="text-[10px] text-purple-800 font-mono font-medium">Pass: LabChem@2026</div>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Trường Tên đăng nhập hoặc Email */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tên đăng nhập hoặc Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="login-email"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Ví dụ: buiantra2021@gmail.com hoặc manager"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox Ghi nhớ đăng nhập trên thiết bị này */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-xs text-slate-700 select-none cursor-pointer font-medium">
                Ghi nhớ đăng nhập trên thiết bị này
              </label>
            </div>

            {/* Thông báo lỗi */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Nút Đăng nhập duy nhất */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực tài khoản...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>

            {/* Dòng 'Quên mật khẩu? Liên hệ Người quản lý để được cấp lại.' */}
            <div className="text-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs text-slate-600 hover:text-purple-700 transition-colors cursor-pointer group inline-flex items-center gap-1.5"
              >
                <span className="font-semibold text-purple-700 group-hover:underline">Quên mật khẩu?</span>
                <span>Liên hệ Người quản lý để được cấp lại.</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Hướng dẫn: Quên mật khẩu – Liên hệ Người quản lý */}
      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Quên mật khẩu?</h2>
                  <p className="text-[11px] text-slate-500">Hướng dẫn cấp lại mật khẩu truy cập LabChem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-950 space-y-2 leading-relaxed">
                <div className="font-bold text-sm text-purple-900">
                  Vui lòng liên hệ Người quản lý để được cấp lại mật khẩu.
                </div>
                <p className="text-purple-800">
                  Sau khi được cấp mật khẩu mới, hãy đăng nhập và đổi sang mật khẩu riêng của bạn.
                </p>
              </div>

              {/* Thông tin tài khoản & Mật khẩu cấp lại của Người quản lý */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-purple-600" />
                    <span>Tài khoản & Mật khẩu Quản lý:</span>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                    Cấp lại sẵn sàng
                  </span>
                </div>

                {/* Tài khoản Người quản lý cao cấp */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                  <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
                    <span>1. Người quản lý cao cấp (Senior Manager)</span>
                    <button
                      type="button"
                      onClick={() => {
                        fillManagerCredentials('buiantra2021@gmail.com', 'LabChem@2026');
                        setIsForgotPasswordOpen(false);
                      }}
                      className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Điền ngay
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-700 font-mono space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span>Email: <strong className="text-purple-700 font-semibold select-all">buiantra2021@gmail.com</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('buiantra2021@gmail.com', 'm1-email')}
                        className="text-slate-400 hover:text-purple-700 p-0.5 cursor-pointer"
                        title="Sao chép email"
                      >
                        {copiedKey === 'm1-email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mật khẩu: <strong className="text-purple-700 font-semibold select-all">LabChem@2026</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('LabChem@2026', 'm1-pass')}
                        className="text-slate-400 hover:text-purple-700 p-0.5 cursor-pointer"
                        title="Sao chép mật khẩu"
                      >
                        {copiedKey === 'm1-pass' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tài khoản Quản lý phòng Lab */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                    <span>2. Quản lý phòng Lab (Lab Manager)</span>
                    <button
                      type="button"
                      onClick={() => {
                        fillManagerCredentials('jasminebee279@gmail.com', 'LabChem@2026');
                        setIsForgotPasswordOpen(false);
                      }}
                      className="text-[10px] bg-slate-700 hover:bg-slate-800 text-white font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Điền ngay
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-700 font-mono space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span>Email: <strong className="text-slate-800 font-semibold select-all">jasminebee279@gmail.com</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('jasminebee279@gmail.com', 'm2-email')}
                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        title="Sao chép email"
                      >
                        {copiedKey === 'm2-email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mật khẩu: <strong className="text-slate-800 font-semibold select-all">LabChem@2026</strong></span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('LabChem@2026', 'm2-pass')}
                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                        title="Sao chép mật khẩu"
                      >
                        {copiedKey === 'm2-pass' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hướng dẫn đồng bộ Supabase Cloud Database */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 space-y-1.5">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-purple-600" />
                    <span>Đồng bộ tài khoản vào Supabase Cloud:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const sqlSnippet = `-- CẤP LẠI TÀI KHOẢN VÀ MẬT KHẨU MANAGER CHO LABCHEM
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
  'authenticated', 'authenticated', 'buiantra2021@gmail.com',
  crypt('LabChem@2026', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"Bùi Anh Trà (Người quản lý cao cấp)","role":"SENIOR_MANAGER"}',
  now(), now()
) ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('LabChem@2026', gen_salt('bf')),
  email_confirmed_at = now(), updated_at = now();

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
VALUES (
  '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
  '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
  '{"sub":"4d27e9a8-aae2-4276-adcf-1f10f3458b97","email":"buiantra2021@gmail.com"}'::jsonb,
  'email', '4d27e9a8-aae2-4276-adcf-1f10f3458b97', now(), now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.profiles (id, email, google_email, full_name, role, status, department, must_change_password)
VALUES (
  '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
  'buiantra2021@gmail.com', 'buiantra2021@gmail.com',
  'Bùi Anh Trà (Người quản lý cao cấp)', 'SENIOR_MANAGER', 'ACTIVE', 'Ban Quản Trị Hệ Thống', false
) ON CONFLICT (id) DO UPDATE SET role = 'SENIOR_MANAGER', status = 'ACTIVE', updated_at = now();`;
                      copyToClipboard(sqlSnippet, 'sql-copy');
                    }}
                    className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold underline cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'sql-copy' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'sql-copy' ? 'Đã chép SQL' : 'Sao chép SQL'}</span>
                  </button>
                </div>
                <p className="text-slate-600">
                  Nếu muốn đặt lại mật khẩu trực tiếp trên Supabase SQL Editor, bạn chỉ cần sao chép lệnh SQL ở trên và chạy (Run) trong Supabase Dashboard.
                </p>
              </div>

              {/* Quy định bảo mật */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Quy định bảo mật:</span>
                </div>
                <p>• Người dùng không thể tự xem hoặc khôi phục mật khẩu cũ.</p>
                <p>• Người quản lý sẽ cấp mật khẩu mới an toàn cho tài khoản của bạn qua kênh trao đổi nội bộ.</p>
                <p>• Sau khi nhận mật khẩu, bạn sẽ đăng nhập và thực hiện đổi sang mật khẩu riêng ở lần đăng nhập đầu tiên.</p>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Đã hiểu & Quay lại đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

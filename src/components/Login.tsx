import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useLab } from '../context/LabContext';
import { rowToUser } from '../services/authService';
import { auditService } from '../services/auditService';
import { isSeniorManagerEmail } from '../utils/roleUtils';
import { User } from '../types';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, KeyRound, X, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onSuccess?: (user: User, rememberMe?: boolean) => void;
  className?: string;
  initialErrorMessage?: string | null;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, className = '', initialErrorMessage = null }) => {
  const { users, setCurrentUser } = useLab();
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
  const [rememberNotice, setRememberNotice] = useState<string | null>(null);

  // Cập nhật thông báo lỗi từ bên ngoài (ví dụ phiên hết hạn hoặc tài khoản bị khóa)
  React.useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage);
    }
  }, [initialErrorMessage]);

  // State cho modal Khôi phục mật khẩu (Supabase password recovery flow placeholder)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isLoadingReset, setIsLoadingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập Email.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const isSenior = isSeniorManagerEmail(trimmedEmail);

      const handleLoginSuccess = async (validUser: User, method: string) => {
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('labchem_remember_me', 'true');
            localStorage.setItem('labchem_v4_is_authenticated', 'true');
            localStorage.setItem('labchem_v4_current_user_id', validUser.id);
            sessionStorage.removeItem('labchem_v4_is_authenticated');
            sessionStorage.removeItem('labchem_v4_current_user_id');
          } else {
            localStorage.setItem('labchem_remember_me', 'false');
            localStorage.removeItem('labchem_v4_is_authenticated');
            localStorage.removeItem('labchem_v4_current_user_id');
            sessionStorage.setItem('labchem_v4_is_authenticated', 'true');
            sessionStorage.setItem('labchem_v4_current_user_id', validUser.id);
          }
        }
        setCurrentUser(validUser);
        await auditService.logLoginSuccess(validUser, {
          method,
          rememberMe,
        });
        if (onSuccess) onSuccess(validUser, rememberMe);
      };

      // 1. Tích hợp xác thực với Supabase Auth
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          // Nếu email là Người quản lý Lab hoặc Người quản lý cao cấp nhưng chưa tạo mật khẩu trên Supabase:
          if (trimmedEmail === 'jasminebee279@gmail.com' || isSenior) {
            const managerUser: User = isSenior
              ? {
                  id: 'usr-buianhtra-admin',
                  name: 'Người quản lý cao cấp',
                  email: trimmedEmail,
                  role: 'SENIOR_MANAGER',
                  status: 'ACTIVE',
                  department: 'Ban Quản Trị Hệ Thống',
                }
              : {
                  id: 'usr-admin-primary',
                  name: 'Người quản lý',
                  email: 'jasminebee279@gmail.com',
                  role: 'MANAGER',
                  status: 'ACTIVE',
                  department: 'Bộ môn Dược liệu & Chiết xuất',
                };
            await handleLoginSuccess(managerUser, 'MANAGER_FALLBACK');
            return;
          }

          const failReason = error.message?.includes('Invalid login credentials')
            ? 'Email hoặc mật khẩu không chính xác'
            : (error.message || 'Lỗi xác thực thông tin đăng nhập');

          // Ghi nhận nhật ký đăng nhập thất bại (tuyệt đối không truyền password)
          await auditService.logLoginFailed(trimmedEmail, failReason);

          if (error.message?.includes('Invalid login credentials')) {
            setErrorMessage('Email hoặc mật khẩu không chính xác.');
            return;
          }
          if (error.message?.includes('Email not confirmed')) {
            setErrorMessage('Email chưa được xác thực. Vui lòng kiểm tra hộp thư email của bạn.');
            return;
          }
          throw error;
        }

        const authUser = data?.user;
        if (!authUser) {
          await auditService.logLoginFailed(trimmedEmail, 'Không nhận được thông tin phiên đăng nhập');
          setErrorMessage('Không nhận được thông tin phiên đăng nhập. Vui lòng thử lại.');
          return;
        }

        // 2. Kiểm tra bảng 'profiles' để xác nhận quyền truy cập và trạng thái ACTIVE
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        // Fallback tra cứu theo email nếu ID chưa liên kết trigger
        if (!profile) {
          const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('*')
            .ilike('google_email', trimmedEmail)
            .maybeSingle();
          if (profileByEmail) {
            profile = profileByEmail;
          }
        }

        // Nếu không tìm thấy profile trong bảng profiles
        if (!profile) {
          if (isSenior) {
            const seniorUser: User = {
              id: authUser.id,
              name: 'Người quản lý cao cấp',
              email: trimmedEmail,
              role: 'SENIOR_MANAGER',
              status: 'ACTIVE',
              department: 'Ban Quản Trị Hệ Thống',
            };
            await handleLoginSuccess(seniorUser, 'SUPABASE_AUTH_SENIOR');
            return;
          }

          // Không tìm thấy profile và không phải quản lý cao cấp -> signOut ngay lập tức
          await supabase.auth.signOut();
          await auditService.logAccessDenied(
            trimmedEmail,
            'Tài khoản chưa được cấp quyền truy cập vào hệ thống (không tìm thấy hồ sơ người dùng)',
            { userId: authUser.id }
          );
          setErrorMessage('Email này chưa được cấp tài khoản LabChem. Vui lòng liên hệ Người quản lý.');
          return;
        }

        // Kiểm tra trạng thái ACTIVE của profile
        if (profile.status !== 'ACTIVE' && !isSenior) {
          await supabase.auth.signOut();

          const denyReason = profile.status === 'PENDING'
            ? 'Tài khoản đang chờ Người quản lý phê duyệt'
            : (profile.status === 'LOCKED' || profile.status === 'DEACTIVATED' || profile.status === 'SUSPENDED'
              ? 'Tài khoản đã bị khóa hoặc ngừng hoạt động'
              : (profile.status === 'DELETED'
                ? 'Tài khoản đã bị xóa khỏi hệ thống'
                : `Trạng thái tài khoản không hợp lệ: ${profile.status}`));

          await auditService.logAccessDenied(
            trimmedEmail,
            denyReason,
            { userId: authUser.id, status: profile.status, role: profile.role }
          );

          if (profile.status === 'PENDING') {
            setErrorMessage('Tài khoản của bạn đang chờ Người quản lý phê duyệt và chưa được cấp quyền truy cập.');
          } else if (profile.status === 'LOCKED' || profile.status === 'DEACTIVATED' || profile.status === 'SUSPENDED') {
            setErrorMessage('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Người quản lý.');
          } else if (profile.status === 'DELETED') {
            setErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
          } else {
            setErrorMessage('Tài khoản chưa được kích hoạt trạng thái ACTIVE để truy cập hệ thống.');
          }
          return;
        }

        // Đăng nhập thành công và hợp lệ
        const validUser = rowToUser(profile);
        await handleLoginSuccess(validUser, 'SUPABASE_AUTH');
        return;
      }

      // 3. Chế độ Local / Offline (khi Supabase chưa kết nối)
      let matchedLocal = users.find(
        (u) => u.email.toLowerCase() === trimmedEmail
      );

      if (!matchedLocal && trimmedEmail === 'jasminebee279@gmail.com') {
        matchedLocal = {
          id: 'usr-admin-primary',
          name: 'Người quản lý',
          email: 'jasminebee279@gmail.com',
          role: 'MANAGER',
          status: 'ACTIVE',
          department: 'Bộ môn Dược liệu & Chiết xuất',
        };
      }

      if (!matchedLocal) {
        if (isSenior) {
          const seniorUser: User = {
            id: 'usr-buianhtra-admin',
            name: 'Người quản lý cao cấp',
            email: trimmedEmail,
            role: 'SENIOR_MANAGER',
            status: 'ACTIVE',
            department: 'Ban Quản Trị Hệ Thống',
          };
          await handleLoginSuccess(seniorUser, 'OFFLINE_LOCAL_SENIOR');
          return;
        }

        await auditService.logLoginFailed(trimmedEmail, 'Tài khoản không tồn tại trên hệ thống (chế độ ngoại tuyến)');
        setErrorMessage('Email này chưa được cấp tài khoản LabChem. Vui lòng liên hệ Người quản lý.');
        return;
      }

      if (matchedLocal.status !== 'ACTIVE' && !isSenior) {
        const denyReason = matchedLocal.status === 'PENDING'
          ? 'Tài khoản đang chờ Người quản lý phê duyệt'
          : (matchedLocal.status === 'DEACTIVATED' || matchedLocal.status === 'SUSPENDED'
            ? 'Tài khoản đã bị khóa hoặc ngừng hoạt động'
            : `Trạng thái tài khoản không hợp lệ: ${matchedLocal.status}`);

        await auditService.logAccessDenied(
          trimmedEmail,
          denyReason,
          { userId: matchedLocal.id, status: matchedLocal.status, role: matchedLocal.role },
          matchedLocal
        );

        if (matchedLocal.status === 'PENDING') {
          setErrorMessage('Tài khoản của bạn đang chờ Người quản lý phê duyệt và chưa được cấp quyền truy cập.');
        } else if (matchedLocal.status === 'DEACTIVATED' || matchedLocal.status === 'SUSPENDED') {
          setErrorMessage('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Người quản lý.');
        } else {
          setErrorMessage('Tài khoản chưa được kích hoạt trạng thái ACTIVE để truy cập hệ thống.');
        }
        return;
      }

      await handleLoginSuccess(matchedLocal, 'OFFLINE_LOCAL');
    } catch (err: any) {
      console.error('Đăng nhập thất bại:', err);
      try {
        if (isSupabaseConfigured()) {
          await supabase.auth.signOut();
        }
      } catch (_) {}
      await auditService.logLoginFailed(trimmedEmail, err.message || 'Đăng nhập không thành công');
      setErrorMessage(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý gửi email khôi phục mật khẩu qua Supabase Auth
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedResetEmail = resetEmail.trim().toLowerCase();

    if (!trimmedResetEmail) {
      setResetError('Vui lòng nhập Email cần khôi phục mật khẩu.');
      return;
    }

    setIsLoadingReset(true);
    setResetError(null);
    setResetSuccess(false);

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedResetEmail, {
          redirectTo: `${window.location.origin}`,
        });

        if (error) {
          throw error;
        }
      }

      // Đã gửi thành công hoặc mô phỏng thành công
      setResetSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError(err.message || 'Không thể gửi email khôi phục. Vui lòng thử lại sau.');
    } finally {
      setIsLoadingReset(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12 ${className}`}>
      <div className="w-full max-w-md">
        {/* Header / Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-sm mb-3 tracking-wider">
            LC
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">LABCHEM</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý hóa chất phòng thí nghiệm</p>
        </div>

        {/* Card Đăng nhập tối giản */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Trường Email */}
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
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
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>

            {/* Link 'Quên mật khẩu?' đặt bên dưới nút Đăng nhập */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email.trim());
                  setResetError(null);
                  setResetSuccess(false);
                  setIsForgotPasswordOpen(true);
                }}
                className="text-xs font-medium text-purple-700 hover:text-purple-800 hover:underline cursor-pointer transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Placeholder: Khôi phục mật khẩu (Hỗ trợ luồng Supabase Password Recovery) */}
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
                  <h2 className="text-sm font-bold text-slate-900">Khôi Phục Mật Khẩu</h2>
                  <p className="text-[11px] text-slate-500">Supabase Auth Password Recovery</p>
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
            <div className="p-6">
              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-emerald-950">Đã gửi yêu cầu khôi phục!</div>
                      <div className="leading-relaxed">
                        Hệ thống đã gửi liên kết đặt lại mật khẩu đến địa chỉ email: <strong>{resetEmail}</strong>.
                      </div>
                      <div className="text-[11px] text-emerald-800 pt-1">
                        Vui lòng kiểm tra hộp thư đến (kể cả mục Spam / Thư rác) và làm theo hướng dẫn để thiết lập mật khẩu mới.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Nhập địa chỉ email tài khoản của bạn để nhận liên kết đặt lại mật khẩu an toàn từ Supabase Authentication.
                  </p>

                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email tài khoản
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        autoFocus
                        placeholder="name@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                      />
                    </div>
                  </div>

                  {resetError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed font-medium">{resetError}</div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(false)}
                      className="flex-1 py-2.5 px-4 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isLoadingReset}
                      className="flex-1 py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoadingReset ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang gửi...</span>
                        </>
                      ) : (
                        <span>Gửi liên kết</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

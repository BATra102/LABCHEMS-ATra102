import React, { useState } from 'react';
import { useLab, DEFAULT_MANAGER_EMAIL } from '../../context/LabContext';
import { User, UserRole } from '../../types';
import { authService } from '../../services/authService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { getRoleDisplayName, isSeniorManagerUser, isSeniorManagerEmail } from '../../utils/roleUtils';
import {
  X,
  LogIn,
  Check,
  Shield,
  User as UserIcon,
  Lock,
  CheckCircle2,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Zap,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { users, currentUser, setCurrentUser, signInWithGoogle, isManager } = useLab();
  const [tab, setTab] = useState<'password' | 'google' | 'switch'>('password');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [isPendingNotice, setIsPendingNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMessage('Vui lòng nhập Email.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsLoadingAuth(true);
    setErrorMessage(null);

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await authService.signInWithPassword(loginEmail.trim(), loginPassword);
        if (error) {
          // If error is invalid credentials
          if (error.message?.includes('Invalid login credentials')) {
            throw new Error('Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.');
          }
          throw error;
        }
        if (data?.user) {
          const isSenior = isSeniorManagerEmail(loginEmail.trim());
          const { data: dbProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (dbProfile && !isSenior) {
            if (dbProfile.status === 'PENDING') {
              setErrorMessage('Tài khoản của bạn chưa được cấp quyền truy cập (Đang chờ Người quản lý phê duyệt).');
              return;
            }
            if (dbProfile.status === 'DEACTIVATED' || dbProfile.status === 'SUSPENDED') {
              setErrorMessage('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động. Vui lòng liên hệ Người quản lý.');
              return;
            }
            if (dbProfile.status !== 'ACTIVE') {
              setErrorMessage('Tài khoản của bạn chưa được cấp quyền truy cập vào hệ thống.');
              return;
            }
          }

          setMessage('Đăng nhập thành công!');
          setTimeout(() => {
            setMessage(null);
            onClose();
          }, 800);
          return;
        }
      }

      // Local / Offline fallback match
      const matched = users.find(
        (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
      );
      if (matched) {
        if (matched.status === 'DEACTIVATED' || matched.status === 'SUSPENDED') {
          setErrorMessage('Tài khoản này đã bị khóa hoặc ngưng hoạt động. Vui lòng liên hệ Người quản lý.');
          return;
        }
        setCurrentUser(matched);
        setMessage(`Đăng nhập thành công! Xin chào ${matched.name}.`);
        setTimeout(() => {
          setMessage(null);
          onClose();
        }, 800);
      } else {
        const res = signInWithGoogle(loginEmail.trim());
        if (res.success && res.user) {
          setMessage(res.message);
          setTimeout(() => {
            setMessage(null);
            onClose();
          }, 800);
        } else {
          setErrorMessage(res.message || 'Email hoặc mật khẩu không đúng.');
        }
      }
    } catch (err: any) {
      console.warn('Password login error:', err);
      setErrorMessage(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleGoogleAuth = (email: string, name?: string) => {
    const res = signInWithGoogle(email, name);
    if (res.success && res.user) {
      if (res.isPending) {
        setIsPendingNotice(true);
        setMessage('Tài khoản của bạn đang chờ Người quản lý phê duyệt.');
        setErrorMessage(null);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setIsPendingNotice(false);
        setMessage(res.message);
        setErrorMessage(null);
        setTimeout(() => {
          setMessage(null);
          onClose();
        }, 900);
      }
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ Email.');
      return;
    }
    let emailToUse = customEmail.trim();
    if (!emailToUse.includes('@')) {
      emailToUse = `${emailToUse}@gmail.com`;
    }
    handleGoogleAuth(emailToUse, customName.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs font-bold text-xs">
              LC
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">LABCHEM</h2>
              <p className="text-xs text-slate-500">Quản lý hóa chất phòng thí nghiệm</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 text-xs gap-1">
          <button
            onClick={() => {
              setTab('password');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'password'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-purple-600" />
            <span>Email & Mật khẩu</span>
          </button>

          <button
            onClick={() => {
              setTab('google');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'google'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GoogleIcon className="w-3.5 h-3.5" />
            <span>Google OAuth</span>
          </button>

          <button
            onClick={() => {
              setTab('switch');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'switch'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Tài khoản ({users.length})</span>
          </button>
        </div>

        {/* Notifications */}
        {message && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
              isPendingNotice
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {isPendingNotice ? (
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="leading-relaxed font-medium">{message}</div>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <div className="p-6">
          {tab === 'password' ? (
            /* TAB: EMAIL & MẬT KHẨU */
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email đăng nhập
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Hiển thị mật khẩu</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoadingAuth}
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoadingAuth ? 'Đang xác thực...' : 'Đăng nhập'}</span>
              </button>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div>• Xác thực an toàn bằng Supabase Authentication.</div>
                <div>• Người quản lý cao cấp tự động nhận toàn quyền quản trị phòng thí nghiệm.</div>
              </div>
            </form>
          ) : tab === 'google' ? (
            <div className="space-y-4">
              {/* Presets with verified Google OAuth profiles */}
              <div className="space-y-2">
                {/* Supabase Auth Live Google Sign-in */}
                {isSupabaseConfigured() && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await authService.signInWithGoogle();
                      } catch (err: any) {
                        setErrorMessage(err.message || 'Lỗi khi gọi Google OAuth qua Supabase Auth');
                      }
                    }}
                    className="w-full p-3 rounded-xl border border-cyan-400 bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white flex items-center justify-between transition-all shadow-md group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                        <GoogleIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>Đăng Nhập Trực Tiếp Với Google OAuth</span>
                          <span className="text-[9px] bg-white/20 text-white font-mono px-1.5 py-0.2 rounded font-bold">Supabase</span>
                        </div>
                        <div className="text-[10px] text-cyan-100 font-mono">Chuyển hướng đến Google Accounts · Tự động tạo Profile</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform shrink-0">
                      Mở Google →
                    </span>
                  </button>
                )}

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pt-1">
                  Chọn nhanh tài khoản thử nghiệm luồng Manager / User:
                </div>

                {/* Account 1: Manager */}
                <button
                  type="button"
                  onClick={() => handleGoogleAuth('buianhtra2021@gmail.com', 'Bùi Anh Trà')}
                  className="w-full p-3 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 hover:border-purple-300 text-left flex items-center justify-between transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-purple-200 flex items-center justify-center shrink-0">
                      <GoogleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">Bùi Anh Trà</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-700">
                          MANAGER (Toàn quyền)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">buianhtra2021@gmail.com</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-purple-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Đăng nhập →
                  </span>
                </button>

                {/* Account 2: Active User */}
                <button
                  type="button"
                  onClick={() => handleGoogleAuth('nguyenvana.lab@gmail.com', 'Nguyễn Văn A')}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left flex items-center justify-between transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <GoogleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">Nguyễn Văn A</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                          USER (Active)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">nguyenvana.lab@gmail.com</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-cyan-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Đăng nhập →
                  </span>
                </button>

                {/* Account 3: Pending User */}
                <button
                  type="button"
                  onClick={() => handleGoogleAuth('lethimai.pending@gmail.com', 'Lê Thị Mai')}
                  className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 text-left flex items-center justify-between transition-all shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center shrink-0">
                      <GoogleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">Lê Thị Mai</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                          PENDING (Chờ duyệt)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">lethimai.pending@gmail.com</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Xem luồng chờ duyệt →
                  </span>
                </button>
              </div>

              {/* Custom Google account */}
              <div className="pt-3 border-t border-slate-200">
                <form onSubmit={handleCustomSubmit} className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-700">
                    Hoặc đăng nhập với tài khoản Google của bạn:
                  </div>

                  <div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="tenban@gmail.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Họ và tên hiển thị (tùy chọn)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-cyan-600"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    <span>Tiếp tục với Google OAuth</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </div>

              {/* Security info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Quy trình bảo mật Google OAuth:</span>
                </div>
                <div>• Email Google là định danh duy nhất của user. Ứng dụng không lưu mật khẩu.</div>
                <div>• Tài khoản mới đăng nhập lần đầu sẽ ở trạng thái <strong>PENDING</strong> chờ Người quản lý phê duyệt.</div>
                <div>• Tài khoản Người quản lý cao cấp tự động nhận toàn quyền quản trị hệ thống.</div>
              </div>
            </div>
          ) : (
            /* Tab: Switch User */
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              <div className="text-[11px] text-slate-500 pb-1">
                Danh sách tài khoản trong hệ thống:
              </div>

              {users
                .filter((u) => isSeniorManagerUser(currentUser) || (!isSeniorManagerEmail(u.email) && u.role !== 'SENIOR_MANAGER'))
                .map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setCurrentUser(u);
                      setMessage(`Đã chuyển sang tài khoản: ${u.name} (${getRoleDisplayName(u.role, u.email)})`);
                      setTimeout(() => {
                        setMessage(null);
                        onClose();
                      }, 700);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20'
                        : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{u.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                              isSeniorManagerUser(u)
                                ? 'bg-indigo-100 text-indigo-700'
                                : u.role === 'MANAGER' || u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {getRoleDisplayName(u.role, u.email)}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {isCurrent ? (
                        <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đang chọn</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Chọn →</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

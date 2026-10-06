import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { userService, generateStrongPassword } from '../../services/userService';
import { useLab } from '../../context/LabContext';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Shield,
  Lock,
  UserCheck,
  Mail,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetPasswordModal: React.FC<Props> = ({ isOpen, user, onClose, onSuccess }) => {
  const { currentUser } = useLab();

  // Mode: 'auto' (Tạo mật khẩu tự động) | 'manual' (Nhập mật khẩu mới)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  // Input states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success view states
  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResultPassword, setShowResultPassword] = useState(true);

  // Auto-generate password on open or mode change if auto
  useEffect(() => {
    if (isOpen && user) {
      setMode('auto');
      const pass = generateStrongPassword();
      setNewPassword(pass);
      setConfirmPassword(pass);
      setShowPassword(true);
      setResetSuccess(false);
      setErrorMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleGenerate = () => {
    const generated = generateStrongPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  const handleModeChange = (newMode: 'auto' | 'manual') => {
    setMode(newMode);
    setErrorMessage(null);
    if (newMode === 'auto') {
      const generated = generateStrongPassword();
      setNewPassword(generated);
      setConfirmPassword(generated);
      setShowPassword(true);
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  };

  // Password validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = mode === 'auto' || newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && (mode === 'auto' || (passwordsMatch && (hasUpper || hasLower) && hasNumber));

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự (khuyến nghị từ 8 ký tự trở lên).');
      return;
    }

    if (mode === 'manual') {
      if (newPassword.length < 8) {
        setErrorMessage('Mật khẩu mới phải có tối thiểu 8 ký tự theo chính sách bảo mật.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage('Xác nhận mật khẩu mới không khớp với mật khẩu mới.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await userService.resetPassword(user.id, newPassword, currentUser);

      if (!res.success) {
        setErrorMessage(res.message || 'Không thể cấp lại mật khẩu.');
        return;
      }

      setResetSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi hệ thống khi cấp lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const loginUrl = window.location.origin;
    const text = `LABCHEM - THÔNG TIN MẬT KHẨU ĐƯỢC CẤP LẠI
------------------------------------
Họ và tên: ${user.name}
Email đăng nhập: ${user.email}
Mật khẩu mới: ${newPassword}
Trang đăng nhập: ${loginUrl}
------------------------------------
Lưu ý: Mật khẩu này là tạm thời. Bạn bắt buộc phải đổi sang mật khẩu riêng ở lần đăng nhập đầu tiên.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setResetSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cấp lại mật khẩu</h2>
              <p className="text-[11px] text-slate-500">Cập nhật mật khẩu thật cho tài khoản thành viên</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {resetSuccess ? (
            /* Màn hình kết quả sau khi cấp lại thành công */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-emerald-950">Đã cấp lại mật khẩu thành công.</div>
                  <p className="text-emerald-800 text-[11px] mt-1 leading-relaxed">
                    Hãy cung cấp mật khẩu mới cho người dùng qua kênh liên hệ an toàn.
                  </p>
                </div>
              </div>

              {/* Thông tin bàn giao */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Họ tên:</span>
                    <span className="font-bold text-slate-900">{user.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email đăng nhập:</span>
                    <span className="font-mono font-semibold text-purple-700 truncate block">{user.email}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Mật khẩu mới tạm thời:</span>
                    <button
                      type="button"
                      onClick={() => setShowResultPassword(!showResultPassword)}
                      className="text-[11px] text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {showResultPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showResultPassword ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-900 tracking-wider font-bold select-all flex items-center justify-between">
                    <span>{showResultPassword ? newPassword : '••••••••••••••••'}</span>
                  </div>
                </div>
              </div>

              {/* Cảnh báo bảo mật bắt buộc */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Lưu ý bảo mật:</span>
                </div>
                <p>• Mật khẩu này chỉ hiển thị <strong>MỘT LẦN DUY NHẤT</strong> trong modal kết quả này để Người quản lý sao chép.</p>
                <p>• Sau khi đóng modal, không thể xem lại mật khẩu đó.</p>
                <p>• Khi người dùng đăng nhập bằng mật khẩu này, hệ thống sẽ <strong>bắt buộc đổi mật khẩu lần đầu</strong> trước khi vào Dashboard.</p>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Sao chép mật khẩu</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2.5 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            /* Form nhập liệu Cấp lại mật khẩu */
            <form onSubmit={handleReset} className="space-y-4">
              {/* Thẻ tóm tắt người dùng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Họ tên người dùng</div>
                  <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{user.name}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Email đăng nhập</div>
                  <div className="font-mono text-purple-700 font-semibold mt-0.5 truncate flex items-center gap-1.5" title={user.email}>
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>{user.email}</span>
                  </div>
                </div>
              </div>

              {/* 2 lựa chọn: [Tạo mật khẩu tự động] & [Nhập mật khẩu mới] */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phương thức tạo mật khẩu</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleModeChange('auto')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'auto'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tạo mật khẩu tự động</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('manual')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'manual'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Nhập mật khẩu mới</span>
                  </button>
                </div>
              </div>

              {mode === 'auto' ? (
                /* Giao diện tạo mật khẩu tự động */
                <div className="space-y-3 p-4 bg-purple-50/50 border border-purple-200/70 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-900">Mật khẩu tự sinh ngẫu nhiên:</span>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Đổi mật khẩu khác</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      readOnly
                      value={newPassword}
                      className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-purple-300 rounded-xl bg-white text-slate-900 font-mono font-bold tracking-wider select-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    ✓ Mật khẩu ngẫu nhiên đạt tiêu chuẩn bảo mật cao (chữ hoa, chữ thường, chữ số và ký tự đặc biệt).
                  </p>
                </div>
              ) : (
                /* Giao diện nhập mật khẩu thủ công */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Tối thiểu 8 ký tự, có chữ và số"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Nhập lại mật khẩu mới"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Checklist quy chuẩn mật khẩu */}
                  <div className="grid grid-cols-2 gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px]">
                    <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <span>{hasMinLength ? '✓' : '•'}</span> Tối thiểu 8 ký tự
                    </div>
                    <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <span>{hasNumber ? '✓' : '•'}</span> Có chữ số (0-9)
                    </div>
                    <div className={`flex items-center gap-1 ${hasUpper || hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <span>{hasUpper || hasLower ? '✓' : '•'}</span> Có chữ cái (A-Z, a-z)
                    </div>
                    <div className={`flex items-center gap-1 ${newPassword && confirmPassword && newPassword === confirmPassword ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                      <span>{newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '•'}</span> Khớp mật khẩu xác nhận
                    </div>
                  </div>
                </div>
              )}

              {/* Cảnh báo bảo mật hệ thống */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-slate-700">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                  <span>Quy tắc bảo mật:</span>
                </div>
                <p>• Mật khẩu thật sẽ được cập nhật trực tiếp trong Supabase Auth.</p>
                <p>• Không lưu mật khẩu vào bảng profiles, localStorage hay nhật ký kiểm toán.</p>
                <p>• Không hiển thị lại mật khẩu cũ vì hệ thống không được phép đọc mật khẩu cũ.</p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">{errorMessage}</div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2.5 px-4 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !isPasswordValid}
                  className="py-2.5 px-5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoading ? 'Đang cập nhật...' : 'Cấp lại mật khẩu'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

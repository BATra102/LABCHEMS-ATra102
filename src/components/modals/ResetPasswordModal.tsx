import React, { useState } from 'react';
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
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ResetPasswordModal: React.FC<Props> = ({ isOpen, user, onClose, onSuccess }) => {
  const { currentUser } = useLab();

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResultPassword, setShowResultPassword] = useState(true);

  if (!isOpen || !user) return null;

  const handleGenerate = () => {
    const generated = generateStrongPassword();
    setNewPassword(generated);
    setShowPassword(true);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await userService.resetPassword(user.id, newPassword, currentUser);

      if (!res.success) {
        setErrorMessage(res.message || 'Không thể đặt lại mật khẩu.');
        return;
      }

      setResetSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi đặt lại mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    const loginUrl = window.location.origin;
    const text = `LABCHEM - MẬT KHẨU MỚI ĐÃ THIẾT LẬP
Họ tên: ${user.name}
Email đăng nhập: ${user.email}
Mật khẩu mới: ${newPassword}
Trang đăng nhập: ${loginUrl}
Vui lòng đổi mật khẩu sau khi đăng nhập.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleClose = () => {
    setNewPassword('');
    setShowPassword(false);
    setResetSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Đặt Lại Mật Khẩu Thành Viên</h2>
              <p className="text-[11px] text-slate-500">{user.name} ({user.email})</p>
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
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-emerald-950">Đã đặt lại mật khẩu thành công!</div>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    Mật khẩu mới đã được cập nhật cho tài khoản {user.email}.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mật khẩu mới tạm thời:</span>
                  <button
                    type="button"
                    onClick={() => setShowResultPassword(!showResultPassword)}
                    className="text-[11px] text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {showResultPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showResultPassword ? 'Ẩn' : 'Hiện'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-900 tracking-wider font-bold">
                  {showResultPassword ? newPassword : '••••••••••••'}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Lưu ý bảo mật:</span>
                </div>
                <p>• Mật khẩu này chỉ hiển thị một lần duy nhất. Hãy sao chép và giao cho thành viên.</p>
                <p>• Hệ thống sẽ không hiển thị lại mật khẩu sau khi bạn đóng cửa sổ này.</p>
              </div>

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
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Tạo mật khẩu mới cho tài khoản <strong>{user.name}</strong> ({user.email}). Mật khẩu cũ sẽ bị vô hiệu hóa.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Mật khẩu mới</label>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tạo tự động</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự"
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
                  className="py-2 px-4 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2 px-5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

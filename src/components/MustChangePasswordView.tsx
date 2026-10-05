import React, { useState } from 'react';
import { useLab } from '../context/LabContext';
import { supabase } from '../lib/supabase';
import { auditService } from '../services/auditService';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  onPasswordChanged: () => void;
}

export const MustChangePasswordView: React.FC<Props> = ({ onPasswordChanged }) => {
  const { currentUser, setCurrentUser, signOut } = useLab();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.');
      return;
    }

    if (currentPassword && newPassword === currentPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu vừa được cấp.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu mới và Xác nhận mật khẩu không khớp nhau.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Cập nhật mật khẩu trong Supabase Auth cho user hiện tại
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        throw authError;
      }

      // 2. Cập nhật trạng thái must_change_password = false trong bảng profiles
      await supabase
        .from('profiles')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      // 3. Ghi audit log (TUYỆT ĐỐI KHÔNG GHI MẬT KHẨU)
      await auditService.log({
        action: 'PASSWORD_RESET',
        entityType: 'USER',
        entityId: currentUser.id,
        actorId: currentUser.id,
        actorName: currentUser.name,
        description: `Thành viên ${currentUser.name} (${currentUser.email}) đã đổi mật khẩu lần đầu thành công.`,
        newData: { must_change_password: false, changedAt: new Date().toISOString() },
      });

      // 4. Cập nhật state nội bộ
      setCurrentUser({
        ...currentUser,
        must_change_password: false,
      });

      setSuccessMessage('Đổi mật khẩu thành công! Đang chuyển hướng vào hệ thống...');
      setTimeout(() => {
        onPasswordChanged();
      }, 1000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setErrorMessage(err.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="p-6 bg-purple-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">YÊU CẦU ĐỔI MẬT KHẨU</h1>
              <p className="text-xs text-purple-200">Bắt buộc cho lần đăng nhập đầu tiên</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="p-2 text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Thông tin cảnh báo */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Mật khẩu của bạn vừa được <strong>Người quản lý cấp lại</strong>. Vì lý do an toàn, bạn bắt buộc phải thiết lập mật khẩu riêng trước khi có thể truy cập hệ thống LabChem.
            </div>
          </div>

          {/* Thông tin tài khoản */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="text-slate-500">Tài khoản: <strong className="text-slate-900">{currentUser.name}</strong></div>
            <div className="text-slate-500 font-mono">Email: <span className="font-semibold text-purple-700">{currentUser.email}</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Mật khẩu hiện tại */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu vừa được cấp (tùy chọn)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu tạm thời vừa nhận"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Mật khẩu mới */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu mới */}
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
                  className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 font-mono"
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

            {/* Thông báo lỗi */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Thông báo thành công */}
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-medium leading-relaxed">{successMessage}</div>
              </div>
            )}

            {/* Nút hành động */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoading ? 'Đang cập nhật mật khẩu...' : 'Đổi mật khẩu & Truy cập hệ thống'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={signOut}
                className="w-full py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất (Đổi sau)</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

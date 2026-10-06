import React, { useState } from 'react';
import { User, UserRole, UserStatus } from '../../types';
import { userService, generateStrongPassword } from '../../services/userService';
import { useLab } from '../../context/LabContext';
import {
  X,
  UserPlus,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Shield,
  KeyRound,
  Lock,
  Mail,
  User as UserIcon,
} from 'lucide-react';

export interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: User) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser } = useLab();

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STAFF');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [department, setDepartment] = useState('Bộ môn Dược liệu & Chiết xuất');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Màn hình thành công (hiển thị thông tin & mật khẩu tạm thời 1 lần duy nhất)
  const [createdResult, setCreatedResult] = useState<{
    user: User;
    tempPassword?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(true);

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const generated = generateStrongPassword();
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedUsername) {
      setErrorMessage('Vui lòng nhập Tên đăng nhập.');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    if (!usernameRegex.test(trimmedUsername)) {
      setErrorMessage('Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới (_) hoặc dấu chấm (.).');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập Họ và tên.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập Mật khẩu cho tài khoản.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu và Xác nhận mật khẩu không khớp nhau.');
      return;
    }

    setIsLoading(true);

    try {
      // Cấp tài khoản bằng Tên đăng nhập và mật khẩu
      const res = await userService.provisionUser(
        {
          username: trimmedUsername,
          name: trimmedName,
          password,
          role,
          status,
          department: department.trim(),
        },
        currentUser
      );

      if (!res.success || !res.user) {
        setErrorMessage(res.message || 'Không thể tạo tài khoản mới.');
        return;
      }

      // Chuyển sang màn hình hiển thị mật khẩu tạm thời một lần duy nhất
      setCreatedResult({
        user: res.user,
        tempPassword: password,
      });

      if (onSuccess) {
        onSuccess(res.user);
      }
    } catch (err: any) {
      console.error('Error creating account:', err);
      setErrorMessage(err.message || 'Lỗi hệ thống khi tạo tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const loginUrl = window.location.origin;
    const textToCopy = `LABCHEM - THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP
Tên đăng nhập: ${createdResult.user.username || createdResult.user.email}
Mật khẩu: ${createdResult.tempPassword || '(Không hiển thị lại)'}
Họ và tên: ${createdResult.user.name}
Bộ môn / Phòng ban: ${createdResult.user.department}
Vai trò: ${createdResult.user.role}
Trạng thái: ${createdResult.user.status}
Trang đăng nhập: ${loginUrl}
Lưu ý: Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResetAndClose = () => {
    setUsername('');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setRole('STAFF');
    setStatus('ACTIVE');
    setDepartment('Bộ môn Dược liệu & Chiết xuất');
    setCreatedResult(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {createdResult ? 'TẠO TÀI KHOẢN THÀNH CÔNG' : 'CẤP TÀI KHOẢN NGƯỜI DÙNG'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {createdResult ? 'Thông tin tài khoản tạm thời để quản lý sao chép' : 'Cấp tài khoản đăng nhập Supabase Auth và lưu hồ sơ vào bảng profiles'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {createdResult ? (
            /* =================================================== */
            /* HIỂN THỊ MẬT KHẨU TẠM THỜI MỘT LẦN DUY NHẤT          */
            /* =================================================== */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-emerald-950">Đã tạo tài khoản thành công!</div>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    User đã được tạo trong Supabase Auth và lưu hồ sơ vào bảng profiles.
                  </p>
                </div>
              </div>

              {/* Thông tin tài khoản */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-900">{createdResult.user.name}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Email đăng nhập:</span>
                  <span className="font-mono font-bold text-purple-700">{createdResult.user.email}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Vai trò:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px]">
                    {createdResult.user.role}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px]">
                    {createdResult.user.status}
                  </span>
                </div>

                {/* Mật khẩu tạm thời */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700">Mật khẩu tạm thời:</span>
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="text-[11px] text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {showTempPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showTempPassword ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-900 tracking-wider font-bold flex items-center justify-between">
                    <span>{showTempPassword ? createdResult.tempPassword : '••••••••••••'}</span>
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="text-xs text-purple-700 hover:text-purple-900 font-sans font-semibold flex items-center gap-1 cursor-pointer ml-2"
                      title="Sao chép mật khẩu"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cảnh báo bảo mật */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Lưu ý bảo mật quan trọng:</span>
                </div>
                <p>
                  • Mật khẩu tạm thời <strong>chỉ được hiển thị một lần duy nhất</strong> trong phiên này để người quản lý bàn giao cho thành viên.
                </p>
                <p>
                  • Sau khi đóng cửa sổ này, mật khẩu sẽ không thể xem lại vì lý do an toàn bảo mật.
                </p>
                <p>• Hệ thống tuyệt đối không lưu mật khẩu dạng plaintext vào database hay audit_logs.</p>
              </div>

              {/* Nút hành động */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Đã sao chép thông tin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Sao chép thông tin đăng nhập</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full sm:w-auto py-2.5 px-5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : (
            /* =================================================== */
            /* FORM CẤP TÀI KHOẢN MỚI                              */
            /* =================================================== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tên đăng nhập */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="vd: nhom2 hoặc lab01"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="vd: Nguyễn Văn A hoặc Nhóm 2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Mật khẩu & Nút Tạo mật khẩu tự động */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Tạo mật khẩu tự động</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự hoặc bấm tạo tự động"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Xác nhận mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Nhập lại mật khẩu vừa tạo"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Vai trò & Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vai trò (Role)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold focus:outline-hidden focus:border-purple-600 cursor-pointer"
                  >
                    <option value="STAFF">STAFF (Nhân viên Lab)</option>
                    <option value="MANAGER">MANAGER (Người quản lý)</option>
                    <option value="VIEWER">VIEWER (Người xem)</option>
                    <option value="USER">USER (Thành viên)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Trạng thái (Status)</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-semibold focus:outline-hidden focus:border-purple-600 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Kích hoạt ngay)</option>
                    <option value="LOCKED">LOCKED (Khóa)</option>
                    <option value="PENDING">PENDING (Chờ duyệt)</option>
                  </select>
                </div>
              </div>

              {/* Bộ môn */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bộ môn / Phòng ban</label>
                <input
                  type="text"
                  placeholder="vd: Bộ môn Dược liệu & Chiết xuất"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 font-medium"
                />
              </div>

              {/* Thông báo lỗi */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-medium leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="py-2 px-4 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2 px-5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? 'Đang cấp tài khoản...' : 'Cấp tài khoản'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateAccountModal;

import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { User } from '../../types';
import { isSeniorManagerUser } from '../../utils/roleUtils';
import {
  AlertTriangle,
  X,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Mail,
  User as UserIcon,
  Shield,
  Clock,
  History,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const DeleteManagerModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const { deleteUser, currentUser, users, canManageTargetUser } = useLab();

  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmEmail('');
      setReason('');
      setErrorMsg(null);
      setIsDeleting(false);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const isTargetManager = user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'LAB_MANAGER';

  // Validation rules
  const isEmailMatching = confirmEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
  const isSelf = user.id === currentUser.id;

  const remainingActiveManagers = users.filter(
    (u) =>
      (u.role === 'MANAGER' || u.role === 'ADMIN' || u.role === 'LAB_MANAGER') &&
      u.status === 'ACTIVE' &&
      u.id !== user.id
  );
  const isLastActiveManager = isTargetManager && remainingActiveManagers.length === 0;

  const permCheck = canManageTargetUser(user);

  const handleDelete = () => {
    if (isSeniorManagerUser(user)) {
      setErrorMsg('Tài khoản Người quản lý cao cấp được bảo vệ tuyệt đối, không thể xóa!');
      return;
    }

    if (!isEmailMatching) {
      setErrorMsg('Email xác nhận không khớp. Vui lòng nhập chính xác email của tài khoản.');
      return;
    }

    if (isSelf) {
      setErrorMsg('Bạn không thể tự xóa tài khoản của chính mình.');
      return;
    }

    if (isLastActiveManager) {
      setErrorMsg('Không thể xóa Manager cuối cùng của hệ thống. Phải có ít nhất một Manager đang hoạt động.');
      return;
    }

    if (!permCheck.allowed) {
      setErrorMsg(permCheck.message);
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    const res = deleteUser(user.id, reason.trim() || (isTargetManager ? 'Xóa tài khoản Manager đã Deactivated' : 'Xóa tài khoản thành viên thuộc quyền'));

    setIsDeleting(false);
    if (res.success) {
      onSuccess(res.message);
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>⚠ {isTargetManager ? 'Xóa tài khoản Manager?' : 'Xóa tài khoản thành viên?'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyển tài khoản vào Lịch sử xóa (Soft Delete) & bảo toàn toàn bộ dữ liệu lịch sử
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-4 text-xs">
          
          {/* Target User Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Bạn đang chuẩn bị xóa:
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{user.name}</div>
                <div className="text-slate-600 font-mono text-[11px] truncate flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
              <div>
                <span className="text-slate-400">Bộ môn:</span>{' '}
                <span className="font-bold text-slate-800">{user.department}</span>
              </div>
              <div>
                <span className="text-slate-400">Vai trò:</span>{' '}
                <span className="font-bold text-purple-700 font-mono">{user.role}</span>
              </div>
            </div>

            {user.manager_name && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                <span>Manager phụ trách: </span>
                <strong className="text-slate-700 font-mono">{user.manager_name}</strong>
              </div>
            )}
          </div>

          {/* Safety Notice Callout (Section 13, 16, 18) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1.5 text-slate-700">
            <div className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Chính sách bảo toàn lịch sử phòng lab</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Lịch sử sử dụng hóa chất, nhập kho và giao dịch của tài khoản <strong>sẽ được giữ lại nguyên vẹn</strong> mang tên <strong>{user.name}</strong>. Tài khoản sẽ không thể đăng nhập sau khi xóa.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Dữ liệu vẫn được giữ trong "Lịch sử xóa" và có thể khôi phục lại khi cần.</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Protection: Email Confirmation Input */}
          <div className="space-y-1.5 pt-1">
            <label className="block font-semibold text-slate-900">
              Nhập email của tài khoản để xác nhận xóa:
            </label>
            <div className="text-[11px] text-slate-500 font-mono select-all">
              Vui lòng gõ: <strong className="text-slate-800">{user.email}</strong>
            </div>
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => {
                setConfirmEmail(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={user.email}
              className={`w-full px-3 py-2 border rounded-xl font-mono text-xs focus:outline-hidden transition-colors ${
                confirmEmail.length > 0
                  ? isEmailMatching
                    ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-rose-400 bg-rose-50/20 text-rose-900'
                  : 'border-slate-300 bg-white'
              }`}
              autoFocus
            />
            {confirmEmail.length > 0 && !isEmailMatching && (
              <p className="text-[11px] text-rose-600 font-medium">
                Email chưa khớp chính xác với "{user.email}"
              </p>
            )}
          </div>

          {/* Optional reason */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-600">
              Lý do xóa (ghi vào Audit Log):
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Nghỉ việc / Chuyển công tác / Hoàn thành đề tài..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:border-slate-400"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Hủy
          </button>
          
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isEmailMatching || isDeleting || isSelf || isLastActiveManager || !permCheck.allowed}
            className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs ${
              !isEmailMatching || isSelf || isLastActiveManager || !permCheck.allowed
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Đang xử lý...' : 'Xác nhận xóa'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { User } from '../../types';
import { isSeniorManagerEmail, isSeniorManagerUser } from '../../utils/roleUtils';
import {
  X,
  User as UserIcon,
  Mail,
  Building,
  Briefcase,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export const PRESET_DEPARTMENTS = [
  'Bộ môn Dược liệu & Chiết xuất',
  'Bộ môn Hóa Phân tích & Kiểm nghiệm',
  'Bộ môn Hóa dược',
  'Bộ môn Dược lý & Dược lâm sàng',
  'Nghiên cứu sinh Dược học',
  'Sinh viên thực tập K45',
  'Phòng Kiểm nghiệm Độc chất',
  'Phòng Thí nghiệm Sinh hóa',
  'Khác',
];

export const EditUserModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onSaved,
}) => {
  const { updateUser, currentUser, users } = useLab();

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [notes, setNotes] = useState('');
  const [managerId, setManagerId] = useState('');

  // Confirmation state for critical changes (Section 7)
  const [confirmStepOpen, setConfirmStepOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSenior = isSeniorManagerUser(currentUser);
  const activeManagers = users.filter(
    (u) =>
      (u.role === 'MANAGER' || u.role === 'ADMIN') &&
      u.status === 'ACTIVE' &&
      (isSenior || !isSeniorManagerEmail(u.email))
  );

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      const deptExists = PRESET_DEPARTMENTS.includes(user.department);
      if (deptExists && user.department !== 'Khác') {
        setDepartment(user.department);
        setIsCustomDept(false);
        setCustomDepartment('');
      } else {
        setDepartment('Khác');
        setIsCustomDept(true);
        setCustomDepartment(user.department || '');
      }
      setPosition(user.position || '');
      setPhone(user.phone || '');
      setMemberCode(user.member_code || '');
      setNotes(user.notes || '');
      setManagerId(user.manager_id || currentUser.id);
      setConfirmStepOpen(false);
      setErrorMsg(null);
      setIsSaving(false);
    }
  }, [user, isOpen, currentUser.id]);

  if (!isOpen || !user) return null;

  const targetDept = isCustomDept ? customDepartment.trim() : department;
  const isDeptChanged = targetDept && targetDept !== user.department;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên thành viên.');
      return;
    }
    if (isCustomDept && !customDepartment.trim()) {
      setErrorMsg('Vui lòng nhập tên bộ môn cụ thể.');
      return;
    }

    // If department changed or critical role change, show confirmation dialog (Section 7)
    if (isDeptChanged) {
      setConfirmStepOpen(true);
    } else {
      executeSave();
    }
  };

  const executeSave = () => {
    setIsSaving(true);
    setErrorMsg(null);

    const chosenManager = activeManagers.find((m) => m.id === managerId);

    const res = updateUser(user.id, {
      name: name.trim(),
      department: targetDept,
      position: position.trim(),
      phone: phone.trim(),
      member_code: memberCode.trim(),
      notes: notes.trim(),
      manager_id: chosenManager?.id || user.manager_id || currentUser.id,
      manager_name: chosenManager?.name || user.manager_name || currentUser.name,
    });

    setIsSaving(false);
    if (res.success) {
      onSaved(res.message);
      onClose();
    } else {
      setErrorMsg(res.message);
      setConfirmStepOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Cập nhật thông tin thành viên
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉnh sửa thông tin hồ sơ & chuyển bộ môn trong phạm vi quản lý
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 7: Confirmation Step if Department Changed */}
        {confirmStepOpen ? (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-3 text-slate-700">
              <div className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Xác nhận cập nhật bộ môn</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Bạn đang chuẩn bị chuyển thành viên <strong>{user.name}</strong> sang đơn vị / bộ môn mới:
              </p>
              
              <div className="p-3 bg-white rounded-lg border border-amber-200/80 flex items-center justify-between text-xs font-medium">
                <div className="text-slate-500">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Bộ môn cũ</div>
                  <div className="font-semibold text-slate-700">{user.department}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0 mx-2" />
                <div className="text-purple-900 text-right">
                  <div className="text-[10px] uppercase font-bold text-purple-600">Bộ môn mới</div>
                  <div className="font-bold text-purple-800">{targetDept}</div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Lưu ý: Thay đổi này sẽ được đồng bộ trên toàn bộ báo cáo, danh mục và Audit Log kiểm toán hệ thống.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStepOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
              >
                {isSaving ? 'Đang lưu...' : 'Xác nhận chuyển bộ môn'}
              </button>
            </div>
          </div>
        ) : (
          /* Form Content (Section 6) */
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Họ và tên */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Họ và tên thành viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                required
              />
            </div>

            {/* Email Google (Định danh OAuth - Readonly) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Email Google</span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Định danh Google OAuth (Không thể sửa)
                </span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-100/80 text-slate-500 font-mono cursor-not-allowed select-all"
                />
              </div>
            </div>

            {/* Bộ môn (Chuyển bộ môn - Mục 4) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Bộ môn / Đơn vị <span className="text-rose-500">*</span></span>
                {isDeptChanged && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Sẽ chuyển sang bộ môn mới
                  </span>
                )}
              </label>
              <div className="space-y-2">
                <select
                  value={isCustomDept ? 'Khác' : department}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Khác') {
                      setIsCustomDept(true);
                      setDepartment('Khác');
                    } else {
                      setIsCustomDept(false);
                      setDepartment(val);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 font-medium cursor-pointer"
                >
                  {PRESET_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {isCustomDept && (
                  <input
                    type="text"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="Nhập tên bộ môn / đơn vị mới..."
                    className="w-full px-3 py-2 border border-purple-300 rounded-xl bg-purple-50/30 text-slate-900 focus:outline-hidden focus:border-purple-600 text-xs"
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* Grid: Chức danh & SĐT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chức danh / Vị trí
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="VD: Học viên cao học"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0901234567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 font-mono"
                />
              </div>
            </div>

            {/* Mã thành viên */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mã thành viên phòng lab
              </label>
              <input
                type="text"
                value={memberCode}
                onChange={(e) => setMemberCode(e.target.value)}
                placeholder="VD: TV-001"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 font-mono"
              />
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ghi chú nội bộ
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú về dự án phụ trách, lưu ý an toàn..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 resize-none text-xs"
              />
            </div>

            {/* Manager phụ trách */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Quản lý phụ trách (Manager)</span>
                <span className="text-[10px] text-slate-400">Xác định phạm vi tài khoản thuộc quyền</span>
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={Boolean(currentUser.role !== 'ADMIN' && user.manager_id && user.manager_id !== currentUser.id)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 font-medium"
              >
                {activeManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.department}) {m.id === currentUser.id ? '— Bạn phụ trách' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-colors cursor-pointer active:scale-95"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { User, UserLimits, UserPermissions, UserRole } from '../../types';
import {
  X,
  Shield,
  Gauge,
  Sliders,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertTriangle,
  FileCheck,
  Check,
  Zap,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const UserLimitsModal: React.FC<Props> = ({ isOpen, user, onClose, onSaved }) => {
  const { updateUserLimits, updateUserPermissions, changeUserRole } = useLab();

  // Role
  const [role, setRole] = useState<UserRole>('USER');

  // Limits
  const [maxPerTx, setMaxPerTx] = useState<string>('150');
  const [isPerTxUnlimited, setIsPerTxUnlimited] = useState<boolean>(false);

  const [dailyLimit, setDailyLimit] = useState<string>('500');
  const [isDailyUnlimited, setIsDailyUnlimited] = useState<boolean>(false);

  const [dailyCount, setDailyCount] = useState<string>('8');
  const [isCountUnlimited, setIsCountUnlimited] = useState<boolean>(false);

  const [maxStockIn, setMaxStockIn] = useState<string>('5');
  const [isStockInUnlimited, setIsStockInUnlimited] = useState<boolean>(false);

  // Permissions
  const [permissions, setPermissions] = useState<UserPermissions>({
    viewInventory: true,
    recordUsage: true,
    viewAllUsageHistory: false,
    createStockIn: false,
    adjustStock: false,
    importExcel: false,
    viewReports: false,
    addChemical: false,
    editChemical: false,
    archiveChemical: false,
    deleteChemical: false,
    manageUsers: false,
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setRole(user.role);

      // Populate limits
      const lim = user.limits;
      if (lim) {
        if (lim.maxUsagePerTransaction === null || lim.maxUsagePerTransaction === undefined) {
          setIsPerTxUnlimited(true);
          setMaxPerTx('150');
        } else {
          setIsPerTxUnlimited(false);
          setMaxPerTx(lim.maxUsagePerTransaction.toString());
        }

        if (lim.dailyUsageLimit === null || lim.dailyUsageLimit === undefined) {
          setIsDailyUnlimited(true);
          setDailyLimit('500');
        } else {
          setIsDailyUnlimited(false);
          setDailyLimit(lim.dailyUsageLimit.toString());
        }

        if (lim.dailyTransactionCount === null || lim.dailyTransactionCount === undefined) {
          setIsCountUnlimited(true);
          setDailyCount('8');
        } else {
          setIsCountUnlimited(false);
          setDailyCount(lim.dailyTransactionCount.toString());
        }

        if (lim.maxStockInQuantity === null || lim.maxStockInQuantity === undefined) {
          setIsStockInUnlimited(true);
          setMaxStockIn('5');
        } else {
          setIsStockInUnlimited(false);
          setMaxStockIn(lim.maxStockInQuantity.toString());
        }
      } else {
        // Defaults
        if (user.role === 'MANAGER' || user.role === 'ADMIN') {
          setIsPerTxUnlimited(true);
          setIsDailyUnlimited(true);
          setIsCountUnlimited(true);
          setIsStockInUnlimited(true);
        } else {
          setIsPerTxUnlimited(false);
          setMaxPerTx('150');
          setIsDailyUnlimited(false);
          setDailyLimit('500');
          setIsCountUnlimited(false);
          setDailyCount('8');
          setIsStockInUnlimited(false);
          setMaxStockIn('5');
        }
      }

      // Populate permissions
      const perm = user.permissions;
      if (perm) {
        setPermissions({
          viewInventory: perm.viewInventory ?? true,
          recordUsage: perm.recordUsage ?? true,
          viewAllUsageHistory: perm.viewAllUsageHistory ?? (user.role === 'MANAGER'),
          createStockIn: perm.createStockIn ?? (user.role === 'MANAGER'),
          adjustStock: perm.adjustStock ?? (user.role === 'MANAGER'),
          importExcel: perm.importExcel ?? (user.role === 'MANAGER'),
          viewReports: perm.viewReports ?? true,
          addChemical: perm.addChemical ?? (user.role === 'MANAGER'),
          editChemical: perm.editChemical ?? (user.role === 'MANAGER'),
          archiveChemical: perm.archiveChemical ?? (user.role === 'MANAGER'),
          deleteChemical: perm.deleteChemical ?? (user.role === 'MANAGER'),
          manageUsers: perm.manageUsers ?? (user.role === 'MANAGER'),
        });
      } else {
        const isMgr = user.role === 'MANAGER' || user.role === 'ADMIN';
        setPermissions({
          viewInventory: true,
          recordUsage: true,
          viewAllUsageHistory: isMgr,
          createStockIn: isMgr,
          adjustStock: isMgr,
          importExcel: isMgr,
          viewReports: true,
          addChemical: isMgr,
          editChemical: isMgr,
          archiveChemical: isMgr,
          deleteChemical: isMgr,
          manageUsers: isMgr,
        });
      }
    }
  }, [user]);

  if (!isOpen || !user) return null;

  // Presets
  const applyPreset = (preset: 'RESEARCHER' | 'INTERN' | 'TECHNICIAN' | 'MANAGER') => {
    if (preset === 'RESEARCHER') {
      setRole('USER');
      setIsPerTxUnlimited(false);
      setMaxPerTx('150');
      setIsDailyUnlimited(false);
      setDailyLimit('500');
      setIsCountUnlimited(false);
      setDailyCount('8');
      setIsStockInUnlimited(false);
      setMaxStockIn('5');
      setPermissions({
        viewInventory: true,
        recordUsage: true,
        viewAllUsageHistory: false, // only see own usage
        createStockIn: false,
        adjustStock: false,
        importExcel: false,
        viewReports: true,
        addChemical: false,
        editChemical: false,
        archiveChemical: false,
        deleteChemical: false,
        manageUsers: false,
      });
    } else if (preset === 'INTERN') {
      setRole('USER');
      setIsPerTxUnlimited(false);
      setMaxPerTx('50');
      setIsDailyUnlimited(false);
      setDailyLimit('150');
      setIsCountUnlimited(false);
      setDailyCount('3');
      setIsStockInUnlimited(false);
      setMaxStockIn('0');
      setPermissions({
        viewInventory: true,
        recordUsage: true,
        viewAllUsageHistory: false,
        createStockIn: false,
        adjustStock: false,
        importExcel: false,
        viewReports: false,
        addChemical: false,
        editChemical: false,
        archiveChemical: false,
        deleteChemical: false,
        manageUsers: false,
      });
    } else if (preset === 'TECHNICIAN') {
      setRole('USER');
      setIsPerTxUnlimited(false);
      setMaxPerTx('500');
      setIsDailyUnlimited(false);
      setDailyLimit('2000');
      setIsCountUnlimited(false);
      setDailyCount('20');
      setIsStockInUnlimited(false);
      setMaxStockIn('20');
      setPermissions({
        viewInventory: true,
        recordUsage: true,
        viewAllUsageHistory: true,
        createStockIn: true,
        adjustStock: false,
        importExcel: false,
        viewReports: true,
        addChemical: false,
        editChemical: false,
        archiveChemical: false,
        deleteChemical: false,
        manageUsers: false,
      });
    } else if (preset === 'MANAGER') {
      setRole('MANAGER');
      setIsPerTxUnlimited(true);
      setIsDailyUnlimited(true);
      setIsCountUnlimited(true);
      setIsStockInUnlimited(true);
      setPermissions({
        viewInventory: true,
        recordUsage: true,
        viewAllUsageHistory: true,
        createStockIn: true,
        adjustStock: true,
        importExcel: true,
        viewReports: true,
        addChemical: true,
        editChemical: true,
        archiveChemical: true,
        deleteChemical: true,
        manageUsers: true,
      });
    }
  };

  const handleSave = () => {
    // 1. Build limits
    const updatedLimits: UserLimits = {
      maxUsagePerTransaction: isPerTxUnlimited ? null : parseFloat(maxPerTx) || 100,
      dailyUsageLimit: isDailyUnlimited ? null : parseFloat(dailyLimit) || 500,
      dailyTransactionCount: isCountUnlimited ? null : parseInt(dailyCount, 10) || 10,
      maxStockInQuantity: isStockInUnlimited ? null : parseFloat(maxStockIn) || 10,
    };

    // 2. Change role if modified
    if (role !== user.role) {
      const roleRes = changeUserRole(user.id, role);
      if (!roleRes.success) {
        setFeedback({ type: 'error', message: roleRes.message });
        return;
      }
    }

    // 3. Save limits
    const limitRes = updateUserLimits(user.id, updatedLimits);
    if (!limitRes.success) {
      setFeedback({ type: 'error', message: limitRes.message });
      return;
    }

    // 4. Save permissions
    const permRes = updateUserPermissions(user.id, permissions);
    if (!permRes.success) {
      setFeedback({ type: 'error', message: permRes.message });
      return;
    }

    setFeedback({ type: 'success', message: `Đã lưu thành công quyền và hạn mức cho ${user.name}!` });
    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 900);
  };

  const togglePermission = (key: keyof UserPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{user.name}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                  {role}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">{user.email} • {user.department}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">{feedback.message}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Gán nhanh mẫu phân quyền (Quick Presets)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('RESEARCHER')}
                className="p-2.5 text-left border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700">Nghiên cứu sinh</div>
                <div className="text-[10px] text-slate-500 mt-0.5">150 mL/lần • 500 mL/ngày</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('INTERN')}
                className="p-2.5 text-left border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700">Thực tập sinh</div>
                <div className="text-[10px] text-slate-500 mt-0.5">50 mL/lần • Giới hạn chặt</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('TECHNICIAN')}
                className="p-2.5 text-left border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-cyan-700">Kỹ thuật viên</div>
                <div className="text-[10px] text-slate-500 mt-0.5">500 mL/lần • Được nhập kho</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('MANAGER')}
                className="p-2.5 text-left border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 rounded-xl transition-colors cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700">Quản lý (Manager)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Toàn quyền • Không giới hạn</div>
              </button>
            </div>
          </div>

          {/* Section 1: Cấu hình giới hạn số lượng (User Limits) */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Giới Hạn Thao Tác Chi Tiết (Operating Limits)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Limit 1: Usage per transaction */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Lượng dùng tối đa / 1 lần (mL)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 font-medium">
                    <input
                      type="checkbox"
                      checked={isPerTxUnlimited}
                      onChange={(e) => setIsPerTxUnlimited(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Không giới hạn</span>
                  </label>
                </div>
                {!isPerTxUnlimited ? (
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={maxPerTx}
                      onChange={(e) => setMaxPerTx(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-purple-600"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 font-mono text-xs">mL</span>
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                    ∞ Không giới hạn định mức mỗi lần
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Nếu người dùng nhập vượt số này, app yêu cầu Quản lý phê duyệt.</p>
              </div>

              {/* Limit 2: Daily usage limit */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Lượng dùng tối đa trong 1 ngày (mL)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 font-medium">
                    <input
                      type="checkbox"
                      checked={isDailyUnlimited}
                      onChange={(e) => setIsDailyUnlimited(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Không giới hạn</span>
                  </label>
                </div>
                {!isDailyUnlimited ? (
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      placeholder="500"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-purple-600"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 font-mono text-xs">mL/ngày</span>
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                    ∞ Không giới hạn lượng dùng cả ngày
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Cộng dồn tất cả các lần dùng trong ngày theo thời gian thực.</p>
              </div>

              {/* Limit 3: Daily transaction count */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Số lần ghi nhận tối đa / ngày</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 font-medium">
                    <input
                      type="checkbox"
                      checked={isCountUnlimited}
                      onChange={(e) => setIsCountUnlimited(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Không giới hạn</span>
                  </label>
                </div>
                {!isCountUnlimited ? (
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={dailyCount}
                      onChange={(e) => setDailyCount(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-purple-600"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 font-mono text-xs">lần</span>
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                    ∞ Không giới hạn số lần thực hiện
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Ngăn ngừa spam hoặc ghi nhận sai lệch liên tiếp nhiều lần.</p>
              </div>

              {/* Limit 4: Max Stock In Quantity */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Lượng nhập kho tối đa / 1 lần</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 font-medium">
                    <input
                      type="checkbox"
                      checked={isStockInUnlimited}
                      onChange={(e) => setIsStockInUnlimited(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Không giới hạn</span>
                  </label>
                </div>
                {!isStockInUnlimited ? (
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={maxStockIn}
                      onChange={(e) => setMaxStockIn(e.target.value)}
                      placeholder="5"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-purple-600"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 font-mono text-xs">chai / đơn vị</span>
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 font-medium bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100">
                    ∞ Không giới hạn số lượng nhập
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Kiểm soát quy mô lô hóa chất được phép đưa vào hệ thống.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Phân quyền tính năng (Feature Permissions) */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Quyền Truy Cập Tính Năng (Module Permissions)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">Bật / Tắt theo từng người dùng</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Record Usage */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.recordUsage}
                  onChange={() => togglePermission('recordUsage')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Ghi nhận sử dụng hóa chất</div>
                  <div className="text-[11px] text-slate-500">Cho phép tạo phiếu sử dụng trừ tồn kho chai</div>
                </div>
              </label>

              {/* View all usage history (User requirement) */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.viewAllUsageHistory}
                  onChange={() => togglePermission('viewAllUsageHistory')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Xem lịch sử của toàn bộ lab</div>
                  <div className="text-[11px] text-slate-500">Nếu tắt: Chỉ xem được lịch sử của chính mình</div>
                </div>
              </label>

              {/* Create Stock In */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.createStockIn}
                  onChange={() => togglePermission('createStockIn')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Nhập kho hóa chất (Stock In)</div>
                  <div className="text-[11px] text-slate-500">Tạo mã chai, lô mới và tăng tồn kho</div>
                </div>
              </label>

              {/* Add Chemical */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.addChemical}
                  onChange={() => togglePermission('addChemical')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Thêm hóa chất mới vào danh mục</div>
                  <div className="text-[11px] text-slate-500">Đăng ký CAS, nhóm, thông số an toàn mới</div>
                </div>
              </label>

              {/* Edit Chemical */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.editChemical}
                  onChange={() => togglePermission('editChemical')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Chỉnh sửa thông tin hóa chất & chai</div>
                  <div className="text-[11px] text-slate-500">Sửa ngưỡng cảnh báo, hạn dùng, vị trí tủ</div>
                </div>
              </label>

              {/* Adjust Stock */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.adjustStock}
                  onChange={() => togglePermission('adjustStock')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Điều chỉnh tồn kho thực tế (Audit/Adjust)</div>
                  <div className="text-[11px] text-slate-500">Cân chỉnh hao hụt, bay hơi, chênh lệch kiểm kê</div>
                </div>
              </label>

              {/* View Reports */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.viewReports}
                  onChange={() => togglePermission('viewReports')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Xem Báo cáo Thống kê & Phân tích</div>
                  <div className="text-[11px] text-slate-500">Truy cập Dashboard báo cáo, chi phí, hao phí</div>
                </div>
              </label>

              {/* Import Excel */}
              <label className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.importExcel}
                  onChange={() => togglePermission('importExcel')}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-slate-900">Nhập dữ liệu hàng loạt từ Excel</div>
                  <div className="text-[11px] text-slate-500">Upload file Excel nhập hàng trăm hóa chất</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Lưu Quyền & Giới Hạn</span>
          </button>
        </div>
      </div>
    </div>
  );
};

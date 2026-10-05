import React, { useMemo } from 'react';
import { useLab } from '../../context/LabContext';
import { getRoleDisplayName } from '../../utils/roleUtils';
import {
  X,
  User as UserIcon,
  Shield,
  Gauge,
  Calendar,
  Building,
  Mail,
  FlaskConical,
  Clock,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin?: () => void;
  onSignOut?: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose, onOpenLogin, onSignOut }) => {
  const { currentUser, isManager, transactions } = useLab();

  // Compute today's usage statistics for this user
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const userTodayTxs = transactions.filter(
      (t) =>
        t.type === 'USAGE' &&
        !t.isReversed &&
        (t.user === currentUser.name || t.userId === currentUser.id || t.userEmail === currentUser.email) &&
        t.date.startsWith(todayStr)
    );

    const totalQty = userTodayTxs.reduce((sum, t) => sum + (t.quantity || 0), 0);
    return {
      count: userTodayTxs.length,
      totalQty,
    };
  }, [transactions, currentUser]);

  // Overall user stats
  const overallStats = useMemo(() => {
    const userTxs = transactions.filter(
      (t) =>
        t.type === 'USAGE' &&
        !t.isReversed &&
        (t.user === currentUser.name || t.userId === currentUser.id || t.userEmail === currentUser.email)
    );
    const uniqueChemicals = new Set(userTxs.map((t) => t.chemicalId)).size;
    const totalVolume = userTxs.reduce((sum, t) => sum + (t.quantity || 0), 0);

    return {
      totalUsages: userTxs.length,
      uniqueChemicals,
      totalVolume,
    };
  }, [transactions, currentUser]);

  if (!isOpen) return null;

  const limits = currentUser.limits;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thông Tin Cá Nhân</h2>
              <p className="text-[11px] text-slate-500">Tài khoản & Hạn mức làm việc tại phòng lab</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* User Card */}
          <div className="p-4 rounded-2xl bg-linear-to-br from-slate-900 via-cyan-950 to-slate-900 text-white flex items-center gap-4 shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl font-black text-cyan-200 shrink-0 overflow-hidden">
              {currentUser.picture ? (
                <img src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white truncate">{currentUser.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    isManager ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30' : 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/30'
                  }`}
                >
                  {getRoleDisplayName(currentUser.role, currentUser.email)}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5 mt-1 truncate">
                <Mail className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="truncate">{currentUser.email}</span>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                <Building className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span>{currentUser.department || 'Phòng Thí Nghiệm'}</span>
              </div>
            </div>
          </div>

          {/* User Limits Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Gauge className="w-4 h-4 text-cyan-600" />
                <span>Hạn Mức Sử Dụng Cá Nhân</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Quy định phòng lab</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="text-[10px] font-semibold text-slate-500">Giới hạn mỗi lần chiết</div>
                <div className="text-sm font-black text-slate-900 mt-1 font-mono">
                  {limits?.maxUsagePerTransaction ? `${limits.maxUsagePerTransaction} mL / g` : 'Không giới hạn'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tối đa cho 1 giao dịch</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="text-[10px] font-semibold text-slate-500">Hạn mức theo ngày</div>
                <div className="text-sm font-black text-slate-900 mt-1 font-mono">
                  {limits?.dailyUsageLimit ? `${limits.dailyUsageLimit} mL / g` : 'Không giới hạn'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Đã dùng hôm nay: <strong className="text-cyan-700">{todayStats.totalQty}</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="text-[10px] font-semibold text-slate-500">Số lượt thao tác / ngày</div>
                <div className="text-sm font-black text-slate-900 mt-1 font-mono">
                  {limits?.dailyTransactionCount ? `${limits.dailyTransactionCount} lượt` : 'Không giới hạn'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Hôm nay: <strong className="text-cyan-700">{todayStats.count} lượt</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="text-[10px] font-semibold text-slate-500">Trạng thái tài khoản</div>
                <div className="flex items-center gap-1.5 mt-1 text-sm font-black text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{currentUser.status === 'ACTIVE' ? 'Đã kích hoạt' : 'Chờ duyệt'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Quyền ghi sử dụng đầy đủ</div>
              </div>
            </div>
          </div>

          {/* Overall Stats Section */}
          <div className="p-4 bg-cyan-50/50 border border-cyan-200/60 rounded-2xl space-y-2">
            <div className="text-xs font-bold text-cyan-950 flex items-center gap-1.5">
              <FlaskConical className="w-4 h-4 text-cyan-700" />
              <span>Thống Kê Hoạt Động Của Bạn</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                <div className="text-base font-extrabold text-cyan-900 font-mono">{overallStats.totalUsages}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Lần sử dụng</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                <div className="text-base font-extrabold text-cyan-900 font-mono">{overallStats.uniqueChemicals}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Hóa chất khác nhau</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-cyan-100 shadow-2xs">
                <div className="text-base font-extrabold text-cyan-900 font-mono">{overallStats.totalVolume}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tổng lượng (mL/g)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={() => {
              onClose();
              if (onSignOut) {
                onSignOut();
              } else if (onOpenLogin) {
                onOpenLogin();
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng Xuất</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

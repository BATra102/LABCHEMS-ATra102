import React, { useState, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { exportUsageHistoryCSV } from '../utils/exportImport';
import { Plus, Download, Search, Filter, User, FolderKanban, Calendar, FlaskConical, Lock, QrCode, Archive } from 'lucide-react';

interface Props {
  onOpenRecordUsage: () => void;
  onOpenQrScanner?: () => void;
}

export const UsageView: React.FC<Props> = ({ onOpenRecordUsage, onOpenQrScanner }) => {
  const { transactions, chemicals, bottles, currentUser, isManager, canExportHistory } = useLab();

  // Rule: "lab manager xem được lịch sử dùng của các thành viên khác, còn user thì không được"
  const canViewAllUsage =
    isManager ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'LAB_MANAGER' ||
    !!currentUser.permissions?.viewAllUsageHistory;

  // Filters (Page 12)
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [filterChemical, setFilterChemical] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterBottle, setFilterBottle] = useState<string>('ALL');
  const [searchNote, setSearchNote] = useState<string>('');
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  const usageTransactions = useMemo(() => {
    const allUsages = transactions.filter((t) => t.type === 'USAGE');
    if (canViewAllUsage) return allUsages;
    return allUsages.filter((t) => t.user === currentUser.name);
  }, [transactions, canViewAllUsage, currentUser.name]);

  // Distinct filter values
  const uniqueUsers = useMemo(() => Array.from(new Set(usageTransactions.map((t) => t.user))), [usageTransactions]);
  const uniqueChemicals = useMemo(() => Array.from(new Set(usageTransactions.map((t) => t.chemicalName))), [usageTransactions]);
  const uniqueProjects = useMemo(
    () => Array.from(new Set(usageTransactions.map((t) => t.project).filter(Boolean) as string[])),
    [usageTransactions]
  );
  const uniqueBottles = useMemo(
    () => Array.from(new Set(usageTransactions.map((t) => t.bottleCode).filter(Boolean) as string[])),
    [usageTransactions]
  );

  // Filtered list
  const filteredList = useMemo(() => {
    return usageTransactions.filter((t) => {
      if (filterUser !== 'ALL' && t.user !== filterUser) return false;
      if (filterChemical !== 'ALL' && t.chemicalName !== filterChemical) return false;
      if (filterProject !== 'ALL' && t.project !== filterProject) return false;
      if (filterBottle !== 'ALL' && t.bottleCode !== filterBottle) return false;
      if (searchNote.trim()) {
        const q = searchNote.toLowerCase();
        const m =
          (t.purpose && t.purpose.toLowerCase().includes(q)) ||
          (t.experiment && t.experiment.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q));
        if (!m) return false;
      }
      return true;
    });
  }, [usageTransactions, filterUser, filterChemical, filterProject, filterBottle, searchNote]);

  // Compute User Breakdown for this month (Pages 26-27 & 31: "Tháng này Trà đã dùng bao nhiêu hexane?")
  const userUsageSummary = useMemo(() => {
    const summary: Record<string, Record<string, { total: number; unit: string }>> = {};

    usageTransactions.forEach((t) => {
      if (!summary[t.user]) {
        summary[t.user] = {};
      }
      if (!summary[t.user][t.chemicalName]) {
        summary[t.user][t.chemicalName] = { total: 0, unit: t.unit };
      }
      summary[t.user][t.chemicalName].total += t.quantity;
    });

    return summary;
  }, [usageTransactions]);

  const handleExport = () => {
    if (!canExportHistory) {
      setExportWarning('Chỉ Admin và Lab Manager mới có quyền xuất file lịch sử sử dụng. Tài khoản của bạn (' + currentUser.name + ') hiện có vai trò USER.');
      setTimeout(() => setExportWarning(null), 4000);
      return;
    }
    exportUsageHistoryCSV(usageTransactions);
  };

  return (
    <div className="space-y-6">
      {/* Title & Top Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {canViewAllUsage ? 'Nhật Ký Sử Dụng Hóa Chất Toàn Lab' : 'Lịch Sử Sử Dụng Của Tôi'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {canViewAllUsage
              ? 'Ghi nhận mọi lần xuất kho, khấu trừ chính xác theo chai, lưu vết đề tài và người thao tác'
              : 'Theo dõi toàn bộ các lần bạn chiết dùng hóa chất, số lượng trừ tồn kho và ghi chú đề tài'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExportHistory && (
            <button
              onClick={handleExport}
              className="px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border text-slate-700 bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
              title="Xuất file CSV nhật ký sử dụng"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Nhật Ký CSV</span>
            </button>
          )}
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3.5 py-2 text-xs font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow-cyan-500/20 cursor-pointer active:scale-95"
              title="Quét mã QR tem dán chai bằng Camera (Mục 4)"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-200" />
              <span>Quét QR Chai</span>
            </button>
          )}
          <button
            onClick={onOpenRecordUsage}
            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ghi Sử Dụng (Record Usage)</span>
          </button>
        </div>
      </div>

      {exportWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
          <span>{exportWarning}</span>
          <button onClick={() => setExportWarning(null)} className="text-amber-600 font-bold ml-2">×</button>
        </div>
      )}

      {/* User Usage Spotlight Card (Pages 26-27: "USER USAGE & USER DASHBOARD") */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <User className="w-4 h-4 text-cyan-600" />
            <span>Thống Kê Khối Lượng Sử Dụng Theo Người Làm Lab (User Usage)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Tháng 10/2026</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(userUsageSummary).map(([userName, chemData]) => (
            <div
              key={userName}
              className={`p-3 rounded-lg border text-xs ${
                userName === currentUser.name
                  ? 'bg-cyan-50/40 border-cyan-200'
                  : 'bg-slate-50/60 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between font-semibold text-slate-900 mb-2">
                <span>{userName}</span>
                {userName === currentUser.name && (
                  <span className="text-[10px] text-cyan-700 font-mono bg-cyan-100/70 px-1.5 py-0.2 rounded">
                    Tài khoản của bạn
                  </span>
                )}
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {Object.entries(chemData).map(([chemName, qtyInfo]) => (
                  <div key={chemName} className="flex items-center justify-between text-slate-600">
                    <span className="truncate max-w-[140px]">{chemName}:</span>
                    <span className="font-bold text-slate-900">
                      {Math.round(qtyInfo.total * 100) / 100} {qtyInfo.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Toolbar (Page 12) */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {/* Filter by User */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-medium flex items-center justify-between">
              <span>Người làm</span>
              {!canViewAllUsage && (
                <span className="text-[10px] text-amber-700 flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> Chỉ cá nhân
                </span>
              )}
            </label>
            <select
              value={canViewAllUsage ? filterUser : currentUser.name}
              disabled={!canViewAllUsage}
              onChange={(e) => setFilterUser(e.target.value)}
              className={`w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden ${
                !canViewAllUsage ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
              }`}
            >
              {canViewAllUsage ? (
                <>
                  <option value="ALL">Tất cả người làm</option>
                  {uniqueUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </>
              ) : (
                <option value={currentUser.name}>{currentUser.name} (Tài khoản của bạn)</option>
              )}
            </select>
          </div>

          {/* Filter by Chemical */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-medium">Hóa chất</label>
            <select
              value={filterChemical}
              onChange={(e) => setFilterChemical(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">Tất cả hóa chất</option>
              {uniqueChemicals.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Project */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-medium">Dự án / Đề tài</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">Tất cả đề tài</option>
              {uniqueProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Bottle */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 font-medium">Mã chai (Bottle ID)</label>
            <select
              value={filterBottle}
              onChange={(e) => setFilterBottle(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="ALL">Tất cả chai</option>
              {uniqueBottles.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Usage History Table (Page 11-12) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">
            Chi Tiết Lịch Sử Sử Dụng ({filteredList.length} lượt)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Bảo lưu lịch sử không bị xóa</span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Không tìm thấy lượt ghi nhận sử dụng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <>
            {/* Mobile View: Vertical Cards (Section 16: Lịch sử Mobile) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredList.map((t) => {
                const chem = chemicals.find((c) => c.id === t.chemicalId);
                const isArchived = chem?.status === 'ARCHIVED';

                return (
                  <div key={t.id} className="p-4 space-y-2 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{t.date}</span>
                      {t.bottleCode && (
                        <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 font-bold border border-cyan-100">
                          {t.bottleCode}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-slate-900 leading-snug flex items-center gap-1.5 flex-wrap">
                          <span>{t.chemicalName}</span>
                          {isArchived && (
                            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                              Lưu trữ
                            </span>
                          )}
                        </h4>
                        {t.user && canViewAllUsage && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Người dùng: <span className="font-medium text-slate-800">{t.user}</span>
                          </p>
                        )}
                        {t.project && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Đề tài: <span className="font-medium text-slate-700">{t.project}</span>
                          </p>
                        )}
                        {(t.purpose || t.experiment) && (
                          <p className="text-[11px] text-slate-400 mt-0.5 italic">
                            "{t.purpose || t.experiment}"
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold text-rose-600 font-mono block">
                          -{t.quantity} {t.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          còn {t.newStock} {t.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Ngày</th>
                  <th className="px-4 py-3 font-semibold">Hóa chất</th>
                  <th className="px-4 py-3 font-semibold">Mã chai</th>
                  <th className="px-4 py-3 font-semibold">Lượng dùng</th>
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Dự án & Thí nghiệm</th>
                  <th className="px-4 py-3 font-semibold">Tồn chai sau dùng</th>
                  <th className="px-6 py-3 font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((t) => {
                  const chem = chemicals.find((c) => c.id === t.chemicalId);
                  const isArchived = chem?.status === 'ARCHIVED';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{t.chemicalName}</span>
                          {isArchived && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              <Archive className="w-2.5 h-2.5" />
                              <span>Đã xóa / Lưu trữ</span>
                            </span>
                          )}
                        </div>
                      </td>
                    <td className="px-4 py-3.5 font-mono text-cyan-700 font-medium">
                      {t.bottleCode || 'Tự động trừ'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-rose-600">
                      -{t.quantity} {t.unit}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {t.user}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="font-medium text-slate-800 truncate max-w-[180px]">
                        {t.project || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {t.experiment || t.purpose || 'Thí nghiệm'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800">
                      {t.newStock} {t.unit}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 max-w-[200px] truncate text-[11px]">
                      {t.notes || '—'}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
    </div>
  );
};

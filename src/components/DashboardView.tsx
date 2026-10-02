import React, { useState } from 'react';
import { useLab } from '../context/LabContext';
import { getStockStatusLabel, getExpiryStatusLabel } from '../utils/status';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldAlert,
  Package,
  ArrowRight,
  TrendingDown,
  BarChart3,
  FlaskConical,
  Users,
  Mail,
  ShieldCheck,
  CheckCircle2,
  FileText,
  UserCheck,
  Sparkles,
  BookOpen,
  QrCode,
} from 'lucide-react';
import { DashboardStatsDetailModal, DashboardModalType } from './modals/DashboardStatsDetailModal';

interface Props {
  onNavigateToTab: (tab: any) => void;
  onOpenRecordUsage: (chemicalId?: string) => void;
  onOpenStockIn: (chemicalId?: string) => void;
  onOpenBottleDetail?: (bottleId: string) => void;
  onOpenEmailAlerts?: () => void;
  onOpenDiscrepancyModal?: () => void;
  onOpenUserGuide?: () => void;
  onOpenQrScanner?: () => void;
}

export const DashboardView: React.FC<Props> = ({
  onNavigateToTab,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenBottleDetail,
  onOpenEmailAlerts,
  onOpenDiscrepancyModal,
  onOpenUserGuide,
  onOpenQrScanner,
}) => {
  const [detailModalType, setDetailModalType] = useState<DashboardModalType | null>(null);
  const {
    chemicals,
    bottles,
    transactions,
    currentUser,
    users,
    isManager,
    pendingUsersCount,
    approveUser,
    emailAlertLogs,
    emailSettings,
    discrepancyReports,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
  } = useLab();

  // Metrics computation - Active chemicals only (Mục 37-39: Ẩn hóa chất đã lưu trữ)
  const activeChemicals = chemicals.filter((c) => c.status !== 'ARCHIVED');
  const totalChemicalsCount = activeChemicals.length;
  let lowStockCount = 0;
  let criticalStockCount = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;
  const categoryStats: Record<string, { count: number }> = {};

  activeChemicals.forEach((c) => {
    const stockStatus = getChemicalStockStatus(c.id);
    const expiryStatus = getChemicalExpiryStatus(c.id);

    if (stockStatus === 'CRITICAL') criticalStockCount++;
    else if (stockStatus === 'LOW_STOCK') lowStockCount++;

    if (expiryStatus === 'EXPIRED') expiredCount++;
    else if (expiryStatus === 'EXPIRING_SOON') expiringSoonCount++;

    if (!categoryStats[c.category]) {
      categoryStats[c.category] = { count: 0 };
    }
    categoryStats[c.category].count += 1;
  });

  // Calculate usage frequency from transactions
  const usageFrequency: Record<string, { name: string; count: number; totalQty: number; unit: string }> = {};
  transactions
    .filter((t) => t.type === 'USAGE' && !t.isReversed)
    .forEach((t) => {
      if (!usageFrequency[t.chemicalId]) {
        usageFrequency[t.chemicalId] = {
          name: t.chemicalName,
          count: 0,
          totalQty: 0,
          unit: t.unit,
        };
      }
      usageFrequency[t.chemicalId].count += 1;
      usageFrequency[t.chemicalId].totalQty += t.quantity;
    });

  const topUsedChemicals = Object.values(usageFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // User personal transactions
  const myRecentUsage = transactions
    .filter((t) => t.type === 'USAGE' && t.user === currentUser.name)
    .slice(0, 5);

  // Pending user approvals
  const pendingApprovals = users.filter((u) => u.status === 'PENDING');
  const pendingDiscrepancies = discrepancyReports.filter((d) => d.status === 'PENDING');

  // Attention list - Active chemicals only
  const attentionList = activeChemicals
    .filter((c) => {
      const s = getChemicalStockStatus(c.id);
      const e = getChemicalExpiryStatus(c.id);
      return s === 'CRITICAL' || s === 'LOW_STOCK' || e === 'EXPIRED' || e === 'EXPIRING_SOON';
    })
    .sort((a, b) => {
      const sA = getChemicalStockStatus(a.id) === 'CRITICAL' ? 0 : 1;
      const sB = getChemicalStockStatus(b.id) === 'CRITICAL' ? 0 : 1;
      return sA - sB;
    });

  const categoryEntries = Object.entries(categoryStats).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      {/* 1. PENDING APPROVAL WARNING BANNER (Section 39 & 57) */}
      {currentUser.status === 'PENDING' && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                Tài khoản Google của bạn đang chờ Quản lý phê duyệt (Pending Approval)
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Bạn đã đăng nhập với tài khoản <strong>{currentUser.email}</strong>. Bạn có thể tra cứu thông tin hóa chất, vị trí lưu trữ và số CAS. Quyền ghi nhận sử dụng sẽ được mở ngay khi Quản lý phòng lab (Manager) duyệt tài khoản.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('dashboard')}
            className="px-3.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors shrink-0"
          >
            Đang chờ duyệt...
          </button>
        </div>
      )}

      {/* 2. Top Header & Primary Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isManager ? 'Bảng Điều Khiển Quản Lý (Manager Dashboard)' : 'Tổng Quan Phòng Thí Nghiệm'}
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isManager ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hệ thống quản lý hóa chất LabChem · Đăng nhập: <strong>{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick QR Scanner & Record Usage on Dashboard (Section 4) */}
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-cyan-500/20 cursor-pointer active:scale-95 ring-1 ring-cyan-400/40"
              title="Quét mã QR tem dán chai / hóa chất bằng Camera"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-200" />
              <span>Quét QR Chai</span>
            </button>
          )}

          <button
            onClick={() => onOpenRecordUsage()}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow-emerald-500/20 cursor-pointer active:scale-95 ring-1 ring-emerald-400/40"
            title="Ghi nhận sử dụng và trừ tồn kho chai"
          >
            <span>+ Ghi Sử Dụng</span>
          </button>

          {/* Discrepancy report button for all users */}
          {onOpenDiscrepancyModal && (
            <button
              onClick={onOpenDiscrepancyModal}
              className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Báo Lệch Tồn</span>
            </button>
          )}

          {/* Automated Email alert log link */}
          {onOpenEmailAlerts && (
            <button
              onClick={onOpenEmailAlerts}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Xem lịch sử email tự động gửi khi tồn kho thấp"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Cảnh Báo ({emailAlertLogs.length})</span>
            </button>
          )}

          {/* User Guide button */}
          {onOpenUserGuide && (
            <button
              onClick={onOpenUserGuide}
              className="px-3 py-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Xem tài liệu và hướng dẫn sử dụng phần mềm"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-700" />
              <span>Hướng Dẫn</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToTab('purchase')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>Mua Sắm</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. MANAGER PENDING APPROVALS ALERT BAR (Section 55 & 57) */}
      {isManager && pendingApprovals.length > 0 && (
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-purple-900">
                {pendingApprovals.length} Tài Khoản Google Đang Chờ Duyệt (Pending Approvals)
              </div>
              <p className="text-xs text-purple-700 mt-0.5">
                Người dùng mới cần phê duyệt của Quản lý để được ghi nhận sử dụng hóa chất.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => approveUser(pendingApprovals[0].id)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Duyệt Nhanh ({pendingApprovals[0].name})</span>
            </button>
            <button
              onClick={() => onNavigateToTab('users')}
              className="px-3 py-1.5 text-xs font-semibold text-purple-800 hover:underline"
            >
              Xem tất cả →
            </button>
          </div>
        </div>
      )}

      {/* 4. TOP KPI CARDS – MỖI Ô LÀ CỬA VÀO XEM CHI TIẾT (Mục 5) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Tổng hóa chất */}
        <div
          onClick={() => setDetailModalType('TOTAL_CHEMICALS')}
          className="p-4 bg-white hover:bg-blue-50/30 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium group-hover:text-blue-700 transition-colors">Tổng hóa chất</span>
            <Package className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 group-hover:text-blue-900 tabular-nums">
            {totalChemicalsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono flex items-center justify-between">
            <span>{bottles.length} chai/lọ</span>
            <span className="text-[10px] text-blue-600 font-semibold group-hover:underline">Chi tiết →</span>
          </div>
        </div>

        {/* Card 2: Kho nguy cấp */}
        <div
          onClick={() => setDetailModalType('CRITICAL_STOCK')}
          className="p-4 bg-rose-50/60 hover:bg-rose-50 rounded-2xl border border-rose-200 hover:border-rose-400 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-rose-700 text-xs mb-2 font-medium">
            <span className="group-hover:text-rose-900 transition-colors">Kho nguy cấp</span>
            <AlertOctagon className="w-4 h-4 text-rose-600 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 group-hover:text-rose-900 tabular-nums">
            {criticalStockCount}
          </div>
          <div className="text-[11px] text-rose-600 mt-1 flex items-center justify-between">
            <span>≤ Mức tối thiểu</span>
            <span className="text-[10px] text-rose-700 font-bold group-hover:underline">Xem ngay →</span>
          </div>
        </div>

        {/* Card 3: Sắp hết (Low Stock) */}
        <div
          onClick={() => setDetailModalType('LOW_STOCK')}
          className="p-4 bg-amber-50/60 hover:bg-amber-50 rounded-2xl border border-amber-200 hover:border-amber-400 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-amber-700 text-xs mb-2 font-medium">
            <span className="group-hover:text-amber-900 transition-colors">Sắp hết (Low)</span>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 group-hover:text-amber-900 tabular-nums">
            {lowStockCount}
          </div>
          <div className="text-[11px] text-amber-600 mt-1 flex items-center justify-between">
            <span>Mức cảnh báo</span>
            <span className="text-[10px] text-amber-800 font-semibold group-hover:underline">Chi tiết →</span>
          </div>
        </div>

        {/* Card 4: Hạn ≤ 90 ngày */}
        <div
          onClick={() => setDetailModalType('EXPIRING_SOON')}
          className="p-4 bg-orange-50/60 hover:bg-orange-50 rounded-2xl border border-orange-200 hover:border-orange-400 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-orange-700 text-xs mb-2 font-medium">
            <span className="group-hover:text-orange-900 transition-colors">Hạn ≤ 90 ngày</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-orange-700 group-hover:text-orange-900 tabular-nums">
            {expiringSoonCount}
          </div>
          <div className="text-[11px] text-orange-600 mt-1 flex items-center justify-between">
            <span>Ưu tiên dùng</span>
            <span className="text-[10px] text-orange-800 font-semibold group-hover:underline">Xem hạn →</span>
          </div>
        </div>

        {/* Card 5: Đã hết hạn */}
        <div
          onClick={() => setDetailModalType('EXPIRED')}
          className="p-4 bg-slate-50 hover:bg-rose-50/50 rounded-2xl border border-slate-300 hover:border-rose-300 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-slate-700 text-xs mb-2 font-medium">
            <span className="group-hover:text-rose-700 transition-colors">Đã hết hạn</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 group-hover:text-rose-900 tabular-nums">
            {expiredCount}
          </div>
          <div className="text-[11px] text-rose-600 mt-1 font-medium flex items-center justify-between">
            <span>Khóa sử dụng</span>
            <span className="text-[10px] text-rose-700 font-bold group-hover:underline">Tiêu hủy →</span>
          </div>
        </div>

        {/* Card 6: Chai đang mở (In-Use) */}
        <div
          onClick={() => setDetailModalType('IN_USE')}
          className="p-4 bg-cyan-50/50 hover:bg-cyan-50 rounded-2xl border border-cyan-200 hover:border-cyan-400 shadow-xs hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-cyan-800 text-xs mb-2 font-medium">
            <span className="group-hover:text-cyan-900 transition-colors">Chai đang mở</span>
            <FlaskConical className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-800 group-hover:text-cyan-900 tabular-nums">
            {bottles.filter((b) => b.status === 'IN_USE' || (b.openedDate && b.status !== 'DISPOSED')).length}
          </div>
          <div className="text-[11px] text-cyan-700 mt-1 font-mono flex items-center justify-between">
            <span>{bottles.filter((b) => !b.openedDate && b.status !== 'DISPOSED').length} chai mới</span>
            <span className="text-[10px] text-cyan-900 font-bold group-hover:underline">Theo dõi →</span>
          </div>
        </div>
      </div>

      {/* 5. MIDDLE SECTION: AUTOMATED EMAIL ALERTS & ACTIVITY FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automated Low Stock Email System Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Thông Báo Email Tự Động Tới Manager Khi Tồn Kho Thấp
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold">
              {emailSettings.autoEmailOnLowStock ? 'ĐANG BẬT' : 'TẮT'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Hệ thống tự động kích hoạt email cảnh báo gửi trực tiếp đến hộp thư của Quản lý: <strong className="font-mono text-slate-800">{emailSettings.managerEmail}</strong> mỗi khi một hóa chất chạm ngưỡng cảnh báo (Warning) hoặc mức tối thiểu (Min).
          </p>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Email gần nhất được gửi:</span>
              <span className="font-mono font-bold text-slate-700">
                {emailAlertLogs.length > 0
                  ? new Date(emailAlertLogs[0].timestamp).toLocaleString('vi-VN')
                  : 'Chưa có'}
              </span>
            </div>
            {emailAlertLogs.length > 0 && (
              <div className="text-slate-800 font-semibold text-[11px] truncate">
                {emailAlertLogs[0].subject}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 text-[11px]">Tổng số: {emailAlertLogs.length} email đã gửi</span>
            {onOpenEmailAlerts && (
              <button
                onClick={onOpenEmailAlerts}
                className="text-cyan-700 hover:text-cyan-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Xem hộp thư & cấu hình →</span>
              </button>
            )}
          </div>
        </div>

        {/* Most frequently used / My recent usage */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {isManager ? 'Hóa Chất Sử Dụng Phổ Biến' : 'Giao Dịch Gần Nhất Của Tôi'}
              </h2>
            </div>
            <button
              onClick={() => onNavigateToTab('usage')}
              className="text-xs text-cyan-700 hover:text-cyan-800 font-semibold cursor-pointer"
            >
              Xem tất cả →
            </button>
          </div>

          <div className="space-y-2.5">
            {(isManager ? topUsedChemicals : myRecentUsage).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Chưa có giao dịch sử dụng nào.</p>
            ) : isManager ? (
              topUsedChemicals.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-mono font-bold text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.count} lượt thao tác</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-900">
                      {Math.round(item.totalQty * 100) / 100} {item.unit}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              myRecentUsage.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{tx.chemicalName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Chai {tx.bottleCode} · {tx.date}
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-cyan-800">
                    -{tx.quantity} {tx.unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 6. BOTTOM SECTION: CHEMICALS REQUIRING ATTENTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Hóa Chất Cần Chú Ý Ngay (Chemicals Requiring Attention)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {attentionList.length} hóa chất cần xử lý
          </span>
        </div>

        {attentionList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Tất cả hóa chất đều ở trạng thái an toàn, đủ tồn kho và còn hạn sử dụng tốt!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Hóa chất</th>
                  <th className="px-4 py-3 font-semibold">Tồn kho hiện tại</th>
                  <th className="px-4 py-3 font-semibold">Tối thiểu (Min)</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái kho</th>
                  <th className="px-4 py-3 font-semibold">Hạn sử dụng</th>
                  <th className="px-6 py-3 font-semibold text-right">Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attentionList.map((c) => {
                  const stock = getChemicalTotalStock(c.id);
                  const stockStatus = getChemicalStockStatus(c.id);
                  const expiryStatus = getChemicalExpiryStatus(c.id);

                  const sLabel = getStockStatusLabel(stockStatus);
                  const eLabel = getExpiryStatusLabel(expiryStatus);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        <div className="font-bold">{c.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          CAS: {c.casNumber} · {c.storageLocation.cabinet}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {stock.total} {stock.unit}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500">
                        {c.minimumStock} {c.primaryUnit}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${sLabel.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sLabel.dotClass}`} />
                          {sLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${eLabel.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${eLabel.dotClass}`} />
                          {eLabel.text}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => onOpenRecordUsage(c.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Dùng
                        </button>
                        {isManager && (
                          <button
                            onClick={() => onOpenStockIn(c.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-cyan-700 rounded-lg hover:bg-cyan-800 transition-colors shadow-xs cursor-pointer"
                          >
                            Nhập thêm
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6 Clickable Stats Detail Drill-down Modal (Mục 5) */}
      <DashboardStatsDetailModal
        isOpen={!!detailModalType}
        type={detailModalType}
        onClose={() => setDetailModalType(null)}
        onOpenRecordUsage={onOpenRecordUsage}
        onOpenStockIn={onOpenStockIn}
        onOpenBottleDetail={onOpenBottleDetail}
        onNavigateToTab={onNavigateToTab}
      />
    </div>
  );
};

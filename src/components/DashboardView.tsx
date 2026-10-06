import React, { useState } from 'react';
import { useLab } from '../context/LabContext';
import { getStockStatusLabel, getExpiryStatusLabel } from '../utils/status';
import { getRoleDisplayName } from '../utils/roleUtils';
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
  Plus,
  ShoppingCart,
  Columns3,
  LayoutGrid,
  Check,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { DashboardStatsDetailModal, DashboardModalType } from './modals/DashboardStatsDetailModal';

interface Props {
  onNavigateToTab: (tab: any) => void;
  onNavigateWithFilter?: (tab: any, filter?: string) => void;
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
  onNavigateWithFilter,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenBottleDetail,
  onOpenEmailAlerts,
  onOpenDiscrepancyModal,
  onOpenUserGuide,
  onOpenQrScanner,
}) => {
  const [detailModalType, setDetailModalType] = useState<DashboardModalType | null>(null);
  const [activeHubTab, setActiveHubTab] = useState<'STOCK' | 'PURCHASE' | 'EMAIL'>('STOCK');
  const [hubViewMode, setHubViewMode] = useState<'TAB' | 'GRID'>('TAB');
  const [showRecentTransactions, setShowRecentTransactions] = useState(false);

  const {
    chemicals,
    bottles,
    transactions,
    purchaseItems,
    updatePurchaseStatus,
    currentUser,
    users,
    isManager,
    approveUser,
    emailAlertLogs,
    emailSettings,
    discrepancyReports,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
  } = useLab();

  // Metrics computation - Active chemicals only
  const activeChemicals = chemicals.filter((c) => c.status !== 'ARCHIVED');
  const totalChemicalsCount = activeChemicals.length;
  let lowStockCount = 0;
  let criticalStockCount = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;

  activeChemicals.forEach((c) => {
    const stockStatus = getChemicalStockStatus(c.id);
    const expiryStatus = getChemicalExpiryStatus(c.id);

    if (stockStatus === 'CRITICAL') criticalStockCount++;
    else if (stockStatus === 'LOW_STOCK') lowStockCount++;

    if (expiryStatus === 'EXPIRED') expiredCount++;
    else if (expiryStatus === 'EXPIRING_SOON') expiringSoonCount++;
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

  const myRecentUsage = transactions
    .filter((t) => t.type === 'USAGE' && t.user === currentUser.name)
    .slice(0, 5);

  const pendingApprovals = users.filter((u) => u.status === 'PENDING');
  const pendingDiscrepancies = discrepancyReports.filter((d) => d.status === 'PENDING');

  // Attention list - Active chemicals only (Sorted by urgency)
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

  // Purchase items summary
  const allPurchaseItems = purchaseItems || [];
  const pendingPurchases = allPurchaseItems.filter((p) => p.status !== 'RECEIVED');
  const urgentPurchases = pendingPurchases.filter((p) => p.priority === 'CRITICAL');

  return (
    <div className="space-y-3 sm:space-y-3.5 max-w-7xl mx-auto">
      {/* 1. COMPACT TOP HEADER & QUICK ACTION TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{isManager ? 'Bảng Điều Khiển Quản Lý' : 'Tổng Quan Phòng Thí Nghiệm'}</span>
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isManager ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {getRoleDisplayName(currentUser.role, currentUser.email)}
            </span>
            {pendingApprovals.length > 0 && isManager && (
              <button
                onClick={() => onNavigateToTab('users')}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors flex items-center gap-1 cursor-pointer animate-pulse"
                title="Có tài khoản đang chờ phê duyệt"
              >
                <Users className="w-3 h-3" />
                <span>{pendingApprovals.length} chờ duyệt</span>
              </button>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Hệ thống LabChem · Người dùng: <strong className="text-slate-700">{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        {/* Thanh công cụ thao tác nhanh gọn gàng */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 border border-slate-200/90 rounded-2xl flex-wrap shadow-2xs">
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-2.5 py-1 text-xs font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-xl transition-all flex items-center gap-1 shadow-xs hover:shadow-cyan-500/20 active:scale-95 cursor-pointer ring-1 ring-cyan-400/40"
              title="Quét mã QR tem dán chai"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-100" />
              <span>Quét QR</span>
            </button>
          )}

          <button
            onClick={() => onOpenRecordUsage()}
            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center gap-1 shadow-xs hover:shadow-emerald-500/20 active:scale-95 cursor-pointer ring-1 ring-emerald-400/40"
            title="Ghi nhận sử dụng và trừ tồn kho"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-100" />
            <span>Ghi Sử Dụng</span>
          </button>

          <div className="hidden sm:block h-3.5 w-px bg-slate-300 mx-0.5" />

          {onOpenDiscrepancyModal && (
            <button
              onClick={onOpenDiscrepancyModal}
              className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Báo cáo chênh lệch số lượng thực tế"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Báo Lệch Tồn</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToTab('purchase')}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Xem danh sách mua sắm hóa chất"
          >
            <ShoppingCart className="w-3 h-3 text-slate-500" />
            <span>Mua Sắm ({pendingPurchases.length})</span>
          </button>

          {onOpenEmailAlerts && (
            <button
              onClick={onOpenEmailAlerts}
              className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-white hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Hộp thư & Lịch sử email cảnh báo tự động"
            >
              <Mail className="w-3 h-3 text-rose-600" />
              <span>Email ({emailAlertLogs.length})</span>
            </button>
          )}

          {onOpenUserGuide && (
            <button
              onClick={onOpenUserGuide}
              className="px-2 py-1 text-xs font-semibold text-cyan-800 hover:text-cyan-900 bg-white hover:bg-cyan-50 rounded-xl transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Hướng dẫn sử dụng"
            >
              <BookOpen className="w-3 h-3 text-cyan-700" />
              <span className="hidden sm:inline">Hướng Dẫn</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. COMPACT TOP KPI CARDS (Tối ưu chiều cao, click mở drill-down) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Card 1: Tổng hóa chất */}
        <div
          onClick={() => setDetailModalType('TOTAL_CHEMICALS')}
          className="p-2.5 sm:p-3 bg-white hover:bg-blue-50/40 rounded-xl border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span className="font-medium group-hover:text-blue-700 truncate">Tổng hóa chất</span>
            <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 group-hover:text-blue-900 tabular-nums">
            {totalChemicalsCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono flex items-center justify-between">
            <span>{bottles.length} chai/lọ</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('inventory', 'ALL') : onNavigateToTab('inventory');
              }}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Chi tiết →
            </span>
          </div>
        </div>

        {/* Card 2: Kho nguy cấp */}
        <div
          onClick={() => setDetailModalType('CRITICAL_STOCK')}
          className="p-2.5 sm:p-3 bg-rose-50/60 hover:bg-rose-50 rounded-xl border border-rose-200 hover:border-rose-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-rose-700 text-[11px] mb-1 font-medium">
            <span className="group-hover:text-rose-900 truncate">Kho nguy cấp</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 animate-pulse shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-700 group-hover:text-rose-900 tabular-nums">
            {criticalStockCount}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5 flex items-center justify-between">
            <span>≤ Tối thiểu (Min)</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('inventory', 'CRITICAL') : onNavigateToTab('inventory');
              }}
              className="font-bold hover:underline cursor-pointer"
            >
              Xem ngay →
            </span>
          </div>
        </div>

        {/* Card 3: Sắp hết (Low Stock) */}
        <div
          onClick={() => setDetailModalType('LOW_STOCK')}
          className="p-2.5 sm:p-3 bg-amber-50/60 hover:bg-amber-50 rounded-xl border border-amber-200 hover:border-amber-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-amber-700 text-[11px] mb-1 font-medium">
            <span className="group-hover:text-amber-900 truncate">Sắp hết (Low)</span>
            <TrendingDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700 group-hover:text-amber-900 tabular-nums">
            {lowStockCount}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5 flex items-center justify-between">
            <span>≤ Ngưỡng báo</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('inventory', 'LOW') : onNavigateToTab('inventory');
              }}
              className="font-semibold hover:underline cursor-pointer"
            >
              Chi tiết →
            </span>
          </div>
        </div>

        {/* Card 4: Hạn ≤ 90 ngày */}
        <div
          onClick={() => setDetailModalType('EXPIRING_SOON')}
          className="p-2.5 sm:p-3 bg-orange-50/60 hover:bg-orange-50 rounded-xl border border-orange-200 hover:border-orange-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-orange-700 text-[11px] mb-1 font-medium">
            <span className="group-hover:text-orange-900 truncate">Hạn ≤ 90 ngày</span>
            <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-orange-700 group-hover:text-orange-900 tabular-nums">
            {expiringSoonCount}
          </div>
          <div className="text-[10px] text-orange-600 mt-0.5 flex items-center justify-between">
            <span>Ưu tiên dùng</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('expiry', 'EXPIRING_90') : onNavigateToTab('expiry');
              }}
              className="font-semibold hover:underline cursor-pointer"
            >
              Xem hạn →
            </span>
          </div>
        </div>

        {/* Card 5: Đã hết hạn */}
        <div
          onClick={() => setDetailModalType('EXPIRED')}
          className="p-2.5 sm:p-3 bg-slate-50 hover:bg-rose-50/50 rounded-xl border border-slate-300 hover:border-rose-300 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-slate-700 text-[11px] mb-1 font-medium">
            <span className="group-hover:text-rose-700 truncate">Đã hết hạn</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 group-hover:text-rose-900 tabular-nums">
            {expiredCount}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5 font-medium flex items-center justify-between">
            <span>Khóa sử dụng</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('expiry', 'EXPIRED') : onNavigateToTab('expiry');
              }}
              className="font-bold hover:underline cursor-pointer"
            >
              Tiêu hủy →
            </span>
          </div>
        </div>

        {/* Card 6: Chai đang mở (In-Use) */}
        <div
          onClick={() => setDetailModalType('IN_USE')}
          className="p-2.5 sm:p-3 bg-cyan-50/50 hover:bg-cyan-50 rounded-xl border border-cyan-200 hover:border-cyan-400 shadow-2xs hover:shadow-sm transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-cyan-800 text-[11px] mb-1 font-medium">
            <span className="group-hover:text-cyan-900 truncate">Chai đang mở</span>
            <FlaskConical className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-800 group-hover:text-cyan-900 tabular-nums">
            {bottles.filter((b) => b.status === 'IN_USE' || (b.openedDate && b.status !== 'DISPOSED')).length}
          </div>
          <div className="text-[10px] text-cyan-700 mt-0.5 font-mono flex items-center justify-between">
            <span>{bottles.filter((b) => !b.openedDate && b.status !== 'DISPOSED').length} chai niêm</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onNavigateWithFilter ? onNavigateWithFilter('inventory', 'IN_USE') : onNavigateToTab('inventory');
              }}
              className="font-bold hover:underline cursor-pointer"
            >
              Theo dõi →
            </span>
          </div>
        </div>
      </div>

      {/* 3. CORE SECTION: KHUNG TRUNG TÂM TÍCH HỢP TỐI ƯU KHÔNG GIAN
          Gộp: BÁO CÁO TỒN KHO - DANH SÁCH MUA SẮM - EMAIL CẢNH BÁO
          Hỗ trợ: Chuyển Tab (Tập trung) HOẶC 3 Cột Song Song (Bao quát 1 màn hình) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header điều hướng thống nhất của Khung */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-50/90 border-b border-slate-200">
          {/* Cụm 3 Tabs chính */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* Tab 1: Báo cáo tồn kho */}
            <button
              onClick={() => setActiveHubTab('STOCK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeHubTab === 'STOCK'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${activeHubTab === 'STOCK' ? 'text-amber-100' : 'text-amber-600'}`} />
              <span>Báo Cáo Tồn Kho</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeHubTab === 'STOCK'
                    ? 'bg-amber-700/80 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {attentionList.length}
              </span>
            </button>

            {/* Tab 2: Danh sách mua sắm */}
            <button
              onClick={() => setActiveHubTab('PURCHASE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeHubTab === 'PURCHASE'
                  ? 'bg-cyan-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <ShoppingCart className={`w-3.5 h-3.5 ${activeHubTab === 'PURCHASE' ? 'text-cyan-100' : 'text-cyan-700'}`} />
              <span>Danh Sách Mua Sắm</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeHubTab === 'PURCHASE'
                    ? 'bg-cyan-800/80 text-white'
                    : 'bg-cyan-100 text-cyan-800'
                }`}
              >
                {pendingPurchases.length}
              </span>
            </button>

            {/* Tab 3: Email cảnh báo */}
            <button
              onClick={() => setActiveHubTab('EMAIL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeHubTab === 'EMAIL'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Mail className={`w-3.5 h-3.5 ${activeHubTab === 'EMAIL' ? 'text-rose-100' : 'text-rose-600'}`} />
              <span>Email Cảnh Báo</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeHubTab === 'EMAIL'
                    ? 'bg-rose-700/80 text-white'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {emailAlertLogs.length}
              </span>
            </button>
          </div>

          {/* Công cụ bên phải: Chuyển đổi hiển thị (Tab vs 3 Cột) & Nút mở rộng */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* View Mode Toggle */}
            <div className="hidden md:flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setHubViewMode('TAB')}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  hubViewMode === 'TAB' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
                title="Hiển thị chi tiết theo Tab được chọn"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Tab Chi Tiết</span>
              </button>
              <button
                onClick={() => setHubViewMode('GRID')}
                className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  hubViewMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
                title="Hiển thị song song cả 3 cột để nhìn gọn 1 trang"
              >
                <Columns3 className="w-3 h-3" />
                <span>3 Cột Thu Gọn</span>
              </button>
            </div>

            {/* Quick Context Action Button */}
            {activeHubTab === 'STOCK' && (
              <div className="flex items-center gap-1.5">
                {onOpenDiscrepancyModal && (
                  <button
                    onClick={onOpenDiscrepancyModal}
                    className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>Báo Lệch Tồn</span>
                  </button>
                )}
                <button
                  onClick={() => onNavigateWithFilter ? onNavigateWithFilter('inventory', 'ALL') : onNavigateToTab('inventory')}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Sổ sách báo cáo →</span>
                </button>
              </div>
            )}

            {activeHubTab === 'PURCHASE' && (
              <button
                onClick={() => onNavigateToTab('purchase')}
                className="px-2.5 py-1 text-[11px] font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <ShoppingCart className="w-3 h-3" />
                <span>Trang Mua Sắm Chi Tiết →</span>
              </button>
            )}

            {activeHubTab === 'EMAIL' && onOpenEmailAlerts && (
              <button
                onClick={onOpenEmailAlerts}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Mail className="w-3 h-3 text-rose-700" />
                <span>Hộp Thư & Cấu Hình Email →</span>
              </button>
            )}
          </div>
        </div>

        {/* NỘI DUNG HUB: CHẾ ĐỘ 1 - TAB DETAIL (Chiều cao cố định h-[330px], cuộn nội bộ mượt mà) */}
        {hubViewMode === 'TAB' ? (
          <div className="p-3 sm:p-4">
            {/* TAB 1: BÁO CÁO TỒN KHO */}
            {activeHubTab === 'STOCK' && (
              <div className="space-y-2.5">
                {/* Thanh tóm tắt nhanh */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Tổng số cần xử lý: <strong className="text-slate-900 font-mono">{attentionList.length}</strong> hóa chất</span>
                    </span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <span className="hidden sm:inline text-rose-700 font-medium">
                      Nguy cấp: <strong>{criticalStockCount}</strong>
                    </span>
                    <span className="hidden sm:inline text-amber-700 font-medium">
                      Sắp hết: <strong>{lowStockCount}</strong>
                    </span>
                    {pendingDiscrepancies.length > 0 && (
                      <span className="text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {pendingDiscrepancies.length} báo lệch tồn đang chờ duyệt
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Cập nhật thời gian thực · FIFO tự động
                  </span>
                </div>

                {/* Danh sách bảng cuộn nội bộ (Giới hạn tối đa 300px để không đẩy trang) */}
                {attentionList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-medium text-slate-800">Kho hóa chất đang ở trạng thái an toàn!</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Không có hóa chất nào dưới mức tối thiểu hoặc sắp hết hạn.</p>
                  </div>
                ) : (
                  <div className="max-h-[290px] xl:max-h-[320px] overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-600 sticky top-0 uppercase font-mono text-[10px] tracking-wider z-10">
                        <tr>
                          <th className="px-3 py-2 font-bold">Hóa chất & Vị trí</th>
                          <th className="px-2.5 py-2 font-bold">Tồn kho / Mức Min</th>
                          <th className="px-2.5 py-2 font-bold">Trạng thái kho</th>
                          <th className="px-2.5 py-2 font-bold">Hạn sử dụng</th>
                          <th className="px-3 py-2 font-bold text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attentionList.map((c) => {
                          const stock = getChemicalTotalStock(c.id);
                          const stockStatus = getChemicalStockStatus(c.id);
                          const expiryStatus = getChemicalExpiryStatus(c.id);
                          const sLabel = getStockStatusLabel(stockStatus);
                          const eLabel = getExpiryStatusLabel(expiryStatus);
                          const pct = c.minimumStock > 0 ? Math.min(100, Math.round((stock.total / c.minimumStock) * 100)) : 100;

                          return (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                <div className="font-bold flex items-center gap-1.5">
                                  <span>{c.name}</span>
                                  {stockStatus === 'CRITICAL' && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  CAS: {c.casNumber} · {c.storageLocation.cabinet}
                                </div>
                              </td>

                              <td className="px-2.5 py-2">
                                <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                                  <span>{stock.total}</span>
                                  <span className="text-slate-400 font-normal">/ {c.minimumStock} {stock.unit}</span>
                                </div>
                                <div className="w-24 bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct < 50 ? 'bg-rose-500' : pct <= 100 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>

                              <td className="px-2.5 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sLabel.badgeClass}`}>
                                  <span className={`w-1 h-1 rounded-full ${sLabel.dotClass}`} />
                                  {sLabel.text}
                                </span>
                              </td>

                              <td className="px-2.5 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${eLabel.badgeClass}`}>
                                  <span className={`w-1 h-1 rounded-full ${eLabel.dotClass}`} />
                                  {eLabel.text}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-right space-x-1.5 shrink-0">
                                <button
                                  onClick={() => onOpenRecordUsage(c.id)}
                                  className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  Dùng
                                </button>
                                {isManager && (
                                  <button
                                    onClick={() => onOpenStockIn(c.id)}
                                    className="px-2 py-0.5 text-[11px] font-semibold text-white bg-cyan-700 rounded-md hover:bg-cyan-800 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    Nhập
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
            )}

            {/* TAB 2: DANH SÁCH MUA SẮM */}
            {activeHubTab === 'PURCHASE' && (
              <div className="space-y-2.5">
                {/* Tóm tắt mua sắm */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-cyan-50/60 rounded-xl border border-cyan-100 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-cyan-950 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-cyan-700" />
                      <span>Tổng mặt hàng cần mua: <strong className="font-mono text-cyan-900">{pendingPurchases.length}</strong></span>
                    </span>
                    <span className="hidden sm:inline text-cyan-200">|</span>
                    <span className="text-rose-700 font-medium">
                      Ưu tiên khẩn cấp: <strong>{urgentPurchases.length}</strong>
                    </span>
                    <span className="hidden md:inline text-slate-600">
                      Đang đặt hàng: <strong>{allPurchaseItems.filter((p) => p.status === 'ORDERED').length}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigateToTab('purchase')}
                    className="text-[11px] font-bold text-cyan-800 hover:text-cyan-950 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Quản lý đơn hàng & xuất file →</span>
                  </button>
                </div>

                {/* Danh sách mua sắm cuộn nội bộ */}
                {pendingPurchases.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <CheckCircle2 className="w-6 h-6 text-cyan-600 mx-auto mb-1.5" />
                    <p className="font-medium text-slate-800">Không có hóa chất nào cần mua sắm thêm!</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Tồn kho hiện tại đều đạt ngưỡng an toàn.</p>
                  </div>
                ) : (
                  <div className="max-h-[290px] xl:max-h-[320px] overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 text-slate-600 sticky top-0 uppercase font-mono text-[10px] tracking-wider z-10">
                        <tr>
                          <th className="px-3 py-2 font-bold">Hóa chất & NCC</th>
                          <th className="px-2.5 py-2 font-bold">Tồn hiện tại</th>
                          <th className="px-2.5 py-2 font-bold">Đề xuất mua</th>
                          <th className="px-2.5 py-2 font-bold">Mức ưu tiên</th>
                          <th className="px-2.5 py-2 font-bold">Trạng thái</th>
                          <th className="px-3 py-2 font-bold text-right">Hành động nhanh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pendingPurchases.map((item) => {
                          const priorityColor =
                            item.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : item.priority === 'NORMAL'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200';

                          const statusBadge =
                            item.status === 'ORDERED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700';

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                <div className="font-bold">{item.chemicalName}</div>
                                <div className="text-[10px] text-slate-400">
                                  NCC: {item.supplier || 'Chưa chỉ định'}
                                </div>
                              </td>

                              <td className="px-2.5 py-2 font-mono text-slate-700">
                                <span>{item.currentStock} {item.unit}</span>
                                <span className="text-[10px] text-slate-400 block font-sans">Min: {item.minimumStock}</span>
                              </td>

                              <td className="px-2.5 py-2 font-mono font-bold text-cyan-800">
                                +{item.recommendedPurchase} {item.unit}
                              </td>

                              <td className="px-2.5 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColor}`}>
                                  {item.priority === 'CRITICAL' ? 'Cấp bách' : item.priority === 'NORMAL' ? 'Bình thường' : 'Thấp'}
                                </span>
                              </td>

                              <td className="px-2.5 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge}`}>
                                  {item.status === 'ORDERED' ? 'Đã đặt hàng' : 'Cần mua'}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-right space-x-1.5 shrink-0">
                                {item.status === 'PENDING' ? (
                                  <button
                                    onClick={() => updatePurchaseStatus(item.id, 'ORDERED')}
                                    className="px-2 py-0.5 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors cursor-pointer"
                                    title="Chuyển sang trạng thái đã đặt hàng"
                                  >
                                    Đã đặt
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => updatePurchaseStatus(item.id, 'RECEIVED')}
                                    className="px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                                    title="Xác nhận hàng đã về phòng lab"
                                  >
                                    Đã nhận
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
            )}

            {/* TAB 3: EMAIL CẢNH BÁO */}
            {activeHubTab === 'EMAIL' && (
              <div className="space-y-2.5">
                {/* Khung trạng thái email quản lý */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-rose-600" />
                        <span>Email Tự Động Tới Quản Lý Khi Hóa Chất Chạm Ngưỡng Tồn Kho</span>
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                        {emailSettings.autoEmailOnLowStock ? 'ĐANG BẬT' : 'TẮT'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Hộp thư nhận cảnh báo: <strong className="font-mono text-slate-800">{emailSettings.managerEmail}</strong>
                    </p>
                  </div>

                  {onOpenEmailAlerts && (
                    <button
                      onClick={onOpenEmailAlerts}
                      className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Cấu hình & Gửi thử</span>
                    </button>
                  )}
                </div>

                {/* Danh sách nhật ký email đã gửi gần nhất (cuộn nội bộ) */}
                <div className="max-h-[290px] xl:max-h-[320px] overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-2 bg-slate-50/40">
                  {emailAlertLogs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Chưa có email cảnh báo nào được gửi đi.
                    </div>
                  ) : (
                    emailAlertLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>{log.subject}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Gửi tới: <strong className="font-mono text-slate-700">{log.toEmail}</strong></span>
                            <span>·</span>
                            <span>Hóa chất: <strong className="text-slate-700">{log.chemicalName}</strong></span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono text-slate-500 block">
                            {new Date(log.timestamp).toLocaleString('vi-VN')}
                          </span>
                          <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đã chuyển thành công
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* NỘI DUNG HUB: CHẾ ĐỘ 2 - 3 CỘT SONG SONG (Hiển thị đồng thời cả 3 mục trong 1 trang màn hình) */
          <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Cột 1: Báo cáo tồn kho */}
            <div className="flex flex-col bg-slate-50/60 rounded-xl border border-slate-200 p-2.5 h-[340px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900">Báo Cáo Tồn Kho</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800">
                  {attentionList.length} cần chú ý
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {attentionList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Tồn kho an toàn!</p>
                ) : (
                  attentionList.map((c) => {
                    const stock = getChemicalTotalStock(c.id);
                    const sLabel = getStockStatusLabel(getChemicalStockStatus(c.id));
                    return (
                      <div
                        key={c.id}
                        className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-1.5 shadow-2xs"
                      >
                        <div className="truncate">
                          <div className="font-bold text-slate-900 truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            Tồn: <strong className="font-mono text-slate-700">{stock.total}</strong> / Min: {c.minimumStock} {stock.unit}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${sLabel.badgeClass}`}>
                            {sLabel.text}
                          </span>
                          <button
                            onClick={() => onOpenRecordUsage(c.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                          >
                            Dùng
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {onOpenDiscrepancyModal && (
                <button
                  onClick={onOpenDiscrepancyModal}
                  className="mt-2 w-full py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span>Báo Lệch Tồn Kho</span>
                </button>
              )}
            </div>

            {/* Cột 2: Danh sách mua sắm */}
            <div className="flex flex-col bg-slate-50/60 rounded-xl border border-slate-200 p-2.5 h-[340px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-cyan-700" />
                  <h3 className="text-xs font-bold text-slate-900">Danh Sách Mua Sắm</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                  {pendingPurchases.length} đề xuất
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {pendingPurchases.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Không có mục cần mua!</p>
                ) : (
                  pendingPurchases.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-1.5 shadow-2xs"
                    >
                      <div className="truncate">
                        <div className="font-bold text-slate-900 truncate">{item.chemicalName}</div>
                        <div className="text-[10px] text-cyan-800 font-mono font-bold truncate">
                          Đề xuất: +{item.recommendedPurchase} {item.unit}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.priority === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.priority === 'CRITICAL' ? 'Khẩn' : 'Bình thường'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => onNavigateToTab('purchase')}
                className="mt-2 w-full py-1 text-[11px] font-bold text-cyan-800 bg-cyan-100 hover:bg-cyan-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <ShoppingCart className="w-3 h-3 text-cyan-700" />
                <span>Xem Trang Mua Sắm →</span>
              </button>
            </div>

            {/* Cột 3: Email cảnh báo */}
            <div className="flex flex-col bg-slate-50/60 rounded-xl border border-slate-200 p-2.5 h-[340px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  <h3 className="text-xs font-bold text-slate-900">Email Cảnh Báo</h3>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                  {emailAlertLogs.length} đã gửi
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                <div className="p-2 bg-white rounded-lg border border-rose-100 text-xs text-slate-600 space-y-0.5">
                  <div className="text-[11px] text-slate-500">Người nhận tự động:</div>
                  <div className="font-mono font-bold text-slate-800 text-[11px] truncate">{emailSettings.managerEmail}</div>
                </div>

                {emailAlertLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Chưa có email cảnh báo nào.</p>
                ) : (
                  emailAlertLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-2 bg-white rounded-lg border border-slate-200 text-xs space-y-0.5 shadow-2xs"
                    >
                      <div className="font-semibold text-slate-800 text-[11px] truncate">{log.subject}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        <span>{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                        <span className="text-emerald-600 font-semibold">Đã gửi</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {onOpenEmailAlerts && (
                <button
                  onClick={onOpenEmailAlerts}
                  className="mt-2 w-full py-1 text-[11px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <Mail className="w-3 h-3 text-rose-700" />
                  <span>Cấu Hình Hộp Thư Email →</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. FOOTER MINI-BAR: GIAO DỊCH TIÊU HAO GẦN NHẤT (Thu gọn, mở rộng tùy chọn) */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-cyan-700" />
          <span className="font-bold text-slate-800">
            {isManager ? 'Top hóa chất tiêu hao phổ biến:' : 'Lịch sử dùng gần nhất của bạn:'}
          </span>
          <div className="hidden md:flex items-center gap-2 overflow-x-auto text-[11px]">
            {(isManager ? topUsedChemicals : myRecentUsage).slice(0, 3).map((item: any, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded-md font-mono text-slate-700">
                {isManager ? item.name : item.chemicalName} ({isManager ? `${Math.round(item.totalQty)} ${item.unit}` : `-${item.quantity} ${item.unit}`})
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigateToTab('usage')}
          className="text-[11px] font-bold text-cyan-800 hover:text-cyan-950 hover:underline flex items-center gap-1 cursor-pointer self-end sm:self-center shrink-0"
        >
          <span>Xem toàn bộ nhật ký dùng ({transactions.length}) →</span>
        </button>
      </div>

      {/* Drill-down Modal khi click các thẻ KPI */}
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

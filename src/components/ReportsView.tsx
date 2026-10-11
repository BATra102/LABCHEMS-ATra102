import React, { useMemo, useState } from 'react';
import { useLab } from '../context/LabContext';
import {
  exportUsageHistoryCSV,
  exportChemicalInventoryCSV,
  exportPurchaseListCSV,
  exportExpiryReportCSV,
  exportStockMovementCSV,
  exportAuditDiscrepancyCSV,
  exportUserConsumptionCSV,
  downloadCSV,
} from '../utils/exportImport';
import {
  Download,
  Users,
  FolderKanban,
  FileSpreadsheet,
  PieChart,
  Lock,
  AlertCircle,
  TrendingDown,
  Coins,
  ShieldAlert,
  Calendar,
  Filter,
  Search,
  ArrowUpDown,
  Printer,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  CheckCircle2,
  Scale,
  ClipboardCheck,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { convertUnit } from '../utils/units';

interface Props {
  onOpenPdfReport?: (type?: 'INVENTORY' | 'TRANSACTIONS' | 'ARCHIVE') => void;
}

export const ReportsView: React.FC<Props> = ({ onOpenPdfReport }) => {
  const {
    transactions,
    chemicals,
    bottles,
    purchaseItems,
    users,
    currentUser,
    isManager,
    canExportHistory,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    discrepancyReports,
    referenceDate,
  } = useLab();

  // Active Report Tab: 7 comprehensive report suites
  const [activeReportTab, setActiveReportTab] = useState<
    'user' | 'project' | 'movement' | 'valuation' | 'expiry' | 'audit' | 'exports'
  >('user');

  // Time Range Filter
  const [timeRange, setTimeRange] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS' | 'MONTH'>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected row for drill-down modal/view
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const showExportSuccess = (msg: string) => {
    setExportSuccessMsg(msg);
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // Base Usage transactions with permission check
  const canViewAllUsage =
    isManager ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'LAB_MANAGER' ||
    !!currentUser.permissions?.viewAllUsageHistory;

  // Filtered usage transactions based on time and permissions
  const filteredUsageList = useMemo(() => {
    let list = transactions.filter((t) => t.type === 'USAGE' && !t.isReversed);

    // Permission enforcement: regular users only see their own usage
    if (!canViewAllUsage) {
      list = list.filter((t) => t.user === currentUser.name);
    }

    // Time filter
    if (timeRange !== 'ALL') {
      const today = new Date(referenceDate);
      list = list.filter((t) => {
        const txDate = new Date(t.date);
        const diffDays = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

        if (timeRange === 'TODAY') return t.date === referenceDate;
        if (timeRange === '7DAYS') return diffDays >= 0 && diffDays <= 7;
        if (timeRange === '30DAYS') return diffDays >= 0 && diffDays <= 30;
        if (timeRange === 'MONTH') {
          return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
        }
        return true;
      });
    }

    // Category filter
    if (selectedCategoryFilter !== 'ALL') {
      const chemIdsInCategory = new Set(
        chemicals.filter((c) => c.category === selectedCategoryFilter).map((c) => c.id)
      );
      list = list.filter((t) => chemIdsInCategory.has(t.chemicalId));
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.chemicalName.toLowerCase().includes(q) ||
          t.user.toLowerCase().includes(q) ||
          (t.project && t.project.toLowerCase().includes(q)) ||
          (t.experiment && t.experiment.toLowerCase().includes(q))
      );
    }

    return list;
  }, [transactions, canViewAllUsage, currentUser.name, timeRange, referenceDate, selectedCategoryFilter, chemicals, searchTerm]);

  // Chemical lookup map for pricing and metadata
  const chemMap = useMemo(() => {
    const map = new Map<string, (typeof chemicals)[0]>();
    chemicals.forEach((c) => map.set(c.id, c));
    return map;
  }, [chemicals]);

  // Calculate High-Level Metrics
  const summaryKPIs = useMemo(() => {
    // 1. Total usage cost in period
    let totalUsageCost = 0;
    filteredUsageList.forEach((t) => {
      const chem = chemMap.get(t.chemicalId);
      const unitPrice = chem?.unitPrice || 80000;
      // Convert to primary unit
      const primaryQty = chem ? (convertUnit(t.quantity, t.unit, chem.primaryUnit) ?? t.quantity) : t.quantity;
      totalUsageCost += primaryQty * (unitPrice / 1000); // normalized
    });

    // 2. Total active inventory valuation
    let totalInventoryValuation = 0;
    bottles.forEach((b) => {
      if (b.status !== 'DISPOSED' && b.status !== 'EMPTY') {
        const chem = chemMap.get(b.chemicalId);
        const unitPrice = chem?.unitPrice || 120000;
        const volRatio = b.initialVolume > 0 ? b.currentVolume / b.initialVolume : 1;
        totalInventoryValuation += unitPrice * volRatio;
      }
    });

    // 3. Total expired inventory waste
    let totalExpiredWaste = 0;
    let expiredBottlesCount = 0;
    const refTime = new Date(referenceDate).getTime();
    bottles.forEach((b) => {
      if (b.status !== 'DISPOSED' && b.currentVolume > 0) {
        const isExp = new Date(b.expiryDate).getTime() < refTime;
        if (isExp) {
          expiredBottlesCount++;
          const chem = chemMap.get(b.chemicalId);
          const unitPrice = chem?.unitPrice || 100000;
          const volRatio = b.initialVolume > 0 ? b.currentVolume / b.initialVolume : 1;
          totalExpiredWaste += unitPrice * volRatio;
        }
      }
    });

    return {
      txCount: filteredUsageList.length,
      totalUsageCost: Math.round(totalUsageCost),
      totalInventoryValuation: Math.round(totalInventoryValuation),
      totalExpiredWaste: Math.round(totalExpiredWaste),
      expiredBottlesCount,
    };
  }, [filteredUsageList, chemMap, bottles, referenceDate]);

  // Aggregate: Usage by User
  const usageByUser = useMemo(() => {
    const map = new Map<
      string,
      {
        userName: string;
        department: string;
        role: string;
        txCount: number;
        totalCost: number;
        chemsUsed: Map<string, { qty: number; unit: string; chemicalName: string }>;
        limits?: any;
      }
    >();

    filteredUsageList.forEach((t) => {
      const u = t.user;
      if (!map.has(u)) {
        const userObj = users.find((x) => x.name === u);
        map.set(u, {
          userName: u,
          department: userObj?.department || 'Khoa Dược liệu',
          role: userObj?.role || 'MEMBER',
          txCount: 0,
          totalCost: 0,
          chemsUsed: new Map(),
          limits: userObj?.limits,
        });
      }

      const rec = map.get(u)!;
      rec.txCount += 1;

      const chem = chemMap.get(t.chemicalId);
      const unitPrice = chem?.unitPrice || 80000;
      const primaryQty = chem ? (convertUnit(t.quantity, t.unit, chem.primaryUnit) ?? t.quantity) : t.quantity;
      rec.totalCost += primaryQty * (unitPrice / 1000);

      // Chem breakdown
      const chemKey = t.chemicalName;
      if (!rec.chemsUsed.has(chemKey)) {
        rec.chemsUsed.set(chemKey, { qty: 0, unit: t.unit, chemicalName: t.chemicalName });
      }
      rec.chemsUsed.get(chemKey)!.qty += t.quantity;
    });

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredUsageList, users, chemMap]);

  // Aggregate: Usage by Project
  const usageByProject = useMemo(() => {
    const map = new Map<
      string,
      {
        projectName: string;
        experiments: Set<string>;
        users: Set<string>;
        txCount: number;
        totalCost: number;
        chemsUsed: Map<string, { qty: number; unit: string; chemicalName: string }>;
      }
    >();

    filteredUsageList.forEach((t) => {
      const p = t.project || 'Nghiên cứu khoa học chung';
      if (!map.has(p)) {
        map.set(p, {
          projectName: p,
          experiments: new Set(),
          users: new Set(),
          txCount: 0,
          totalCost: 0,
          chemsUsed: new Map(),
        });
      }

      const rec = map.get(p)!;
      rec.txCount += 1;
      if (t.experiment) rec.experiments.add(t.experiment);
      rec.users.add(t.user);

      const chem = chemMap.get(t.chemicalId);
      const unitPrice = chem?.unitPrice || 80000;
      const primaryQty = chem ? (convertUnit(t.quantity, t.unit, chem.primaryUnit) ?? t.quantity) : t.quantity;
      rec.totalCost += primaryQty * (unitPrice / 1000);

      const chemKey = t.chemicalName;
      if (!rec.chemsUsed.has(chemKey)) {
        rec.chemsUsed.set(chemKey, { qty: 0, unit: t.unit, chemicalName: t.chemicalName });
      }
      rec.chemsUsed.get(chemKey)!.qty += t.quantity;
    });

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredUsageList, chemMap]);

  // Aggregate: Inventory Valuation by Category
  const categoryValuation = useMemo(() => {
    const catMap = new Map<
      string,
      {
        category: string;
        chemicalCount: number;
        bottleCount: number;
        totalEstimatedValue: number;
      }
    >();

    chemicals.forEach((c) => {
      if (!catMap.has(c.category)) {
        catMap.set(c.category, {
          category: c.category,
          chemicalCount: 0,
          bottleCount: 0,
          totalEstimatedValue: 0,
        });
      }
      const cat = catMap.get(c.category)!;
      cat.chemicalCount += 1;

      const chemBottles = bottles.filter((b) => b.chemicalId === c.id && b.status !== 'DISPOSED');
      cat.bottleCount += chemBottles.length;

      chemBottles.forEach((b) => {
        if (b.currentVolume > 0) {
          const ratio = b.initialVolume > 0 ? b.currentVolume / b.initialVolume : 1;
          cat.totalEstimatedValue += (c.unitPrice || 100000) * ratio;
        }
      });
    });

    return Array.from(catMap.values()).sort((a, b) => b.totalEstimatedValue - a.totalEstimatedValue);
  }, [chemicals, bottles]);

  // Bottle status summary
  const bottleStatusBreakdown = useMemo(() => {
    const summary = {
      FULL: 0,
      IN_USE: 0,
      LOW: 0,
      EMPTY: 0,
      EXPIRED: 0,
      DISPOSED: 0,
      total: bottles.length,
    };

    bottles.forEach((b) => {
      if (b.status === 'DISPOSED') summary.DISPOSED++;
      else if (b.status === 'EMPTY' || b.currentVolume <= 0) summary.EMPTY++;
      else if (new Date(b.expiryDate).getTime() < new Date(referenceDate).getTime()) summary.EXPIRED++;
      else if (b.status === 'IN_USE') summary.IN_USE++;
      else if (b.status === 'LOW') summary.LOW++;
      else summary.FULL++;
    });

    return summary;
  }, [bottles, referenceDate]);

  // Handle Export Project Cost Report
  const handleExportProjectCostCSV = () => {
    const headers = ['Dự án / Đề tài', 'Số lượt sử dụng', 'Các người làm', 'Ước tính chi phí tiêu hao (VND)'];
    const rows = usageByProject.map((p) => [
      `"${p.projectName}"`,
      p.txCount,
      `"${Array.from(p.users).join(', ')}"`,
      Math.round(p.totalCost),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    downloadCSV(`LabChem_BaoCao_DeTai_${new Date().toISOString().split('T')[0]}.csv`, csv);
    showExportSuccess('Đã xuất Báo cáo Chi phí Đề tài thành công!');
  };

  const handleExportHistory = () => {
    if (!canExportHistory) {
      setExportWarning('Chỉ Quản lý (LAB_MANAGER) và Quản trị viên (ADMIN) mới có quyền xuất nhật ký lịch sử sử dụng.');
      setTimeout(() => setExportWarning(null), 5000);
      return;
    }
    exportUsageHistoryCSV(filteredUsageList);
    showExportSuccess('Đã tải file Lịch sử sử dụng hóa chất!');
  };

  // Aggregate: Stock Movement Ledger (Báo Cáo Nhập - Xuất - Tồn)
  const stockMovementData = useMemo(() => {
    return chemicals
      .filter((c) => {
        if (selectedCategoryFilter !== 'ALL' && c.category !== selectedCategoryFilter) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.englishName.toLowerCase().includes(q) ||
            c.casNumber.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .map((chem) => {
        const endingStock = getChemicalTotalStock(chem.id).total;

        // Transactions in period for this chemical
        const chemTxs = transactions.filter((t) => t.chemicalId === chem.id && !t.isReversed);

        let filteredTxs = chemTxs;
        if (timeRange !== 'ALL') {
          const today = new Date(referenceDate);
          filteredTxs = chemTxs.filter((t) => {
            const txDate = new Date(t.date);
            const diffDays = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
            if (timeRange === 'TODAY') return t.date === referenceDate;
            if (timeRange === '7DAYS') return diffDays >= 0 && diffDays <= 7;
            if (timeRange === '30DAYS') return diffDays >= 0 && diffDays <= 30;
            if (timeRange === 'MONTH') {
              return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
            }
            return true;
          });
        }

        let totalIn = 0;
        let totalOut = 0;
        let totalDisposed = 0;

        filteredTxs.forEach((t) => {
          const converted = convertUnit(t.quantity, t.unit, chem.primaryUnit) ?? t.quantity;
          if (t.type === 'STOCK_IN') {
            totalIn += converted;
          } else if (t.type === 'USAGE') {
            totalOut += converted;
          } else if (t.type === 'DISPOSAL') {
            totalDisposed += converted;
          }
        });

        // Theoretical beginning stock
        const beginningStock = Math.max(0, Math.round((endingStock + totalOut + totalDisposed - totalIn) * 100) / 100);
        const totalEndingValue = Math.round(endingStock * chem.unitPrice);
        const stockStatus = getChemicalStockStatus(chem.id);

        return {
          id: chem.id,
          code: chem.code,
          name: chem.name,
          englishName: chem.englishName,
          casNumber: chem.casNumber,
          category: chem.category,
          unit: chem.primaryUnit,
          unitPrice: chem.unitPrice,
          beginningStock,
          totalIn: Math.round(totalIn * 100) / 100,
          totalOut: Math.round(totalOut * 100) / 100,
          totalDisposed: Math.round(totalDisposed * 100) / 100,
          endingStock: Math.round(endingStock * 100) / 100,
          totalEndingValue,
          stockStatus,
        };
      });
  }, [
    chemicals,
    transactions,
    selectedCategoryFilter,
    searchTerm,
    timeRange,
    referenceDate,
    getChemicalTotalStock,
    getChemicalStockStatus,
  ]);

  // High-level metrics for Stock Movement
  const stockMovementSummary = useMemo(() => {
    let sumIn = 0;
    let sumOut = 0;
    let sumDisposed = 0;
    let sumEndingVal = 0;

    stockMovementData.forEach((r) => {
      sumIn += r.totalIn;
      sumOut += r.totalOut;
      sumDisposed += r.totalDisposed;
      sumEndingVal += r.totalEndingValue;
    });

    return {
      sumIn: Math.round(sumIn * 100) / 100,
      sumOut: Math.round(sumOut * 100) / 100,
      sumDisposed: Math.round(sumDisposed * 100) / 100,
      sumEndingVal: Math.round(sumEndingVal),
    };
  }, [stockMovementData]);

  // Handle Export Stock Movement CSV
  const handleExportMovementCSV = () => {
    exportStockMovementCSV(stockMovementData);
    showExportSuccess('Đã xuất Báo cáo Nhập - Xuất - Tồn thành công!');
  };

  // Physical count audit metrics
  const auditMetrics = useMemo(() => {
    const totalReports = discrepancyReports.length;
    const pending = discrepancyReports.filter((d) => d.status === 'PENDING').length;
    const resolved = discrepancyReports.filter((d) => d.status === 'RESOLVED').length;
    const rejected = discrepancyReports.filter((d) => d.status === 'REJECTED').length;

    const bottleCount = bottles.length || 1;
    const accuracyRate = Math.max(0, Math.min(100, Math.round((1 - totalReports / bottleCount) * 100)));

    return {
      totalReports,
      pending,
      resolved,
      rejected,
      accuracyRate,
    };
  }, [discrepancyReports, bottles]);

  // Handle Export Audit Discrepancy CSV
  const handleExportAuditCSV = () => {
    exportAuditDiscrepancyCSV(discrepancyReports);
    showExportSuccess('Đã xuất Biên bản Kiểm kê & Chênh lệch thành công!');
  };

  // Handle Export User Consumption Summary CSV
  const handleExportUserConsumptionCSV = () => {
    const summary = usageByUser.map((u) => ({
      userName: u.userName,
      department: u.department,
      role: u.role,
      txCount: u.txCount,
      chemsCount: u.chemsUsed.size,
      totalCost: u.totalCost,
    }));
    exportUserConsumptionCSV(summary);
    showExportSuccess('Đã xuất Báo cáo Tiêu hao Người dùng thành công!');
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Official Laboratory Report Header */}
      <div className="hidden print:block mb-8 pb-4 border-b border-slate-300 text-center font-serif">
        <div className="flex justify-between items-start text-[11px] uppercase tracking-wider text-slate-700 font-bold mb-4">
          <div className="text-left">
            <div>Bộ Giáo Dục & Đào Tạo / Bộ Y Tế</div>
            <div>Trường Đại Học / Viện Nghiên Cứu Dược Liệu</div>
            <div className="font-normal text-[10px] text-slate-500">Phòng Thí Nghiệm Chiết Xuất & Hoạt Chất Tự Nhiên</div>
          </div>
          <div className="text-right">
            <div>Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
            <div className="font-normal text-[10px]">Độc lập - Tự do - Hạnh phúc</div>
            <div className="text-slate-400 font-mono text-[9px] mt-0.5">Số: ....../BC-PTN-LABCHEM</div>
          </div>
        </div>
        <h1 className="text-base font-bold uppercase tracking-wide text-slate-900 mt-2">
          Báo Cáo Quản Lý Kho & Thống Kê Tiêu Hao Hóa Chất Phòng Thí Nghiệm
        </h1>
        <p className="text-xs text-slate-600 mt-1 italic">
          Kỳ thống kê: {timeRange === 'ALL' ? 'Toàn bộ thời gian' : timeRange === 'TODAY' ? `Hôm nay (${referenceDate})` : timeRange === 'MONTH' ? 'Tháng 10/2026' : timeRange} • Ngày xuất bản: {new Date().toLocaleDateString('vi-VN')} • Người lập biểu: {currentUser.name}
        </p>
      </div>

      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Trung Tâm Báo Cáo & Phân Tích Thống Kê</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Báo cáo tiêu hao theo cá nhân & đề tài, định giá kho hóa chất, kiểm soát hao hụt và xuất sổ sách
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>In Báo Cáo</span>
          </button>

          <button
            onClick={() => setActiveReportTab('exports')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Bảng Tính (Excel / CSV)</span>
          </button>
        </div>
      </div>

      {/* Export Notifications */}
      {exportWarning && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{exportWarning}</span>
          </div>
          <button onClick={() => setExportWarning(null)} className="font-bold text-amber-700 hover:text-amber-900">
            ×
          </button>
        </div>
      )}

      {exportSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{exportSuccessMsg}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tiêu hao trong kỳ */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tiêu hao trong kỳ</span>
            <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {summaryKPIs.txCount}{' '}
            <span className="text-xs font-normal text-slate-500">lượt chiết</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Ước tính:{' '}
            <span className="font-bold text-blue-700 font-mono">
              {summaryKPIs.totalUsageCost.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>

        {/* Card 2: Định giá tồn kho */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tổng giá trị kho lab</span>
            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
              <Coins className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {summaryKPIs.totalInventoryValuation.toLocaleString('vi-VN')}{' '}
            <span className="text-xs font-normal text-slate-500">đ</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {chemicals.length} loại hóa chất • {bottles.length} chai
          </div>
        </div>

        {/* Card 3: Hao hụt do quá hạn */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Lãng phí do hết hạn</span>
            <span className="p-1 rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-rose-700">
            {summaryKPIs.totalExpiredWaste.toLocaleString('vi-VN')}{' '}
            <span className="text-xs font-normal text-slate-500">đ</span>
          </div>
          <div className="text-[11px] text-rose-600 font-medium">
            {summaryKPIs.expiredBottlesCount} chai cần lập biên bản tiêu hủy
          </div>
        </div>

        {/* Card 4: Chai đang mở sử dụng */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Chai đang mở (In-Use)</span>
            <span className="p-1 rounded-lg bg-cyan-50 text-cyan-600">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-cyan-700">
            {bottleStatusBreakdown.IN_USE}{' '}
            <span className="text-xs font-normal text-slate-500">/ {bottles.length} chai</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Chưa mở: {bottleStatusBreakdown.FULL} • Đã hết: {bottleStatusBreakdown.EMPTY}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs & Global Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl text-xs">
          <button
            onClick={() => setActiveReportTab('user')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'user'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Theo Người Làm</span>
          </button>

          <button
            onClick={() => setActiveReportTab('project')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'project'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Theo Đề Tài</span>
          </button>

          <button
            onClick={() => setActiveReportTab('movement')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'movement'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Nhập - Xuất - Tồn</span>
          </button>

          <button
            onClick={() => setActiveReportTab('valuation')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'valuation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Định Giá & Cơ Cấu Kho</span>
          </button>

          <button
            onClick={() => setActiveReportTab('expiry')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'expiry'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Hạn Dùng & Lãng Phí</span>
          </button>

          <button
            onClick={() => setActiveReportTab('audit')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Kiểm Kê & Chênh Lệch</span>
          </button>

          <button
            onClick={() => setActiveReportTab('exports')}
            className={`px-3 py-1.5 font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeReportTab === 'exports'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo</span>
          </button>
        </div>

        {/* Time Period Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Khoảng thời gian:</span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
          >
            <option value="ALL">Toàn bộ thời gian</option>
            <option value="TODAY">Hôm nay ({referenceDate})</option>
            <option value="7DAYS">7 ngày gần nhất</option>
            <option value="30DAYS">30 ngày qua</option>
            <option value="MONTH">Tháng 10/2026</option>
          </select>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: BÁO CÁO TIÊU HAO THEO NGƯỜI LÀM (USER USAGE & QUOTA ANALYSIS) */}
      {/* ===================================================================== */}
      {activeReportTab === 'user' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Bảng Thống Kê Tiêu Hao Theo Cá Nhân (User Consumption Analysis)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Theo dõi số lượt chiết xuất, khối lượng hóa chất và chi phí tiêu hao của từng thành viên
                </p>
              </div>

              <button
                onClick={handleExportHistory}
                className="px-3 py-1.5 text-xs font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-cyan-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file Excel người dùng</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Người làm (User)</th>
                    <th className="py-3 px-4">Đơn vị / Bộ môn</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4 text-right">Số lượt dùng</th>
                    <th className="py-3 px-4 text-right">Số hóa chất</th>
                    <th className="py-3 px-4 text-right">Chi phí ước tính (VND)</th>
                    <th className="py-3 px-4">Hạn mức & Tình trạng</th>
                    <th className="py-3 px-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageByUser.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Không có dữ liệu tiêu hao trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    usageByUser.map((row) => {
                      const isExpanded = expandedUser === row.userName;
                      const chemList = Array.from(row.chemsUsed.values());

                      return (
                        <React.Fragment key={row.userName}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{row.userName}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{row.department}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                {row.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {row.txCount} lần
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-700">
                              {chemList.length} loại
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                              {Math.round(row.totalCost).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-3 px-4">
                              {row.role === 'MANAGER' || row.role === 'ADMIN' ? (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  Toàn quyền
                                </span>
                              ) : (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Tối đa: {row.limits?.maxUsagePerTransaction || 150} mL/lần
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setExpandedUser(isExpanded ? null : row.userName)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>{isExpanded ? 'Thu gọn' : 'Xem danh mục'}</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Chemical Breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50/60 p-4 border-b border-slate-200">
                                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                  <div className="text-xs font-bold text-slate-800">
                                    Chi tiết hóa chất đã dùng bởi {row.userName}:
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {chemList.map((c, i) => (
                                      <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                                        <span className="font-medium text-slate-800">{c.chemicalName}</span>
                                        <span className="font-mono font-bold text-purple-800">
                                          {Math.round(c.qty * 100) / 100} {c.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BÁO CÁO THEO ĐỀ TÀI & DỰ ÁN (PROJECT & EXPERIMENT ANALYTICS)   */}
      {/* ===================================================================== */}
      {activeReportTab === 'project' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Báo Cáo Tiêu Hao Theo Đề Tài & Dự Án (Project Consumption)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Phân bổ định mức chi phí nguyên liệu cho từng công trình nghiên cứu và đề tài cấp cơ sở
                </p>
              </div>

              <button
                onClick={handleExportProjectCostCSV}
                className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-blue-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất file Excel Đề Tài</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Tên đề tài / Dự án (Project)</th>
                    <th className="py-3 px-4">Thí nghiệm chính</th>
                    <th className="py-3 px-4">Thành viên tham gia</th>
                    <th className="py-3 px-4 text-right">Lượt chiết</th>
                    <th className="py-3 px-4 text-right">Số hóa chất</th>
                    <th className="py-3 px-4 text-right">Chi phí nguyên liệu (VND)</th>
                    <th className="py-3 px-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageByProject.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Không có dữ liệu đề tài trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    usageByProject.map((row) => {
                      const isExpanded = expandedProject === row.projectName;
                      const chemList = Array.from(row.chemsUsed.values());

                      return (
                        <React.Fragment key={row.projectName}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{row.projectName}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {Array.from(row.experiments).join(', ') || 'Nghiên cứu cơ bản'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {Array.from(row.users).join(', ')}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {row.txCount} lần
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-700">
                              {chemList.length} loại
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                              {Math.round(row.totalCost).toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setExpandedProject(isExpanded ? null : row.projectName)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>{isExpanded ? 'Thu gọn' : 'Xem hóa chất'}</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Chemical Breakdown */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50/60 p-4 border-b border-slate-200">
                                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                                  <div className="text-xs font-bold text-slate-800">
                                    Danh mục hóa chất tiêu hao cho đề tài "{row.projectName}":
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {chemList.map((c, i) => (
                                      <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                                        <span className="font-medium text-slate-800">{c.chemicalName}</span>
                                        <span className="font-mono font-bold text-blue-800">
                                          {Math.round(c.qty * 100) / 100} {c.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BÁO CÁO NHẬP - XUẤT - TỒN TỔNG HỢP (STOCK MOVEMENT LEDGER)       */}
      {/* ===================================================================== */}
      {activeReportTab === 'movement' && (
        <div className="space-y-4">
          {/* Summary KPIs for Movement */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Tổng Nhập Trong Kỳ</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                {stockMovementSummary.sumIn.toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Nhập mới từ nhà cung cấp</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Tổng Xuất Tiêu Hao</span>
                <span className="p-1 rounded-lg bg-blue-50 text-blue-700">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                {stockMovementSummary.sumOut.toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Cấp phát cho thí nghiệm & đề tài</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Hao Hụt / Tiêu Hủy</span>
                <span className="p-1 rounded-lg bg-rose-50 text-rose-700">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-rose-700 mt-1">
                {stockMovementSummary.sumDisposed.toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">đơn vị</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Hết hạn hoặc biến chất</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Giá Trị Tồn Cuối Kỳ</span>
                <span className="p-1 rounded-lg bg-purple-50 text-purple-700">
                  <Coins className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-purple-700 mt-1">
                {stockMovementSummary.sumEndingVal.toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">đ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Định giá tài sản kho hiện thời</div>
            </div>
          </div>

          {/* Movement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpDown className="w-4 h-4 text-slate-700" />
                  <span>Sổ Báo Cáo Nhập - Xuất - Tồn Tổng Hợp (Stock Movement Ledger)</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Theo dõi biến động chi tiết: Tồn đầu kỳ + Nhập trong kỳ - Xuất trong kỳ - Hao hụt = Tồn cuối kỳ
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportMovementCSV}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-200 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất file Excel Nhập - Xuất - Tồn</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2 flex-wrap text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm hóa chất, CAS, mã code..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-hidden"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-hidden"
              >
                <option value="ALL">Tất cả nhóm hóa chất</option>
                {Array.from(new Set(chemicals.map((c) => c.category))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Mã & Hóa chất</th>
                    <th className="py-3 px-3">Phân loại</th>
                    <th className="py-3 px-3 text-center">ĐVT</th>
                    <th className="py-3 px-3 text-right">Tồn đầu kỳ</th>
                    <th className="py-3 px-3 text-right text-emerald-700">Nhập (+)</th>
                    <th className="py-3 px-3 text-right text-blue-700">Xuất (-)</th>
                    <th className="py-3 px-3 text-right text-rose-600">Hao hụt / Hủy</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900 bg-slate-100/50">Tồn cuối kỳ</th>
                    <th className="py-3 px-3 text-right">Đơn giá ước tính</th>
                    <th className="py-3 px-4 text-right">Giá trị tồn kho (VND)</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockMovementData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        Không có hóa chất nào khớp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    stockMovementData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{row.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {row.code} • CAS: {row.casNumber}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{row.category}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700 font-bold">{row.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.beginningStock}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {row.totalIn > 0 ? `+${row.totalIn}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                          {row.totalOut > 0 ? `-${row.totalOut}` : '0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-medium">
                          {row.totalDisposed > 0 ? `-${row.totalDisposed}` : '0'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/50 text-[13px]">
                          {row.endingStock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {row.unitPrice.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-700">
                          {row.totalEndingValue.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              row.stockStatus === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : row.stockStatus === 'LOW_STOCK'
                                ? 'bg-amber-100 text-amber-800'
                                : row.stockStatus === 'EMPTY'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.stockStatus === 'CRITICAL'
                              ? 'NGUY CẤP'
                              : row.stockStatus === 'LOW_STOCK'
                              ? 'CẢNH BÁO'
                              : row.stockStatus === 'EMPTY'
                              ? 'ĐÃ HẾT'
                              : 'AN TOÀN'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ĐỊNH GIÁ & CƠ CẤU DANH MỤC KHO (INVENTORY VALUATION & STRUCTURE) */}
      {/* ===================================================================== */}
      {activeReportTab === 'valuation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Table of categories */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cơ Cấu Giá Trị Tồn Kho Theo Phân Loại (Valuation by Category)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Phân bố tài sản hóa chất theo dung môi, thuốc thử, chuẩn đối chiếu và axit-bazơ
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                      <th className="py-3 px-4">Nhóm hóa chất</th>
                      <th className="py-3 px-4 text-right">Số loại</th>
                      <th className="py-3 px-4 text-right">Số chai</th>
                      <th className="py-3 px-4 text-right">Ước tính giá trị (VND)</th>
                      <th className="py-3 px-4 text-right">Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryValuation.map((cat) => {
                      const ratio =
                        summaryKPIs.totalInventoryValuation > 0
                          ? Math.round((cat.totalEstimatedValue / summaryKPIs.totalInventoryValuation) * 100)
                          : 0;

                      return (
                        <tr key={cat.category} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{cat.category}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">{cat.chemicalCount}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">{cat.bottleCount}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            {Math.round(cat.totalEstimatedValue).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {ratio}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Container state breakdown card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Tình Trạng Vỏ Chai / Lọ (Container Lifecycle)
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="font-semibold text-emerald-900">Chai nguyên (Unopened)</span>
                  <span className="font-mono font-bold text-emerald-700">{bottleStatusBreakdown.FULL} chai</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-cyan-50/60 rounded-xl border border-cyan-100">
                  <span className="font-semibold text-cyan-900">Đang mở chiết (In-Use)</span>
                  <span className="font-mono font-bold text-cyan-700">{bottleStatusBreakdown.IN_USE} chai</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="font-semibold text-amber-900">Sắp hết (Low volume)</span>
                  <span className="font-mono font-bold text-amber-700">{bottleStatusBreakdown.LOW} chai</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="font-semibold text-rose-900">Hết hạn sử dụng (Expired)</span>
                  <span className="font-mono font-bold text-rose-700">{bottleStatusBreakdown.EXPIRED} chai</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-700">Đã dùng hết (Empty)</span>
                  <span className="font-mono font-bold text-slate-700">{bottleStatusBreakdown.EMPTY} chai</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-500">Đã thanh lý (Disposed)</span>
                  <span className="font-mono font-bold text-slate-500">{bottleStatusBreakdown.DISPOSED} chai</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: HẠN DÙNG & LÃNG PHÍ (EXPIRY, WASTE & DISPOSAL REPORT)           */}
      {/* ===================================================================== */}
      {activeReportTab === 'expiry' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-rose-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Báo Cáo Hóa Chất Hết Hạn & Hao Phí (Waste & Expiry Audit)</span>
                </h2>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Kiểm soát các chai lọ đã quá hạn sử dụng cần phong tỏa sử dụng và lập biên bản thanh lý
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-rose-700 font-mono">
                  Lãng phí: {summaryKPIs.totalExpiredWaste.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-[10px] text-slate-500">{summaryKPIs.expiredBottlesCount} chai quá hạn</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Mã chai</th>
                    <th className="py-3 px-4">Tên hóa chất</th>
                    <th className="py-3 px-4">Số Lot</th>
                    <th className="py-3 px-4 text-right">Lượng còn lại</th>
                    <th className="py-3 px-4">Hạn sử dụng</th>
                    <th className="py-3 px-4">Tình trạng</th>
                    <th className="py-3 px-4 text-right">Giá trị lãng phí (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bottles
                    .filter((b) => {
                      if (b.status === 'DISPOSED' || b.currentVolume <= 0) return false;
                      return new Date(b.expiryDate).getTime() < new Date(referenceDate).getTime();
                    })
                    .map((b) => {
                      const chem = chemMap.get(b.chemicalId);
                      const unitPrice = chem?.unitPrice || 100000;
                      const wasteCost = Math.round(unitPrice * (b.initialVolume > 0 ? b.currentVolume / b.initialVolume : 1));

                      return (
                        <tr key={b.id} className="hover:bg-rose-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.bottleCode}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{chem?.name || 'Hóa chất'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{chem?.casNumber}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{b.lotNumber}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {b.currentVolume} {b.unit}
                          </td>
                          <td className="py-3 px-4 font-mono text-rose-600 font-semibold">{b.expiryDate}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              ĐÃ HẾT HẠN
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            {wasteCost.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: KIỂM KÊ & CHÊNH LỆCH THỰC TẾ (PHYSICAL COUNT & DISCREPANCIES) */}
      {/* ===================================================================== */}
      {activeReportTab === 'audit' && (
        <div className="space-y-4">
          {/* Summary KPIs for Audit */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Độ Khớp Số Sách & Thực Tế</span>
                <span className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                {auditMetrics.accuracyRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tỷ lệ chai lọ trùng khớp hoàn hảo</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Số Vụ Chênh Lệch Ghi Nhận</span>
                <span className="p-1 rounded-lg bg-amber-50 text-amber-700">
                  <Scale className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 mt-1">
                {auditMetrics.totalReports} <span className="text-xs font-normal text-slate-500">vụ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Phát hiện qua kiểm kê đối chiếu</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Đã Điều Chỉnh Tồn Kho</span>
                <span className="p-1 rounded-lg bg-blue-50 text-blue-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-blue-700 mt-1">
                {auditMetrics.resolved} <span className="text-xs font-normal text-slate-500">vụ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Đã lập phiếu bù trừ sổ sách</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>Chờ Quản Lý Xử Lý</span>
                <span className="p-1 rounded-lg bg-purple-50 text-purple-700">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-purple-700 mt-1">
                {auditMetrics.pending} <span className="text-xs font-normal text-slate-500">vụ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Biên bản đang chờ phê duyệt</div>
            </div>
          </div>

          {/* Audit Discrepancy Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-slate-700" />
                  <span>Sổ Theo Dõi Chênh Lệch & Kiểm Kê Thực Tế (Audit & Discrepancies)</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kiểm soát sai lệch giữa lượng hóa chất ghi nhận trên phần mềm và lượng cân đo thực tế
                </p>
              </div>

              <button
                onClick={handleExportAuditCSV}
                className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-200 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Biên bản Kiểm kê (Excel)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Mã biên bản</th>
                    <th className="py-3 px-4">Hóa chất & Chai</th>
                    <th className="py-3 px-3 text-right">Tồn sổ sách</th>
                    <th className="py-3 px-3 text-right">Tồn thực tế</th>
                    <th className="py-3 px-3 text-right">Sai lệch (+/-)</th>
                    <th className="py-3 px-3">Lý do ghi nhận</th>
                    <th className="py-3 px-3">Người phát hiện & Ngày</th>
                    <th className="py-3 px-4 text-center">Trạng thái xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discrepancyReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                          <span className="font-semibold text-slate-800 text-sm">
                            Tồn kho hoàn toàn trùng khớp với thực tế
                          </span>
                          <span className="text-xs text-slate-400">
                            Không có biên bản sai lệch số liệu nào chưa giải quyết trong hệ thống.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    discrepancyReports.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{row.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{row.chemicalName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {row.bottleCode ? `Mã chai: ${row.bottleCode}` : 'Kiểm kê định kỳ'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {row.systemQuantity} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {row.physicalQuantity} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={row.difference >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {row.difference > 0 ? `+${row.difference}` : row.difference} {row.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={row.reason}>
                          {row.reason}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          <div>{row.reportedBy}</div>
                          <div className="text-[10px] font-mono text-slate-400">{row.reportedDate}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              row.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : row.status === 'REJECTED'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.status === 'RESOLVED'
                              ? 'ĐÃ BÙ TRỪ KHO'
                              : row.status === 'REJECTED'
                              ? 'BỊ TỪ CHỐI'
                              : 'CHỜ PHÊ DUYỆT'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: TRUNG TÂM XUẤT BÁO CÁO TOÀN DIỆN (OFFICIAL EXPORT SUITE)        */}
      {/* ===================================================================== */}
      {activeReportTab === 'exports' && (
        <div className="space-y-4">
          {onOpenPdfReport && (
            <div className="p-4 bg-linear-to-r from-cyan-900 to-teal-900 text-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <FileText className="w-6 h-6 text-cyan-200" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Xuất Báo Cáo PDF & In Hồ Sơ Chuẩn Văn Bản A4</h3>
                  <p className="text-xs text-cyan-200">
                    Hỗ trợ in ấn hoặc lưu PDF cho danh mục tồn kho, lịch sử giao dịch và lưu trữ định kỳ
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPdfReport('INVENTORY')}
                  className="px-3.5 py-2 bg-white hover:bg-cyan-50 text-cyan-900 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF Tồn Kho</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPdfReport('TRANSACTIONS')}
                  className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>PDF Giao Dịch</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPdfReport('ARCHIVE')}
                  className="px-3.5 py-2 bg-cyan-800 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Kho Lưu Trữ</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export 1: Inventory */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Báo Cáo Tồn Kho Tổng Thể (Chemical Inventory)</h3>
                <p className="text-[11px] text-slate-500">Danh mục đầy đủ, số CAS, nồng độ, tồn kho và vị trí lưu trữ</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  exportChemicalInventoryCSV(
                    chemicals,
                    getChemicalTotalStock,
                    getChemicalStockStatus,
                    getChemicalExpiryStatus
                  );
                  showExportSuccess('Đã xuất file Chemical Inventory CSV thành công!');
                }}
                className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Tải file Excel (CSV)</span>
              </button>

              {onOpenPdfReport && (
                <button
                  type="button"
                  onClick={() => onOpenPdfReport('INVENTORY')}
                  className="w-full py-2.5 text-xs font-bold text-slate-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-cyan-700" />
                  <span>In / Lưu PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Export 2: Stock Movement (Nhập - Xuất - Tồn) */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Báo Cáo Nhập - Xuất - Tồn Tổng Hợp (Movement Ledger)</h3>
                <p className="text-[11px] text-slate-500">Biến động chi tiết: Đầu kỳ, Nhập, Xuất, Hủy, Tồn cuối kỳ và Định giá</p>
              </div>
            </div>
            <button
              onClick={handleExportMovementCSV}
              className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Sổ Nhập - Xuất - Tồn (CSV)</span>
            </button>
          </div>

          {/* Export 3: Usage History */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Nhật Ký Sử Dụng Hóa Chất (Usage History Log)</h3>
                  <p className="text-[11px] text-slate-500">Chi tiết từng lần chiết rót, người thực hiện, đề tài và thí nghiệm</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Quản lý & Admin
              </span>
            </div>
            <button
              onClick={handleExportHistory}
              className={`w-full py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                canExportHistory
                  ? 'text-white bg-purple-700 hover:bg-purple-800 shadow-xs cursor-pointer'
                  : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
              }`}
            >
              {canExportHistory ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400" />}
              <span>{canExportHistory ? 'Tải file Lịch Sử Sử Dụng (CSV)' : 'Khóa: Chỉ Quản lý'}</span>
            </button>
          </div>

          {/* Export 4: Physical Count & Discrepancies */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Biên Bản Kiểm Kê & Chênh Lệch Thực Tế (Audit Ledger)</h3>
                <p className="text-[11px] text-slate-500">Đối chiếu thực tế cân đo, sai lệch số lượng, lý do và quyết định bù trừ</p>
              </div>
            </div>
            <button
              onClick={handleExportAuditCSV}
              className="w-full py-2.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Biên Bản Kiểm Kê (CSV)</span>
            </button>
          </div>

          {/* Export 5: User Consumption & Quota */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Báo Cáo Tiêu Hao Cá Nhân (User Consumption Summary)</h3>
                <p className="text-[11px] text-slate-500">Tổng hợp lượt dùng, phân bổ chi phí nguyên liệu và hạn mức thành viên</p>
              </div>
            </div>
            <button
              onClick={handleExportUserConsumptionCSV}
              className="w-full py-2.5 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Báo Cáo Người Dùng (CSV)</span>
            </button>
          </div>

          {/* Export 6: Project Cost */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Báo Cáo Chi Phí Đề Tài & Dự Án (Project Cost Report)</h3>
                <p className="text-[11px] text-slate-500">Phân bổ chi phí hóa chất cho từng đề tài nghiên cứu và dự án thực nghiệm</p>
              </div>
            </div>
            <button
              onClick={handleExportProjectCostCSV}
              className="w-full py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Chi Phí Đề Tài (CSV)</span>
            </button>
          </div>

          {/* Export 7: Purchase List */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dự Trù & Đề Xuất Mua Hàng (Purchase List)</h3>
                <p className="text-[11px] text-slate-500">Danh mục hóa chất chạm ngưỡng cảnh báo cần nhập bổ sung</p>
              </div>
            </div>
            <button
              onClick={() => {
                exportPurchaseListCSV(purchaseItems);
                showExportSuccess('Đã xuất file Dự trù mua sắm thành công!');
              }}
              className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Dự trù Mua sắm (CSV)</span>
            </button>
          </div>

          {/* Export 8: Expiry & Disposal */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sổ Theo Dõi Hạn Dùng & Tiêu Hủy (Expiry Report)</h3>
                <p className="text-[11px] text-slate-500">Chi tiết từng chai, số Lot, hạn bảo quản và hao phí quá hạn</p>
              </div>
            </div>
            <button
              onClick={() => {
                exportExpiryReportCSV(bottles, chemicals);
                showExportSuccess('Đã xuất file Báo cáo Hạn dùng thành công!');
              }}
              className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Tải file Báo cáo Hạn dùng (CSV)</span>
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Print-Only Signature Block for Official Vietnamese Laboratory Standards */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-800 border-t border-slate-300 mt-10">
        <div>
          <div className="font-bold uppercase">Người Lập Biểu</div>
          <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
          <div className="h-20"></div>
          <div className="font-bold text-slate-900">{currentUser.name}</div>
        </div>
        <div>
          <div className="font-bold uppercase">Cán Bộ Quản Lý Kho Lab</div>
          <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
          <div className="h-20"></div>
          <div className="font-bold text-slate-900">Bùi Anh Trà</div>
        </div>
        <div>
          <div className="font-bold uppercase">Trưởng Phòng Thí Nghiệm</div>
          <div className="text-[11px] text-slate-500 italic mt-0.5">(Ký tên và đóng dấu)</div>
          <div className="h-20"></div>
          <div className="font-bold text-slate-900">PGS. TS. Trần Minh Tuấn</div>
        </div>
      </div>
    </div>
  );
};

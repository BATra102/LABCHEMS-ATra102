import React, { useState, useMemo } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical, InventoryTransaction, ChemicalUnit } from '../../types';
import { getStockStatusLabel, getExpiryStatusLabel } from '../../utils/status';
import { getRoleDisplayName } from '../../utils/roleUtils';
import {
  generateChemicalInventoryPdfHtml,
  generateTransactionHistoryPdfHtml,
  generateAndDownloadChemicalInventoryPdf,
  generateAndDownloadTransactionHistoryPdf,
  openPrintWindow,
  downloadReportFile,
  ChemicalReportData,
  TransactionReportData,
} from '../../utils/pdfExport';
import {
  X,
  Printer,
  FileText,
  Download,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  FolderArchive,
  Save,
  Trash2,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Scale,
  FlaskConical,
  PackagePlus,
  PackageMinus,
  Check,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'INVENTORY' | 'TRANSACTIONS' | 'ARCHIVE';
}

export const PdfReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialType = 'INVENTORY',
}) => {
  const {
    chemicals,
    bottles,
    transactions,
    currentUser,
    isManager,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    archivedReports,
    saveArchivedReport,
    deleteArchivedReport,
    storageCabinets,
  } = useLab();

  // Active Tab: Inventory Report, Transaction Report, or Archived Periodic Reports
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'TRANSACTIONS' | 'ARCHIVE'>(initialType);

  // Sync initial type when opening
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
    }
  }, [isOpen, initialType]);

  // Filters for Chemical Inventory Report
  const [invCategoryFilter, setInvCategoryFilter] = useState<string>('ALL');
  const [invStatusFilter, setInvStatusFilter] = useState<string>('ALL');
  const [invCabinetFilter, setInvCabinetFilter] = useState<string>('ALL');
  const [invSearchQuery, setInvSearchQuery] = useState<string>('');

  // Filters for Transaction History Report
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txTimeRange, setTxTimeRange] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS' | 'MONTH'>('ALL');
  const [txUserFilter, setTxUserFilter] = useState<string>('ALL');
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');

  // Periodic Archiving Form States
  const [archiveTitle, setArchiveTitle] = useState<string>('');
  const [archivePeriod, setArchivePeriod] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'>('MONTHLY');
  const [archiveNotes, setArchiveNotes] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    chemicals.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [chemicals]);

  // Distinct users in transactions
  const transactionUsers = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.user) set.add(t.user);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered Chemicals Data for Report
  const filteredChemicalsReportData: ChemicalReportData[] = useMemo(() => {
    return chemicals
      .filter((c) => c.status !== 'ARCHIVED')
      .filter((c) => {
        // Category filter
        if (invCategoryFilter !== 'ALL' && c.category !== invCategoryFilter) return false;

        // Cabinet filter
        if (invCabinetFilter !== 'ALL' && c.storageLocation.cabinet !== invCabinetFilter) return false;

        // Stock status filter
        const sStatus = getChemicalStockStatus(c.id);
        const eStatus = getChemicalExpiryStatus(c.id);
        if (invStatusFilter === 'CRITICAL' && sStatus !== 'CRITICAL' && sStatus !== 'EMPTY') return false;
        if (invStatusFilter === 'WARNING' && sStatus !== 'LOW_STOCK') return false;
        if (invStatusFilter === 'SAFE' && sStatus !== 'NORMAL') return false;
        if (invStatusFilter === 'EXPIRED' && eStatus !== 'EXPIRED') return false;

        // Search query
        if (invSearchQuery.trim()) {
          const q = invSearchQuery.toLowerCase().trim();
          const match =
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.casNumber.toLowerCase().includes(q) ||
            (c.englishName && c.englishName.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .map((c) => {
        const stock = getChemicalTotalStock(c.id);
        const stockStatus = getChemicalStockStatus(c.id);
        const sLabel = getStockStatusLabel(stockStatus);
        const expiryStatus = getChemicalExpiryStatus(c.id);
        const eLabel = getExpiryStatusLabel(expiryStatus);
        const bCount = bottles.filter(
          (b) => b.chemicalId === c.id && b.currentVolume > 0 && b.status !== 'ARCHIVED' && b.status !== 'DISPOSED'
        ).length;

        return {
          chemical: c,
          totalStock: stock.total,
          unit: stock.unit,
          stockStatus,
          stockStatusLabel: sLabel.text,
          expiryStatus,
          expiryStatusLabel: eLabel.text,
          bottleCount: bCount,
        };
      });
  }, [chemicals, bottles, invCategoryFilter, invCabinetFilter, invStatusFilter, invSearchQuery, getChemicalTotalStock, getChemicalStockStatus, getChemicalExpiryStatus]);

  // Inventory Summary KPIs
  const invKpis = useMemo(() => {
    const total = filteredChemicalsReportData.length;
    let bottlesCount = 0;
    let critical = 0;
    let warning = 0;
    let expired = 0;

    for (const item of filteredChemicalsReportData) {
      bottlesCount += item.bottleCount;
      if (item.stockStatus === 'CRITICAL' || item.stockStatus === 'EMPTY') critical++;
      else if (item.stockStatus === 'LOW_STOCK') warning++;
      if (item.expiryStatus === 'EXPIRED') expired++;
    }

    return { total, bottlesCount, critical, warning, expired };
  }, [filteredChemicalsReportData]);

  // Filtered Transactions Data for Report
  const filteredTransactionsReportData: TransactionReportData[] = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((t) => !t.isReversed)
      .filter((t) => {
        // Type filter
        if (txTypeFilter !== 'ALL' && t.type !== txTypeFilter) return false;

        // User filter
        if (txUserFilter !== 'ALL' && t.user !== txUserFilter) return false;

        // Time range filter
        if (txTimeRange !== 'ALL') {
          const tDate = new Date(t.date || t.timestamp);
          if (txTimeRange === 'TODAY') {
            const todayStr = now.toISOString().split('T')[0];
            const itemStr = tDate.toISOString().split('T')[0];
            if (itemStr !== todayStr) return false;
          } else if (txTimeRange === '7DAYS') {
            const past7 = new Date(now.getTime() - 7 * 86400000);
            if (tDate < past7) return false;
          } else if (txTimeRange === '30DAYS') {
            const past30 = new Date(now.getTime() - 30 * 86400000);
            if (tDate < past30) return false;
          } else if (txTimeRange === 'MONTH') {
            if (tDate.getMonth() !== now.getMonth() || tDate.getFullYear() !== now.getFullYear()) return false;
          }
        }

        // Search query
        if (txSearchQuery.trim()) {
          const q = txSearchQuery.toLowerCase().trim();
          const match =
            t.chemicalName.toLowerCase().includes(q) ||
            t.user.toLowerCase().includes(q) ||
            (t.bottleCode && t.bottleCode.toLowerCase().includes(q)) ||
            (t.project && t.project.toLowerCase().includes(q)) ||
            (t.purpose && t.purpose.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .map((t) => ({ transaction: t }));
  }, [transactions, txTypeFilter, txUserFilter, txTimeRange, txSearchQuery]);

  // Transaction Summary KPIs
  const txKpis = useMemo(() => {
    const total = filteredTransactionsReportData.length;
    let inCount = 0;
    let outCount = 0;
    let inQty = 0;
    let outQty = 0;

    for (const item of filteredTransactionsReportData) {
      const t = item.transaction;
      if (t.type === 'STOCK_IN') {
        inCount++;
        inQty += Math.abs(t.quantity);
      } else if (t.type === 'USAGE') {
        outCount++;
        outQty += Math.abs(t.quantity);
      }
    }

    return { total, inCount, outCount, inQty, outQty };
  }, [filteredTransactionsReportData]);

  // Today Date String
  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const nowReportCode = useMemo(() => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 900 + 100);
    return activeTab === 'INVENTORY' ? `BC-TK-${ymd}-${rand}` : `BC-GD-${ymd}-${rand}`;
  }, [activeTab]);

  /**
   * Print or Save PDF
   */
  const handlePrintOrSavePdf = () => {
    if (activeTab === 'INVENTORY') {
      const html = generateChemicalInventoryPdfHtml({
        reportCode: nowReportCode,
        generatedDate: todayStr,
        generatedBy: currentUser.name,
        roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
        chemicals: filteredChemicalsReportData,
        filterCategory: invCategoryFilter === 'ALL' ? undefined : invCategoryFilter,
        totalChemicals: invKpis.total,
        totalBottles: invKpis.bottlesCount,
        criticalCount: invKpis.critical,
        warningCount: invKpis.warning,
        expiredCount: invKpis.expired,
        notes: archiveNotes.trim() || undefined,
      });
      openPrintWindow(html, `Báo cáo Tồn kho Hóa chất - ${nowReportCode}`);
    } else if (activeTab === 'TRANSACTIONS') {
      const html = generateTransactionHistoryPdfHtml({
        reportCode: nowReportCode,
        generatedDate: todayStr,
        generatedBy: currentUser.name,
        roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
        transactions: filteredTransactionsReportData,
        filterType: txTypeFilter === 'ALL' ? 'Tất cả các loại giao dịch' : txTypeFilter === 'STOCK_IN' ? 'Chỉ giao dịch Nhập kho' : 'Chỉ giao dịch Sử dụng',
        filterTimeRange: txTimeRange === 'ALL' ? 'Toàn bộ thời gian' : txTimeRange === 'TODAY' ? 'Hôm nay' : txTimeRange === '7DAYS' ? '7 ngày qua' : 'Tháng này',
        totalTransactions: txKpis.total,
        totalStockInQty: txKpis.inQty,
        totalUsageQty: txKpis.outQty,
        totalStockInCount: txKpis.inCount,
        totalUsageCount: txKpis.outCount,
        notes: archiveNotes.trim() || undefined,
      });
      openPrintWindow(html, `Báo cáo Lịch sử Giao dịch - ${nowReportCode}`);
    }
  };

  /**
   * Direct PDF Export (.pdf file download)
   */
  const handleDirectPdfDownload = async () => {
    try {
      setIsExportingPdf(true);
      if (activeTab === 'INVENTORY') {
        await generateAndDownloadChemicalInventoryPdf({
          reportCode: nowReportCode,
          generatedDate: todayStr,
          generatedBy: currentUser.name,
          roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
          chemicals: filteredChemicalsReportData,
          filterCategory: invCategoryFilter === 'ALL' ? undefined : invCategoryFilter,
          totalChemicals: invKpis.total,
          totalBottles: invKpis.bottlesCount,
          criticalCount: invKpis.critical,
          warningCount: invKpis.warning,
          expiredCount: invKpis.expired,
          notes: archiveNotes.trim() || undefined,
        });
      } else if (activeTab === 'TRANSACTIONS') {
        await generateAndDownloadTransactionHistoryPdf({
          reportCode: nowReportCode,
          generatedDate: todayStr,
          generatedBy: currentUser.name,
          roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
          transactions: filteredTransactionsReportData,
          filterType: txTypeFilter === 'ALL' ? 'Tất cả các loại giao dịch' : txTypeFilter === 'STOCK_IN' ? 'Chỉ giao dịch Nhập kho' : 'Chỉ giao dịch Sử dụng',
          filterTimeRange: txTimeRange === 'ALL' ? 'Toàn bộ thời gian' : txTimeRange === 'TODAY' ? 'Hôm nay' : txTimeRange === '7DAYS' ? '7 ngày qua' : 'Tháng này',
          totalTransactions: txKpis.total,
          totalStockInQty: txKpis.inQty,
          totalUsageQty: txKpis.outQty,
          totalStockInCount: txKpis.inCount,
          totalUsageCount: txKpis.outCount,
          notes: archiveNotes.trim() || undefined,
        });
      }
    } catch (err) {
      console.error('Lỗi khi xuất file PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  /**
   * Download Standalone Report File (.html with print trigger)
   */
  const handleDownloadReportFile = () => {
    if (activeTab === 'INVENTORY') {
      const html = generateChemicalInventoryPdfHtml({
        reportCode: nowReportCode,
        generatedDate: todayStr,
        generatedBy: currentUser.name,
        roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
        chemicals: filteredChemicalsReportData,
        totalChemicals: invKpis.total,
        totalBottles: invKpis.bottlesCount,
        criticalCount: invKpis.critical,
        warningCount: invKpis.warning,
        expiredCount: invKpis.expired,
        notes: archiveNotes.trim() || undefined,
      });
      downloadReportFile(`Bao_Cao_Ton_Kho_${nowReportCode}.html`, html);
    } else if (activeTab === 'TRANSACTIONS') {
      const html = generateTransactionHistoryPdfHtml({
        reportCode: nowReportCode,
        generatedDate: todayStr,
        generatedBy: currentUser.name,
        roleDisplayName: getRoleDisplayName(currentUser.role, currentUser.email),
        transactions: filteredTransactionsReportData,
        totalTransactions: txKpis.total,
        totalStockInQty: txKpis.inQty,
        totalUsageQty: txKpis.outQty,
        totalStockInCount: txKpis.inCount,
        totalUsageCount: txKpis.outCount,
        notes: archiveNotes.trim() || undefined,
      });
      downloadReportFile(`Bao_Cao_Lich_Su_Giao_Dich_${nowReportCode}.html`, html);
    }
  };

  /**
   * Save to Periodic Archive
   */
  const handleSaveToArchive = () => {
    const title = archiveTitle.trim() || (activeTab === 'INVENTORY'
      ? `Báo cáo Tồn kho Hóa chất Định kỳ (${todayStr})`
      : `Báo cáo Lịch sử Giao dịch Định kỳ (${todayStr})`);

    const result = saveArchivedReport({
      code: nowReportCode,
      title,
      reportType: activeTab === 'INVENTORY' ? 'INVENTORY' : 'TRANSACTIONS',
      period: archivePeriod,
      startDate: todayStr,
      endDate: todayStr,
      createdBy: currentUser.name,
      createdById: currentUser.id,
      totalItems: activeTab === 'INVENTORY' ? invKpis.total : txKpis.total,
      totalTransactions: activeTab === 'TRANSACTIONS' ? txKpis.total : undefined,
      totalVolumeIn: activeTab === 'TRANSACTIONS' ? txKpis.inQty : undefined,
      totalVolumeOut: activeTab === 'TRANSACTIONS' ? txKpis.outQty : undefined,
      summaryNotes: archiveNotes.trim() || 'Lưu trữ định kỳ tự động',
    });

    if (result.success) {
      setSaveSuccessMsg(result.message);
      setArchiveTitle('');
      setArchiveNotes('');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-cyan-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Xuất Báo Cáo PDF & In Ấn Hồ Sơ Phòng Lab
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                  LabChems Anhtra102
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Xuất danh sách tồn kho, lịch sử giao dịch ra PDF chuẩn in ấn A4 hoặc lưu trữ định kỳ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('INVENTORY')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'INVENTORY'
                  ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FlaskConical className="w-4 h-4 text-cyan-600" />
              <span>Báo Cáo Tồn Kho Hóa Chất</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 font-mono text-slate-700">
                {invKpis.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'TRANSACTIONS'
                  ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4 text-cyan-600" />
              <span>Báo Cáo Lịch Sử Giao Dịch</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 font-mono text-slate-700">
                {txKpis.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVE')}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'ARCHIVE'
                  ? 'border-cyan-600 text-cyan-800 bg-cyan-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FolderArchive className="w-4 h-4 text-cyan-600" />
              <span>Kho Lưu Trữ Báo Cáo Định Kỳ</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 font-mono text-slate-700">
                {archivedReports.length}
              </span>
            </button>
          </div>

          {activeTab !== 'ARCHIVE' && (
            <div className="flex items-center gap-2 pb-2">
              <button
                type="button"
                onClick={handleDirectPdfDownload}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 bg-linear-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Tải trực tiếp file PDF chuẩn in ấn A4 ngang về máy tính / điện thoại"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tạo PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>📥 Tải File PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrintOrSavePdf}
                className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Mở hộp thoại in và tùy chọn In ngay hoặc Lưu PDF bằng trình duyệt"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>🖨️ In Báo Cáo / Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReportFile}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Tải file báo cáo HTML standalone dự phòng"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>File HTML</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* TAB 1: CHEMICAL INVENTORY REPORT */}
          {activeTab === 'INVENTORY' && (
            <div className="space-y-4">
              {/* Filter Tool Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Nhóm / Phân loại
                  </label>
                  <select
                    value={invCategoryFilter}
                    onChange={(e) => setInvCategoryFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Tất cả nhóm hóa chất</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Trạng thái tồn kho
                  </label>
                  <select
                    value={invStatusFilter}
                    onChange={(e) => setInvStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="SAFE">Tồn an toàn / Đạt chuẩn</option>
                    <option value="WARNING">Cảnh báo sắp hết</option>
                    <option value="CRITICAL">Mức nguy cấp</option>
                    <option value="EXPIRED">Hóa chất đã hết hạn</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Vị trí tủ lưu trữ
                  </label>
                  <select
                    value={invCabinetFilter}
                    onChange={(e) => setInvCabinetFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Tất cả các tủ cất giữ</option>
                    {storageCabinets.map((cab) => (
                      <option key={cab.id} value={cab.name}>
                        {cab.name} ({cab.room})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tìm kiếm nhanh
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                    <input
                      type="text"
                      value={invSearchQuery}
                      onChange={(e) => setInvSearchQuery(e.target.value)}
                      placeholder="Tên, CAS, mã HC..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Cards Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-slate-900">{invKpis.total}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Số loại HC</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-cyan-700">{invKpis.bottlesCount}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Chai thực tế</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-emerald-600">
                    {invKpis.total - invKpis.critical - invKpis.warning}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Tồn an toàn</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-amber-600">{invKpis.warning}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Cảnh báo thiếu</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-rose-600">{invKpis.critical}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Mức nguy cấp</div>
                </div>
              </div>

              {/* Live Preview Paper Container */}
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    👁️ Bản xem trước báo cáo (Khổ giấy in A4 Landscape)
                  </span>
                  <span className="font-mono text-[11px]">Mã báo cáo: {nowReportCode}</span>
                </div>

                <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-teal-800 text-white font-mono text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center">STT</th>
                        <th className="px-3 py-2">Mã HC</th>
                        <th className="px-3 py-2">Tên Hóa Chất</th>
                        <th className="px-3 py-2">Số CAS</th>
                        <th className="px-3 py-2">Phân Loại</th>
                        <th className="px-3 py-2 text-right">Tồn Kho</th>
                        <th className="px-3 py-2 text-center">Số Chai</th>
                        <th className="px-3 py-2">Vị Trí</th>
                        <th className="px-3 py-2 text-center">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredChemicalsReportData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                            Không có hóa chất nào khớp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredChemicalsReportData.map((item, idx) => (
                          <tr key={item.chemical.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                            <td className="px-3 py-2 font-bold text-teal-700">{item.chemical.code}</td>
                            <td className="px-3 py-2 font-sans font-semibold text-slate-900">
                              {item.chemical.name}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{item.chemical.casNumber}</td>
                            <td className="px-3 py-2 font-sans text-slate-600">{item.chemical.category}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                              {item.totalStock} {item.unit}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-700">{item.bottleCount} chai</td>
                            <td className="px-3 py-2 font-sans text-slate-600 text-[10px]">
                              {item.chemical.storageLocation.cabinet}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.stockStatus === 'CRITICAL'
                                    ? 'bg-rose-100 text-rose-800'
                                    : item.stockStatus === 'WARNING' || item.stockStatus === 'LOW'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {item.stockStatusLabel}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Periodic Archiving Section */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl">
                  <div className="flex-1 space-y-1.5">
                    <label className="block font-bold text-slate-700">
                      📁 Lưu trữ báo cáo định kỳ vào hồ sơ hệ thống
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={archiveTitle}
                        onChange={(e) => setArchiveTitle(e.target.value)}
                        placeholder="Tiêu đề (vd: Báo cáo Kiểm kê Tồn kho Tháng 10/2026)..."
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-cyan-600"
                      />
                      <select
                        value={archivePeriod}
                        onChange={(e) => setArchivePeriod(e.target.value as any)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-cyan-600"
                      >
                        <option value="WEEKLY">Báo cáo Tuần (Weekly)</option>
                        <option value="MONTHLY">Báo cáo Tháng (Monthly)</option>
                        <option value="QUARTERLY">Báo cáo Quý (Quarterly)</option>
                        <option value="YEARLY">Báo cáo Năm (Yearly)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveToArchive}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Vào Kho Báo Cáo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTION HISTORY REPORT */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              {/* Filter Tool Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Loại giao dịch
                  </label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Tất cả giao dịch (Nhập & Xuất)</option>
                    <option value="STOCK_IN">Chỉ giao dịch Nhập kho (STOCK_IN)</option>
                    <option value="USAGE">Chỉ giao dịch Xuất sử dụng (USAGE)</option>
                    <option value="ADJUSTMENT">Chỉ điều chỉnh kho (ADJUSTMENT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Khoảng thời gian
                  </label>
                  <select
                    value={txTimeRange}
                    onChange={(e) => setTxTimeRange(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Toàn bộ thời gian</option>
                    <option value="TODAY">Hôm nay</option>
                    <option value="7DAYS">7 ngày qua</option>
                    <option value="30DAYS">30 ngày qua</option>
                    <option value="MONTH">Tháng hiện tại</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Người thực hiện
                  </label>
                  <select
                    value={txUserFilter}
                    onChange={(e) => setTxUserFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                  >
                    <option value="ALL">Tất cả thành viên</option>
                    {transactionUsers.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Tìm kiếm giao dịch
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                    <input
                      type="text"
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                      placeholder="Hóa chất, mã chai, đề tài..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-cyan-600"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Cards Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-slate-900">{txKpis.total}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Tổng giao dịch</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-emerald-700">{txKpis.inCount}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Lượt nhập kho</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-cyan-700">{txKpis.outCount}</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Lượt xuất dùng</div>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
                  <div className="text-xl font-bold font-mono text-cyan-800">
                    -{Math.round(txKpis.outQty * 10) / 10}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Tổng lượng tiêu hao</div>
                </div>
              </div>

              {/* Live Preview Paper Container */}
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    👁️ Bản xem trước báo cáo lịch sử giao dịch (Khổ giấy A4 Landscape)
                  </span>
                  <span className="font-mono text-[11px]">Mã báo cáo: {nowReportCode}</span>
                </div>

                <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-teal-800 text-white font-mono text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center">STT</th>
                        <th className="px-3 py-2">Thời Gian</th>
                        <th className="px-3 py-2 text-center">Loại GD</th>
                        <th className="px-3 py-2">Tên Hóa Chất</th>
                        <th className="px-3 py-2">Mã Chai</th>
                        <th className="px-3 py-2 text-right">Số Lượng</th>
                        <th className="px-3 py-2 text-right">Tồn Sau GD</th>
                        <th className="px-3 py-2">Người Thao Tác</th>
                        <th className="px-3 py-2">Mục Đích / Đề Tài</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredTransactionsReportData.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                            Không có giao dịch nào khớp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactionsReportData.map((item, idx) => {
                          const t = item.transaction;
                          const isStockIn = t.type === 'STOCK_IN';
                          return (
                            <tr key={t.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2 text-slate-600">{t.date || t.timestamp.split('T')[0]}</td>
                              <td className="px-3 py-2 text-center font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isStockIn ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'
                                  }`}
                                >
                                  {isStockIn ? 'Nhập kho' : 'Xuất dùng'}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-sans font-semibold text-slate-900">
                                {t.chemicalName}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{t.bottleCode || '—'}</td>
                              <td
                                className={`px-3 py-2 text-right font-bold ${
                                  isStockIn ? 'text-emerald-700' : 'text-cyan-700'
                                }`}
                              >
                                {isStockIn ? '+' : '-'}
                                {Math.abs(t.quantity)} {t.unit}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-800 font-bold">
                                {t.newStock} {t.unit}
                              </td>
                              <td className="px-3 py-2 font-sans text-slate-800">{t.user}</td>
                              <td className="px-3 py-2 font-sans text-slate-600 text-[10px]">
                                {t.project || t.purpose || 'Thí nghiệm'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Periodic Archiving Section */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl">
                  <div className="flex-1 space-y-1.5">
                    <label className="block font-bold text-slate-700">
                      📁 Lưu trữ báo cáo giao dịch định kỳ
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={archiveTitle}
                        onChange={(e) => setArchiveTitle(e.target.value)}
                        placeholder="Tiêu đề (vd: Báo cáo Tổng hợp Xuất Nhập Tuần 40/2026)..."
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-cyan-600"
                      />
                      <select
                        value={archivePeriod}
                        onChange={(e) => setArchivePeriod(e.target.value as any)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-cyan-600"
                      >
                        <option value="WEEKLY">Báo cáo Tuần (Weekly)</option>
                        <option value="MONTHLY">Báo cáo Tháng (Monthly)</option>
                        <option value="QUARTERLY">Báo cáo Quý (Quarterly)</option>
                        <option value="YEARLY">Báo cáo Năm (Yearly)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveToArchive}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Vào Kho Báo Cáo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PERIODIC ARCHIVED REPORTS LIST */}
          {activeTab === 'ARCHIVE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Kho Lưu Trữ Hồ Sơ & Báo Cáo Định Kỳ ({archivedReports.length} báo cáo)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Các bản ghi báo cáo tuần, tháng, quý đã được chốt số liệu và lưu trữ chính thức
                  </p>
                </div>
              </div>

              {archivedReports.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Chưa có báo cáo định kỳ nào trong kho lưu trữ.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {archivedReports.map((rep) => {
                    const isInv = rep.reportType === 'INVENTORY';
                    return (
                      <div
                        key={rep.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-cyan-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                  isInv ? 'bg-teal-100 text-teal-800' : 'bg-cyan-100 text-cyan-800'
                                }`}
                              >
                                {isInv ? 'TỒN KHO' : 'GIAO DỊCH'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 font-semibold">
                                {rep.code}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm mt-1">{rep.title}</h4>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {rep.period === 'WEEKLY'
                              ? 'Tuần'
                              : rep.period === 'MONTHLY'
                              ? 'Tháng'
                              : rep.period === 'QUARTERLY'
                              ? 'Quý'
                              : 'Năm'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">{rep.summaryNotes}</p>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <div>
                            <span>Người lập: <strong>{rep.createdBy}</strong></span>
                            <span className="mx-1.5">·</span>
                            <span>{new Date(rep.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isInv) {
                                  setActiveTab('INVENTORY');
                                  handlePrintOrSavePdf();
                                } else {
                                  setActiveTab('TRANSACTIONS');
                                  handlePrintOrSavePdf();
                                }
                              }}
                              className="p-1.5 text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                              title="In ấn lại hoặc lưu PDF"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {isManager && (
                              <button
                                type="button"
                                onClick={() => deleteArchivedReport(rep.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Xóa báo cáo này khỏi kho lưu trữ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

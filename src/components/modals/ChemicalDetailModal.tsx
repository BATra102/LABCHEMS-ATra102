import React, { useState, useMemo } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical, Bottle } from '../../types';
import { getStockStatusLabel, getExpiryStatusLabel, getBottleStatusLabel, getDaysRemaining } from '../../utils/status';
import { getBottleQrId } from '../../utils/qrCode';
import {
  X,
  Edit2,
  Plus,
  FlaskConical,
  Package,
  Calendar,
  MapPin,
  Clock,
  History,
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Printer,
  ShieldAlert,
  Layers,
  FileText,
  Building2,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Info,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface Props {
  chemical: Chemical | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit: (chem: Chemical) => void;
  onOpenRecordUsage: (chemicalId: string, bottleId?: string) => void;
  onOpenStockIn: (chemicalId: string) => void;
  onOpenBottleDetail: (bottle: Bottle) => void;
  onOpenPrintLabels?: (bottles: Bottle[]) => void;
  onOpenDeleteChemical?: (chem: Chemical) => void;
}

type TabType = 'overview' | 'bottles' | 'stock' | 'usage' | 'stockin' | 'audit';

export const ChemicalDetailModal: React.FC<Props> = ({
  chemical,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenBottleDetail,
  onOpenPrintLabels,
  onOpenDeleteChemical,
}) => {
  const {
    bottles,
    transactions,
    auditLogs,
    isManager,
    currentUser,
    referenceDate,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    recordUsage,
  } = useLab();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [bottleSearch, setBottleSearch] = useState('');
  const [bottleStatusFilter, setBottleStatusFilter] = useState<string>('ALL');
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  if (!isOpen || !chemical) return null;

  const totalStock = getChemicalTotalStock(chemical.id);
  const stockStatus = getChemicalStockStatus(chemical.id);
  const expiryStatus = getChemicalExpiryStatus(chemical.id);

  const stockStatusInfo = getStockStatusLabel(stockStatus);
  const expiryStatusInfo = getExpiryStatusLabel(expiryStatus);

  // Bottles of this chemical
  const chemBottles = bottles.filter((b) => b.chemicalId === chemical.id);

  // Filtered bottles in bottle tab
  const filteredBottles = chemBottles.filter((b) => {
    if (bottleStatusFilter !== 'ALL' && b.status !== bottleStatusFilter) return false;
    if (!bottleSearch.trim()) return true;
    const q = bottleSearch.toLowerCase();
    const qrId = b.qrId || getBottleQrId(b.bottleCode);
    return (
      b.bottleCode.toLowerCase().includes(q) ||
      b.lotNumber.toLowerCase().includes(q) ||
      qrId.toLowerCase().includes(q) ||
      b.location.cabinet.toLowerCase().includes(q) ||
      b.location.shelf.toLowerCase().includes(q)
    );
  });

  // Bottle status stats
  const activeCount = chemBottles.filter((b) => b.status === 'IN_USE').length;
  const sealedCount = chemBottles.filter((b) => b.status === 'FULL' || b.status === 'UNOPENED').length;
  const emptyCount = chemBottles.filter((b) => b.status === 'EMPTY' || b.currentVolume <= 0).length;
  const disposedCount = chemBottles.filter((b) => b.status === 'DISPOSED').length;

  // Expiry statistics
  const expiredCount = chemBottles.filter((b) => getDaysRemaining(b.expiryDate, referenceDate) <= 0 && b.status !== 'DISPOSED').length;
  const expiringSoonCount = chemBottles.filter((b) => {
    const days = getDaysRemaining(b.expiryDate, referenceDate);
    return days > 0 && days <= 90 && b.status !== 'DISPOSED';
  }).length;

  // Closest expiry
  const validBottles = chemBottles.filter((b) => b.status !== 'DISPOSED' && b.currentVolume > 0);
  const sortedByExpiry = [...validBottles].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const nearestExpiryBottle = sortedByExpiry[0];
  const nearestDays = nearestExpiryBottle ? getDaysRemaining(nearestExpiryBottle.expiryDate, referenceDate) : null;

  // Transactions of this chemical
  const usageTxs = transactions.filter(
    (t) => t.chemicalId === chemical.id && t.type === 'USAGE' && !t.isReversed
  );
  const stockInTxs = transactions.filter(
    (t) => t.chemicalId === chemical.id && (t.type === 'STOCK_IN' || t.type === 'INITIAL')
  );

  // Audit logs related to this chemical
  const chemAudits = auditLogs.filter(
    (a) => a.entityId === chemical.id || a.description.includes(chemical.name) || (chemical.code && a.description.includes(chemical.code))
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Bar */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold shrink-0 shadow-inner">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {chemical.code}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {chemical.name}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stockStatusInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stockStatusInfo.dotClass}`} />
                  {stockStatusInfo.text}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono">
                {chemical.englishName && <span className="italic">{chemical.englishName}</span>}
                <span>·</span>
                <span>CAS: {chemical.casNumber}</span>
                <span>·</span>
                <span className="text-cyan-400 font-semibold">{chemical.category}</span>
                <span>·</span>
                <span>Grade: {chemical.grade}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {/* MANAGER ONLY EDIT BUTTON (Section 13, 17, 20) */}
            {isManager && (
              <button
                type="button"
                onClick={() => onOpenEdit(chemical)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                title="Chỉnh sửa thông tin hóa chất (Chỉ dành cho Quản lý)"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            )}

            {/* MANAGER ONLY DELETE (SOFT-DELETE) BUTTON */}
            {isManager && onOpenDeleteChemical && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDeleteChemical(chemical);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
                title="Xóa / Lưu trữ hóa chất an toàn (Cơ chế Soft-delete có thể khôi phục)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            )}

            {/* Quick 1-click use full bottle (Cách 1) */}
            <button
              type="button"
              onClick={() => {
                const res = recordUsage({
                  chemicalId: chemical.id,
                  useFullBottle: true,
                  source: 'MANUAL',
                  purpose: 'Dùng hết 1 chai',
                  notes: '[Cách 1] Dùng hết 1 chai',
                });
                if (res.success) {
                  setQuickNotice(res.message);
                  setTimeout(() => setQuickNotice(null), 3500);
                } else {
                  setQuickNotice(res.message);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
              title="Dùng hết 1 chai (Cách 1: Không cần nhập số mL)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-800" />
              <span>Dùng 1 Chai</span>
            </button>

            {/* Record Usage Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRecordUsage(chemical.id);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-sm cursor-pointer hover:scale-105 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi Dùng</span>
            </button>

            {/* Stock In Button (Manager only) */}
            {isManager && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStockIn(chemical.id);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl transition-colors cursor-pointer border border-slate-700"
              >
                <span>Nhập kho</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer ml-1"
              title="Đóng chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hazard Safety Alert Banner (Section 14) */}
        {chemical.safetyInfo?.ghsPictograms && chemical.safetyInfo.ghsPictograms.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-300/30 flex items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">Cảnh báo an toàn GHS:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {chemical.safetyInfo.ghsPictograms.map((ghs) => (
                  <span
                    key={ghs}
                    className="px-2 py-0.5 text-[10px] font-bold font-mono bg-white border border-amber-300 rounded text-amber-900 shadow-2xs"
                  >
                    {ghs.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-amber-800 hidden md:inline">
              Vui lòng đảm bảo thao tác đúng quy trình an toàn của phòng thí nghiệm.
            </span>
          </div>
        )}

        {/* Navigation Tabs (Section 27) */}
        <div className="px-5 border-b border-slate-200 bg-slate-50 flex items-center gap-1 overflow-x-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Thông Tin Hóa Chất
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bottles')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bottles'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Các Chai / Lọ</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold font-mono">
              {chemBottles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stock'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Tồn Kho & Hạn Dùng</span>
            {stockStatus === 'CRITICAL' && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'usage'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Lịch Sử Dùng</span>
            <span className="text-[10px] font-mono text-slate-500">({usageTxs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stockin')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stockin'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Lịch Sử Nhập Kho</span>
            <span className="text-[10px] font-mono text-slate-500">({stockInTxs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Nhật Ký Kiểm Toán</span>
            <span className="text-[10px] font-mono text-slate-500">({chemAudits.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {quickNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
              <span>{quickNotice}</span>
              <button onClick={() => setQuickNotice(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
          )}

          {/* TAB 1: OVERVIEW & CHEMICAL INFORMATION */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">Tổng tồn hiện tại</span>
                  <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                    {totalStock.total} <span className="text-xs font-normal text-slate-500">{totalStock.unit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tự động tính từ các chai</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">Mức tối thiểu (Min)</span>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                    {chemical.minimumStock} <span className="text-xs font-normal text-slate-500">{chemical.primaryUnit}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Mức kích hoạt đề xuất mua</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">Số chai trong kho</span>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                    {chemBottles.length} <span className="text-xs font-normal text-slate-500">chai</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{activeCount} đang dùng · {sealedCount} nguyên</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">Hạn dùng gần nhất</span>
                  <div className={`text-base font-bold mt-1 font-mono ${nearestDays !== null && nearestDays <= 90 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {nearestExpiryBottle ? nearestExpiryBottle.expiryDate : 'Chưa có'}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {nearestDays !== null ? (nearestDays <= 0 ? 'Đã hết hạn' : `Còn ${nearestDays} ngày`) : '---'}
                  </span>
                </div>
              </div>

              {/* Chemical Master Details Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-700" />
                    <span>Hồ Sơ Hóa Chất (Master Data)</span>
                  </h3>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => onOpenEdit(chemical)}
                      className="text-xs text-cyan-700 hover:text-cyan-800 font-semibold flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Sửa hồ sơ</span>
                    </button>
                  )}
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-xs divide-y md:divide-y-0 divide-slate-100">
                  <div className="space-y-2.5">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Tên hóa chất (Việt):</span>
                      <span className="font-bold text-slate-900 text-right">{chemical.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Tên tiếng Anh (IUPAC / Synonym):</span>
                      <span className="font-medium text-slate-800 text-right">{chemical.englishName || '---'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Số đăng ký CAS:</span>
                      <span className="font-mono font-bold text-slate-900">{chemical.casNumber}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Công thức phân tử:</span>
                      <span className="font-mono font-medium text-slate-800">{chemical.chemicalFormula || '---'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Khối lượng phân tử (MW):</span>
                      <span className="font-mono text-slate-800">{chemical.molecularWeight ? `${chemical.molecularWeight} g/mol` : '---'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Phân loại / Nhóm:</span>
                      <span className="font-semibold text-cyan-800">{chemical.category}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Cấp tinh khiết (Grade):</span>
                      <span className="font-mono font-bold text-slate-800">{chemical.grade}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-3 md:pt-0">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Nhà sản xuất:</span>
                      <span className="font-medium text-slate-800">{chemical.manufacturer || 'Merck / Sigma'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Mã Catalog No:</span>
                      <span className="font-mono text-slate-800">{chemical.catalogNumber || '---'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Dạng vật lý & Đơn vị:</span>
                      <span className="text-slate-800">{chemical.physicalForm === 'liquid' ? 'Chất lỏng' : 'Chất rắn'} ({chemical.primaryUnit})</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Vị trí lưu trữ mặc định:</span>
                      <span className="font-semibold text-slate-900">
                        {chemical.storageLocation.cabinet} · {chemical.storageLocation.shelf} ({chemical.storageLocation.room})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Điều kiện bảo quản:</span>
                      <span className="text-slate-700 text-right max-w-[220px]">{chemical.storageConditions || 'Nhiệt độ phòng (15-25°C)'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Tài liệu an toàn (SDS):</span>
                      {chemical.safetyInfo?.sdsUrl ? (
                        <a
                          href={chemical.safetyInfo.sdsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-700 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Xem file SDS</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">Chưa tải lên</span>
                      )}
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Đơn giá ước tính:</span>
                      <span className="font-mono text-slate-800">
                        {chemical.unitPrice ? `${chemical.unitPrice.toLocaleString('vi-VN')} đ/${chemical.primaryUnit}` : 'Chưa nhập'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BOTTLES LIST (Section 8, 9, 12) */}
          {activeTab === 'bottles' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={bottleSearch}
                      onChange={(e) => setBottleSearch(e.target.value)}
                      placeholder="Tìm mã chai, số Lot, mã QR (HEX-001)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:border-cyan-600"
                    />
                  </div>
                  <select
                    value={bottleStatusFilter}
                    onChange={(e) => setBottleStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-700"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="IN_USE">Đang mở dùng (IN USE)</option>
                    <option value="FULL">Còn nguyên (SEALED)</option>
                    <option value="LOW">Sắp hết (LOW)</option>
                    <option value="EMPTY">Đã hết (EMPTY)</option>
                    <option value="ARCHIVED">Đã lưu trữ (ARCHIVED)</option>
                    <option value="EXPIRED">Hết hạn (EXPIRED)</option>
                    <option value="DISPOSED">Đã thanh lý</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenPrintLabels && chemBottles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenPrintLabels(chemBottles)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="In tem nhãn QR cho toàn bộ chai của hóa chất này"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>In Nhãn Tất Cả Chai</span>
                    </button>
                  )}

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenStockIn(chemical.id);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nhập Thêm Chai</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Bottles */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                {/* Mobile Bottle Cards (Section 15: Chi tiết hóa chất Mobile) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredBottles.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Không có chai nào phù hợp với bộ lọc.
                    </div>
                  ) : (
                    filteredBottles.map((b) => {
                      const statusBadge = getBottleStatusLabel(b.status);
                      const days = getDaysRemaining(b.expiryDate, referenceDate);

                      return (
                        <div
                          key={b.id}
                          onClick={() => onOpenBottleDetail(b)}
                          className="p-4 space-y-2.5 hover:bg-cyan-50/20 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-cyan-950">{b.bottleCode}</span>
                              {b.status === 'IN_USE' && (
                                <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-bold">
                                  Đang mở
                                </span>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                              {statusBadge.text}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block font-mono">TỒN HIỆN TẠI</span>
                              <span className="font-bold font-mono text-slate-900 text-xs">
                                {b.currentVolume} <span className="text-slate-400 text-[10px] font-normal">/ {b.initialVolume} {b.unit}</span>
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block font-mono">HẠN DÙNG</span>
                              <span className={`font-mono font-bold text-xs ${days <= 0 ? 'text-rose-600' : days <= 90 ? 'text-amber-600' : 'text-slate-700'}`}>
                                {b.expiryDate}
                              </span>
                            </div>
                            <div className="col-span-2 text-slate-600 text-[11px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{b.location.cabinet} · Kệ {b.location.shelf}</span>
                            </div>
                          </div>

                          {b.currentVolume > 0 && b.status !== 'DISPOSED' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                onOpenRecordUsage(chemical.id, b.id);
                              }}
                              className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>📷 Dùng chai này</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View (≥ md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-bold">Mã Chai (Bottle ID)</th>
                        <th className="px-3 py-3 font-semibold">Mã QR</th>
                        <th className="px-3 py-3 font-semibold">Số Lô (Lot)</th>
                        <th className="px-4 py-3 font-semibold text-right">Tồn Hiện Tại</th>
                        <th className="px-3 py-3 font-semibold">Hạn Dùng</th>
                        <th className="px-3 py-3 font-semibold">Vị Trí Tủ</th>
                        <th className="px-3 py-3 font-semibold">Trạng Thái</th>
                        <th className="px-4 py-3 font-semibold text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBottles.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                            Không có chai nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        filteredBottles.map((b) => {
                          const statusBadge = getBottleStatusLabel(b.status);
                          const days = getDaysRemaining(b.expiryDate, referenceDate);
                          const qrId = b.qrId || getBottleQrId(b.bottleCode);

                          return (
                            <tr
                              key={b.id}
                              onClick={() => onOpenBottleDetail(b)}
                              className="hover:bg-cyan-50/40 transition-colors cursor-pointer group"
                            >
                              <td className="px-4 py-3 font-mono font-bold text-cyan-900 group-hover:text-cyan-700">
                                <div className="flex items-center gap-1.5">
                                  <span>{b.bottleCode}</span>
                                  {b.status === 'IN_USE' && (
                                    <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-800 rounded font-bold">
                                      Đang mở
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-3 py-3 font-mono text-slate-500 text-[11px]">
                                <div className="flex items-center gap-1">
                                  <QrCode className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                  <span>{qrId}</span>
                                </div>
                              </td>

                              <td className="px-3 py-3 font-mono text-slate-600 text-[11px]">
                                {b.lotNumber}
                              </td>

                              <td className="px-4 py-3 text-right font-mono">
                                <span className={`font-bold ${b.currentVolume <= 0 ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                  {b.currentVolume}
                                </span>
                                <span className="text-slate-400 text-[11px]"> / {b.initialVolume} {b.unit}</span>
                              </td>

                              <td className="px-3 py-3 font-mono text-[11px]">
                                <span className={days <= 0 ? 'text-rose-600 font-bold' : days <= 90 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                                  {b.expiryDate}
                                </span>
                                <span className="text-slate-400 block text-[10px]">
                                  {days <= 0 ? '(Đã hết hạn)' : `(${days} ngày)`}
                                </span>
                              </td>

                              <td className="px-3 py-3 text-slate-600 text-[11px]">
                                <div className="truncate max-w-[140px]" title={`${b.location.cabinet} - ${b.location.shelf} (${b.location.room})`}>
                                  {b.location.cabinet} · {b.location.shelf}
                                </div>
                              </td>

                              <td className="px-3 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge.badgeClass}`}>
                                  <span className={`w-1 h-1 rounded-full ${statusBadge.dotClass}`} />
                                  {statusBadge.text}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  {b.currentVolume > 0 && b.status !== 'DISPOSED' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose();
                                        onOpenRecordUsage(chemical.id, b.id);
                                      }}
                                      className="px-2.5 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-2xs cursor-pointer"
                                    >
                                      Dùng
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onOpenBottleDetail(b)}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                                    title="Xem chi tiết & mã QR của chai này"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STOCK & EXPIRY (Section 5, 6, 7) */}
          {activeTab === 'stock' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Inventory Thresholds Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-700" />
                      <span>Định Mức Tồn Kho (Thresholds)</span>
                    </h4>
                    {isManager && (
                      <span className="text-[10px] text-cyan-700 font-semibold cursor-pointer hover:underline" onClick={() => onOpenEdit(chemical)}>
                        Chỉnh sửa mức →
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800 block">Mức tối thiểu (Minimum Stock)</span>
                        <span className="text-[11px] text-slate-500">Chạm mức này hệ thống cảnh báo nguy cấp</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600 text-sm">
                        {chemical.minimumStock} {chemical.primaryUnit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800 block">Mức cảnh báo (Warning Stock)</span>
                        <span className="text-[11px] text-slate-500">Chạm mức này tự động gửi email đề xuất mua sắm</span>
                      </div>
                      <span className="font-mono font-bold text-amber-600 text-sm">
                        {chemical.warningStock} {chemical.primaryUnit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2.5 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="font-semibold text-slate-800 block">Mức mục tiêu (Target Stock)</span>
                        <span className="text-[11px] text-slate-500">Mức tồn tối ưu cần duy trì trong lab</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 text-sm">
                        {chemical.targetStock} {chemical.primaryUnit}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-xl text-[11px] text-cyan-900 leading-relaxed">
                    <strong>Quy tắc tính toán tự động:</strong> Tổng tồn kho được cộng tự động từ tất cả chai thực tế còn trong kho. Trạng thái hiển thị tự động chuyển sang <strong>Nguy cấp</strong> khi tổng tồn &le; Mức tối thiểu.
                  </div>
                </div>

                {/* Expiry Breakdown Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-cyan-700" />
                    <span>Tình Trạng Hạn Dùng & Chai Lọ</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Chai đang mở (IN USE)</span>
                      <span className="text-lg font-bold text-amber-600 font-mono">{activeCount} chai</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Chai còn nguyên (SEALED)</span>
                      <span className="text-lg font-bold text-emerald-600 font-mono">{sealedCount} chai</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Sắp hết hạn (&le; 90 ngày)</span>
                      <span className="text-lg font-bold text-orange-600 font-mono">{expiringSoonCount} chai</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Đã hết hạn</span>
                      <span className="text-lg font-bold text-rose-600 font-mono">{expiredCount} chai</span>
                    </div>
                  </div>

                  {expiredCount > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Có {expiredCount} chai đã quá hạn sử dụng!</div>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Vui lòng kiểm tra và tiến hành làm thủ tục thanh lý chất thải nguy hại (Disposal).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: USAGE HISTORY (Section 10) */}
          {activeTab === 'usage' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">Nhật ký tiêu hao của {chemical.name} ({usageTxs.length} lần xuất):</span>
                <span className="text-[11px] text-slate-400 font-mono">Dữ liệu bất biến · Không thể sửa xóa</span>
              </div>

              {usageTxs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  Chưa có lượt sử dụng nào cho hóa chất này.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Thời Gian</th>
                        <th className="px-3 py-3 font-semibold">Mã Chai</th>
                        <th className="px-4 py-3 font-semibold">Người Dùng</th>
                        <th className="px-3 py-3 font-semibold text-right">Lượng Dùng</th>
                        <th className="px-4 py-3 font-semibold text-right">Trước &rarr; Sau</th>
                        <th className="px-4 py-3 font-semibold">Mục Đích & Đề Tài</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usageTxs.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                            {t.date}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-cyan-900">
                            {t.bottleCode || 'Chai'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {t.user}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-rose-600">
                            -{t.quantity} {t.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                            {t.previousStock} &rarr; <span className="font-bold text-slate-800">{t.newStock} {t.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium truncate max-w-[200px]">{t.purpose || 'Thí nghiệm'}</div>
                            {t.project && (
                              <div className="text-[10px] text-cyan-800 font-mono truncate max-w-[200px]">
                                Dự án: {t.project}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: STOCK IN HISTORY (Section 11) */}
          {activeTab === 'stockin' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">Lịch sử các đợt nhập kho ({stockInTxs.length} đợt):</span>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStockIn(chemical.id);
                    }}
                    className="text-xs text-cyan-700 font-bold hover:underline"
                  >
                    + Nhập thêm lô mới
                  </button>
                )}
              </div>

              {stockInTxs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  Chưa có lịch sử nhập kho phát sinh.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Ngày Nhập</th>
                        <th className="px-3 py-3 font-semibold">Mã Chai</th>
                        <th className="px-3 py-3 font-semibold text-right">Số Lượng Nhập</th>
                        <th className="px-4 py-3 font-semibold">Người Nhập</th>
                        <th className="px-4 py-3 font-semibold">Ghi Chú & Số Lô</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockInTxs.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                            {t.date}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-cyan-900">
                            {t.bottleCode || 'Chai'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600">
                            +{t.quantity} {t.unit}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {t.user}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-[11px]">
                            {t.notes || 'Nhập kho định kỳ'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL (Section 19) */}
          {activeTab === 'audit' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold">Nhật ký chỉnh sửa & kiểm toán ({chemAudits.length} bản ghi):</span>
                <span className="text-[11px] text-slate-400 font-mono">Bảo mật hệ thống · Ghi nhận tự động</span>
              </div>

              {chemAudits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  Chưa có nhật ký chỉnh sửa thông tin nào.
                </div>
              ) : (
                <div className="space-y-2">
                  {chemAudits.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-start gap-3"
                    >
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 mt-0.5 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{a.action}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(a.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{a.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {isManager ? (
              <span className="text-purple-700 font-medium">Bạn đang đăng nhập với quyền Quản Lý (Manager) · Toàn quyền chỉnh sửa</span>
            ) : (
              <span className="text-slate-500">Chế độ xem thông tin (View-only) dành cho Nghiên cứu viên</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { Chemical, Bottle, StockStatus, ExpiryStatus } from '../types';
import { getStockStatusLabel, getExpiryStatusLabel, getBottleStatusLabel, getDaysRemaining } from '../utils/status';
import { BottleGraphic } from './visual/BottleGraphic';
import {
  Search,
  Filter,
  Plus,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  MapPin,
  Shield,
  Trash2,
  Archive,
  LayoutGrid,
  List,
  AlertTriangle,
  Info,
  FileSpreadsheet,
  QrCode,
  Printer,
} from 'lucide-react';
import { ChemicalDetailModal } from './modals/ChemicalDetailModal';
import { EditChemicalModal } from './modals/EditChemicalModal';
import { PrintLabelModal } from './modals/PrintLabelModal';

interface Props {
  onOpenRecordUsage: (chemicalId?: string, bottleId?: string) => void;
  onOpenStockIn: (chemicalId?: string) => void;
  onOpenAddChemical: () => void;
  onOpenExcelImport?: () => void;
  onOpenBottleDetail: (bottle: Bottle) => void;
  onOpenDiscrepancyModal?: (chemicalId?: string, bottleId?: string) => void;
  onOpenQrScanner?: () => void;
  onOpenArchiveCenter?: () => void;
  onOpenDeleteChemical?: (chemical: Chemical) => void;
  externalSearchTerm?: string;
  targetChemicalId?: string;
  initialFilterStatus?: string;
}

export const InventoryView: React.FC<Props> = ({
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenAddChemical,
  onOpenExcelImport,
  onOpenBottleDetail,
  onOpenDiscrepancyModal,
  onOpenQrScanner,
  onOpenArchiveCenter,
  onOpenDeleteChemical,
  externalSearchTerm,
  targetChemicalId,
  initialFilterStatus,
}) => {
  const {
    chemicals,
    bottles,
    getChemicalTotalStock,
    getChemicalBottles,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    isManager,
    currentUser,
    referenceDate,
  } = useLab();

  // Chemical Detail & Edit Modals State
  const [selectedChemicalForDetail, setSelectedChemicalForDetail] = useState<Chemical | null>(null);
  const [chemicalDetailOpen, setChemicalDetailOpen] = useState(false);
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null);
  const [editChemicalOpen, setEditChemicalOpen] = useState(false);
  const [printLabelModalOpen, setPrintLabelModalOpen] = useState(false);
  const [bottlesToPrint, setBottlesToPrint] = useState<Bottle[]>([]);

  const handleOpenChemicalDetail = (chem: Chemical) => {
    setSelectedChemicalForDetail(chem);
    setChemicalDetailOpen(true);
  };

  const handleOpenEditChemical = (chem: Chemical) => {
    setEditingChemical(chem);
    setEditChemicalOpen(true);
  };

  const handleOpenPrintLabels = (bts: Bottle[]) => {
    setBottlesToPrint(bts);
    setPrintLabelModalOpen(true);
  };

  // View Mode: 'visual' or 'table'
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState(externalSearchTerm || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>(initialFilterStatus || 'ALL');
  const [selectedExpiryStatus, setSelectedExpiryStatus] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');

  // Expanded chemicals
  const [expandedChemIds, setExpandedChemIds] = useState<Set<string>>(new Set(['chem-hexane', 'chem-ethanol']));

  // Sync with global header search
  React.useEffect(() => {
    if (externalSearchTerm !== undefined) {
      setSearchTerm(externalSearchTerm);
    }
  }, [externalSearchTerm]);

  React.useEffect(() => {
    if (targetChemicalId) {
      setExpandedChemIds((prev) => new Set([...prev, targetChemicalId]));
      const foundChem = chemicals.find((c) => c.id === targetChemicalId);
      if (foundChem) {
        setSelectedChemicalForDetail(foundChem);
        setChemicalDetailOpen(true);
      }
    }
  }, [targetChemicalId, chemicals]);

  const toggleExpand = (id: string) => {
    setExpandedChemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categories = useMemo(() => Array.from(new Set(chemicals.filter((c) => c.status !== 'ARCHIVED').map((c) => c.category))), [chemicals]);
  const locations = useMemo(
    () => Array.from(new Set(chemicals.filter((c) => c.status !== 'ARCHIVED').map((c) => `${c.storageLocation.cabinet} (${c.storageLocation.room})`))),
    [chemicals]
  );

  const archivedChemicalsCount = useMemo(() => {
    return chemicals.filter((c) => c.status === 'ARCHIVED').length;
  }, [chemicals]);

  const filteredChemicals = useMemo(() => {
    return chemicals.filter((c) => {
      // Hide soft-deleted / archived chemicals from active inventory (Mục 37-39)
      if (c.status === 'ARCHIVED') return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesChem =
          c.name.toLowerCase().includes(query) ||
          c.englishName.toLowerCase().includes(query) ||
          c.casNumber.toLowerCase().includes(query) ||
          c.manufacturer.toLowerCase().includes(query) ||
          (c.catalogNumber && c.catalogNumber.toLowerCase().includes(query));

        const chemBottles = bottles.filter((b) => b.chemicalId === c.id);
        const matchesBottle = chemBottles.some(
          (b) =>
            b.bottleCode.toLowerCase().includes(query) ||
            b.lotNumber.toLowerCase().includes(query)
        );

        if (!matchesChem && !matchesBottle) return false;
      }

      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (selectedLocation !== 'ALL') {
        const locStr = `${c.storageLocation.cabinet} (${c.storageLocation.room})`;
        if (locStr !== selectedLocation) return false;
      }
      if (selectedStockStatus !== 'ALL') {
        const s = getChemicalStockStatus(c.id);
        if (s !== selectedStockStatus) return false;
      }
      if (selectedExpiryStatus !== 'ALL') {
        const e = getChemicalExpiryStatus(c.id);
        if (e !== selectedExpiryStatus) return false;
      }

      return true;
    });
  }, [
    chemicals,
    bottles,
    searchTerm,
    selectedCategory,
    selectedLocation,
    selectedStockStatus,
    selectedExpiryStatus,
  ]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kho Hóa Chất & Quản Lý Chai</h1>
          <p className="text-xs text-slate-500 mt-1">
            Giao diện trực quan hình ảnh chai lọ · Mức dung dịch thực tế · Trừ tồn theo từng chai
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Visual / Table Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'visual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-cyan-600" />
              <span>Trực Quan Chai</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-slate-600" />
              <span>Dạng Bảng Gọn</span>
            </button>
          </div>

          {/* Quick QR Scanner & Record Usage */}
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="flex px-3.5 py-1.5 text-xs font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-xl transition-all items-center gap-1.5 shadow-xs hover:shadow-cyan-500/20 cursor-pointer active:scale-95"
              title="Quét mã QR tem dán trên chai hóa chất bằng Camera"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-200" />
              <span>Quét QR Chai</span>
            </button>
          )}

          <button
            onClick={() => onOpenRecordUsage()}
            className="flex px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all items-center gap-1.5 shadow-xs hover:shadow-emerald-500/20 cursor-pointer active:scale-95"
            title="Ghi nhận sử dụng và trừ tồn kho chai"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ghi Sử Dụng</span>
          </button>

          {/* Section 43 & 44 & 66: Add Chemical & Excel Import are Manager only */}
          {isManager && (
            <>
              <button
                onClick={onOpenAddChemical}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm Hóa Chất</span>
              </button>

              {onOpenExcelImport && (
                <button
                  onClick={onOpenExcelImport}
                  className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Nhập danh mục hóa chất & chai từ Excel hoặc Google Sheets (Mục 66)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>📥 Nhập Excel / Sheets</span>
                </button>
              )}

              {onOpenArchiveCenter && (
                <button
                  onClick={onOpenArchiveCenter}
                  className="px-3.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Kho lưu trữ & Thùng rác hóa chất đã xóa mềm - Khôi phục khi xóa nhầm (Mục 38)"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-700" />
                  <span>Kho Lưu Trữ ({archivedChemicalsCount})</span>
                </button>
              )}
            </>
          )}

          {/* Report Discrepancy Button (Accessible to all users) */}
          {onOpenDiscrepancyModal && (
            <button
              onClick={() => onOpenDiscrepancyModal()}
              className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Báo Lệch Tồn</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Reminder for Users (Section 44) */}
      {!isManager && (
        <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-xl text-xs text-cyan-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>
            <strong>Quy định bảo toàn kho:</strong> Bạn đang đăng nhập quyền <strong>USER</strong>. Bạn chỉ có thể ghi nhận số lượng đã dùng qua nút <strong>"+ Dùng"</strong>. Bạn không được trực tiếp sửa số lượng tồn kho. Nếu phát hiện tồn kho thực tế sai lệch, vui lòng bấm <strong>"Báo Lệch Tồn"</strong> để Quản lý kiểm tra.
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo tên hóa chất, số CAS, nhà sản xuất, số Lot, mã chai (HEX-001)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 bg-slate-50/50"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả phân loại</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedStockStatus}
            onChange={(e) => setSelectedStockStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả mức tồn</option>
            <option value="NORMAL">Bình thường (Đủ hàng)</option>
            <option value="LOW_STOCK">Sắp hết (Low Stock)</option>
            <option value="CRITICAL">Nguy cấp (Critical)</option>
          </select>

          <select
            value={selectedExpiryStatus}
            onChange={(e) => setSelectedExpiryStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả hạn dùng</option>
            <option value="EXPIRED">Đã hết hạn</option>
            <option value="EXPIRING_SOON">Sắp hết (≤ 90 ngày)</option>
            <option value="EXPIRING">Chú ý (≤ 180 ngày)</option>
            <option value="VALID">Còn hạn an toàn</option>
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="ALL">Tất cả vị trí tủ</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Counts Header */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-mono">
        <span>Hiển thị {filteredChemicals.length} / {chemicals.length} loại hóa chất</span>
        <button
          onClick={() => {
            if (expandedChemIds.size === chemicals.length) {
              setExpandedChemIds(new Set());
            } else {
              setExpandedChemIds(new Set(chemicals.map((c) => c.id)));
            }
          }}
          className="text-cyan-700 hover:text-cyan-800 font-medium cursor-pointer"
        >
          {expandedChemIds.size === chemicals.length ? 'Thu gọn tất cả chai' : 'Mở rộng tất cả chai'}
        </button>
      </div>

      {/* Content Rendering based on viewMode */}
      {viewMode === 'visual' ? (
        <div className="space-y-4">
          {filteredChemicals.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              Không tìm thấy hóa chất nào khớp với tìm kiếm.
            </div>
          ) : (
            filteredChemicals.map((chem) => {
              const chemBottles = getChemicalBottles(chem.id);
              const stock = getChemicalTotalStock(chem.id);
              const stockStatus = getChemicalStockStatus(chem.id);
              const expiryStatus = getChemicalExpiryStatus(chem.id);
              const isExpanded = expandedChemIds.has(chem.id);

              const sLabel = getStockStatusLabel(stockStatus);
              const eLabel = getExpiryStatusLabel(expiryStatus);

              return (
                <div
                  key={chem.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-150"
                >
                  {/* Master Chemical Card Header */}
                  <div
                    onClick={() => handleOpenChemicalDetail(chem)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white hover:bg-cyan-50/20 transition-colors cursor-pointer group"
                    title="Bấm để xem chi tiết hóa chất & danh sách từng chai lọ"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Visual Category Flask or Primary Bottle */}
                      <div className="shrink-0 flex items-center justify-center p-2 rounded-2xl bg-slate-50 border border-slate-200/80 group-hover:border-cyan-400 group-hover:bg-cyan-50/40 transition-all">
                        {chemBottles.length > 0 ? (
                          <BottleGraphic
                            fillPercent={
                              chemBottles[0].initialVolume > 0
                                ? Math.round((chemBottles[0].currentVolume / chemBottles[0].initialVolume) * 100)
                                : 0
                            }
                            status={chemBottles[0].status}
                            category={chem.category}
                            size="md"
                          />
                        ) : (
                          <FlaskConical className="w-8 h-8 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {chem.code}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-cyan-700 transition-colors">
                            {chem.name}
                          </h3>
                          <span className="text-xs text-slate-400 truncate hidden sm:inline">
                            ({chem.englishName})
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Chi tiết</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5 font-mono">
                          <span className="text-slate-700 font-semibold">{chem.category}</span>
                          <span>·</span>
                          <span className="hover:underline">CAS: {chem.casNumber}</span>
                          <span>·</span>
                          <span>Grade: {chem.grade}</span>
                          <span>·</span>
                          <span className="text-slate-600">
                            {chem.storageLocation.cabinet} / {chem.storageLocation.shelf}
                          </span>
                        </div>

                        {/* GHS Pictograms */}
                        {chem.safetyInfo.ghsPictograms.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-slate-400 font-medium">An toàn:</span>
                            <div className="flex items-center gap-1">
                              {chem.safetyInfo.ghsPictograms.slice(0, 3).map((ghs) => (
                                <span
                                  key={ghs}
                                  className="text-xs px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[10px]"
                                  title={ghs}
                                >
                                  {ghs}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock Overview & Quick Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pl-16 md:pl-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="text-left md:text-right font-mono">
                        <div className="text-xs text-slate-400">
                          {chemBottles.length} chai trong kho
                        </div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums">
                          {stock.total}{' '}
                          <span className="text-xs font-normal text-slate-500">{stock.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Min: {chem.minimumStock} {chem.primaryUnit}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-end">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${sLabel.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sLabel.dotClass}`} />
                          {sLabel.text}
                        </span>
                        {expiryStatus !== 'VALID' && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${eLabel.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${eLabel.dotClass}`} />
                            {eLabel.text}
                          </span>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Record Usage (Primary for all users) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecordUsage(chem.id);
                          }}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl transition-colors shadow-xs cursor-pointer active:scale-95"
                          title="Ghi nhận sử dụng và trừ tồn kho"
                        >
                          + Dùng
                        </button>

                        {/* Stock In (Manager Only) */}
                        {isManager ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStockIn(chem.id);
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                            title="Nhập thêm chai vào kho"
                          >
                            + Nhập
                          </button>
                        ) : onOpenDiscrepancyModal ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDiscrepancyModal(chem.id);
                            }}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-xl transition-colors cursor-pointer"
                            title="Báo cáo chênh lệch tồn kho thực tế cho Quản lý"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        {isManager && onOpenDeleteChemical && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDeleteChemical(chem);
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-colors cursor-pointer"
                            title="Xóa / Lưu trữ hóa chất an toàn (Soft-delete có thể khôi phục)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(chem.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Xem từng chai dưới ngăn kéo"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Individual Bottles Visual Drawer */}
                  {isExpanded && (
                    <div className="bg-slate-50/70 border-t border-slate-200 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Danh Sách Chai/Lọ Thực Tế Của Hóa Chất Này:</span>
                        {isManager && (
                          <button
                            onClick={() => onOpenStockIn(chem.id)}
                            className="text-cyan-700 hover:text-cyan-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Thêm chai mới</span>
                          </button>
                        )}
                      </div>

                      {chemBottles.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                          Chưa có chai nào trong kho.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {chemBottles.map((b) => {
                            const bStatus = getBottleStatusLabel(b.status);
                            const daysRem = getDaysRemaining(b.expiryDate, referenceDate);
                            const fillPct =
                              b.initialVolume > 0
                                ? Math.min(100, Math.round((b.currentVolume / b.initialVolume) * 100))
                                : 0;

                            return (
                              <div
                                key={b.id}
                                onClick={() => onOpenBottleDetail(b)}
                                className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-cyan-400 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5"
                              >
                                <div className="shrink-0">
                                  <BottleGraphic
                                    fillPercent={fillPct}
                                    status={b.status}
                                    category={chem.category}
                                    size="sm"
                                  />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-slate-900">{b.bottleCode}</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${bStatus.badgeClass}`}>
                                      {bStatus.text}
                                    </span>
                                  </div>

                                  <div className="text-xs font-mono font-bold text-slate-800">
                                    {b.currentVolume} / {b.initialVolume} {b.unit}
                                  </div>

                                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                                    <span>{b.location.cabinet} · {b.location.shelf}</span>
                                    <span className={daysRem <= 0 ? 'text-rose-600 font-bold' : daysRem <= 90 ? 'text-orange-600 font-semibold' : ''}>
                                      {daysRem <= 0 ? 'Quá hạn' : `${daysRem} ngày`}
                                    </span>
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
              );
            })
          )}
        </div>
      ) : (
        /* TABLE MODE: Compact scientific table view */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Mã & Tên hóa chất</th>
                  <th className="px-4 py-3 font-semibold">Số CAS</th>
                  <th className="px-4 py-3 font-semibold">Phân loại</th>
                  <th className="px-4 py-3 font-semibold">Số chai</th>
                  <th className="px-4 py-3 font-semibold">Tổng tồn kho</th>
                  <th className="px-4 py-3 font-semibold">Mức tối thiểu</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Vị trí tủ</th>
                  <th className="px-6 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChemicals.map((c) => {
                  const chemBottles = getChemicalBottles(c.id);
                  const stock = getChemicalTotalStock(c.id);
                  const sStatus = getChemicalStockStatus(c.id);
                  const sLabel = getStockStatusLabel(sStatus);

                    return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenChemicalDetail(c)}
                      className="hover:bg-cyan-50/40 transition-colors cursor-pointer group"
                      title="Bấm để xem chi tiết hóa chất & danh sách từng chai lọ"
                    >
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        <div className="font-bold text-slate-900 group-hover:text-cyan-700 transition-colors flex items-center gap-1.5">
                          <span>{c.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{c.code} · {c.englishName}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600">
                        {c.casNumber}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {c.category}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {chemBottles.length} chai
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {stock.total} {stock.unit}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500">
                        {c.minimumStock} {c.primaryUnit}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sLabel.badgeClass}`}>
                          <span className={`w-1 h-1 rounded-full ${sLabel.dotClass}`} />
                          {sLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                        {c.storageLocation.cabinet} ({c.storageLocation.room})
                      </td>
                      <td
                        className="px-6 py-3.5 text-right space-x-1.5 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRecordUsage(c.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors shadow-xs cursor-pointer active:scale-95"
                          title="Ghi nhận sử dụng và trừ tồn kho"
                        >
                          Dùng
                        </button>
                        {isManager ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStockIn(c.id);
                            }}
                            className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                            title="Nhập thêm chai vào kho"
                          >
                            Nhập
                          </button>
                        ) : onOpenDiscrepancyModal ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDiscrepancyModal(c.id);
                            }}
                            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Báo cáo chênh lệch tồn kho thực tế cho Quản lý"
                          >
                            Báo lệch
                          </button>
                        ) : null}

                        {isManager && onOpenDeleteChemical && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDeleteChemical(c);
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Xóa / Lưu trữ hóa chất an toàn"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Master Chemical Detail Modal */}
      <ChemicalDetailModal
        chemical={selectedChemicalForDetail}
        isOpen={chemicalDetailOpen}
        onClose={() => setChemicalDetailOpen(false)}
        onOpenEdit={(chem) => {
          setEditingChemical(chem);
          setEditChemicalOpen(true);
        }}
        onOpenRecordUsage={(chemId, bottleId) => {
          setChemicalDetailOpen(false);
          onOpenRecordUsage(chemId, bottleId);
        }}
        onOpenStockIn={(chemId) => {
          setChemicalDetailOpen(false);
          onOpenStockIn(chemId);
        }}
        onOpenBottleDetail={(b) => {
          onOpenBottleDetail(b);
        }}
        onOpenPrintLabels={(bts) => {
          handleOpenPrintLabels(bts);
        }}
        onOpenDeleteChemical={(chem) => {
          setChemicalDetailOpen(false);
          onOpenDeleteChemical?.(chem);
        }}
      />

      {/* Edit Chemical Modal (Manager only) */}
      <EditChemicalModal
        chemical={editingChemical}
        isOpen={editChemicalOpen}
        onClose={() => setEditChemicalOpen(false)}
        onSuccess={() => {
          setEditChemicalOpen(false);
        }}
      />

      {/* Print Label Modal */}
      <PrintLabelModal
        bottles={bottlesToPrint}
        isOpen={printLabelModalOpen}
        onClose={() => setPrintLabelModalOpen(false)}
      />
    </div>
  );
};

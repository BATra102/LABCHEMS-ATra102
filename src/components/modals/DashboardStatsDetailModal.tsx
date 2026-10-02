import React, { useState, useMemo } from 'react';
import { useLab } from '../../context/LabContext';
import {
  X,
  Package,
  AlertOctagon,
  TrendingDown,
  Clock,
  ShieldAlert,
  FlaskConical,
  Search,
  Filter,
  ArrowUpDown,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  Calendar,
  MapPin,
  ExternalLink,
  ChevronRight,
  Flame,
  Droplet,
  Percent,
  Layers,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { getStockStatusLabel, getExpiryStatusLabel } from '../../utils/status';

export type DashboardModalType =
  | 'TOTAL_CHEMICALS'
  | 'CRITICAL_STOCK'
  | 'LOW_STOCK'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'IN_USE';

interface Props {
  isOpen: boolean;
  type: DashboardModalType | null;
  onClose: () => void;
  onOpenRecordUsage?: (chemicalId?: string, bottleId?: string) => void;
  onOpenStockIn?: (chemicalId?: string) => void;
  onOpenBottleDetail?: (bottleId: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export const DashboardStatsDetailModal: React.FC<Props> = ({
  isOpen,
  type,
  onClose,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenBottleDetail,
  onNavigateToTab,
}) => {
  const {
    chemicals,
    bottles,
    transactions,
    referenceDate,
    isManager,
    currentUser,
    getChemicalTotalStock,
    getChemicalStockStatus,
    getChemicalExpiryStatus,
    disposeBottle,
    addCustomPurchaseItem,
  } = useLab();

  // Internal search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'expiry'>('stock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Specific filter for Expiring tab (30, 60, 90 days)
  const [expirySubTab, setExpirySubTab] = useState<'ALL' | '30' | '60' | '90'>('ALL');

  // Quick action feedback toast
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Disposal dialog confirmation
  const [disposingBottleId, setDisposingBottleId] = useState<string | null>(null);
  const [disposalReason, setDisposalReason] = useState<string>('Hết hạn sử dụng – Lập biên bản tiêu hủy');

  if (!isOpen || !type) return null;

  const showToast = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Helper date calculations
  const calculateDaysRemaining = (expiryDate: string) => {
    const today = new Date(referenceDate);
    const exp = new Date(expiryDate);
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const calculateDaysOpened = (openedDate?: string) => {
    if (!openedDate) return 0;
    const today = new Date(referenceDate);
    const op = new Date(openedDate);
    return Math.max(0, Math.ceil((today.getTime() - op.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const formatLocation = (loc: any) => {
    if (!loc) return '—';
    if (typeof loc === 'string') return loc;
    const parts = [loc.cabinet, loc.shelf, loc.room ? `(${loc.room})` : ''].filter(Boolean);
    return parts.join(' - ') || '—';
  };

  // All unique categories and locations for filter
  const allCategories = useMemo(() => Array.from(new Set(chemicals.map((c) => c.category))), [chemicals]);
  const allLocations = useMemo(
    () => Array.from(new Set(bottles.map((b) => formatLocation(b.location)).filter((l) => l !== '—'))),
    [bottles]
  );

  // Handle Quick Purchase request from critical / low stock list
  const handleQuickPurchase = (chemicalId: string, neededAmount: number, unit: any, chemName: string) => {
    if (!isManager) {
      showToast('error', 'Chỉ Quản lý mới có quyền tạo đơn mua hàng.');
      return;
    }
    const chem = chemicals.find((c) => c.id === chemicalId);
    const res = addCustomPurchaseItem({
      chemicalId,
      chemicalName: chemName,
      currentStock: getChemicalTotalStock(chemicalId).total,
      minimumStock: chem?.minimumStock || 0,
      targetStock: chem?.targetStock || (chem?.minimumStock || 0) * 2,
      recommendedPurchase: Math.max(1, Math.round(neededAmount)),
      unit,
      supplier: chem?.manufacturer || 'Nhà cung cấp chính',
      estimatedCost: (chem?.unitPrice || 100000) * Math.max(1, Math.round(neededAmount)),
      priority: 'CRITICAL',
      status: 'PENDING',
    });
    if (res.success) {
      showToast('success', `Đã thêm đề xuất mua ${Math.round(neededAmount)} ${unit} ${chemName} vào danh sách Mua sắm!`);
    } else {
      showToast('error', res.message);
    }
  };

  // Handle Dispose Bottle
  const handleConfirmDisposal = () => {
    if (!disposingBottleId) return;
    const res = disposeBottle({
      bottleId: disposingBottleId,
      reason: disposalReason,
      notes: `Tiêu hủy trực tiếp từ Dashboard kiểm soát chất lượng (${referenceDate})`,
    });
    if (res.success) {
      showToast('success', res.message);
      setDisposingBottleId(null);
    } else {
      showToast('error', res.message);
    }
  };

  // Render content according to the active clicked card type
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {type === 'TOTAL_CHEMICALS' && (
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl shadow-2xs">
                <Package className="w-6 h-6" />
              </div>
            )}
            {type === 'CRITICAL_STOCK' && (
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl shadow-2xs">
                <AlertOctagon className="w-6 h-6" />
              </div>
            )}
            {type === 'LOW_STOCK' && (
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shadow-2xs">
                <TrendingDown className="w-6 h-6" />
              </div>
            )}
            {type === 'EXPIRING_SOON' && (
              <div className="p-2.5 bg-orange-100 text-orange-700 rounded-2xl shadow-2xs">
                <Clock className="w-6 h-6" />
              </div>
            )}
            {type === 'EXPIRED' && (
              <div className="p-2.5 bg-rose-900 text-rose-100 rounded-2xl shadow-2xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
            {type === 'IN_USE' && (
              <div className="p-2.5 bg-cyan-100 text-cyan-700 rounded-2xl shadow-2xs">
                <FlaskConical className="w-6 h-6" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {type === 'TOTAL_CHEMICALS' && 'TỔNG QUAN KHO HÓA CHẤT'}
                  {type === 'CRITICAL_STOCK' && 'HÓA CHẤT NGUY CẤP (≤ ĐỊNH MỨC TỐI THIỂU)'}
                  {type === 'LOW_STOCK' && 'HÓA CHẤT SẮP HẾT (MỨC CẢNH BÁO)'}
                  {type === 'EXPIRING_SOON' && 'HÓA CHẤT SẮP HẾT HẠN (≤ 90 NGÀY)'}
                  {type === 'EXPIRED' && 'HÓA CHẤT ĐÃ HẾT HẠN – KHÓA SỬ DỤNG'}
                  {type === 'IN_USE' && 'DANH SÁCH CHAI ĐANG MỞ (IN-USE)'}
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  Phòng Lab Chuẩn GLP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {type === 'TOTAL_CHEMICALS' && 'Thống kê toàn bộ phân loại, dung tích, khối lượng và tình trạng tồn kho.'}
                {type === 'CRITICAL_STOCK' && 'Danh mục hóa chất cạn kiệt, cần đặt hàng bổ sung khẩn cấp để đảm bảo kiểm nghiệm.'}
                {type === 'LOW_STOCK' && 'Hóa chất vượt qua mức an toàn, chuẩn bị đơn mua dự phòng trước khi cạn.'}
                {type === 'EXPIRING_SOON' && 'Theo dõi chặt chẽ hạn sử dụng ≤ 90 ngày, ưu tiên sử dụng trước theo nguyên tắc FEFO.'}
                {type === 'EXPIRED' && 'Cảnh báo niêm phong cách ly, chờ lập biên bản và thanh lý tiêu hủy theo quy định an toàn.'}
                {type === 'IN_USE' && 'Kiểm soát tỷ lệ mở nắp, lượng tồn thực tế của từng chai và thời gian đã mở.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NOTIFICATION TOAST */}
        {actionMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ==================================================================== */}
          {/* 1. TỔNG HÓA CHẤT MODAL VIEW */}
          {/* ==================================================================== */}
          {type === 'TOTAL_CHEMICALS' && (() => {
            const activeCount = chemicals.filter((c) => c.status === 'ACTIVE').length;
            const archivedCount = chemicals.filter((c) => c.status === 'ARCHIVED').length;
            const inUseBottles = bottles.filter((b) => b.openedDate && b.status !== 'DISPOSED').length;
            const sealedBottles = bottles.filter((b) => !b.openedDate && b.status !== 'DISPOSED').length;

            let totalVolumeML = 0;
            let totalWeightG = 0;

            bottles.forEach((b) => {
              if (b.status === 'DISPOSED') return;
              if (b.unit === 'mL') totalVolumeML += b.currentVolume;
              else if (b.unit === 'L') totalVolumeML += b.currentVolume * 1000;
              else if (b.unit === 'g') totalWeightG += b.currentVolume;
              else if (b.unit === 'kg') totalWeightG += b.currentVolume * 1000;
              else if (b.unit === 'mg') totalWeightG += b.currentVolume / 1000;
            });

            // Group by Category
            const groupStats: Record<string, { chemCount: number; bottleCount: number }> = {};
            chemicals.forEach((c) => {
              const cat = c.category || 'Khác';
              if (!groupStats[cat]) groupStats[cat] = { chemCount: 0, bottleCount: 0 };
              groupStats[cat].chemCount += 1;
              const relatedBottles = bottles.filter((b) => b.chemicalId === c.id && b.status !== 'DISPOSED');
              groupStats[cat].bottleCount += relatedBottles.length;
            });

            const filteredChems = chemicals
              .filter((c) => {
                const matchSearch =
                  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.casNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.code.toLowerCase().includes(searchTerm.toLowerCase());
                const matchCat = selectedCategory === 'ALL' || c.category === selectedCategory;
                return matchSearch && matchCat;
              })
              .sort((a, b) => {
                if (sortBy === 'name') {
                  return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                }
                if (sortBy === 'stock') {
                  const stockA = getChemicalTotalStock(a.id).total;
                  const stockB = getChemicalTotalStock(b.id).total;
                  return sortOrder === 'asc' ? stockA - stockB : stockB - stockA;
                }
                return 0;
              });

            return (
              <div className="space-y-6">
                {/* 1.1 Tổng quan KPI */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-2xl">
                    <div className="text-[11px] text-blue-700 font-medium">Tổng loại hóa chất</div>
                    <div className="text-xl font-bold font-mono text-blue-900 mt-1">{chemicals.length}</div>
                    <div className="text-[10px] text-blue-600 mt-0.5">mã sản phẩm</div>
                  </div>
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl">
                    <div className="text-[11px] text-indigo-700 font-medium">Tổng chai / lọ</div>
                    <div className="text-xl font-bold font-mono text-indigo-900 mt-1">{bottles.length}</div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">vật lý trong kho</div>
                  </div>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
                    <div className="text-[11px] text-emerald-700 font-medium">Tổng thể tích</div>
                    <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
                      {totalVolumeML >= 1000 ? `${(totalVolumeML / 1000).toFixed(2)} L` : `${totalVolumeML} mL`}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">dung dịch / dung môi</div>
                  </div>
                  <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-2xl">
                    <div className="text-[11px] text-teal-700 font-medium">Tổng khối lượng</div>
                    <div className="text-xl font-bold font-mono text-teal-900 mt-1">
                      {totalWeightG >= 1000 ? `${(totalWeightG / 1000).toFixed(2)} kg` : `${totalWeightG} g`}
                    </div>
                    <div className="text-[10px] text-teal-600 mt-0.5">chất rắn / bột</div>
                  </div>
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl">
                    <div className="text-[11px] text-amber-700 font-medium">Chai đang mở</div>
                    <div className="text-xl font-bold font-mono text-amber-900 mt-1">{inUseBottles}</div>
                    <div className="text-[10px] text-amber-600 mt-0.5">đang sử dụng dở</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="text-[11px] text-slate-700 font-medium">Chai chưa mở</div>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">{sealedBottles}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">nguyên seal</div>
                  </div>
                  <div className="p-3 bg-green-50/60 border border-green-200 rounded-2xl">
                    <div className="text-[11px] text-green-700 font-medium">Đang hoạt động</div>
                    <div className="text-xl font-bold font-mono text-green-900 mt-1">{activeCount}</div>
                    <div className="text-[10px] text-green-600 mt-0.5">danh mục dùng</div>
                  </div>
                  <div className="p-3 bg-slate-100 border border-slate-300 rounded-2xl">
                    <div className="text-[11px] text-slate-600 font-medium">Đã lưu trữ</div>
                    <div className="text-xl font-bold font-mono text-slate-800 mt-1">{archivedCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ngừng dùng</div>
                  </div>
                </div>

                {/* 1.2 Thống kê theo nhóm */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>Cơ cấu danh mục hóa chất theo nhóm</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">{Object.keys(groupStats).length} nhóm phân loại</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {Object.entries(groupStats).map(([cat, stat]) => {
                      const percentage = Math.round((stat.chemCount / chemicals.length) * 100) || 0;
                      return (
                        <div
                          key={cat}
                          onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            selectedCategory === cat
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate">{cat}</span>
                            <span className={selectedCategory === cat ? 'text-blue-100' : 'text-slate-500 font-mono'}>
                              {percentage}%
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className={selectedCategory === cat ? 'text-blue-100' : 'text-slate-500'}>
                              {stat.chemCount} loại
                            </span>
                            <span className={selectedCategory === cat ? 'text-blue-200 font-mono' : 'text-slate-700 font-mono font-bold'}>
                              {stat.bottleCount} chai
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 1.3 Danh sách toàn bộ hóa chất kèm Filter & Search */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Tìm hóa chất, CAS, mã..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700"
                      >
                        <option value="ALL">Tất cả nhóm</option>
                        {allCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          setSortBy('stock');
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sắp xếp tồn: {sortOrder === 'asc' ? 'Tăng' : 'Giảm'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-[380px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Hóa chất</th>
                            <th className="py-2.5 px-3">CAS</th>
                            <th className="py-2.5 px-3">Nhóm</th>
                            <th className="py-2.5 px-3 text-right">Số chai</th>
                            <th className="py-2.5 px-3 text-right">Tồn kho</th>
                            <th className="py-2.5 px-3">Trạng thái</th>
                            <th className="py-2.5 px-3">Vị trí</th>
                            <th className="py-2.5 px-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredChems.map((chem) => {
                            const stock = getChemicalTotalStock(chem.id).total;
                            const stockStatus = getChemicalStockStatus(chem.id);
                            const relatedBottles = bottles.filter((b) => b.chemicalId === chem.id && b.status !== 'DISPOSED');
                            const locations = Array.from(new Set(relatedBottles.map((b) => `${b.location.cabinet || ''} ${b.location.shelf || ''}`).filter(Boolean))).join(', ') || 'Chưa định vị';

                            return (
                              <tr key={chem.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900">{chem.name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{chem.code} • {chem.grade}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">{chem.casNumber}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium">
                                    {chem.category}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                  {relatedBottles.length}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {stock} <span className="font-normal text-slate-500">{chem.primaryUnit}</span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      stockStatus === 'CRITICAL'
                                        ? 'bg-rose-100 text-rose-800'
                                        : stockStatus === 'LOW_STOCK'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {stockStatus === 'CRITICAL' ? 'Nguy cấp' : stockStatus === 'LOW_STOCK' ? 'Sắp hết' : 'An toàn'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate max-w-[140px]" title={locations}>
                                  {locations}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onOpenRecordUsage?.(chem.id);
                                      }}
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    >
                                      Dùng
                                    </button>
                                    {isManager && (
                                      <button
                                        onClick={() => {
                                          onClose();
                                          onOpenStockIn?.(chem.id);
                                        }}
                                        className="px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                      >
                                        Nhập
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================================== */}
          {/* 2. KHO NGUY CẤP (≤ ĐỊNH MỨC TỐI THIỂU) */}
          {/* ==================================================================== */}
          {type === 'CRITICAL_STOCK' && (() => {
            const criticalChems = chemicals.filter((c) => {
              const stock = getChemicalTotalStock(c.id).total;
              return stock <= c.minimumStock;
            });

            const totalCriticalChems = criticalChems.length;
            const zeroStockCount = criticalChems.filter((c) => getChemicalTotalStock(c.id).total === 0).length;
            let totalRelatedBottles = 0;
            let totalDeficitUnits = 0;

            criticalChems.forEach((c) => {
              const currentStock = getChemicalTotalStock(c.id).total;
              const related = bottles.filter((b) => b.chemicalId === c.id && b.status !== 'DISPOSED');
              totalRelatedBottles += related.length;
              const deficit = Math.max(0, c.warningStock * 1.5 - currentStock);
              totalDeficitUnits += deficit;
            });

            return (
              <div className="space-y-6">
                {/* 2.1 Warning Banner & Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                    <div className="text-xs font-semibold text-rose-700">Hóa chất nguy cấp</div>
                    <div className="text-2xl font-bold font-mono text-rose-900 mt-1">{totalCriticalChems}</div>
                    <div className="text-[11px] text-rose-600 mt-0.5">≤ Mức tối thiểu</div>
                  </div>
                  <div className="p-4 bg-rose-100/60 border border-rose-300 rounded-2xl">
                    <div className="text-xs font-semibold text-rose-800">Đã cạn kiệt (Tồn = 0)</div>
                    <div className="text-2xl font-bold font-mono text-rose-950 mt-1">{zeroStockCount}</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">ngừng phân tích</div>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div className="text-xs font-semibold text-amber-700">Số chai vật lý còn lại</div>
                    <div className="text-2xl font-bold font-mono text-amber-900 mt-1">{totalRelatedBottles}</div>
                    <div className="text-[11px] text-amber-600 mt-0.5">chai/lọ dở trong kho</div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                    <div className="text-xs font-semibold text-blue-700">Khối lượng/TT cần mua</div>
                    <div className="text-2xl font-bold font-mono text-blue-900 mt-1">
                      {Math.round(totalDeficitUnits).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-blue-600 mt-0.5">đơn vị tiêu chuẩn</div>
                  </div>
                </div>

                {/* 2.2 Danh sách chi tiết */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                      Danh sách hóa chất cần lập đơn đặt hàng khẩn cấp
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToTab?.('purchase');
                      }}
                      className="text-xs font-semibold text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Xem toàn bộ kế hoạch mua sắm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Hóa chất</th>
                          <th className="py-2.5 px-3">Số CAS</th>
                          <th className="py-2.5 px-3 text-right">Tồn hiện tại</th>
                          <th className="py-2.5 px-3 text-right">Mức tối thiểu</th>
                          <th className="py-2.5 px-3 text-right">Lượng thiếu hụt</th>
                          <th className="py-2.5 px-3 text-center">Trạng thái</th>
                          <th className="py-2.5 px-3">Nhà cung cấp</th>
                          <th className="py-2.5 px-3 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {criticalChems.map((chem) => {
                          const currentStock = getChemicalTotalStock(chem.id).total;
                          const deficit = Math.max(0, chem.warningStock * 1.5 - currentStock);
                          const isZero = currentStock <= 0;

                          return (
                            <tr key={chem.id} className="hover:bg-rose-50/40 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{chem.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{chem.code} • {chem.category}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{chem.casNumber}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                {currentStock} <span className="font-normal text-slate-500">{chem.primaryUnit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {chem.minimumStock} {chem.primaryUnit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                -{Math.round(deficit)} {chem.primaryUnit}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isZero ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {isZero ? 'HẾT HÀNG' : 'NGUY CẤP'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">{chem.manufacturer}</td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleQuickPurchase(chem.id, deficit, chem.primaryUnit, chem.name)}
                                    className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Tạo đề xuất đặt mua vào danh mục Mua sắm"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    <span>Đặt mua ngay</span>
                                  </button>
                                  {isManager && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onOpenStockIn?.(chem.id);
                                      }}
                                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                      title="Nhập kho trực tiếp lô hàng mới"
                                    >
                                      Nhập kho
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================================== */}
          {/* 3. SẮP HẾT (LOW STOCK) */}
          {/* ==================================================================== */}
          {type === 'LOW_STOCK' && (() => {
            const lowChems = chemicals.filter((c) => {
              const stock = getChemicalTotalStock(c.id).total;
              return stock > c.minimumStock && stock <= c.warningStock;
            });

            let inUseCount = 0;
            lowChems.forEach((c) => {
              const inUse = bottles.filter((b) => b.chemicalId === c.id && b.status === 'IN_USE');
              inUseCount += inUse.length;
            });

            return (
              <div className="space-y-6">
                {/* 3.1 Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <div className="text-xs font-semibold text-amber-800">Số hóa chất sắp hết</div>
                    <div className="text-2xl font-bold font-mono text-amber-900 mt-1">{lowChems.length}</div>
                    <div className="text-[11px] text-amber-700 mt-0.5">Tồn kho ≤ Mức cảnh báo</div>
                  </div>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl">
                    <div className="text-xs font-semibold text-orange-800">Chai đang mở dở</div>
                    <div className="text-2xl font-bold font-mono text-orange-900 mt-1">{inUseCount}</div>
                    <div className="text-[11px] text-orange-700 mt-0.5">chai đang tiêu hao</div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                    <div className="text-xs font-semibold text-blue-800">Dự kiến còn dùng được</div>
                    <div className="text-2xl font-bold font-mono text-blue-900 mt-1">15 - 30</div>
                    <div className="text-[11px] text-blue-700 mt-0.5">ngày làm việc trung bình</div>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="text-xs font-semibold text-slate-800">Cơ chế cảnh báo</div>
                    <div className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Email tự động bật</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">gửi Quản lý phòng lab</div>
                  </div>
                </div>

                {/* 3.2 Bảng chi tiết */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Danh mục hóa chất trong ngưỡng cảnh báo sớm
                    </span>
                    <span className="text-xs text-amber-700">Tối thiểu &lt; Tồn kho ≤ Cảnh báo</span>
                  </div>

                  <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Hóa chất</th>
                          <th className="py-2.5 px-3">Số CAS</th>
                          <th className="py-2.5 px-3 text-right">Tồn hiện tại</th>
                          <th className="py-2.5 px-3 text-right">Mức cảnh báo</th>
                          <th className="py-2.5 px-3 text-right">Mức tối thiểu</th>
                          <th className="py-2.5 px-3 text-right">Đề xuất mua</th>
                          <th className="py-2.5 px-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {lowChems.map((chem) => {
                          const stock = getChemicalTotalStock(chem.id).total;
                          const purchaseQty = Math.max(1, chem.warningStock * 2 - stock);

                          return (
                            <tr key={chem.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{chem.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{chem.code} • {chem.category}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{chem.casNumber}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                {stock} <span className="font-normal text-slate-500">{chem.primaryUnit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {chem.warningStock} {chem.primaryUnit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                                {chem.minimumStock} {chem.primaryUnit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                                +{Math.round(purchaseQty)} {chem.primaryUnit}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleQuickPurchase(chem.id, purchaseQty, chem.primaryUnit, chem.name)}
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                  <span>Tạo đơn dự phòng</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================================== */}
          {/* 4. HẠN ≤ 90 NGÀY (EXPIRING SOON) */}
          {/* ==================================================================== */}
          {type === 'EXPIRING_SOON' && (() => {
            const expiringBottles = bottles.filter((b) => {
              if (b.status === 'DISPOSED') return false;
              const days = calculateDaysRemaining(b.expiryDate);
              return days >= 0 && days <= 90;
            });

            // Sub-filter tabs: <=30, 31-60, 61-90
            const filteredBottles = expiringBottles.filter((b) => {
              const days = calculateDaysRemaining(b.expiryDate);
              if (expirySubTab === '30') return days <= 30;
              if (expirySubTab === '60') return days > 30 && days <= 60;
              if (expirySubTab === '90') return days > 60 && days <= 90;
              return true;
            });

            const count30 = expiringBottles.filter((b) => calculateDaysRemaining(b.expiryDate) <= 30).length;
            const count60 = expiringBottles.filter((b) => {
              const d = calculateDaysRemaining(b.expiryDate);
              return d > 30 && d <= 60;
            }).length;
            const count90 = expiringBottles.filter((b) => {
              const d = calculateDaysRemaining(b.expiryDate);
              return d > 60 && d <= 90;
            }).length;

            return (
              <div className="space-y-6">
                {/* 4.1 Sub-tab Filters */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <button
                    onClick={() => setExpirySubTab('ALL')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                      expirySubTab === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả (≤ 90 ngày) ({expiringBottles.length})
                  </button>
                  <button
                    onClick={() => setExpirySubTab('30')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                      expirySubTab === '30'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    ≤ 30 ngày (Khẩn cấp) ({count30})
                  </button>
                  <button
                    onClick={() => setExpirySubTab('60')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                      expirySubTab === '60'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                    }`}
                  >
                    31 - 60 ngày ({count60})
                  </button>
                  <button
                    onClick={() => setExpirySubTab('90')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-colors ${
                      expirySubTab === '90'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    61 - 90 ngày ({count90})
                  </button>
                </div>

                {/* 4.2 Bảng chi tiết từng chai */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[440px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Mã chai</th>
                          <th className="py-2.5 px-3">Hóa chất</th>
                          <th className="py-2.5 px-3">Hạn sử dụng</th>
                          <th className="py-2.5 px-3">Số ngày còn</th>
                          <th className="py-2.5 px-3 text-right">Lượng còn lại</th>
                          <th className="py-2.5 px-3">Vị trí</th>
                          <th className="py-2.5 px-3 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredBottles.map((bottle) => {
                          const chem = chemicals.find((c) => c.id === bottle.chemicalId);
                          const days = calculateDaysRemaining(bottle.expiryDate);

                          return (
                            <tr key={bottle.id} className="hover:bg-orange-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {bottle.bottleCode}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{chem?.name || bottle.chemicalId}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Lô: {bottle.lotNumber}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {bottle.expiryDate}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    days <= 30
                                      ? 'bg-rose-100 text-rose-800'
                                      : days <= 60
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {days} ngày
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {bottle.currentVolume} <span className="font-normal text-slate-500">{bottle.unit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {formatLocation(bottle.location)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onOpenRecordUsage?.(bottle.chemicalId, bottle.id);
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                    title="Ưu tiên dùng trước chai này"
                                  >
                                    Ưu tiên dùng
                                  </button>
                                  {isManager && (
                                    <button
                                      onClick={() => setDisposingBottleId(bottle.id)}
                                      className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                      title="Xuất hủy chai"
                                    >
                                      Thanh lý
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================================== */}
          {/* 5. ĐÃ HẾT HẠN (EXPIRED) */}
          {/* ==================================================================== */}
          {type === 'EXPIRED' && (() => {
            const expiredBottles = bottles.filter((b) => {
              if (b.status === 'DISPOSED') return false;
              const days = calculateDaysRemaining(b.expiryDate);
              return days < 0;
            });

            return (
              <div className="space-y-6">
                {/* 5.1 Danger Notice Banner */}
                <div className="p-4 bg-rose-950 text-white rounded-2xl flex items-start gap-3 shadow-md">
                  <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm tracking-wide text-rose-200">
                      CẢNH BÁO AN TOÀN GLP: KHÓA SỬ DỤNG – CHỜ TIÊU HỦY
                    </div>
                    <p className="text-xs text-rose-300 mt-1 leading-relaxed">
                      Các chai hóa chất dưới đây đã vượt quá hạn sử dụng chính thức. Hệ thống tự động khóa không cho phép ghi nhận sử dụng kiểm nghiệm. Quản lý phòng lab cần cách ly vật lý và lập biên bản thanh lý tiêu hủy theo quy định an toàn hóa chất.
                    </p>
                  </div>
                </div>

                {/* 5.2 Bảng chi tiết chai hết hạn */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[440px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Mã chai</th>
                          <th className="py-2.5 px-3">Hóa chất</th>
                          <th className="py-2.5 px-3">Ngày hết hạn</th>
                          <th className="py-2.5 px-3">Quá hạn</th>
                          <th className="py-2.5 px-3 text-right">Lượng tồn</th>
                          <th className="py-2.5 px-3">Vị trí lưu trữ</th>
                          <th className="py-2.5 px-3 text-right">Thao tác Quản lý</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {expiredBottles.map((bottle) => {
                          const chem = chemicals.find((c) => c.id === bottle.chemicalId);
                          const days = Math.abs(calculateDaysRemaining(bottle.expiryDate));

                          return (
                            <tr key={bottle.id} className="hover:bg-rose-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                                {bottle.bottleCode}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{chem?.name || bottle.chemicalId}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Lô: {bottle.lotNumber}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                                {bottle.expiryDate}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                                  Quá {days} ngày
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {bottle.currentVolume} <span className="font-normal text-slate-500">{bottle.unit}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {formatLocation(bottle.location)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isManager ? (
                                  <button
                                    onClick={() => setDisposingBottleId(bottle.id)}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Thanh lý chai</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Chỉ Quản lý được thanh lý</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================================================================== */}
          {/* 6. CHAI ĐANG MỞ (IN-USE) */}
          {/* ==================================================================== */}
          {type === 'IN_USE' && (() => {
            const inUseBottles = bottles.filter((b) => {
              if (b.status === 'DISPOSED') return false;
              return b.openedDate && b.currentVolume > 0;
            });

            let totalRemainingML = 0;
            let totalDaysOpened = 0;

            inUseBottles.forEach((b) => {
              totalRemainingML += b.currentVolume;
              totalDaysOpened += calculateDaysOpened(b.openedDate);
            });

            const avgDaysOpened = inUseBottles.length > 0 ? Math.round(totalDaysOpened / inUseBottles.length) : 0;
            const inUsePercentage = bottles.length > 0 ? Math.round((inUseBottles.length / bottles.length) * 100) : 0;

            return (
              <div className="space-y-6">
                {/* 6.1 Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl">
                    <div className="text-xs font-semibold text-cyan-800">Chai đang mở (In-Use)</div>
                    <div className="text-2xl font-bold font-mono text-cyan-900 mt-1">{inUseBottles.length}</div>
                    <div className="text-[11px] text-cyan-700 mt-0.5">chai đang sử dụng</div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                    <div className="text-xs font-semibold text-blue-800">Tỷ lệ chai mở / kho</div>
                    <div className="text-2xl font-bold font-mono text-blue-900 mt-1">{inUsePercentage}%</div>
                    <div className="text-[11px] text-blue-700 mt-0.5">trên tổng {bottles.length} chai</div>
                  </div>
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <div className="text-xs font-semibold text-indigo-800">Thời gian mở trung bình</div>
                    <div className="text-2xl font-bold font-mono text-indigo-900 mt-1">{avgDaysOpened}</div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">ngày kể từ khi mở nắp</div>
                  </div>
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl">
                    <div className="text-xs font-semibold text-teal-800">Khối lượng/TT còn lại</div>
                    <div className="text-2xl font-bold font-mono text-teal-900 mt-1">
                      {totalRemainingML.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-teal-700 mt-0.5">đang phân tán ở phòng lab</div>
                  </div>
                </div>

                {/* 6.2 Bảng chi tiết kèm Progress Bar */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto max-h-[440px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Mã chai</th>
                          <th className="py-2.5 px-3">Hóa chất</th>
                          <th className="py-2.5 px-3">Ngày mở nắp</th>
                          <th className="py-2.5 px-3">Đã mở</th>
                          <th className="py-2.5 px-3 text-right">Ban đầu</th>
                          <th className="py-2.5 px-3 text-right">Còn lại</th>
                          <th className="py-2.5 px-3 min-w-[130px]">Tỷ lệ còn</th>
                          <th className="py-2.5 px-3">Vị trí</th>
                          <th className="py-2.5 px-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {inUseBottles.map((bottle) => {
                          const chem = chemicals.find((c) => c.id === bottle.chemicalId);
                          const daysOpened = calculateDaysOpened(bottle.openedDate);
                          const remainingPercent = Math.min(100, Math.max(0, Math.round((bottle.currentVolume / bottle.initialVolume) * 100)));

                          return (
                            <tr key={bottle.id} className="hover:bg-cyan-50/30 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {bottle.bottleCode}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">{chem?.name || bottle.chemicalId}</div>
                                <div className="text-[10px] text-slate-400 font-mono">Lô: {bottle.lotNumber}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {bottle.openedDate}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-cyan-800">
                                {daysOpened} ngày
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                                {bottle.initialVolume} {bottle.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {bottle.currentVolume} {bottle.unit}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      remainingPercent <= 20
                                        ? 'bg-rose-500'
                                        : remainingPercent <= 50
                                        ? 'bg-amber-500'
                                        : 'bg-cyan-500'
                                    }`}
                                    style={{ width: `${remainingPercent}%` }}
                                  />
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 text-right font-semibold">
                                  {remainingPercent}%
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {formatLocation(bottle.location)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onOpenRecordUsage?.(bottle.chemicalId, bottle.id);
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Ghi dùng
                                  </button>
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onOpenBottleDetail?.(bottle.id);
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem chi tiết lý lịch chai"
                                  >
                                    Chi tiết
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Ngày chuẩn đối soát: <strong className="font-mono text-slate-700">{referenceDate}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* DISPOSAL CONFIRMATION MODAL */}
      {disposingBottleId && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận thanh lý chai</h3>
                <p className="text-xs text-slate-500">Hành động này sẽ đưa lượng tồn về 0 và lưu vào lịch sử hủy</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do thanh lý / tiêu hủy:
              </label>
              <textarea
                value={disposalReason}
                onChange={(e) => setDisposalReason(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDisposingBottleId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDisposal}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận thanh lý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

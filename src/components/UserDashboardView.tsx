import React, { useState, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import {
  QrCode,
  Search,
  FlaskConical,
  Clock,
  History,
  ArrowRight,
  Plus,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  FileText,
  Gauge,
  X,
} from 'lucide-react';
import { getStockStatusLabel } from '../utils/status';

interface Props {
  onNavigateToTab: (tab: 'dashboard' | 'inventory' | 'usage') => void;
  onNavigateWithFilter?: (tab: any, filter?: string) => void;
  onOpenRecordUsage: (chemicalId?: string, bottleId?: string) => void;
  onOpenQrScanner: () => void;
  onOpenBottleDetail?: (bottleId: string) => void;
  onOpenUserGuide?: () => void;
  onSelectChemicalFromSearch?: (chemicalId: string, query?: string) => void;
}

export const UserDashboardView: React.FC<Props> = ({
  onNavigateToTab,
  onNavigateWithFilter,
  onOpenRecordUsage,
  onOpenQrScanner,
  onOpenBottleDetail,
  onOpenUserGuide,
  onSelectChemicalFromSearch,
}) => {
  const { currentUser, transactions, chemicals, bottles, getChemicalTotalStock, getChemicalStockStatus } = useLab();

  // Search state within User Dashboard
  const [dashboardSearch, setDashboardSearch] = useState('');

  // Filter only transactions belonging to the current user
  const myTransactions = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.type === 'USAGE' &&
        !t.isReversed &&
        (t.user === currentUser.name || t.userId === currentUser.id || t.userEmail === currentUser.email)
    );
  }, [transactions, currentUser]);

  // Recent 6 usages of this user
  const recentUsages = useMemo(() => {
    return myTransactions.slice(0, 6);
  }, [myTransactions]);

  // Frequently used chemicals by this user
  const frequentChemicals = useMemo(() => {
    const counts: Record<string, { count: number; totalQty: number; unit: string; chemicalId: string; chemicalName: string }> = {};

    myTransactions.forEach((t) => {
      if (!counts[t.chemicalId]) {
        counts[t.chemicalId] = {
          chemicalId: t.chemicalId,
          chemicalName: t.chemicalName,
          count: 0,
          totalQty: 0,
          unit: t.unit,
        };
      }
      counts[t.chemicalId].count += 1;
      counts[t.chemicalId].totalQty += t.quantity;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [myTransactions]);

  // Active chemicals for search
  const activeChemicals = useMemo(() => {
    return chemicals.filter((c) => c.status !== 'ARCHIVED');
  }, [chemicals]);

  // Search matching chemicals
  const matchingChemicals = useMemo(() => {
    if (!dashboardSearch.trim()) return [];
    const q = dashboardSearch.toLowerCase().trim();
    return activeChemicals
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.casNumber.toLowerCase().includes(q) ||
          c.englishName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [activeChemicals, dashboardSearch]);

  // Today's limits calculation
  const todayUsageStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = myTransactions.filter((t) => t.date.startsWith(todayStr));
    const totalQty = todayTxs.reduce((sum, t) => sum + (t.quantity || 0), 0);
    return {
      count: todayTxs.length,
      totalQty,
    };
  }, [myTransactions]);

  const limits = currentUser.limits;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 sm:pb-8">
      {/* 1. Header: Greeting & Quick Subtitle */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-7 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200/80 text-xs font-semibold mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
              <span>LabChem · Thành viên phòng thí nghiệm</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Xin chào, {currentUser.name} 👋
            </h1>
            <p className="text-sm font-medium text-slate-600">
              Hôm nay bạn muốn làm gì? <span className="text-slate-400 font-normal">Bạn có thể thao tác nhanh bên dưới:</span>
            </p>
          </div>

          {onOpenUserGuide && (
            <button
              onClick={onOpenUserGuide}
              className="self-start sm:self-center px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-2xs"
              title="Xem hướng dẫn nhanh dành cho thành viên"
            >
              <BookOpen className="w-4 h-4 text-cyan-700" />
              <span>Hướng Dẫn Lab</span>
            </button>
          )}
        </div>

        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-linear-to-bl from-cyan-100/40 via-transparent to-transparent pointer-events-none rounded-full blur-2xl -mr-16 -mt-16" />
      </div>

      {/* 2. THE 3 MAIN FAST-ACTION BLOCKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* KHỐI 1: QUÉT QR DÙNG HÓA CHẤT (HERO HIGHLIGHT) */}
        <button
          onClick={onOpenQrScanner}
          className="group relative flex flex-col justify-between p-6 rounded-3xl bg-linear-to-br from-cyan-600 via-teal-600 to-emerald-700 text-white shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] text-left cursor-pointer border border-cyan-400/30 overflow-hidden"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 text-white shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <QrCode className="w-7 h-7" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                KHUYÊN DÙNG
              </span>
            </div>

            <div className="mt-5 space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>📷 Quét QR dùng hóa chất</span>
              </h2>
              <p className="text-xs text-cyan-100 leading-relaxed font-normal">
                Quét tem QR dán trên chai để nhận diện tức thì và trừ tồn kho tự động.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-bold text-cyan-100">
            <span>Mở Camera quét ngay</span>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform" />
          </div>
        </button>

        {/* KHỐI 2: GHI SỬ DỤNG THỦ CÔNG */}
        <button
          onClick={() => onOpenRecordUsage()}
          className="group relative flex flex-col justify-between p-6 rounded-3xl bg-white hover:bg-slate-50 text-slate-900 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] text-left cursor-pointer border border-slate-200 overflow-hidden"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 group-hover:scale-110 transition-all duration-300">
                <FileText className="w-7 h-7" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Chọn thủ công
              </span>
            </div>

            <div className="mt-5 space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>📝 Ghi sử dụng thủ công</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Không mang chai hoặc tem mờ? Bạn có thể chọn hóa chất và chai từ danh sách.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Mở biểu mẫu ghi dùng</span>
            <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </button>

        {/* KHỐI 3: TRA CỨU HÓA CHẤT */}
        <button
          onClick={() => onNavigateToTab('inventory')}
          className="group relative flex flex-col justify-between p-6 rounded-3xl bg-white hover:bg-slate-50 text-slate-900 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] text-left cursor-pointer border border-slate-200 overflow-hidden"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="p-3.5 bg-cyan-50 text-cyan-700 rounded-2xl border border-cyan-100 group-hover:scale-110 transition-all duration-300">
                <Search className="w-7 h-7" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                {activeChemicals.length} Hóa chất
              </span>
            </div>

            <div className="mt-5 space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>🧪 Tra cứu hóa chất</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Tìm kiếm tên, số CAS, vị trí tủ kệ, nồng độ và các chai đang sẵn sàng trong kho.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-cyan-800">
            <span>Xem Kho hóa chất</span>
            <ArrowRight className="w-4 h-4 text-cyan-600 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </button>
      </div>

      {/* QUICK INLINE SEARCH WIDGET FOR RAPID LOOKUP */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={dashboardSearch}
            onChange={(e) => setDashboardSearch(e.target.value)}
            placeholder="Tìm nhanh hóa chất hoặc số CAS (ví dụ: Hexane, Ethanol, 67-64-1, NaOH)..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-cyan-600 focus:bg-white rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all"
          />
          {dashboardSearch && (
            <button
              onClick={() => setDashboardSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown */}
        {dashboardSearch.trim() && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 px-1">
              Kết quả tìm kiếm cho "{dashboardSearch}":
            </div>
            {matchingChemicals.length === 0 ? (
              <div className="text-xs text-slate-500 py-3 text-center">
                Không tìm thấy hóa chất nào phù hợp. Bạn có thể kiểm tra lại tên hoặc số CAS.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {matchingChemicals.map((chem) => {
                  const stock = getChemicalTotalStock(chem.id);
                  const status = getChemicalStockStatus(chem.id);
                  const sLabel = getStockStatusLabel(status);

                  return (
                    <div
                      key={chem.id}
                      className="py-2.5 px-2 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{chem.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.2 bg-slate-100 rounded">
                            CAS: {chem.casNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Vị trí: <strong>{chem.storageLocation.cabinet}</strong>, Kệ {chem.storageLocation.shelf} · {chem.storageLocation.room}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-bold font-mono text-slate-900">
                            {stock.total} {stock.unit}
                          </div>
                          <span className={`text-[9px] font-bold ${sLabel.badgeClass}`}>{sLabel.text}</span>
                        </div>

                        <button
                          onClick={() => onOpenRecordUsage(chem.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-colors cursor-pointer shadow-2xs"
                        >
                          + Dùng
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. KHỐI 4: LỊCH SỬ DÙNG GẦN ĐÂY CỦA BẠN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Lịch Sử Dùng Gần Đây Của Bạn
              </h3>
              <p className="text-xs text-slate-500">
                Chỉ hiển thị các lần thao tác do chính bạn thực hiện trong phòng lab
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab('usage')}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 cursor-pointer transition-colors hover:underline"
          >
            <span>Xem tất cả lịch sử</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentUsages.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <div className="text-xs font-medium text-slate-700">Bạn chưa có lượt ghi nhận sử dụng nào.</div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Hãy bấm vào "📷 Quét QR dùng hóa chất" ở trên để ghi nhận chai đầu tiên bạn dùng hôm nay.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentUsages.map((t) => (
              <div
                key={t.id}
                className="py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 rounded-2xl px-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-800 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                    {t.bottleCode ? t.bottleCode.substring(0, 4) : 'CHAI'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {t.chemicalName}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono">
                      <span>Mã chai: <strong className="text-cyan-800">{t.bottleCode || 'Chai'}</strong></span>
                      <span>·</span>
                      <span>{t.date}</span>
                      {t.purpose && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[180px] text-slate-600 font-sans">
                            {t.purpose}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-extrabold text-sm text-rose-600 block">
                    -{t.quantity} {t.unit}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    còn {t.newStock} {t.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. KHỐI 5: HÓA CHẤT HAY DÙNG GẦN ĐÂY & HẠN MỨC CÁ NHÂN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Personal Limits Quick Gauge */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Gauge className="w-4 h-4 text-cyan-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Hạn Mức Cá Nhân</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Đã dùng hôm nay:</span>
              <strong className="text-cyan-800 font-mono">{todayUsageStats.count} lượt</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Tổng lượng hôm nay:</span>
              <strong className="text-cyan-800 font-mono">{todayUsageStats.totalQty} mL/g</strong>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Tối đa mỗi lần:</span>
              <span className="font-mono font-bold text-slate-900">
                {limits?.maxUsagePerTransaction ? `${limits.maxUsagePerTransaction} mL` : 'Tự do'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Giới hạn ngày:</span>
              <span className="font-mono font-bold text-slate-900">
                {limits?.dailyUsageLimit ? `${limits.dailyUsageLimit} mL` : 'Không giới hạn'}
              </span>
            </div>
          </div>
        </div>

        {/* Frequently Used Chemicals */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Hóa Chất Bạn Thường Dùng
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Truy cập nhanh</span>
          </div>

          {frequentChemicals.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              Chưa có dữ liệu thống kê. Hóa chất bạn dùng thường xuyên sẽ tự động xuất hiện tại đây.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {frequentChemicals.map((item) => (
                <div
                  key={item.chemicalId}
                  className="p-3 rounded-2xl bg-slate-50 hover:bg-cyan-50/50 border border-slate-200/80 transition-all flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {item.chemicalName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      Đã dùng <strong>{item.count} lần</strong> ({item.totalQty} {item.unit})
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenRecordUsage(item.chemicalId)}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition-colors shrink-0 cursor-pointer shadow-2xs"
                    title={`Ghi sử dụng ${item.chemicalName}`}
                  >
                    + Dùng
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Safety Reminder */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="flex-1 leading-relaxed">
          <strong>An toàn phòng thí nghiệm:</strong> Luôn đọc kỹ nhãn cảnh báo trên chai, sử dụng tủ hút khí độc đối với dung môi bay hơi và ghi lại chính xác lượng đã lấy để đảm bảo số liệu tồn kho.
        </div>
      </div>
    </div>
  );
};

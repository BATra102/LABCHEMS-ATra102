import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { getRoleDisplayName, isSeniorManagerUser } from '../utils/roleUtils';
import {
  Plus,
  Settings,
  ChevronDown,
  Check,
  Shield,
  LogIn,
  Search,
  X,
  ArrowRight,
  FlaskConical,
  CornerDownLeft,
  Sparkles,
  Bell,
  Mail,
  Users,
  AlertTriangle,
  Clock,
  ExternalLink,
  QrCode,
  BookOpen,
  User as UserIcon,
  LogOut,
  Menu as MenuIcon,
  Database,
  Barcode,
  FileText,
} from 'lucide-react';
import { getStockStatusLabel } from '../utils/status';

export type TabType = 
  | 'dashboard'
  | 'inventory'
  | 'usage'
  | 'purchase'
  | 'expiry'
  | 'users'
  | 'settings';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenRecordUsage: (chemicalId?: string) => void;
  onOpenStockIn: (chemicalId?: string) => void;
  onOpenAddChemical: () => void;
  onOpenLogin?: () => void;
  onSignOut?: () => void;
  onOpenUserProfile?: () => void;
  onOpenMobileMenu?: () => void;
  onOpenEmailAlerts?: () => void;
  onOpenDiscrepancyModal?: () => void;
  onSelectChemicalFromSearch?: (chemicalId: string, query?: string) => void;
  onSearchSubmit?: (query: string) => void;
  onOpenQrScanner?: () => void;
  onOpenUserGuide?: () => void;
  onOpenSupabaseConfig?: () => void;
  onSignOutToLogin?: () => void;
  onOpenSupermarketBarcode?: (mode?: 'STOCK_IN' | 'STOCK_OUT') => void;
  onOpenPdfReport?: (type?: 'INVENTORY' | 'TRANSACTIONS' | 'ARCHIVE') => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export const Header: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenRecordUsage,
  onOpenStockIn,
  onOpenLogin,
  onOpenUserProfile,
  onOpenMobileMenu,
  onOpenEmailAlerts,
  onOpenDiscrepancyModal,
  onSelectChemicalFromSearch,
  onSearchSubmit,
  onOpenQrScanner,
  onOpenUserGuide,
  onOpenSupabaseConfig,
  onSignOutToLogin,
  onSignOut,
  onOpenSupermarketBarcode,
  onOpenPdfReport,
}) => {
  const {
    chemicals,
    currentUser,
    setCurrentUser,
    users,
    purchaseItems,
    isManager,
    pendingUsersCount,
    notifications,
    markNotificationAsRead,
    unreadNotificationsCount,
    emailAlertLogs,
    getChemicalTotalStock,
    getChemicalStockStatus,
    isSupabaseConfigured,
    isRealtimeActive,
    isSyncing,
  } = useLab();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const pendingPurchasesCount = purchaseItems.filter((p) => p.status === 'PENDING').length;

  // Role-based notification filtering (Mục 14: User chỉ nhận thông báo trực tiếp liên quan)
  const userNotifications = useMemo(() => {
    if (isManager) return notifications;
    return notifications.filter(
      (n) => n.targetRole === 'USER' || n.targetUserId === currentUser.id || n.targetRole === 'ALL'
    );
  }, [notifications, isManager, currentUser]);

  const activeUnreadCount = useMemo(() => {
    return userNotifications.filter((n) => !n.read).length;
  }, [userNotifications]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        searchRef.current &&
        !searchRef.current.contains(target) &&
        mobileSearchRef.current &&
        !mobileSearchRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter chemicals across entire inventory by Name or CAS number
  const matchingChemicals = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return chemicals
      .filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.casNumber.toLowerCase().includes(q) ||
          c.englishName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [chemicals, searchQuery]);

  const handleSelectChemical = (chemId: string) => {
    setIsSearchOpen(false);
    if (onSelectChemicalFromSearch) {
      onSelectChemicalFromSearch(chemId, searchQuery);
    } else {
      setActiveTab('inventory');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsSearchOpen(false);
      if (matchingChemicals.length === 1) {
        handleSelectChemical(matchingChemicals[0].id);
      } else if (onSearchSubmit) {
        onSearchSubmit(searchQuery);
      } else {
        setActiveTab('inventory');
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 lg:gap-3 w-full min-w-0">
          {/* Zone 1: Wordmark & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                className="md:hidden p-2 text-slate-700 hover:text-cyan-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Mở menu di động"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setActiveTab('dashboard')}
              className="text-left flex items-center gap-2 cursor-pointer group"
              title="Về Trang chủ LabChems Anhtra102"
            >
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-cyan-600 to-teal-700 text-white flex items-center justify-center font-black text-sm shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                LC
              </div>
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 leading-none group-hover:text-cyan-700 transition-colors">
                  LabChems
                </span>
                <span className="text-xs sm:text-sm font-bold tracking-tight text-cyan-700 leading-none mt-0.5">
                  Anhtra102
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links (Section 1: Role-based Navigation) */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {isManager ? (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'inventory'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Kho Hóa Chất
                </button>
                <button
                  onClick={() => setActiveTab('usage')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'usage'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Lịch Sử
                </button>
                <button
                  onClick={() => setActiveTab('purchase')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors relative cursor-pointer ${
                    activeTab === 'purchase'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Mua Sắm
                  {pendingPurchasesCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-mono rounded-full font-bold">
                      {pendingPurchasesCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('expiry')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'expiry'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Hạn Dùng
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-purple-100 text-purple-900 font-bold'
                      : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                  <span>Users</span>
                  {pendingUsersCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-mono rounded-full font-bold animate-pulse">
                      {pendingUsersCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-2 py-1.5 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title="Cài đặt hệ thống"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Cài Đặt</span>
                </button>
              </>
            ) : (
              /* User / Member minimal navigation (Mục 3: Trang chủ, Kho hóa chất, Ghi sử dụng, Lịch sử của tôi) */
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Trang chủ
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'inventory'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Kho hóa chất
                </button>
                <button
                  onClick={() => onOpenRecordUsage()}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghi sử dụng</span>
                </button>
                <button
                  onClick={() => setActiveTab('usage')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    activeTab === 'usage'
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Lịch sử của tôi
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Global Header Search Bar */}
          <div ref={searchRef} className="relative flex-1 min-w-[120px] max-w-[180px] md:max-w-[220px] lg:max-w-[240px] xl:max-w-[300px] hidden sm:block">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setIsSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Tìm nhanh hóa chất, CAS..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-100 hover:bg-slate-100/90 focus:bg-white border border-slate-200 focus:border-cyan-600 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Filter Dropdown Results */}
            {isSearchOpen && searchQuery.trim() && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Kết quả tìm kiếm toàn kho:</span>
                  <span className="font-semibold text-slate-800">{matchingChemicals.length} hóa chất khớp</span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {matchingChemicals.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Không tìm thấy hóa chất nào khớp với tên hoặc số CAS "{searchQuery}"
                    </div>
                  ) : (
                    matchingChemicals.map((chem) => {
                      const stock = getChemicalTotalStock(chem.id);
                      const stockStatus = getChemicalStockStatus(chem.id);
                      const sLabel = getStockStatusLabel(stockStatus);

                      return (
                        <div
                          key={chem.id}
                          className="p-3 hover:bg-cyan-50/50 transition-colors flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">{chem.name}</span>
                              <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                                CAS: {chem.casNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {chem.englishName} · Vị trí: {chem.storageLocation.cabinet}, {chem.storageLocation.shelf}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <div>
                              <div className="font-bold text-slate-900 font-mono">
                                {stock.total} {stock.unit}
                              </div>
                              <span className={`text-[10px] font-bold ${sLabel.badgeClass}`}>{sLabel.text}</span>
                            </div>

                            <button
                              onClick={() => handleSelectChemical(chem.id)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            >
                              Xem kho →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Zone 4: Action Buttons, Notification Center, User Profile */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Chức năng 1: Quét mã nhập kho */}
            {onOpenSupermarketBarcode && (
              <button
                type="button"
                onClick={() => onOpenSupermarketBarcode('STOCK_IN')}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                title="Quét mã nhập kho: Quét lặp mã vạch / QR tự động cộng tồn kho"
              >
                <Barcode className="w-3.5 h-3.5 text-emerald-700" />
                <span>Quét nhập kho</span>
              </button>
            )}

            {/* Chức năng 2: Quét mã sử dụng hóa chất */}
            {onOpenSupermarketBarcode && (
              <button
                type="button"
                onClick={() => onOpenSupermarketBarcode('STOCK_OUT')}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                title="Quét mã sử dụng hóa chất: Quét mã vạch / QR chai để xuất kho và trừ tồn"
              >
                <FlaskConical className="w-3.5 h-3.5 text-cyan-700" />
                <span>Quét sử dụng hóa chất</span>
              </button>
            )}

            {/* Chức năng 3: Xuất Báo Cáo PDF & In Ấn */}
            {onOpenPdfReport && (
              <button
                type="button"
                onClick={() => onOpenPdfReport('INVENTORY')}
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                title="Xuất danh sách hóa chất, lịch sử giao dịch ra PDF hoặc lưu trữ định kỳ"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-700" />
                <span>Xuất PDF</span>
              </button>
            )}

            {/* Cloud Database Status Badge (Section 9 & 11) */}
            {isManager && onOpenSupabaseConfig ? (
              <button
                onClick={onOpenSupabaseConfig}
                className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                  isSupabaseConfigured
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
                title={
                  isSupabaseConfigured
                    ? 'Cloud Database: Đã kết nối (Bấm để xem cấu hình hệ thống)'
                    : 'Cloud Database: Đang kiểm tra kết nối...'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isSupabaseConfigured
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />
                <Database className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span className="hidden xl:inline">
                  {isSupabaseConfigured ? 'Cloud Database: Đã kết nối' : 'Cloud Database: Đang kiểm tra...'}
                </span>
                <span className="inline xl:hidden">
                  {isSupabaseConfigured ? 'Cloud DB' : 'Đang kết nối'}
                </span>
              </button>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-xl border text-[11px] font-semibold shrink-0 ${
                  isSupabaseConfigured
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
                title="Trạng thái kết nối Cloud Database"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isSupabaseConfigured
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                <Database className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span className="hidden xl:inline">
                  {isSupabaseConfigured ? 'Cloud Database: Đã kết nối' : 'Cloud Database: Đang kiểm tra...'}
                </span>
                <span className="inline xl:hidden">
                  {isSupabaseConfigured ? 'Cloud DB' : 'Đang kết nối'}
                </span>
              </div>
            )}

            {/* NOTIFICATION CENTER BELL (Section 60 & Email Alerts) */}
            <div ref={notifRef} className="relative shrink-0">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Trung tâm thông báo & Email cảnh báo"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-cyan-600" />
                      <span className="font-bold text-slate-900">Thông Báo Hệ Thống</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                          {unreadNotificationsCount} mới
                        </span>
                      )}
                    </div>

                    {onOpenEmailAlerts && (
                      <button
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          onOpenEmailAlerts();
                        }}
                        className="text-[11px] text-cyan-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Hộp thư Email ({emailAlertLogs.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs">Không có thông báo mới</div>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationAsRead(n.id)}
                          className={`p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5 cursor-pointer ${
                            !n.read ? 'bg-cyan-50/30' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {n.type === 'CRITICAL_STOCK' || n.type === 'LOW_STOCK' ? (
                              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            ) : n.type === 'NEW_USER_PENDING' ? (
                              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center">
                                <Bell className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 text-xs truncate">{n.title}</span>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                {new Date(n.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer link to email alerts */}
                  {onOpenEmailAlerts && (
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          onOpenEmailAlerts();
                        }}
                        className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 flex items-center justify-center gap-1.5 w-full cursor-pointer"
                      >
                        <Mail className="w-3.5 h-3.5 text-rose-500" />
                        <span>Xem nhật ký gửi Email tự động khi hóa chất sắp hết</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* USER PROFILE & SIGN IN WITH GOOGLE */}
            <div ref={userMenuRef} className="relative shrink-0">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2 sm:py-1 text-xs text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden text-slate-800">
                  {currentUser.picture ? (
                    <img src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="font-bold text-slate-900 leading-none truncate max-w-[85px] xl:max-w-[110px] flex items-center gap-1">
                    <span>{currentUser.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[9px] font-mono font-bold px-1 rounded ${
                        isSeniorManagerUser(currentUser)
                          ? 'bg-indigo-100 text-indigo-700'
                          : isManager
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {getRoleDisplayName(currentUser.role, currentUser.email)}
                    </span>
                    {currentUser.status === 'PENDING' && (
                      <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  {/* Current Active Account */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Tài khoản Google đang kết nối
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <GoogleIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                              isSeniorManagerUser(currentUser)
                                ? 'bg-indigo-100 text-indigo-700'
                                : isManager
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {getRoleDisplayName(currentUser.role, currentUser.email)}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              currentUser.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {currentUser.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN CÁ NHÂN (Mục 3: Menu tài khoản Thông tin cá nhân) */}
                  {onOpenUserProfile && (
                    <div className="p-2 border-b border-slate-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenUserProfile();
                        }}
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                      >
                        <UserIcon className="w-4 h-4 text-cyan-700" />
                        <span>Thông Tin Cá Nhân & Hạn Mức</span>
                      </button>
                    </div>
                  )}

                  {/* Quick User Guide option in dropdown */}
                  {onOpenUserGuide && (
                    <div className="p-2 border-b border-slate-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenUserGuide();
                        }}
                        className="w-full py-1.5 px-3 hover:bg-cyan-50 text-cyan-950 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-cyan-700" />
                          <span>Hướng Dẫn Sử Dụng Website</span>
                        </div>
                        <span className="text-[10px] bg-cyan-100 text-cyan-900 px-1.5 py-0.5 rounded font-bold font-mono">
                          Trợ giúp
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Xuất Báo Cáo PDF & In Hồ Sơ */}
                  {onOpenPdfReport && (
                    <div className="p-2 border-b border-slate-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenPdfReport('INVENTORY');
                        }}
                        className="w-full py-1.5 px-3 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-700" />
                          <span>Xuất Báo Cáo PDF & In Ấn</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold font-mono">
                          A4 / PDF
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Sign out */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        if (onSignOut) {
                          onSignOut();
                        } else if (onSignOutToLogin) {
                          onSignOutToLogin();
                        } else if (onOpenLogin) {
                          onOpenLogin();
                        }
                      }}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng Xuất</span>
                    </button>
                  </div>

                  {/* Actions ONLY for Manager (Mục 3: User KHÔNG nhìn thấy Quản lý User) */}
                  {isManager && (
                    <div className="pt-1 border-t border-slate-100 px-3 py-2 flex items-center justify-between text-[11px]">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setActiveTab('users');
                        }}
                        className="text-purple-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>User Management →</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Bar (Compact, Single-Line, Clean) */}
        <div className="sm:hidden pb-2.5 pt-1 border-t border-slate-100">
          <div ref={mobileSearchRef} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm nhanh hóa chất, CAS..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-100 focus:bg-white border border-slate-200 focus:border-cyan-600 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

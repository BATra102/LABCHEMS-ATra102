/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LabProvider, useLab } from './context/LabContext';
import { Header, TabType } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { UserDashboardView } from './components/UserDashboardView';
import { InventoryView } from './components/InventoryView';
import { UsageView } from './components/UsageView';
import { PurchaseView } from './components/PurchaseView';
import { ExpiryView } from './components/ExpiryView';
import { SettingsView } from './components/SettingsView';
import { UserManagementView } from './components/UserManagementView';
import { RecordUsageModal } from './components/modals/RecordUsageModal';
import { StockInModal } from './components/modals/StockInModal';
import { AddChemicalModal } from './components/modals/AddChemicalModal';
import { BottleDetailModal } from './components/modals/BottleDetailModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { EmailAlertsModal } from './components/modals/EmailAlertsModal';
import { StockDiscrepancyModal } from './components/modals/StockDiscrepancyModal';
import { ExcelImportModal } from './components/modals/ExcelImportModal';
import { UserGuideModal } from './components/modals/UserGuideModal';
import { QrScannerModal } from './components/modals/QrScannerModal';
import { ArchiveCenterModal } from './components/modals/ArchiveCenterModal';
import { DeleteChemicalModal } from './components/modals/DeleteChemicalModal';
import { SupabaseConfigModal } from './components/modals/SupabaseConfigModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMenuDrawer } from './components/modals/MobileMenuDrawer';
import { Login } from './components/Login';
import { MustChangePasswordView } from './components/MustChangePasswordView';
import { Bottle, Chemical, User } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { rowToUser } from './services/authService';
import { auditService } from './services/auditService';
import { isSeniorManagerEmail } from './utils/roleUtils';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

/**
 * Danh mục Route chuẩn theo yêu cầu hệ thống LabChems:
 * Dashboard     → /dashboard
 * Kho Hóa Chất  → /chemicals
 * Lịch Sử       → /history
 * Mua Sắm       → /purchases
 * Hạn Dùng      → /expiry
 * Users         → /users
 * Cài Đặt       → /settings
 */
export const TAB_TO_ROUTE: Record<TabType, string> = {
  dashboard: '/dashboard',
  inventory: '/chemicals',
  usage: '/history',
  purchase: '/purchases',
  expiry: '/expiry',
  users: '/users',
  settings: '/settings',
};

export const ROUTE_TO_TAB: Record<string, TabType> = {
  '': 'dashboard',
  dashboard: 'dashboard',
  chemicals: 'inventory',
  inventory: 'inventory',
  bottles: 'inventory',
  'import-export': 'inventory',
  history: 'usage',
  usage: 'usage',
  purchases: 'purchase',
  purchase: 'purchase',
  expiry: 'expiry',
  users: 'users',
  settings: 'settings',
  audit: 'settings',
  reports: 'inventory',
};

const resolveRouteFromUrl = (): { tab: TabType; is404: boolean } => {
  if (typeof window === 'undefined') return { tab: 'dashboard', is404: false };
  const raw = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!raw || raw === 'dashboard') {
    return { tab: 'dashboard', is404: false };
  }
  if (raw === 'login') {
    return { tab: 'dashboard', is404: false };
  }
  if (ROUTE_TO_TAB[raw]) {
    return { tab: ROUTE_TO_TAB[raw], is404: false };
  }
  return { tab: 'dashboard', is404: true };
};

function MainApp() {
  const initialRoute = resolveRouteFromUrl();
  const [activeTab, setActiveTabState] = useState<TabType>(initialRoute.tab);
  const [is404Route, setIs404Route] = useState<boolean>(initialRoute.is404);

  // Trạng thái xác thực đăng nhập
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  // Modal states
  const [recordUsageOpen, setRecordUsageOpen] = useState(false);
  const [selectedChemForUsage, setSelectedChemForUsage] = useState<string | undefined>();
  const [selectedBottleForUsage, setSelectedBottleForUsage] = useState<string | undefined>();

  const [stockInOpen, setStockInOpen] = useState(false);
  const [selectedChemForStockIn, setSelectedChemForStockIn] = useState<string | undefined>();

  const [addChemicalOpen, setAddChemicalOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [emailAlertsOpen, setEmailAlertsOpen] = useState(false);
  const [discrepancyModalOpen, setDiscrepancyModalOpen] = useState(false);
  const [discrepancyChemId, setDiscrepancyChemId] = useState<string | undefined>();
  const [discrepancyBottleId, setDiscrepancyBottleId] = useState<string | undefined>();
  const [userGuideOpen, setUserGuideOpen] = useState(false);
  const [supabaseConfigOpen, setSupabaseConfigOpen] = useState(false);

  // QR Gateway & Archive Center states
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [archiveCenterOpen, setArchiveCenterOpen] = useState(false);
  const [chemicalToDelete, setChemicalToDelete] = useState<Chemical | null>(null);
  const [deleteChemicalOpen, setDeleteChemicalOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedBottleForDetail, setSelectedBottleForDetail] = useState<Bottle | null>(null);
  const [bottleDetailOpen, setBottleDetailOpen] = useState(false);

  // Search sync state
  const [inventorySearchTerm, setInventorySearchTerm] = useState<string>('');
  const [targetChemicalId, setTargetChemicalId] = useState<string | undefined>();
  const [inventoryInitialFilter, setInventoryInitialFilter] = useState<string | undefined>();
  const [expiryInitialFilter, setExpiryInitialFilter] = useState<string | undefined>();

  const { bottles, isManager, currentUser, setCurrentUser, users, refreshFromSupabase } = useLab();

  // Kiểm tra phiên đăng nhập & quyền truy cập khi ứng dụng khởi chạy
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setAuthErrorMessage('Hệ thống chưa được cấu hình kết nối Supabase Cloud.');
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        // 1. Kiểm tra session từ Supabase Auth
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        
        let userEmail = session?.user?.email?.toLowerCase().trim() || '';
        let userId = session?.user?.id || '';

        // Dự phòng nếu phiên đăng nhập của Người quản lý được lưu trữ trong localStorage/sessionStorage
        if (!userEmail) {
          const storedAuth =
            localStorage.getItem('labchem_v4_is_authenticated') === 'true' ||
            sessionStorage.getItem('labchem_v4_is_authenticated') === 'true';
          const storedEmail = (
            localStorage.getItem('labchem_v4_current_user_email') ||
            sessionStorage.getItem('labchem_v4_current_user_email') ||
            ''
          ).toLowerCase().trim();
          const storedId =
            localStorage.getItem('labchem_v4_current_user_id') ||
            sessionStorage.getItem('labchem_v4_current_user_id') ||
            '';

          if (storedAuth && (isSeniorManagerEmail(storedEmail) || storedEmail === 'jasminebee279@gmail.com')) {
            userEmail = storedEmail;
            userId = storedId || '4d27e9a8-aae2-4276-adcf-1f10f3458b97';
          }
        }

        if (!userEmail) {
          if (isMounted) {
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
          }
          return;
        }

        const isSenior = isSeniorManagerEmail(userEmail);

        // 2. Kiểm tra quyền truy cập và trạng thái ACTIVE trong bảng profiles
        let profile = null;
        try {
          if (userId) {
            const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
            profile = data;
          }
        } catch (_) {}

        if (!profile) {
          try {
            const { data: profileByEmail } = await supabase
              .from('profiles')
              .select('*')
              .ilike('google_email', userEmail)
              .maybeSingle();
            if (profileByEmail) {
              profile = profileByEmail;
            }
          } catch (_) {}
        }

        // Nếu không có profile
        if (!profile) {
          if (isSenior) {
            const seniorUser: User = {
              id: userId || '4d27e9a8-aae2-4276-adcf-1f10f3458b97',
              name: 'Người quản lý cao cấp',
              email: userEmail,
              role: 'SENIOR_MANAGER',
              status: 'ACTIVE',
              department: 'Ban Quản Trị Hệ Thống',
            };
            if (isMounted) {
              setCurrentUser(seniorUser);
              setIsAuthenticated(true);
              setIsCheckingAuth(false);
            }
            return;
          }

          if (userEmail === 'jasminebee279@gmail.com') {
            const labManagerUser: User = {
              id: userId || 'b3d5175e-a567-412b-9cd1-22249f18ee25',
              name: 'Người quản lý Lab',
              email: userEmail,
              role: 'MANAGER',
              status: 'ACTIVE',
              department: 'Bộ môn Dược liệu & Chiết xuất',
            };
            if (isMounted) {
              setCurrentUser(labManagerUser);
              setIsAuthenticated(true);
              setIsCheckingAuth(false);
            }
            return;
          }

          // Không tìm thấy profile và không phải quản lý cao cấp -> signOut ngay lập tức
          await auditService.logAccessDenied(
            userEmail,
            'Phiên đăng nhập bị hủy: Không tìm thấy hồ sơ người dùng trong bảng profiles',
            { userId: userId || session?.user?.id }
          );
          await supabase.auth.signOut();
          localStorage.removeItem('labchem_v4_is_authenticated');
          localStorage.removeItem('labchem_v4_current_user_id');
          sessionStorage.removeItem('labchem_v4_is_authenticated');
          sessionStorage.removeItem('labchem_v4_current_user_id');
          if (isMounted) {
            setAuthErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
          }
          return;
        }

        // 4 & 5. Nếu tài khoản không ở trạng thái ACTIVE (LOCKED, DEACTIVATED, SUSPENDED, DELETED)
        if (profile.status !== 'ACTIVE' && !isSenior) {
          await auditService.logAccessDenied(
            userEmail,
            `Phiên đăng nhập bị hủy: Trạng thái tài khoản là ${profile.status}`,
            { userId: userId || session?.user?.id, status: profile.status, role: profile.role }
          );
          await supabase.auth.signOut();
          localStorage.removeItem('labchem_v4_is_authenticated');
          localStorage.removeItem('labchem_v4_current_user_id');
          sessionStorage.removeItem('labchem_v4_is_authenticated');
          sessionStorage.removeItem('labchem_v4_current_user_id');
          if (isMounted) {
            if (profile.status === 'LOCKED' || profile.status === 'DEACTIVATED' || profile.status === 'SUSPENDED') {
              setAuthErrorMessage('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Người quản lý.');
            } else if (profile.status === 'DELETED') {
              setAuthErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
            } else if (profile.status === 'PENDING') {
              setAuthErrorMessage('Tài khoản của bạn đang chờ Người quản lý phê duyệt và chưa được cấp quyền truy cập.');
            } else {
              setAuthErrorMessage('Tài khoản chưa được kích hoạt trạng thái ACTIVE để truy cập hệ thống.');
            }
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
          }
          return;
        }

        // Đã xác thực hợp lệ
        const validUser = rowToUser(profile);
        if (isMounted) {
          setCurrentUser(validUser);
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
        }
      } catch (err) {
        console.error('Lỗi xác thực phiên làm việc:', err);
        if (isMounted) {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
      }
    };

    verifySession();

    // Lắng nghe sự kiện đăng xuất từ Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (isMounted) {
          setIsAuthenticated(false);
          localStorage.removeItem('labchem_v4_is_authenticated');
          localStorage.removeItem('labchem_v4_current_user_id');
          sessionStorage.removeItem('labchem_v4_is_authenticated');
          sessionStorage.removeItem('labchem_v4_current_user_id');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [users]);

  // Xử lý Đăng xuất
  const handleSignOut = async () => {
    try {
      // Ghi nhận nhật ký ĐĂNG XUẤT (LOGOUT)
      if (currentUser) {
        await auditService.logLogout(currentUser, { trigger: 'MANUAL_USER_SIGNOUT' });
      }
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Lỗi khi đăng xuất:', err);
    }
    localStorage.removeItem('labchem_v4_is_authenticated');
    localStorage.removeItem('labchem_v4_current_user_id');
    sessionStorage.removeItem('labchem_v4_is_authenticated');
    sessionStorage.removeItem('labchem_v4_current_user_id');
    localStorage.setItem('labchem_remember_me', 'false');
    setIsAuthenticated(false);
    setActiveTabState('dashboard');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login');
    }
    setAuthErrorMessage(null);
  };

  /**
   * Hàm điều hướng chính thức giữa các Tab / Route.
   * Đồng bộ tức thì cả React state và URL trình duyệt (pushState / replaceState),
   * không reload trang, giữ người dùng ổn định trên trang vừa chọn.
   */
  const navigateToTab = useCallback(
    (tab: TabType, options?: { replace?: boolean; filter?: string; keepUrl?: boolean }) => {
      setIs404Route(false);
      setActiveTabState(tab);

      if (options?.filter) {
        if (tab === 'inventory') {
          setInventoryInitialFilter(options.filter);
        } else if (tab === 'expiry') {
          setExpiryInitialFilter(options.filter);
        }
      }

      if (typeof window !== 'undefined' && !options?.keepUrl) {
        const targetPath = TAB_TO_ROUTE[tab] || `/${tab}`;
        if (window.location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
          if (options?.replace) {
            window.history.replaceState({ tab }, '', targetPath);
          } else {
            window.history.pushState({ tab }, '', targetPath);
          }
        }
      }
    },
    []
  );

  const handleNavigateWithFilter = useCallback(
    (tab: TabType, filter?: string) => {
      navigateToTab(tab, { filter });
    },
    [navigateToTab]
  );

  // Lắng nghe sự kiện trình duyệt Back / Forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const { tab, is404 } = resolveRouteFromUrl();
      setIs404Route(is404);
      setActiveTabState(tab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Đồng bộ URL khi đã xác thực và đang ở route gốc '/' hoặc '/login'
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated) {
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    } else {
      const currentRaw = window.location.pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
      if (!currentRaw || currentRaw === 'login') {
        const targetPath = TAB_TO_ROUTE[activeTab] || '/dashboard';
        window.history.replaceState({ tab: activeTab }, '', targetPath);
      }
    }
  }, [isAuthenticated, activeTab]);

  // Handlers
  const handleOpenRecordUsage = (chemicalId?: string, bottleId?: string) => {
    setSelectedChemForUsage(chemicalId);
    setSelectedBottleForUsage(bottleId);
    setRecordUsageOpen(true);
  };

  const handleOpenStockIn = (chemicalId?: string) => {
    setSelectedChemForStockIn(chemicalId);
    setStockInOpen(true);
  };

  const handleOpenDeleteChemical = (chem: Chemical) => {
    setChemicalToDelete(chem);
    setDeleteChemicalOpen(true);
  };

  const handleOpenArchiveCenter = () => {
    setArchiveCenterOpen(true);
  };

  const handleOpenBottleDetail = (bottleOrId: Bottle | string) => {
    if (typeof bottleOrId === 'string') {
      const found = bottles.find((b) => b.id === bottleOrId);
      if (found) {
        setSelectedBottleForDetail(found);
        setBottleDetailOpen(true);
      }
    } else {
      setSelectedBottleForDetail(bottleOrId);
      setBottleDetailOpen(true);
    }
  };

  const handleOpenDiscrepancy = (chemicalId?: string, bottleId?: string) => {
    setDiscrepancyChemId(chemicalId);
    setDiscrepancyBottleId(bottleId);
    setDiscrepancyModalOpen(true);
  };

  const handleSelectChemicalFromSearch = (chemicalId: string, query?: string) => {
    setTargetChemicalId(chemicalId);
    if (query) setInventorySearchTerm(query);
    navigateToTab('inventory');
  };

  const handleSearchSubmit = (query: string) => {
    setInventorySearchTerm(query);
    setTargetChemicalId(undefined);
    navigateToTab('inventory');
  };

  // 1. Màn hình chờ khi đang kiểm tra / khôi phục phiên làm việc
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-xl flex items-center justify-center shadow-md animate-pulse tracking-wider">
            LC
          </div>
          <div className="text-xs font-semibold text-slate-500">Đang khôi phục phiên đăng nhập...</div>
        </div>
      </div>
    );
  }

  // 2. Khi CHƯA XÁC THỰC: Chỉ hiển thị trang Login mới làm trang mặc định
  // Tuyệt đối không cho phép truy cập Dashboard hoặc bất kỳ dữ liệu nào
  if (!isAuthenticated) {
    return (
      <Login
        onSuccess={(user, rememberMe) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          setAuthErrorMessage(null);
          if (rememberMe) {
            localStorage.setItem('labchem_remember_me', 'true');
            localStorage.setItem('labchem_v4_is_authenticated', 'true');
            localStorage.setItem('labchem_v4_current_user_id', user.id);
            sessionStorage.removeItem('labchem_v4_is_authenticated');
            sessionStorage.removeItem('labchem_v4_current_user_id');
          } else {
            localStorage.setItem('labchem_remember_me', 'false');
            localStorage.removeItem('labchem_v4_is_authenticated');
            localStorage.removeItem('labchem_v4_current_user_id');
            sessionStorage.setItem('labchem_v4_is_authenticated', 'true');
            sessionStorage.setItem('labchem_v4_current_user_id', user.id);
          }
          navigateToTab(activeTab || 'dashboard', { replace: true });
        }}
        initialErrorMessage={authErrorMessage}
      />
    );
  }

  // 3. Nếu tài khoản có cờ bắt buộc đổi mật khẩu lần đầu (must_change_password = true)
  // Ngay lập tức chuyển tới màn hình Đổi mật khẩu, không cho truy cập Dashboard và các chức năng dữ liệu
  if (currentUser?.must_change_password) {
    return (
      <MustChangePasswordView
        onPasswordChanged={async () => {
          if (currentUser) {
            setCurrentUser({
              ...currentUser,
              must_change_password: false,
            });
          }
          await refreshFromSupabase();
        }}
      />
    );
  }

  // 4. Khi ĐÃ XÁC THỰC: Hiển thị giao diện hệ thống LabChem
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onOpenRecordUsage={() => handleOpenRecordUsage()}
        onOpenStockIn={() => handleOpenStockIn()}
        onOpenAddChemical={() => setAddChemicalOpen(true)}
        onSignOut={handleSignOut}
        onOpenUserProfile={() => setUserProfileOpen(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenEmailAlerts={() => setEmailAlertsOpen(true)}
        onOpenDiscrepancyModal={() => handleOpenDiscrepancy()}
        onOpenUserGuide={() => setUserGuideOpen(true)}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onOpenSupabaseConfig={() => setSupabaseConfigOpen(true)}
        onSelectChemicalFromSearch={handleSelectChemicalFromSearch}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8 overflow-x-hidden">
        {/* Fallback 404 Route */}
        {is404Route ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">404 - Không tìm thấy trang</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Đường dẫn <strong className="font-mono text-slate-800">{typeof window !== 'undefined' ? window.location.pathname : ''}</strong> không tồn tại trong hệ thống LabChems.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigateToTab('dashboard')}
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Quay về Trang chủ (Dashboard)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Role-based Dashboard */}
            {activeTab === 'dashboard' && (
              isManager ? (
                <DashboardView
                  onNavigateToTab={navigateToTab}
                  onNavigateWithFilter={handleNavigateWithFilter}
                  onOpenRecordUsage={handleOpenRecordUsage}
                  onOpenStockIn={handleOpenStockIn}
                  onOpenBottleDetail={handleOpenBottleDetail}
                  onOpenEmailAlerts={() => setEmailAlertsOpen(true)}
                  onOpenDiscrepancyModal={() => handleOpenDiscrepancy()}
                  onOpenUserGuide={() => setUserGuideOpen(true)}
                  onOpenQrScanner={() => setQrScannerOpen(true)}
                />
              ) : (
                <UserDashboardView
                  onNavigateToTab={navigateToTab}
                  onNavigateWithFilter={handleNavigateWithFilter}
                  onOpenRecordUsage={handleOpenRecordUsage}
                  onOpenQrScanner={() => setQrScannerOpen(true)}
                  onOpenBottleDetail={handleOpenBottleDetail}
                  onOpenUserGuide={() => setUserGuideOpen(true)}
                  onSelectChemicalFromSearch={handleSelectChemicalFromSearch}
                />
              )
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                onOpenRecordUsage={handleOpenRecordUsage}
                onOpenStockIn={handleOpenStockIn}
                onOpenAddChemical={() => setAddChemicalOpen(true)}
                onOpenExcelImport={() => setExcelImportOpen(true)}
                onOpenBottleDetail={handleOpenBottleDetail}
                onOpenDiscrepancyModal={handleOpenDiscrepancy}
                onOpenQrScanner={() => setQrScannerOpen(true)}
                onOpenArchiveCenter={handleOpenArchiveCenter}
                onOpenDeleteChemical={handleOpenDeleteChemical}
                externalSearchTerm={inventorySearchTerm}
                targetChemicalId={targetChemicalId}
                initialFilterStatus={inventoryInitialFilter}
              />
            )}

            {activeTab === 'usage' && (
              <UsageView
                onOpenRecordUsage={() => handleOpenRecordUsage()}
                onOpenQrScanner={() => setQrScannerOpen(true)}
              />
            )}

            {activeTab === 'purchase' && (
              isManager ? (
                <PurchaseView onOpenStockIn={handleOpenStockIn} />
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Kế hoạch mua sắm hóa chất yêu cầu vai trò Người Quản Lý (MANAGER). Bạn đang đăng nhập với vai trò <strong>{currentUser?.role || 'THÀNH VIÊN'}</strong>.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateToTab('dashboard')}
                      className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      Quay về Trang chủ (Dashboard)
                    </button>
                  </div>
                </div>
              )
            )}

            {activeTab === 'expiry' && (
              isManager ? (
                <ExpiryView
                  onOpenBottleDetail={handleOpenBottleDetail}
                  onOpenRecordUsage={handleOpenRecordUsage}
                  initialFilterGroup={expiryInitialFilter}
                />
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Trang theo dõi hạn dùng chuyên sâu yêu cầu vai trò Người Quản Lý (MANAGER).
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateToTab('dashboard')}
                      className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      Quay về Trang chủ (Dashboard)
                    </button>
                  </div>
                </div>
              )
            )}

            {activeTab === 'users' && (
              isManager ? (
                <UserManagementView />
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Trang Quản lý người dùng chỉ dành riêng cho Người Quản Lý (MANAGER).
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateToTab('dashboard')}
                      className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      Quay về Trang chủ (Dashboard)
                    </button>
                  </div>
                </div>
              )
            )}

            {activeTab === 'settings' && (
              isManager ? (
                <SettingsView
                  onOpenArchiveCenter={handleOpenArchiveCenter}
                  onOpenSupabaseConfig={() => setSupabaseConfigOpen(true)}
                />
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4 animate-in fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Trang Cài đặt hệ thống chỉ dành riêng cho Người Quản Lý (MANAGER).
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateToTab('dashboard')}
                      className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      Quay về Trang chủ (Dashboard)
                    </button>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Shared Modals */}
      <RecordUsageModal
        isOpen={recordUsageOpen}
        onClose={() => setRecordUsageOpen(false)}
        preselectedChemicalId={selectedChemForUsage}
        preselectedBottleId={selectedBottleForUsage}
      />

      <QrScannerModal
        isOpen={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onBottleIdentified={handleOpenBottleDetail}
        onOpenRecordUsage={(chemicalId, bottleId) => handleOpenRecordUsage(chemicalId, bottleId)}
        onOpenStockIn={(chemicalId) => handleOpenStockIn(chemicalId)}
        onOpenAddChemical={() => setAddChemicalOpen(true)}
      />

      <ArchiveCenterModal
        isOpen={archiveCenterOpen}
        onClose={() => setArchiveCenterOpen(false)}
        onOpenChemicalDetail={(chem) => handleSelectChemicalFromSearch(chem.id)}
      />

      <DeleteChemicalModal
        chemical={chemicalToDelete}
        isOpen={deleteChemicalOpen}
        onClose={() => {
          setDeleteChemicalOpen(false);
          setChemicalToDelete(null);
        }}
        onDeleted={() => {
          setDeleteChemicalOpen(false);
          setChemicalToDelete(null);
        }}
      />

      <StockInModal
        isOpen={stockInOpen}
        onClose={() => setStockInOpen(false)}
        preselectedChemicalId={selectedChemForStockIn}
      />

      <AddChemicalModal
        isOpen={addChemicalOpen}
        onClose={() => setAddChemicalOpen(false)}
      />

      <BottleDetailModal
        bottle={selectedBottleForDetail}
        isOpen={bottleDetailOpen}
        onClose={() => setBottleDetailOpen(false)}
        onRecordUsage={(bottleId, chemicalId) => handleOpenRecordUsage(chemicalId, bottleId)}
      />

      <UserProfileModal
        isOpen={userProfileOpen}
        onClose={() => setUserProfileOpen(false)}
        onSignOut={handleSignOut}
      />

      <EmailAlertsModal
        isOpen={emailAlertsOpen}
        onClose={() => setEmailAlertsOpen(false)}
      />

      <StockDiscrepancyModal
        isOpen={discrepancyModalOpen}
        onClose={() => setDiscrepancyModalOpen(false)}
        preselectedChemicalId={discrepancyChemId}
        preselectedBottleId={discrepancyBottleId}
      />

      <ExcelImportModal
        isOpen={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        onSuccess={() => navigateToTab('inventory')}
      />

      <UserGuideModal
        isOpen={userGuideOpen}
        onClose={() => setUserGuideOpen(false)}
      />

      <SupabaseConfigModal
        isOpen={supabaseConfigOpen}
        onClose={() => setSupabaseConfigOpen(false)}
        onConfigChanged={() => {
          refreshFromSupabase();
        }}
      />

      {/* Mobile Slide-over Drawer */}
      <MobileMenuDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onOpenRecordUsage={() => handleOpenRecordUsage()}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onOpenUserProfile={() => setUserProfileOpen(true)}
        onSignOut={handleSignOut}
        onOpenUserGuide={() => setUserGuideOpen(true)}
        onOpenArchiveCenter={handleOpenArchiveCenter}
      />

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-500 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">LabChem Inventory</span>
            <span>· Laboratory Chemical Inventory Management System</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => setUserGuideOpen(true)}
              className="text-cyan-700 hover:text-cyan-800 font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>📖 Hướng Dẫn Sử Dụng Website</span>
            </button>
            <span className="text-slate-300">|</span>
            <div className="text-[11px] text-slate-400 font-mono">
              Quản lý theo chai · Trừ tự động FIFO · Tối giản & Dễ dùng cho sinh viên / lab
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LabProvider>
      <MainApp />
    </LabProvider>
  );
}

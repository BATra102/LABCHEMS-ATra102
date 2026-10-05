/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { Bottle, Chemical, User } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { rowToUser } from './services/authService';
import { auditService } from './services/auditService';
import { isSeniorManagerEmail } from './utils/roleUtils';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

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
      const isRemembered = localStorage.getItem('labchem_remember_me') !== 'false';

      if (!isSupabaseConfigured()) {
        // Chế độ không dùng Supabase / Offline: kiểm tra cờ xác thực lưu trữ
        const savedAuth = isRemembered
          ? (localStorage.getItem('labchem_v4_is_authenticated') || sessionStorage.getItem('labchem_v4_is_authenticated'))
          : sessionStorage.getItem('labchem_v4_is_authenticated');
        const savedUserId = isRemembered
          ? (localStorage.getItem('labchem_v4_current_user_id') || sessionStorage.getItem('labchem_v4_current_user_id'))
          : sessionStorage.getItem('labchem_v4_current_user_id');

        if (savedAuth === 'true' && savedUserId) {
          const found = users.find((u) => u.id === savedUserId);
          if (!found) {
            if (isMounted) {
              setAuthErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
              setIsAuthenticated(false);
              setIsCheckingAuth(false);
            }
            return;
          }
          if (found.status === 'LOCKED' || found.status === 'DEACTIVATED' || found.status === 'SUSPENDED') {
            if (isMounted) {
              setAuthErrorMessage('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Người quản lý.');
              setIsAuthenticated(false);
              setIsCheckingAuth(false);
            }
            return;
          }
          if (found.status === 'DELETED') {
            if (isMounted) {
              setAuthErrorMessage('Tài khoản không còn được phép truy cập hệ thống.');
              setIsAuthenticated(false);
              setIsCheckingAuth(false);
            }
            return;
          }
          if (found.status === 'ACTIVE') {
            if (isMounted) {
              setCurrentUser(found);
              setIsAuthenticated(true);
              setIsCheckingAuth(false);
              return;
            }
          }
        }
        if (isMounted) {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        // 1. Kiểm tra session từ Supabase Auth
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session?.user) {
          if (isMounted) {
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
          }
          return;
        }

        const userEmail = session.user.email?.toLowerCase().trim() || '';
        const isSenior = isSeniorManagerEmail(userEmail);

        // 2. Kiểm tra quyền truy cập và trạng thái ACTIVE trong bảng profiles
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profile) {
          const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('*')
            .ilike('google_email', userEmail)
            .maybeSingle();
          if (profileByEmail) {
            profile = profileByEmail;
          }
        }

        // Nếu không có profile
        if (!profile) {
          if (isSenior) {
            const seniorUser: User = {
              id: session.user.id,
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

          // Không tìm thấy profile và không phải quản lý cao cấp -> signOut ngay lập tức
          await auditService.logAccessDenied(
            userEmail,
            'Phiên đăng nhập bị hủy: Không tìm thấy hồ sơ người dùng trong bảng profiles',
            { userId: session.user.id }
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
            { userId: session.user.id, status: profile.status, role: profile.role }
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
    setActiveTab('dashboard');
    setAuthErrorMessage(null);
  };

  const handleNavigateWithFilter = (tab: TabType, filter?: string) => {
    if (tab === 'inventory') {
      setInventoryInitialFilter(filter);
    } else if (tab === 'expiry') {
      setExpiryInitialFilter(filter);
    }
    setActiveTab(tab);
  };

  // Guard against non-managers accessing restricted tabs
  useEffect(() => {
    if (!isManager && (activeTab === 'users' || activeTab === 'settings' || activeTab === 'purchase' || activeTab === 'expiry')) {
      if (currentUser?.email) {
        auditService.logAccessDenied(
          currentUser.email,
          `Từ chối truy cập tab quản trị "${activeTab}" do không có vai trò MANAGER`,
          { attemptedTab: activeTab, currentRole: currentUser.role },
          currentUser
        );
      }
      setActiveTab('dashboard');
    }
  }, [isManager, activeTab, currentUser]);

  // Bảo vệ toàn bộ URL routes (/dashboard, /chemicals, /bottles, /history, /purchase, /expiry, /users, /settings, /audit, /import-export)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isAuthenticated) {
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    } else {
      const currentPath = window.location.pathname.toLowerCase().replace(/^\//, '');
      const routeToTabMap: Record<string, TabType> = {
        dashboard: 'dashboard',
        chemicals: 'inventory',
        inventory: 'inventory',
        bottles: 'inventory',
        history: 'usage',
        usage: 'usage',
        purchase: 'purchase',
        expiry: 'expiry',
        users: 'users',
        settings: 'settings',
        audit: 'settings',
        'import-export': 'inventory',
      };

      if (currentPath && routeToTabMap[currentPath]) {
        const targetTab = routeToTabMap[currentPath];
        if (targetTab === 'users' || targetTab === 'settings' || targetTab === 'purchase' || targetTab === 'expiry') {
          if (isManager) {
            setActiveTab(targetTab);
          } else {
            setActiveTab('dashboard');
            window.history.replaceState(null, '', '/dashboard');
          }
        } else {
          setActiveTab(targetTab);
        }
      } else {
        window.history.replaceState(null, '', `/${activeTab}`);
      }
    }
  }, [isAuthenticated, activeTab, isManager]);

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
    setActiveTab('inventory');
  };

  const handleSearchSubmit = (query: string) => {
    setInventorySearchTerm(query);
    setTargetChemicalId(undefined);
    setActiveTab('inventory');
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
          setActiveTab('dashboard');
        }}
        initialErrorMessage={authErrorMessage}
      />
    );
  }

  // 3. Khi ĐÃ XÁC THỰC: Hiển thị giao diện hệ thống LabChem
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
        {/* Role-based Dashboard */}
        {activeTab === 'dashboard' && (
          isManager ? (
            <DashboardView
              onNavigateToTab={setActiveTab}
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
              onNavigateToTab={setActiveTab}
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

        {activeTab === 'purchase' && isManager && (
          <PurchaseView onOpenStockIn={handleOpenStockIn} />
        )}

        {activeTab === 'expiry' && isManager && (
          <ExpiryView
            onOpenBottleDetail={handleOpenBottleDetail}
            onOpenRecordUsage={handleOpenRecordUsage}
            initialFilterGroup={expiryInitialFilter}
          />
        )}

        {activeTab === 'users' && isManager && <UserManagementView />}

        {activeTab === 'settings' && isManager && (
          <SettingsView
            onOpenArchiveCenter={handleOpenArchiveCenter}
            onOpenSupabaseConfig={() => setSupabaseConfigOpen(true)}
          />
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
        onSuccess={() => setActiveTab('inventory')}
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
        setActiveTab={setActiveTab}
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
        setActiveTab={setActiveTab}
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

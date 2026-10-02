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
import { LoginModal } from './components/modals/LoginModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { EmailAlertsModal } from './components/modals/EmailAlertsModal';
import { StockDiscrepancyModal } from './components/modals/StockDiscrepancyModal';
import { ExcelImportModal } from './components/modals/ExcelImportModal';
import { UserGuideModal } from './components/modals/UserGuideModal';
import { QrScannerModal } from './components/modals/QrScannerModal';
import { ArchiveCenterModal } from './components/modals/ArchiveCenterModal';
import { DeleteChemicalModal } from './components/modals/DeleteChemicalModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileMenuDrawer } from './components/modals/MobileMenuDrawer';
import { Bottle, Chemical } from './types';

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
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

  // QR Gateway & Archive Center states (Mục 1 & Mục 2)
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

  const { bottles, isManager, currentUser } = useLab();

  // Guard against non-managers accessing restricted tabs (Mục 1 & Mục 3)
  useEffect(() => {
    if (!isManager && (activeTab === 'users' || activeTab === 'settings' || activeTab === 'purchase' || activeTab === 'expiry')) {
      setActiveTab('dashboard');
    }
  }, [isManager, activeTab]);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRecordUsage={() => handleOpenRecordUsage()}
        onOpenStockIn={() => handleOpenStockIn()}
        onOpenAddChemical={() => setAddChemicalOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenUserProfile={() => setUserProfileOpen(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenEmailAlerts={() => setEmailAlertsOpen(true)}
        onOpenDiscrepancyModal={() => handleOpenDiscrepancy()}
        onOpenUserGuide={() => setUserGuideOpen(true)}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onSelectChemicalFromSearch={handleSelectChemicalFromSearch}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Main Container with Mobile Bottom Nav Padding (pb-24 md:pb-8) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8 overflow-x-hidden">
        {/* Role-based Dashboard (Mục 1 & Mục 2: Manager Dashboard vs User Dashboard) */}
        {activeTab === 'dashboard' && (
          isManager ? (
            <DashboardView
              onNavigateToTab={setActiveTab}
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
          />
        )}

        {activeTab === 'users' && isManager && <UserManagementView />}

        {activeTab === 'settings' && isManager && (
          <SettingsView onOpenArchiveCenter={handleOpenArchiveCenter} />
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

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <UserProfileModal
        isOpen={userProfileOpen}
        onClose={() => setUserProfileOpen(false)}
        onOpenLogin={() => setLoginModalOpen(true)}
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

      {/* Mobile Slide-over Drawer (Hamburger menu) */}
      <MobileMenuDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRecordUsage={() => handleOpenRecordUsage()}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onOpenUserProfile={() => setUserProfileOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenUserGuide={() => setUserGuideOpen(true)}
        onOpenArchiveCenter={handleOpenArchiveCenter}
      />

      {/* Mobile Fixed Bottom Navigation Bar (Section 2: 🏠 Kho 📷 QR 🕘 Lịch sử) */}
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

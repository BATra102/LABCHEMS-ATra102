import React from 'react';
import { TabType } from '../Header';
import { useLab } from '../../context/LabContext';
import {
  X,
  Home,
  FlaskConical,
  Plus,
  Clock,
  ShoppingCart,
  Calendar,
  Users,
  Settings,
  Archive,
  BookOpen,
  User as UserIcon,
  LogOut,
  QrCode,
  Shield,
  FileSpreadsheet,
  Barcode,
  FileText,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenRecordUsage: () => void;
  onOpenQrScanner: () => void;
  onOpenUserProfile: () => void;
  onOpenLogin?: () => void;
  onSignOut?: () => void;
  onOpenUserGuide?: () => void;
  onOpenArchiveCenter?: () => void;
  onOpenSupermarketBarcode?: (mode: 'STOCK_IN' | 'STOCK_OUT') => void;
  onOpenPdfReport?: (type?: 'INVENTORY' | 'TRANSACTIONS' | 'ARCHIVE') => void;
}

export const MobileMenuDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onOpenRecordUsage,
  onOpenQrScanner,
  onOpenUserProfile,
  onOpenLogin,
  onSignOut,
  onOpenUserGuide,
  onOpenArchiveCenter,
  onOpenSupermarketBarcode,
  onOpenPdfReport,
}) => {
  const { currentUser, isManager, pendingUsersCount, purchaseItems } = useLab();
  const pendingPurchasesCount = purchaseItems.filter((p) => p.status === 'PENDING').length;

  if (!isOpen) return null;

  const handleNavigate = (tab: TabType) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl z-10 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              LC
            </div>
            <div>
              <div className="font-extrabold text-sm text-slate-900">LabChems</div>
              <div className="text-[10px] font-mono text-cyan-700 font-bold">Anhtra102 · Menu</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center justify-center font-bold text-sm shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-slate-900 truncate">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate">{currentUser.email}</div>
            <div className="text-[9px] font-mono font-bold text-cyan-700 mt-0.5">
              {isManager ? 'Quản lý (Manager)' : 'Thành viên (User)'}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
          {/* Main User Links (Always visible) */}
          <div className="text-[10px] font-semibold text-slate-400 px-2 pt-1 pb-0.5 uppercase tracking-wider">
            Điều hướng chính
          </div>

          <button
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-cyan-50 text-cyan-900 font-bold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Home className="w-4 h-4 text-cyan-600" />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={() => handleNavigate('inventory')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-colors ${
              activeTab === 'inventory'
                ? 'bg-cyan-50 text-cyan-900 font-bold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-cyan-600" />
            <span>Kho hóa chất</span>
          </button>

          {onOpenSupermarketBarcode && (
            <>
              <button
                onClick={() => {
                  onClose();
                  onOpenSupermarketBarcode('STOCK_IN');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                <Barcode className="w-4 h-4 text-emerald-600" />
                <span>⚡ Quét mã nhập kho</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenSupermarketBarcode('STOCK_OUT');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 transition-colors border border-cyan-200"
              >
                <FlaskConical className="w-4 h-4 text-cyan-600" />
                <span>⚡ Quét mã sử dụng hóa chất</span>
              </button>
            </>
          )}

          {onOpenPdfReport && (
            <button
              onClick={() => {
                onClose();
                onOpenPdfReport('INVENTORY');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-slate-800 bg-white hover:bg-slate-50 transition-colors border border-slate-300 shadow-2xs"
            >
              <FileText className="w-4 h-4 text-cyan-700" />
              <span>📄 Xuất báo cáo PDF & In ấn</span>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onOpenQrScanner();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 transition-all shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            <span>📷 Quét QR dùng chai</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenRecordUsage();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>+ Ghi sử dụng thủ công</span>
          </button>

          <button
            onClick={() => handleNavigate('usage')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-colors ${
              activeTab === 'usage'
                ? 'bg-cyan-50 text-cyan-900 font-bold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-4 h-4 text-cyan-600" />
            <span>{isManager ? 'Nhật ký sử dụng' : 'Lịch sử của tôi'}</span>
          </button>

          {/* MANAGER ONLY SECTION (Section 6: User KHÔNG nhìn thấy Quản lý User, Mua sắm, Cài đặt) */}
          {isManager && (
            <>
              <div className="text-[10px] font-semibold text-purple-700 px-2 pt-3 pb-0.5 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Quản lý phòng lab (Manager)</span>
              </div>

              <button
                onClick={() => handleNavigate('purchase')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'purchase'
                    ? 'bg-purple-50 text-purple-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                  <span>Mua Sắm & Nhập</span>
                </div>
                {pendingPurchasesCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-mono rounded-full font-bold">
                    {pendingPurchasesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNavigate('expiry')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'expiry'
                    ? 'bg-purple-50 text-purple-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>Cảnh báo Hạn Dùng</span>
              </button>

              <button
                onClick={() => handleNavigate('users')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-purple-50 text-purple-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Quản Lý User</span>
                </div>
                {pendingUsersCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] font-mono rounded-full font-bold">
                    {pendingUsersCount}
                  </span>
                )}
              </button>

              {onOpenArchiveCenter && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenArchiveCenter();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                >
                  <Archive className="w-4 h-4 text-amber-600" />
                  <span>Kho Lưu Trữ (Xóa Mềm)</span>
                </button>
              )}

              <button
                onClick={() => handleNavigate('settings')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-purple-50 text-purple-900 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Settings className="w-4 h-4 text-purple-600" />
                <span>Cài Đặt Hệ Thống</span>
              </button>
            </>
          )}

          {/* User Guide & Profile Section */}
          <div className="text-[10px] font-semibold text-slate-400 px-2 pt-3 pb-0.5 uppercase tracking-wider">
            Tài khoản & Trợ giúp
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenUserProfile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserIcon className="w-4 h-4 text-cyan-700" />
            <span>Thông tin cá nhân & Hạn mức</span>
          </button>

          {onOpenUserGuide && (
            <button
              onClick={() => {
                onClose();
                onOpenUserGuide();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-cyan-700" />
              <span>Hướng dẫn sử dụng</span>
            </button>
          )}
        </div>

        {/* Footer Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={() => {
              onClose();
              if (onSignOut) {
                onSignOut();
              } else if (onOpenLogin) {
                onOpenLogin();
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
};

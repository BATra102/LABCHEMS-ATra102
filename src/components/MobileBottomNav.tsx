import React from 'react';
import { TabType } from './Header';
import { Home, FlaskConical, QrCode, Barcode, Clock, Plus, Menu } from 'lucide-react';
import { useLab } from '../context/LabContext';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenQrScanner: () => void;
  onOpenMobileMenu?: () => void;
}

export const MobileBottomNav: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  onOpenQrScanner,
  onOpenMobileMenu,
}) => {
  const { isManager } = useLab();

  return (
    <nav
      aria-label="Điều hướng di động"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-5 h-15 items-center px-1 max-w-md mx-auto">
        {/* 1. Trang chủ */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer select-none active:scale-95 ${
            activeTab === 'dashboard'
              ? 'text-cyan-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className={`w-4.5 h-4.5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[9.5px] tracking-tight">Trang chủ</span>
        </button>

        {/* 2. Kho hóa chất */}
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer select-none active:scale-95 ${
            activeTab === 'inventory'
              ? 'text-cyan-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className={`w-4.5 h-4.5 ${activeTab === 'inventory' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[9.5px] tracking-tight">Kho hàng</span>
        </button>

        {/* 3. QUÉT MÃ CHAI (Hero Action Button - To, Nổi Bật Nhất) */}
        <div className="flex flex-col items-center justify-center -mt-4">
          <button
            type="button"
            onClick={onOpenQrScanner}
            className="w-12 h-12 rounded-full bg-linear-to-r from-cyan-600 via-teal-600 to-emerald-600 text-white shadow-md shadow-cyan-600/30 ring-3 ring-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            title="Quét mã vạch / QR trên chai hóa chất bằng Camera"
          >
            <Barcode className="w-5.5 h-5.5" />
          </button>
          <span className="text-[9.5px] font-bold text-cyan-800 tracking-tight mt-0.5">Quét mã chai</span>
        </div>

        {/* 4. Lịch sử dùng */}
        <button
          type="button"
          onClick={() => setActiveTab('usage')}
          className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer select-none active:scale-95 ${
            activeTab === 'usage'
              ? 'text-cyan-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className={`w-4.5 h-4.5 ${activeTab === 'usage' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[9.5px] tracking-tight">Lịch sử</span>
        </button>

        {/* 5. Menu mở rộng */}
        <button
          type="button"
          onClick={() => {
            if (onOpenMobileMenu) {
              onOpenMobileMenu();
            } else {
              setActiveTab('settings');
            }
          }}
          className="flex flex-col items-center justify-center h-full gap-0.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none active:scale-95"
        >
          <Menu className="w-4.5 h-4.5 stroke-2" />
          <span className="text-[9.5px] tracking-tight">Thêm</span>
        </button>
      </div>
    </nav>
  );
};

import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X, Check } from 'lucide-react';

interface Props {
  className?: string;
  variant?: 'button' | 'compact' | 'drawer';
}

export const PWAInstallButton: React.FC<Props> = ({ className = '', variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running as an installed standalone PWA, suppress button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    try {
      setInstalling(true);
      await install();
    } finally {
      setInstalling(false);
    }
  };

  if (isInstallable) {
    if (variant === 'compact') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 ${className}`}
          title="Cài đặt LabChem PWA lên màn hình chính điện thoại hoặc máy tính"
        >
          <Download className="w-3.5 h-3.5 text-cyan-600 animate-bounce" />
          <span>Cài app</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={installing}
        className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-cyan-700 hover:to-blue-700 transition cursor-pointer active:scale-98 ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>Cài đặt LabChem (PWA)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition shadow-2xs cursor-pointer ${className}`}
          title="Hướng dẫn thêm vào màn hình chính iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-600" />
          <span>Cài trên iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Smartphone className="w-4 h-4 text-cyan-600" />
                  <span>Cài đặt trên iPhone / iPad</span>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 space-y-2.5 text-slate-600 leading-relaxed">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    Nhấn vào nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari (biểu tượng mũi tên hướng lên).
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    Nhấn <strong>Thêm (Add)</strong> ở góc trên bên phải để hoàn tất.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { Bottle, Chemical } from '../../types';
import { getBottleQrId, getBottleQrPayload, generateQrDataUrl } from '../../utils/qrCode';
import { X, Printer, QrCode, Download, Check, ShieldAlert, Sparkles } from 'lucide-react';

interface Props {
  bottles: Bottle[];
  isOpen: boolean;
  onClose: () => void;
}

interface BottleWithQr {
  bottle: Bottle;
  chemical: Chemical | undefined;
  qrDataUrl: string;
  qrId: string;
}

export const PrintLabelModal: React.FC<Props> = ({ bottles, isOpen, onClose }) => {
  const { chemicals } = useLab();
  const [items, setItems] = useState<BottleWithQr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || bottles.length === 0) return;

    let isMounted = true;
    setLoading(true);

    const loadQrs = async () => {
      const results: BottleWithQr[] = [];
      for (const b of bottles) {
        const chem = chemicals.find((c) => c.id === b.chemicalId);
        const qrId = b.qrId || getBottleQrId(b.bottleCode);
        const payload = getBottleQrPayload(b);
        const qrUrl = await generateQrDataUrl(payload, 250, 1);
        results.push({
          bottle: b,
          chemical: chem,
          qrDataUrl: qrUrl,
          qrId,
        });
      }
      if (isMounted) {
        setItems(results);
        setLoading(false);
      }
    };

    loadQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bottles, chemicals]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">In Tem Nhãn QR Dán Chai Hóa Chất</h2>
              <p className="text-xs text-slate-300">
                Chuẩn kích thước nhãn phòng lab · Mã QR độc nhất cho từng chai ({items.length} nhãn)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="px-4 py-2 bg-linear-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay (Print)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Instruction Banner */}
        <div className="p-3 bg-cyan-50 border-b border-cyan-200 text-xs text-cyan-950 flex items-center justify-between px-6 shrink-0 print:hidden">
          <span>
            💡 <strong>Mẹo in:</strong> Nhấn <strong>In Ngay</strong> &rarr; Trong hộp thoại in trình duyệt, chọn khổ giấy (A4 hoặc Label Sticker) và bật tùy chọn <em>"Background graphics" (Đồ họa nền)</em>.
          </span>
          <span className="font-mono text-[11px] text-cyan-800 font-semibold">{items.length} nhãn</span>
        </div>

        {/* Labels Display Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 print:p-0 print:bg-white">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-500">
              Đang tạo mã QR phân giải cao cho từng chai...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              {items.map(({ bottle, chemical, qrDataUrl, qrId }) => (
                <div
                  key={bottle.id}
                  className="bg-white rounded-xl border-2 border-slate-300 p-4 shadow-sm flex flex-col justify-between print:border-black print:rounded-none print:shadow-none break-inside-avoid"
                  style={{ minHeight: '220px' }}
                >
                  {/* Top Label Brand & Name */}
                  <div className="border-b border-slate-200 pb-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                      <span>LabChem Inventory</span>
                      {chemical?.safetyInfo?.ghsPictograms && (
                        <span className="text-rose-600 font-bold">
                          {chemical.safetyInfo.ghsPictograms.slice(0, 2).join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className="font-black text-sm text-slate-900 leading-tight">
                      {chemical?.name || 'Hóa Chất'}
                    </div>
                    {chemical?.englishName && (
                      <div className="text-[11px] text-slate-500 italic truncate">
                        {chemical.englishName}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                      CAS: <strong>{chemical?.casNumber || 'N/A'}</strong> · Grade: <strong>{chemical?.grade || 'AR'}</strong>
                    </div>
                  </div>

                  {/* Body with specs and QR */}
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <div className="space-y-1.5 text-xs text-slate-700 flex-1 min-w-0 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Mã chai:</span>
                        <strong className="text-sm text-cyan-950 font-black">{bottle.bottleCode}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Số Lô (Lot):</span>
                        <span className="font-semibold text-slate-800">{bottle.lotNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Quy cách ban đầu:</span>
                        <span className="font-bold text-slate-900">{bottle.initialVolume} {bottle.unit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Hạn sử dụng:</span>
                        <span className="font-bold text-rose-700">{bottle.expiryDate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Vị trí tủ:</span>
                        <span className="text-[11px] font-semibold text-slate-800">
                          {bottle.location.cabinet} · {bottle.location.shelf}
                        </span>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="text-center shrink-0 flex flex-col items-center">
                      <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                        <img
                          src={qrDataUrl}
                          alt={qrId}
                          className="w-24 h-24 object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-800 mt-1 block">
                        {qrId}
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono uppercase">
                        Quét tra cứu tồn
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <span className="text-xs text-slate-500">
            Tổng cộng: <strong>{items.length}</strong> chai hóa chất đã sẵn sàng in tem nhãn.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
            >
              In Tem Nhãn
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

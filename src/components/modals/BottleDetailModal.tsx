import React, { useState, useEffect } from 'react';
import { useLab } from '../../context/LabContext';
import { Bottle, Chemical, StorageLocation } from '../../types';
import { getBottleStatusLabel, getDaysRemaining } from '../../utils/status';
import { getBottleQrId, getBottleQrPayload, generateQrDataUrl } from '../../utils/qrCode';
import {
  X,
  Calendar,
  MapPin,
  Tag,
  FlaskConical,
  History,
  AlertCircle,
  QrCode,
  Printer,
  Download,
  ExternalLink,
  RefreshCw,
  Edit2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  bottle: Bottle | null;
  isOpen: boolean;
  onClose: () => void;
  onRecordUsage?: (bottleId: string, chemicalId: string, useFullBottle?: boolean) => void;
  onOpenChemicalDetail?: (chemical: Chemical) => void;
  onOpenPrintLabel?: (bottle: Bottle) => void;
  onOpenDiscrepancyModal?: (chemId?: string, bottleId?: string) => void;
}

export const BottleDetailModal: React.FC<Props> = ({
  bottle,
  isOpen,
  onClose,
  onRecordUsage,
  onOpenChemicalDetail,
  onOpenPrintLabel,
  onOpenDiscrepancyModal,
}) => {
  const {
    chemicals,
    transactions,
    referenceDate,
    isManager,
    storageCabinets,
    updateBottle,
    createApprovalRequest,
    currentUser,
  } = useLab();

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [selectedCabinet, setSelectedCabinet] = useState('');
  const [selectedShelf, setSelectedShelf] = useState('');
  const [locSuccessMsg, setLocSuccessMsg] = useState<string | null>(null);

  // Regenerate QR state (Section 29)
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false);
  const [regenReason, setRegenReason] = useState('Tem nhãn bị mờ / mã QR bị hỏng');
  const [regenSuccessMsg, setRegenSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !bottle) return;
    let isMounted = true;
    const payload = getBottleQrPayload(bottle);
    generateQrDataUrl(payload, 250, 1).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    setSelectedCabinet(bottle.location.cabinet);
    setSelectedShelf(bottle.location.shelf);
    setIsChangingLocation(false);
    setIsRegeneratingQr(false);
    setLocSuccessMsg(null);
    setRegenSuccessMsg(null);

    return () => {
      isMounted = false;
    };
  }, [isOpen, bottle]);

  if (!isOpen || !bottle) return null;

  const chem = chemicals.find((c) => c.id === bottle.chemicalId);
  const statusInfo = getBottleStatusLabel(bottle.status);
  const daysRemaining = getDaysRemaining(bottle.expiryDate, referenceDate);
  const qrId = bottle.qrId || getBottleQrId(bottle.bottleCode);

  // Filter transactions for this specific bottle
  const bottleTxs = transactions.filter(
    (t) => t.bottleId === bottle.id || t.bottleCode === bottle.bottleCode
  );

  const fillPercent =
    bottle.initialVolume > 0
      ? Math.min(100, Math.round((bottle.currentVolume / bottle.initialVolume) * 100))
      : 0;

  const isDisposed = bottle.status === 'DISPOSED';
  const isEmpty = bottle.status === 'EMPTY' || bottle.currentVolume <= 0;

  // Handle Download QR
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${qrId}_${bottle.bottleCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle Location Change (Section 24)
  const handleSaveLocation = () => {
    const cabObj = storageCabinets.find((c) => c.name === selectedCabinet);
    const newLoc: StorageLocation = {
      building: cabObj?.building || bottle.location.building,
      room: cabObj?.room || bottle.location.room,
      cabinet: selectedCabinet,
      shelf: selectedShelf || 'Shelf 1',
    };

    if (isManager) {
      const res = updateBottle(bottle.id, { location: newLoc });
      if (res.success) {
        setLocSuccessMsg(res.message);
        setTimeout(() => {
          setIsChangingLocation(false);
          setLocSuccessMsg(null);
        }, 1500);
      }
    } else {
      // Member creates approval request (Section 24)
      createApprovalRequest({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        type: 'STOCK_ADJUSTMENT',
        bottleId: bottle.id,
        bottleCode: bottle.bottleCode,
        chemicalId: bottle.chemicalId,
        chemicalName: chem?.name || 'Hóa chất',
        requestedQuantity: 0,
        unit: bottle.unit,
        reason: `Yêu cầu đổi từ [${bottle.location.cabinet} · ${bottle.location.shelf}] sang [${selectedCabinet} · ${selectedShelf}].`,
      });
      setLocSuccessMsg('Đã gửi yêu cầu đổi vị trí đến Quản lý phòng lab phê duyệt.');
      setTimeout(() => {
        setIsChangingLocation(false);
        setLocSuccessMsg(null);
      }, 2000);
    }
  };

  // Handle Regenerate QR (Section 29)
  const handleConfirmRegenerateQr = () => {
    const newQrId = getBottleQrId(bottle.bottleCode);
    const res = updateBottle(bottle.id, { qrId: newQrId });
    if (res.success) {
      setRegenSuccessMsg('Đã cập nhật lại mã QR cho chai.');
      // Re-generate QR
      const payload = `LABCHEM:BOTTLE:${bottle.bottleCode}`;
      generateQrDataUrl(payload, 250, 1).then(setQrDataUrl);
      setTimeout(() => {
        setIsRegeneratingQr(false);
        setRegenSuccessMsg(null);
      }, 2000);
    }
  };

  const selectedCabObj = storageCabinets.find((c) => c.name === selectedCabinet);
  const availableShelves = selectedCabObj?.shelves || ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in duration-200 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-600/10 border border-cyan-300 rounded-xl text-cyan-800">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-slate-900">{bottle.bottleCode}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${statusInfo.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                  {statusInfo.text}
                </span>
                {qrId && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                    {qrId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                <span className="font-bold text-slate-900">{chem?.name || 'Hóa chất'}</span>
                {chem && onOpenChemicalDetail && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenChemicalDetail(chem);
                    }}
                    className="text-cyan-700 hover:text-cyan-800 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer text-[11px]"
                  >
                    <span>(Xem hồ sơ hóa chất)</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hazard Safety Alert (Section 14) */}
        {chem?.safetyInfo?.ghsPictograms && chem.safetyInfo.ghsPictograms.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">⚠ HÓA CHẤT NGUY HIỂM:</span>
              <span className="font-medium text-amber-800 truncate">
                {chem.safetyInfo.ghsPictograms.join(', ')}. Vui lòng đảm bảo tuân thủ đúng quy trình an toàn của phòng lab.
              </span>
            </div>
          </div>
        )}

        {/* Disposed or Empty Notice (Section 21, 22) */}
        {isDisposed ? (
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-900 flex items-center gap-2 shrink-0 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Chai này đã được thanh lý (DISPOSED). Không thể ghi sử dụng hoặc thay đổi tồn kho.</span>
          </div>
        ) : isEmpty ? (
          <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex items-center gap-2 shrink-0 font-medium">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Chai này đã hết dung tích (EMPTY - 0 {bottle.unit}). Không thể phát sinh giao dịch tiêu hao.</span>
          </div>
        ) : null}

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Fill Gauge & QR Card Hero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Left 2 Cols: Fill Gauge & Specs */}
            <div className="sm:col-span-2 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold uppercase">Mức tồn chứa trong chai</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {bottle.currentVolume} / {bottle.initialVolume} {bottle.unit} ({fillPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 ${
                      fillPercent <= 20
                        ? 'bg-rose-500'
                        : fillPercent <= 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>Ban đầu: {bottle.initialVolume} {bottle.unit}</span>
                  <span>Đã dùng: {Math.round((bottle.initialVolume - bottle.currentVolume) * 100) / 100} {bottle.unit}</span>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Số Lô (Lot number)</span>
                  <span className="font-mono font-bold text-slate-900 block">{bottle.lotNumber}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Hạn sử dụng</span>
                  <span className={`font-mono font-bold block ${daysRemaining <= 0 ? 'text-rose-600' : daysRemaining <= 90 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {bottle.expiryDate} {daysRemaining <= 0 ? '(Hết hạn)' : `(Còn ${daysRemaining} ngày)`}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ngày nhận / Mở nắp</span>
                  <span className="text-slate-800 font-medium block">
                    {bottle.receivedDate} {bottle.openedDate ? `· Mở: ${bottle.openedDate}` : '· Chưa mở nắp'}
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Vị trí cất giữ</span>
                    <button
                      type="button"
                      onClick={() => setIsChangingLocation(!isChangingLocation)}
                      className="text-[10px] text-cyan-700 hover:underline font-bold"
                    >
                      {isChangingLocation ? 'Đóng' : 'Đổi vị trí'}
                    </button>
                  </div>
                  <span className="text-slate-900 font-bold block truncate" title={`${bottle.location.cabinet} · ${bottle.location.shelf}`}>
                    {bottle.location.cabinet} · {bottle.location.shelf}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {bottle.location.room} · {bottle.location.building}
                  </span>
                </div>
              </div>

              {/* Inline Change Location Form (Section 24) */}
              {isChangingLocation && (
                <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-950">
                      {isManager ? 'Thay Đổi Vị Trí Chai Trực Tiếp' : 'Yêu Cầu Thay Đổi Vị Trí Chai'}
                    </span>
                    <span className="text-[10px] text-cyan-800 font-mono">
                      {isManager ? 'Quản lý duyệt ngay' : 'Cần Quản lý duyệt'}
                    </span>
                  </div>

                  {locSuccessMsg && (
                    <div className="p-2 bg-emerald-100 text-emerald-900 text-xs rounded-lg font-medium">
                      {locSuccessMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tủ lưu trữ</label>
                      <select
                        value={selectedCabinet}
                        onChange={(e) => {
                          setSelectedCabinet(e.target.value);
                          const cab = storageCabinets.find((c) => c.name === e.target.value);
                          if (cab && cab.shelves.length > 0) setSelectedShelf(cab.shelves[0]);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                      >
                        {storageCabinets.map((c) => (
                          <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tầng / Kệ</label>
                      <select
                        value={selectedShelf}
                        onChange={(e) => setSelectedShelf(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-mono"
                      >
                        {availableShelves.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsChangingLocation(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLocation}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg cursor-pointer"
                    >
                      {isManager ? 'Lưu vị trí mới' : 'Gửi yêu cầu đổi'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Live QR Card (Section 5, 6, 12, 16) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-between text-center space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Mã QR Chai Độc Nhất
                </span>
                <span className="text-xs font-mono font-black text-cyan-900 block mt-0.5">
                  {qrId}
                </span>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={qrId} className="w-28 h-28 object-contain" />
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center text-slate-400 text-xs">
                    Đang tạo QR...
                  </div>
                )}
              </div>

              <div className="space-y-1.5 w-full">
                {onOpenPrintLabel && (
                  <button
                    type="button"
                    onClick={() => onOpenPrintLabel(bottle)}
                    className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>In nhãn chai</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tải ảnh QR</span>
                </button>

                {/* Manager Regenerate QR (Section 29) */}
                {isManager && (
                  <button
                    type="button"
                    onClick={() => setIsRegeneratingQr(!isRegeneratingQr)}
                    className="w-full py-1 text-[11px] text-cyan-800 hover:underline font-semibold cursor-pointer"
                  >
                    {isRegeneratingQr ? 'Hủy cấp lại' : 'Cấp lại mã QR (Revoke)'}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Regenerate QR Dialog (Section 29) */}
          {isRegeneratingQr && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-amber-950 uppercase">
                  Cấp Lại Mã QR Mới & Thu Hồi Mã Cũ (Revoke QR)
                </span>
              </div>
              <p className="text-xs text-amber-800">
                Mã QR hiện tại (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{qrId}</code>) sẽ bị thu hồi và ghi vào nhật ký lịch sử. Hệ thống sẽ sinh mã QR mới cho chai này.
              </p>

              {regenSuccessMsg && (
                <div className="p-2 bg-emerald-100 text-emerald-900 text-xs rounded-lg font-medium">
                  {regenSuccessMsg}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Lý do cấp lại mã:
                </label>
                <input
                  type="text"
                  value={regenReason}
                  onChange={(e) => setRegenReason(e.target.value)}
                  placeholder="vd: Nhãn bị mờ do dính cồn, dán nhãn mới..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegeneratingQr(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRegenerateQr}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer"
                >
                  Xác nhận cấp mã mới
                </button>
              </div>
            </div>
          )}

          {/* Usage History for this Bottle (Section 10) */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <History className="w-4 h-4 text-slate-500" />
                <span>Nhật ký sử dụng của riêng chai {bottle.bottleCode}</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Đã dùng:{' '}
                <strong className="text-slate-800">
                  {Math.round((bottle.initialVolume - bottle.currentVolume) * 100) / 100} {bottle.unit}
                </strong>
              </span>
            </div>

            {bottleTxs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                Chai mới nguyên, chưa phát sinh lượt chiết dùng nào.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {bottleTxs.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{t.user}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-500">{t.date}</span>
                        {t.project && (
                          <>
                            <span className="text-slate-400">·</span>
                            <span className="text-cyan-800 font-mono truncate max-w-[140px]">{t.project}</span>
                          </>
                        )}
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{t.purpose || t.notes || 'Sử dụng thí nghiệm'}</p>
                    </div>
                    <div className="text-right font-mono shrink-0 ml-3">
                      <span className="font-bold text-rose-600 block">
                        -{t.quantity} {t.unit}
                      </span>
                      <span className="text-[10px] text-slate-400">còn {t.newStock} {t.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            {onOpenDiscrepancyModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDiscrepancyModal(bottle.chemicalId, bottle.id);
                }}
                className="text-xs text-amber-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Báo chai có vấn đề / Lệch tồn</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            {!isDisposed && !isEmpty && onRecordUsage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRecordUsage(bottle.id, bottle.chemicalId, true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  title="Dùng hết chai này (Cách 1: Không cần nhập số mL)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                  <span>⚡ Dùng hết chai</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRecordUsage(bottle.id, bottle.chemicalId, false);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>+ Ghi dùng mL</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

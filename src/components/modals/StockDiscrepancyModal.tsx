import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { ChemicalUnit } from '../../types';
import { X, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedChemicalId?: string;
  preselectedBottleId?: string;
}

export const StockDiscrepancyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  preselectedChemicalId,
  preselectedBottleId,
}) => {
  const { chemicals, bottles, getChemicalTotalStock, reportDiscrepancy } = useLab();

  const [chemicalId, setChemicalId] = useState<string>(preselectedChemicalId || (chemicals[0]?.id || ''));
  const [bottleId, setBottleId] = useState<string>(preselectedBottleId || '');
  const [physicalQuantity, setPhysicalQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentChem = chemicals.find((c) => c.id === chemicalId);
  const chemBottles = bottles.filter((b) => b.chemicalId === chemicalId && b.currentVolume > 0);
  const currentBottle = bottles.find((b) => b.id === bottleId);

  const systemQty = currentBottle
    ? currentBottle.currentVolume
    : currentChem
    ? getChemicalTotalStock(currentChem.id).total
    : 0;

  const unit: ChemicalUnit = currentBottle ? currentBottle.unit : currentChem ? currentChem.primaryUnit : 'mL';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chemicalId) {
      setErrorMsg('Vui lòng chọn hóa chất.');
      return;
    }
    const parsedQty = parseFloat(physicalQuantity);
    if (isNaN(parsedQty) || parsedQty < 0) {
      setErrorMsg('Số lượng thực tế không hợp lệ.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do chênh lệch (vd: bay hơi, rơi rớt, kiểm kê thực tế).');
      return;
    }

    const res = reportDiscrepancy({
      chemicalId,
      bottleId: bottleId || undefined,
      physicalQuantity: parsedQty,
      unit,
      reason: reason.trim(),
    });

    if (res.success) {
      setMessage(res.message);
      setErrorMsg(null);
      setTimeout(() => {
        setMessage(null);
        onClose();
      }, 1500);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-amber-50/60">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Báo Cáo Chênh Lệch Tồn Kho</h2>
              <p className="text-xs text-slate-500">Gửi thông báo số lượng thực tế kiểm kê tới Quản lý (Manager)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {errorMsg && (
          <div className="m-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hóa chất cần báo cáo *</label>
            <select
              value={chemicalId}
              onChange={(e) => {
                setChemicalId(e.target.value);
                setBottleId('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              {chemicals.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) - CAS: {c.casNumber}
                </option>
              ))}
            </select>
          </div>

          {chemBottles.length > 0 && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chọn chai cụ thể (tùy chọn)</label>
              <select
                value={bottleId}
                onChange={(e) => setBottleId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Tất cả các chai / Toàn bộ hóa chất này</option>
                {chemBottles.map((b) => (
                  <option key={b.id} value={b.id}>
                    Chai {b.bottleCode} - Còn: {b.currentVolume} {b.unit} (Lot: {b.lotNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Hệ thống đang ghi</label>
              <div className="px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 font-mono font-bold text-slate-800">
                {systemQty} {unit}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số lượng thực tế kiểm kê *</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="vd: 280"
                  value={physicalQuantity}
                  onChange={(e) => setPhysicalQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900 pr-10"
                />
                <span className="absolute right-3 top-2 font-mono text-slate-400">{unit}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Lý do chênh lệch tồn kho <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Ví dụ: Rơi vỡ, bay hơi trong quá trình bảo quản, hao hụt bám dính pipette..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
            <strong>Lưu ý:</strong> Theo quy định phòng lab, thành viên không được tự ý sửa tồn kho. Báo cáo này sẽ được chuyển ngay đến <strong>Quản lý (Manager)</strong> để kiểm tra và duyệt điều chỉnh (Stock Adjustment).
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer"
            >
              Gửi Báo Cáo Chênh Lệch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

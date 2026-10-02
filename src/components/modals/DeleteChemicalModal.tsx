import React, { useState } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical } from '../../types';
import {
  AlertTriangle,
  Trash2,
  X,
  ShieldAlert,
  Archive,
  CheckCircle2,
  Layers,
  History,
  Info,
} from 'lucide-react';

interface Props {
  chemical: Chemical | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

const PRESET_REASONS = [
  'Hóa chất không còn sử dụng',
  'Dữ liệu nhập nhầm',
  'Hóa chất đã thanh lý',
  'Duplicate Chemical (Trùng lặp hồ sơ)',
  'Khác',
];

export const DeleteChemicalModal: React.FC<Props> = ({
  chemical,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const {
    isManager,
    currentUser,
    deleteChemical,
    getChemicalTotalStock,
    getChemicalBottles,
    transactions,
  } = useLab();

  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [confirmedStockWarning, setConfirmedStockWarning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !chemical) return null;

  const totalStockInfo = getChemicalTotalStock(chemical.id);
  const bottles = getChemicalBottles(chemical.id);
  const chemTransactions = transactions.filter((t) => t.chemicalId === chemical.id);

  const hasRemainingStock = totalStockInfo.total > 0;
  const finalReason = selectedReason === 'Khác' ? customReason.trim() : selectedReason;
  const canConfirm =
    isManager &&
    (!hasRemainingStock || confirmedStockWarning) &&
    finalReason.length > 0 &&
    !isSubmitting;

  const handleConfirmDelete = () => {
    if (!isManager) {
      setErrorMsg('ACCESS DENIED (403): Chỉ Quản lý phòng lab (MANAGER) mới có quyền xóa hóa chất.');
      return;
    }

    if (hasRemainingStock && !confirmedStockWarning) {
      setErrorMsg('Vui lòng đánh dấu xác nhận bạn hiểu rằng hóa chất vẫn còn tồn kho.');
      return;
    }

    if (!finalReason) {
      setErrorMsg('Vui lòng chọn hoặc nhập lý do xóa hóa chất.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = deleteChemical(chemical.id, finalReason);
    setIsSubmitting(false);

    if (res.success) {
      if (onDeleted) onDeleted();
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6">
        {/* Header */}
        <div className="px-6 py-4.5 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 tracking-tight">
                Xác Nhận Xóa / Lưu Trữ Hóa Chất
              </h2>
              <p className="text-xs text-rose-700 mt-0.5">
                Cơ chế Soft-delete bảo toàn lịch sử giao dịch & có thể khôi phục
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-600">
          {/* Target Chemical Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Hóa chất yêu cầu xóa
                </span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{chemical.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  CAS: {chemical.casNumber} · Mã: {chemical.code || 'N/A'}
                </div>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-semibold bg-cyan-100 text-cyan-800 rounded-full">
                {chemical.category}
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80">
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-600" />
                  <span>Số chai</span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {bottles.length} chai
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Archive className="w-3 h-3 text-emerald-600" />
                  <span>Tổng tồn</span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {totalStockInfo.total} {totalStockInfo.unit}
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <History className="w-3 h-3 text-indigo-600" />
                  <span>Lịch sử</span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {chemTransactions.length} GD
                </div>
              </div>
            </div>
          </div>

          {/* Stock Warning Box (Requirement 31) */}
          {hasRemainingStock && (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950 text-xs">
                    Cảnh báo: Hóa chất vẫn còn tồn kho thực tế!
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Hóa chất này vẫn còn <strong className="font-mono text-amber-950">{totalStockInfo.total} {totalStockInfo.unit}</strong> trong kho ({bottles.filter(b => b.currentVolume > 0).length} chai chưa rỗng).
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-2 border-t border-amber-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedStockWarning}
                  onChange={(e) => setConfirmedStockWarning(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-amber-950">
                  Tôi hiểu rằng hóa chất vẫn còn tồn kho và xác nhận đưa vào Kho lưu trữ.
                </span>
              </label>
            </div>
          )}

          {/* Notice about preservation (Requirement 29) */}
          <div className="p-3 bg-cyan-50/70 border border-cyan-200 rounded-2xl flex items-start gap-2.5 text-[11px] text-cyan-900 leading-relaxed">
            <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý quan trọng:</strong> Dữ liệu sẽ <strong>không bị xóa vĩnh viễn</strong> khỏi cơ sở dữ liệu. Toàn bộ lịch sử chiết dùng, báo cáo kiểm kê và nhật ký kiểm toán vẫn được giữ nguyên. Quản lý có thể khôi phục bất cứ lúc nào trong mục <strong>Kho Lưu Trữ / Thùng Rác</strong>.
            </div>
          </div>

          {/* Mandatory Deletion Reason (Requirement 28) */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Lý do xóa / lưu trữ <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden"
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {selectedReason === 'Khác' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do cụ thể..."
                rows={2}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-hidden mt-1.5"
              />
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirmDelete}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
              canConfirm
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                : 'bg-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xác nhận xóa (Lưu trữ)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useLab } from '../../context/LabContext';
import { Chemical, Bottle } from '../../types';
import {
  Archive,
  RefreshCw,
  Search,
  X,
  History,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Calendar,
  Layers,
  FlaskConical,
  Eye,
  Check,
  FileText,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenChemicalDetail?: (chem: Chemical) => void;
}

export const ArchiveCenterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onOpenChemicalDetail,
}) => {
  const {
    chemicals,
    bottles,
    isManager,
    currentUser,
    restoreChemical,
    deletionLogs,
    restoreLogs,
    getChemicalTotalStock,
  } = useLab();

  const [activeTab, setActiveTab] = useState<'trash' | 'history'>('trash');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChemForRestore, setSelectedChemForRestore] = useState<Chemical | null>(null);
  const [restoreReason, setRestoreReason] = useState('Khôi phục hoạt động sau khi kiểm tra lại');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  // Filter archived chemicals
  const archivedChemicals = useMemo(() => {
    return chemicals.filter((c) => c.status === 'ARCHIVED');
  }, [chemicals]);

  const filteredArchived = useMemo(() => {
    if (!searchTerm.trim()) return archivedChemicals;
    const q = searchTerm.toLowerCase();
    return archivedChemicals.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.englishName.toLowerCase().includes(q) ||
        c.casNumber.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [archivedChemicals, searchTerm]);

  // Combined Deletion and Restore History
  const combinedHistory = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'DELETE' | 'RESTORE';
      timestamp: string;
      name: string;
      user: string;
      reason: string;
      details: string;
    }> = [];

    deletionLogs.forEach((del) => {
      list.push({
        id: del.id,
        type: 'DELETE',
        timestamp: del.deletedAt,
        name: del.chemicalName,
        user: del.deletedBy,
        reason: del.reason,
        details: `${del.entityType === 'CHEMICAL' ? 'Hóa chất' : 'Chai'}: ${del.bottleIds.length} chai, tồn ${del.stockAtDeletion} ${del.unit}`,
      });
    });

    restoreLogs.forEach((rest) => {
      list.push({
        id: rest.id,
        type: 'RESTORE',
        timestamp: rest.restoredAt,
        name: rest.chemicalName,
        user: rest.restoredBy,
        reason: rest.reason || 'Khôi phục',
        details: `${rest.previousStatus} → ${rest.newStatus}`,
      });
    });

    return list.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [deletionLogs, restoreLogs]);

  if (!isOpen) return null;

  // Handle Restore Confirmation
  const handleConfirmRestore = () => {
    if (!selectedChemForRestore) return;
    setRestoreError(null);
    setRestoreSuccess(null);

    const res = restoreChemical(selectedChemForRestore.id, restoreReason);
    if (res.success) {
      setRestoreSuccess(res.message);
      setTimeout(() => {
        setSelectedChemForRestore(null);
        setRestoreSuccess(null);
      }, 1500);
    } else {
      setRestoreError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Kho Lưu Trữ & Thùng Rác (Archive Center)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                  MANAGER ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Quản lý hóa chất đã xóa mềm, xem lịch sử xóa và khôi phục khi xóa nhầm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('trash')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'trash'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Trash2 className="w-4 h-4 text-amber-600" />
              <span>Hóa chất đã xóa / lưu trữ</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-amber-100 text-amber-800 font-bold">
                {archivedChemicals.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-amber-600 text-amber-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4 text-slate-600" />
              <span>Nhật ký xóa & Khôi phục</span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-200 text-slate-700 font-bold">
                {combinedHistory.length}
              </span>
            </button>
          </div>

          {activeTab === 'trash' && (
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm hóa chất trong thùng rác..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* Restore Confirmation Dialog Banner */}
        {selectedChemForRestore && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 space-y-3 animate-in fade-in shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin-reverse" />
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Xác nhận khôi phục: "{selectedChemForRestore.name}"
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChemForRestore(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-amber-900">
              Khôi phục <strong>{selectedChemForRestore.name}</strong> (CAS: {selectedChemForRestore.casNumber}) và toàn bộ các chai liên kết trở lại danh mục hoạt động. Hóa chất sẽ xuất hiện lại trên Dashboard, Kho hóa chất, và tính toán tồn kho.
            </p>

            {restoreSuccess && (
              <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {restoreError && (
              <div className="p-2.5 bg-rose-100 text-rose-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{restoreError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                  placeholder="Lý do khôi phục..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChemForRestore(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200/60"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Xác nhận Khôi phục</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'trash' && (
            <div>
              {filteredArchived.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Archive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">
                    {searchTerm ? 'Không tìm thấy hóa chất phù hợp' : 'Thùng rác trống'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Không có hóa chất nào đang trong trạng thái lưu trữ / xóa mềm.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Hóa chất</th>
                        <th className="py-3 px-3 text-center">Số chai</th>
                        <th className="py-3 px-3 text-right">Tồn lúc xóa</th>
                        <th className="py-3 px-3">Người xóa</th>
                        <th className="py-3 px-3">Thời gian</th>
                        <th className="py-3 px-4">Lý do xóa</th>
                        <th className="py-3 px-3 text-center">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {filteredArchived.map((chem) => {
                        const chemBottles = bottles.filter((b) => b.chemicalId === chem.id);
                        const totalStock = getChemicalTotalStock(chem.id);
                        const delLog = deletionLogs.find(
                          (l) => l.chemicalId === chem.id && l.entityType === 'CHEMICAL'
                        );

                        return (
                          <tr key={chem.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{chem.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                CAS: {chem.casNumber} · {chem.code || 'N/A'}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center font-mono font-semibold">
                              {chemBottles.length}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {delLog ? `${delLog.stockAtDeletion} ${delLog.unit}` : `${totalStock.total} ${totalStock.unit}`}
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-700">
                                {chem.deletedBy || delLog?.deletedBy || 'Quản lý'}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {chem.deletedAt
                                ? new Date(chem.deletedAt).toLocaleString('vi-VN')
                                : chem.archivedDate || 'N/A'}
                            </td>

                            <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={chem.deletionReason || chem.archivedReason}>
                              {chem.deletionReason || chem.archivedReason || delLog?.reason || 'Ngừng sử dụng'}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-rose-100 text-rose-800 rounded-md">
                                DELETED
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {onOpenChemicalDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenChemicalDetail(chem)}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Xem chi tiết hồ sơ"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedChemForRestore(chem)}
                                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Khôi phục hóa chất về danh mục hoạt động"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Khôi phục</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {combinedHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Chưa có lịch sử xóa / khôi phục</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Mọi hành động xóa mềm và khôi phục của Quản lý sẽ được ghi lại tại đây.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Thời gian</th>
                        <th className="py-3 px-3">Hành động</th>
                        <th className="py-3 px-4">Đối tượng</th>
                        <th className="py-3 px-3">Người thực hiện</th>
                        <th className="py-3 px-4">Lý do</th>
                        <th className="py-3 px-4">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {combinedHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                          </td>

                          <td className="py-3 px-3">
                            {item.type === 'DELETE' ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-rose-100 text-rose-800 rounded-md">
                                XÓA MỀM
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 rounded-md">
                                KHÔI PHỤC
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.name}
                          </td>

                          <td className="py-3 px-3 font-medium text-slate-700">
                            {item.user}
                          </td>

                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={item.reason}>
                            {item.reason}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                            {item.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Chỉ tài khoản MANAGER mới có quyền xem và khôi phục dữ liệu từ Archive Center.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

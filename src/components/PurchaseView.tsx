import React, { useState, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { PurchaseItem, PurchasePriority } from '../types';
import { exportPurchaseListCSV } from '../utils/exportImport';
import {
  ShoppingCart,
  Download,
  CheckCircle2,
  Clock,
  PackagePlus,
  Plus,
  Truck,
  ArrowRight,
  PackageCheck,
} from 'lucide-react';

interface Props {
  onOpenStockIn?: (chemicalId?: string) => void;
}

export const PurchaseView: React.FC<Props> = ({ onOpenStockIn }) => {
  const { purchaseItems, updatePurchaseStatus, transactions, bottles, chemicals } = useLab();
  const [subTab, setSubTab] = useState<'purchase' | 'stock-in'>('purchase');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredItems = useMemo(() => {
    return purchaseItems.filter((p) => {
      // Exclude archived chemicals (Mục 39)
      const chem = chemicals.find((c) => c.id === p.chemicalId);
      if (chem?.status === 'ARCHIVED') return false;

      if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
      return true;
    });
  }, [purchaseItems, filterStatus, chemicals]);

  const stockInTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'STOCK_IN');
  }, [transactions]);

  const handleExport = () => {
    exportPurchaseListCSV(purchaseItems);
  };

  const getPriorityBadge = (p: PurchasePriority) => {
    switch (p) {
      case 'CRITICAL':
        return {
          text: 'NGUY CẤP',
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'LOW':
        return {
          text: 'ƯU TIÊN CAO',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'NORMAL':
      default:
        return {
          text: 'BÌNH THƯỜNG',
          badge: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kế Hoạch Mua Sắm & Nhập Kho</h1>
          <p className="text-xs text-slate-500 mt-1">
            Tự động lập danh sách mua khi tồn kho $\le$ mức cảnh báo · Xác nhận nhận hàng tự động tạo phiếu nhập kho
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenStockIn && (
            <button
              onClick={() => onOpenStockIn()}
              className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nhập Hóa Chất (Stock In)</span>
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs: Kế Hoạch Mua Sắm vs Lịch Sử Nhập Hàng */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit text-xs font-medium">
        <button
          onClick={() => setSubTab('purchase')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-colors ${
            subTab === 'purchase'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5 text-cyan-600" />
          <span>Danh Sách Cần Đặt Mua ({purchaseItems.filter((p) => p.status !== 'RECEIVED').length})</span>
        </button>

        <button
          onClick={() => setSubTab('stock-in')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-colors ${
            subTab === 'stock-in'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Lịch Sử Các Đợt Nhập Hàng ({stockInTransactions.length})</span>
        </button>
      </div>

      {subTab === 'purchase' ? (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span>Hóa chất cần mua</span>
                <ShoppingCart className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {purchaseItems.filter((p) => p.status === 'PENDING').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Đang chờ đặt mua</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span>Đã đặt hàng (Ordered)</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700">
                {purchaseItems.filter((p) => p.status === 'ORDERED').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Đang chờ giao tới lab</div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
                <span>Mức độ nguy cấp</span>
                <span className="text-[10px] font-mono text-rose-600 font-bold">Cần bổ sung</span>
              </div>
              <div className="text-2xl font-bold font-mono text-rose-600 truncate">
                {purchaseItems.filter((p) => p.priority === 'CRITICAL').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Hóa chất dưới mức tồn tối thiểu</div>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-fit text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filterStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({purchaseItems.length})
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filterStatus === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chưa đặt ({purchaseItems.filter((p) => p.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setFilterStatus('ORDERED')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filterStatus === 'ORDERED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang giao ({purchaseItems.filter((p) => p.status === 'ORDERED').length})
            </button>
            <button
              onClick={() => setFilterStatus('RECEIVED')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                filterStatus === 'RECEIVED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã nhận ({purchaseItems.filter((p) => p.status === 'RECEIVED').length})
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Không có đơn hàng nào ở trạng thái này.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Hóa chất</th>
                      <th className="px-4 py-3 font-semibold">Tồn hiện tại</th>
                      <th className="px-4 py-3 font-semibold">Mức tối thiểu</th>
                      <th className="px-4 py-3 font-semibold">Mục tiêu</th>
                      <th className="px-4 py-3 font-semibold">Đề xuất mua</th>
                      <th className="px-4 py-3 font-semibold">Nhà cung cấp</th>
                      <th className="px-4 py-3 font-semibold">Ưu tiên</th>
                      <th className="px-6 py-3 font-semibold text-right">Quy trình xử lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((p) => {
                      const pBadge = getPriorityBadge(p.priority);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-slate-900">
                            <div>{p.chemicalName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {p.notes || 'Tự động tính theo mức tồn'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">
                            {p.currentStock} {p.unit}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">
                            {p.minimumStock} {p.unit}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">
                            {p.targetStock} {p.unit}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-cyan-700 text-sm">
                            {p.recommendedPurchase} {p.unit}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">
                            {p.supplier}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${pBadge.badge}`}>
                              {pBadge.text}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right whitespace-nowrap">
                            {p.status === 'PENDING' && (
                              <button
                                onClick={() => updatePurchaseStatus(p.id, 'ORDERED')}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                              >
                                Đã đặt (Ordered)
                              </button>
                            )}
                            {p.status === 'ORDERED' && (
                              <button
                                onClick={() => updatePurchaseStatus(p.id, 'RECEIVED')}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
                                title="Tự động tạo Stock In transaction và tăng tồn kho!"
                              >
                                Đã nhận (Received & Stock In)
                              </button>
                            )}
                            {p.status === 'RECEIVED' && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đã nhập kho</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Sub Tab: Lịch Sử Các Đợt Nhập Hàng */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Lịch Sử Các Đợt Nhập Hàng ({stockInTransactions.length} đợt)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Dữ liệu gắn liền mã chai và số Lot</span>
          </div>

          {stockInTransactions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Chưa có đợt nhập kho nào được ghi nhận.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Ngày nhập</th>
                    <th className="px-4 py-3 font-semibold">Hóa chất</th>
                    <th className="px-4 py-3 font-semibold">Mã chai tạo ra</th>
                    <th className="px-4 py-3 font-semibold">Số lượng nhập</th>
                    <th className="px-4 py-3 font-semibold">Người tiếp nhận</th>
                    <th className="px-6 py-3 font-semibold">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockInTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {t.chemicalName}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-emerald-700 font-bold">
                        {t.bottleCode || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-600">
                        +{t.quantity} {t.unit}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {t.user}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-[11px]">
                        {t.notes || 'Nhập kho tiêu chuẩn'}
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
  );
};

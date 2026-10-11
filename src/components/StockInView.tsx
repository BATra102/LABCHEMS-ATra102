import React, { useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { Plus, Download, Truck, PackageCheck, MapPin, Calendar, FileSpreadsheet, QrCode, Barcode } from 'lucide-react';

interface Props {
  onOpenStockIn: (chemicalId?: string) => void;
  onOpenExcelImport?: () => void;
  onOpenQrScanner?: () => void;
  onOpenSupermarketBarcode?: (mode?: 'STOCK_IN' | 'STOCK_OUT') => void;
}

export const StockInView: React.FC<Props> = ({
  onOpenStockIn,
  onOpenExcelImport,
  onOpenQrScanner,
  onOpenSupermarketBarcode,
}) => {
  const { transactions, chemicals, bottles, isManager } = useLab();

  const stockInTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'STOCK_IN');
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quản Lý Nhập Kho (Stock In)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Ghi nhận các lô hàng mới về, cập nhật số Lot, hạn dùng và tự động đưa vào kho sẵn sàng sử dụng
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-3.5 py-2 text-xs font-bold text-white bg-linear-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow-cyan-500/20 cursor-pointer active:scale-95"
              title="Quét mã QR tem dán chai bằng Camera (Mục 4)"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-200" />
              <span>Quét QR Chai</span>
            </button>
          )}
          {isManager && onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Nhập nhiều hóa chất và chai từ file Excel hoặc Google Sheets (Mục 66 - 75)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>📥 Nhập Danh Sách (Excel / Sheets)</span>
            </button>
          )}
          {onOpenSupermarketBarcode && (
            <button
              onClick={() => onOpenSupermarketBarcode('STOCK_IN')}
              className="px-3.5 py-2 text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow-emerald-500/20 cursor-pointer active:scale-95"
              title="Quét mã nhập kho: Quét lặp mã vạch / QR tự động cộng tồn kho"
            >
              <Barcode className="w-4 h-4 text-emerald-200" />
              <span>Quét mã nhập kho</span>
            </button>
          )}
          <button
            onClick={() => onOpenStockIn()}
            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nhập Hóa Chất Vào Kho (Stock In)</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Tổng đợt nhập kho</div>
            <div className="text-xl font-bold font-mono text-slate-900">{stockInTransactions.length}</div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-cyan-50 text-cyan-700 rounded-lg">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Chai mới đang hoạt động</div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {bottles.filter((b) => b.status === 'FULL').length}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Đợt nhập gần nhất</div>
            <div className="text-sm font-semibold font-mono text-slate-800">
              {stockInTransactions[0]?.date || 'Chưa có'}
            </div>
          </div>
        </div>
      </div>

      {/* Stock In History Table */}
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
    </div>
  );
};

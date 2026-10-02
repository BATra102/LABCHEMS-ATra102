import React, { useState, useMemo } from 'react';
import { useLab } from '../context/LabContext';
import { Bottle, ExpiryStatus } from '../types';
import { calculateExpiryStatus, getDaysRemaining, getExpiryStatusLabel } from '../utils/status';
import { exportExpiryReportCSV } from '../utils/exportImport';
import {
  Calendar,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MapPin,
  FlaskConical,
} from 'lucide-react';

interface Props {
  onOpenBottleDetail: (bottle: Bottle) => void;
  onOpenRecordUsage: (chemicalId: string, bottleId: string) => void;
}

export const ExpiryView: React.FC<Props> = ({ onOpenBottleDetail, onOpenRecordUsage }) => {
  const { bottles, chemicals, referenceDate } = useLab();
  const [filterGroup, setFilterGroup] = useState<string>('ALL');

  // Enrich bottles with chemical details and expiry countdown (Mục 39: Ẩn hóa chất đã lưu trữ)
  const enrichedBottles = useMemo(() => {
    return bottles
      .filter((b) => {
        if (b.status === 'ARCHIVED' || b.currentVolume <= 0) return false;
        const chem = chemicals.find((c) => c.id === b.chemicalId);
        if (!chem || chem.status === 'ARCHIVED') return false;
        return true;
      })
      .map((b) => {
        const chem = chemicals.find((c) => c.id === b.chemicalId);
        const days = getDaysRemaining(b.expiryDate, referenceDate);
        const status = calculateExpiryStatus(b.expiryDate, referenceDate);
        return {
          bottle: b,
          chem,
          days,
          status,
        };
      })
      .sort((a, b) => a.days - b.days); // Nearest expiry first
  }, [bottles, chemicals, referenceDate]);

  // Counts
  const expiredCount = enrichedBottles.filter((x) => x.status === 'EXPIRED').length;
  const expiringSoonCount = enrichedBottles.filter((x) => x.status === 'EXPIRING_SOON').length;
  const expiringCount = enrichedBottles.filter((x) => x.status === 'EXPIRING').length;
  const validCount = enrichedBottles.filter((x) => x.status === 'VALID').length;

  const filteredBottles = useMemo(() => {
    if (filterGroup === 'ALL') return enrichedBottles;
    return enrichedBottles.filter((x) => x.status === filterGroup);
  }, [enrichedBottles, filterGroup]);

  const handleExport = () => {
    exportExpiryReportCSV(bottles, chemicals);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quản Lý Hạn Sử Dụng Hóa Chất</h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tuổi thọ từng chai hóa chất theo mốc ≤ 90 ngày, ≤ 180 ngày và các lô hết hạn
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo Hạn Dùng</span>
          </button>
        </div>
      </div>

      {/* Category Status Cards (Pages 8-9) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterGroup('EXPIRED')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterGroup === 'EXPIRED'
              ? 'bg-rose-100/70 border-rose-300 ring-2 ring-rose-400'
              : 'bg-rose-50/50 border-rose-200 hover:bg-rose-100/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 font-semibold mb-1">
            <span>EXPIRED (Đã hết hạn)</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
            {expiredCount}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">Cần loại bỏ / cách ly</div>
        </button>

        <button
          onClick={() => setFilterGroup('EXPIRING_SOON')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterGroup === 'EXPIRING_SOON'
              ? 'bg-orange-100/70 border-orange-300 ring-2 ring-orange-400'
              : 'bg-orange-50/50 border-orange-200 hover:bg-orange-100/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-orange-700 font-semibold mb-1">
            <span>EXPIRING SOON (≤ 90 ngày)</span>
            <Clock className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-orange-700 tabular-nums">
            {expiringSoonCount}
          </div>
          <div className="text-[11px] text-orange-600 mt-1">Ưu tiên dùng trước</div>
        </button>

        <button
          onClick={() => setFilterGroup('EXPIRING')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterGroup === 'EXPIRING'
              ? 'bg-amber-100/70 border-amber-300 ring-2 ring-amber-400'
              : 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 font-semibold mb-1">
            <span>EXPIRING (≤ 180 ngày)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {expiringCount}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">Lập kế hoạch sử dụng</div>
        </button>

        <button
          onClick={() => setFilterGroup('VALID')}
          className={`p-4 rounded-xl border text-left transition-all ${
            filterGroup === 'VALID'
              ? 'bg-emerald-100/70 border-emerald-300 ring-2 ring-emerald-400'
              : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
            <span>VALID (&gt; 180 ngày)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {validCount}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">Thời hạn ổn định an toàn</div>
        </button>
      </div>

      {/* Filter tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-lg text-xs">
          <button
            onClick={() => setFilterGroup('ALL')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              filterGroup === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả chai ({enrichedBottles.length})
          </button>
          <button
            onClick={() => setFilterGroup('EXPIRED')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              filterGroup === 'EXPIRED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã hết hạn ({expiredCount})
          </button>
          <button
            onClick={() => setFilterGroup('EXPIRING_SOON')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              filterGroup === 'EXPIRING_SOON'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sắp hết hạn ({expiringSoonCount})
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          Ngày đối chiếu hệ thống: {referenceDate}
        </span>
      </div>

      {/* Expiry Table (Page 9) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredBottles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Không có chai hóa chất nào thuộc phân loại này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-mono text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Hóa chất & Mã chai</th>
                  <th className="px-4 py-3 font-semibold">Số Lot</th>
                  <th className="px-4 py-3 font-semibold">Lượng còn lại</th>
                  <th className="px-4 py-3 font-semibold">Hạn sử dụng</th>
                  <th className="px-4 py-3 font-semibold">Số ngày còn lại</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Vị trí cất giữ</th>
                  <th className="px-6 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBottles.map(({ bottle: b, chem, days, status }) => {
                  const sLabel = getExpiryStatusLabel(status);

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        <div className="font-semibold text-slate-900">{chem?.name}</div>
                        <div className="text-[11px] font-mono text-cyan-700">
                          {b.bottleCode} · {chem?.category}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {b.lotNumber}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                        {b.currentVolume} / {b.initialVolume} {b.unit}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {b.expiryDate}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold">
                        {days <= 0 ? (
                          <span className="text-rose-600">Quá hạn {-days} ngày</span>
                        ) : (
                          <span className={days <= 90 ? 'text-orange-600' : 'text-slate-800'}>
                            {days} ngày
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${sLabel.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sLabel.dotClass}`} />
                          {sLabel.text}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div>{b.location.cabinet}</div>
                        <div className="text-[11px] text-slate-400">{b.location.room} · {b.location.shelf}</div>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => onOpenBottleDetail(b)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                        >
                          Chi tiết
                        </button>
                        {status !== 'EXPIRED' && (
                          <button
                            onClick={() => onOpenRecordUsage(b.chemicalId, b.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-white bg-cyan-600 rounded hover:bg-cyan-700 transition-colors shadow-xs"
                          >
                            Dùng trước
                          </button>
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
  );
};

import { StockStatus, ExpiryStatus, BottleStatus } from '../types';

export function getDaysRemaining(expiryDateStr: string, referenceDateStr: string = '2026-10-01'): number {
  const expiry = new Date(expiryDateStr);
  const ref = new Date(referenceDateStr);
  const diffTime = expiry.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Mục 11 & 40: Logic Tồn Kho Cải Tiến
 * > warnStock -> NORMAL (Bình thường - 🟢)
 * minStock < current <= warnStock -> LOW_STOCK (Sắp hết - 🟡)
 * 0 < current <= minStock -> CRITICAL (Nguy cấp - 🔴)
 * current = 0 -> EMPTY (Hết - ⚫)
 */
export function calculateStockStatus(current: number, minStock: number, warnStock: number): StockStatus {
  if (current <= 0.0001) {
    return 'EMPTY';
  }
  if (current <= minStock) {
    return 'CRITICAL';
  }
  if (current <= warnStock) {
    return 'LOW_STOCK';
  }
  return 'NORMAL';
}

/**
 * Mục 16: Hạn sử dụng trong 90 ngày
 * - Đã hết hạn (days <= 0)
 * - Khẩn cấp (<= 30 ngày)
 * - Chú ý (31 - 90 ngày)
 * - An toàn (> 90 ngày)
 */
export function calculateExpiryStatus(expiryDateStr: string, referenceDateStr: string = '2026-10-01'): ExpiryStatus {
  const days = getDaysRemaining(expiryDateStr, referenceDateStr);
  if (days <= 0) {
    return 'EXPIRED';
  }
  if (days <= 90) {
    return 'EXPIRING_SOON';
  }
  if (days <= 180) {
    return 'EXPIRING';
  }
  return 'VALID';
}

export function calculateBottleStatus(
  currentVolume: number,
  initialVolume: number,
  expiryDateStr: string,
  referenceDateStr: string = '2026-10-01',
  openedDate?: string
): BottleStatus {
  if (currentVolume <= 0.0001) {
    return 'EMPTY';
  }
  const days = getDaysRemaining(expiryDateStr, referenceDateStr);
  if (days <= 0) {
    return 'EXPIRED';
  }
  const ratio = initialVolume > 0 ? currentVolume / initialVolume : 0;
  if (ratio <= 0.20) {
    return 'LOW';
  }
  if (!openedDate && currentVolume >= initialVolume - 0.0001) {
    return 'FULL'; // Chưa mở
  }
  return 'IN_USE'; // Đang mở
}

export function calculateRecommendedPurchase(
  currentStock: number,
  targetStock: number,
  warningStock: number
): number {
  if (currentStock <= warningStock) {
    const diff = targetStock - currentStock;
    return Math.max(0, Math.round(diff * 100) / 100);
  }
  return 0;
}

export function getStockStatusLabel(status: StockStatus): { text: string; dotClass: string; badgeClass: string } {
  switch (status) {
    case 'EMPTY':
      return {
        text: 'Đã hết (0)',
        dotClass: 'bg-slate-700',
        badgeClass: 'text-slate-700 bg-slate-100 border border-slate-300',
      };
    case 'CRITICAL':
      return {
        text: 'Nguy cấp (≤ Min)',
        dotClass: 'bg-rose-500',
        badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
      };
    case 'LOW_STOCK':
      return {
        text: 'Sắp hết (≤ Warning)',
        dotClass: 'bg-amber-500',
        badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
      };
    case 'NORMAL':
    default:
      return {
        text: 'Bình thường',
        dotClass: 'bg-emerald-500',
        badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      };
  }
}

export function getExpiryStatusLabel(status: ExpiryStatus): { text: string; dotClass: string; badgeClass: string } {
  switch (status) {
    case 'EXPIRED':
      return {
        text: 'Đã hết hạn',
        dotClass: 'bg-rose-500',
        badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
      };
    case 'EXPIRING_SOON':
      return {
        text: 'Sắp hết hạn (≤ 90 ngày)',
        dotClass: 'bg-orange-500',
        badgeClass: 'text-orange-700 bg-orange-50 border border-orange-200',
      };
    case 'EXPIRING':
      return {
        text: 'Cần chú ý (≤ 180 ngày)',
        dotClass: 'bg-amber-500',
        badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
      };
    case 'VALID':
    default:
      return {
        text: 'Còn hạn (> 180 ngày)',
        dotClass: 'bg-emerald-500',
        badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      };
  }
}

export function getBottleStatusLabel(status: BottleStatus): { text: string; dotClass: string; badgeClass: string } {
  switch (status) {
    case 'FULL':
    case 'UNOPENED':
      return {
        text: 'Chưa mở (Niêm phong)',
        dotClass: 'bg-emerald-500',
        badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      };
    case 'IN_USE':
    case 'OPENED':
      return {
        text: 'Đang mở (Đang dùng)',
        dotClass: 'bg-sky-500',
        badgeClass: 'text-sky-700 bg-sky-50 border border-sky-200',
      };
    case 'LOW':
      return {
        text: 'Gần hết (≤ 20%)',
        dotClass: 'bg-amber-500',
        badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
      };
    case 'EMPTY':
      return {
        text: 'Đã hết (0 mL/g)',
        dotClass: 'bg-slate-400',
        badgeClass: 'text-slate-600 bg-slate-100 border border-slate-200',
      };
    case 'EXPIRED':
      return {
        text: 'Đã hết hạn',
        dotClass: 'bg-rose-500',
        badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
      };
    case 'DISPOSED':
      return {
        text: 'Đã thanh lý',
        dotClass: 'bg-zinc-500',
        badgeClass: 'text-zinc-700 bg-zinc-100 border border-zinc-300',
      };
    case 'ARCHIVED':
      return {
        text: 'Đã lưu trữ (Kho rác/Archive)',
        dotClass: 'bg-purple-500',
        badgeClass: 'text-purple-700 bg-purple-50 border border-purple-200',
      };
    default:
      return {
        text: String(status),
        dotClass: 'bg-slate-400',
        badgeClass: 'text-slate-600 bg-slate-100 border border-slate-200',
      };
  }
}

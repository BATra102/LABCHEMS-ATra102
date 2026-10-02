import { Chemical, Bottle, InventoryTransaction, PurchaseItem } from '../types';
import { getDaysRemaining } from './status';

/**
 * Downloads a string content as a CSV file with UTF-8 BOM so Excel opens Vietnamese characters cleanly.
 */
export function downloadCSV(filename: string, content: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export Chemical Inventory to CSV / Excel
 */
export function exportChemicalInventoryCSV(
  chemicals: Chemical[],
  getChemicalTotalStock: (id: string) => { total: number; unit: string },
  getChemicalStockStatus: (id: string) => string,
  getChemicalExpiryStatus: (id: string) => string
) {
  const headers = [
    'Mã hóa chất',
    'Tên hóa chất',
    'Tên tiếng Anh',
    'Số CAS',
    'Công thức',
    'Cấp độ (Grade)',
    'Phân loại (Category)',
    'Dạng tồn tại',
    'Tồn kho hiện tại',
    'Đơn vị',
    'Tồn tối thiểu (Min)',
    'Mức cảnh báo (Warn)',
    'Mức mục tiêu (Target)',
    'Trạng thái kho',
    'Trạng thái hạn dùng',
    'Nhà sản xuất',
    'Vị trí lưu trữ',
    'Điều kiện bảo quản',
    'Người phụ trách',
  ];

  const rows = chemicals.map((c) => {
    const stock = getChemicalTotalStock(c.id);
    const stockStatus = getChemicalStockStatus(c.id);
    const expiryStatus = getChemicalExpiryStatus(c.id);
    const loc = `${c.storageLocation.building} - ${c.storageLocation.room} - ${c.storageLocation.cabinet} - ${c.storageLocation.shelf}`;

    return [
      escapeCSV(c.code),
      escapeCSV(c.name),
      escapeCSV(c.englishName),
      escapeCSV(c.casNumber),
      escapeCSV(c.chemicalFormula),
      escapeCSV(c.grade),
      escapeCSV(c.category),
      escapeCSV(c.physicalForm),
      escapeCSV(stock.total),
      escapeCSV(c.primaryUnit),
      escapeCSV(c.minimumStock),
      escapeCSV(c.warningStock),
      escapeCSV(c.targetStock),
      escapeCSV(stockStatus),
      escapeCSV(expiryStatus),
      escapeCSV(c.manufacturer),
      escapeCSV(loc),
      escapeCSV(c.storageConditions),
      escapeCSV(c.responsiblePerson),
    ].join(',');
  });

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_Inventory_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Usage History to CSV
 */
export function exportUsageHistoryCSV(transactions: InventoryTransaction[]) {
  const usageOnly = transactions.filter((t) => t.type === 'USAGE');
  const headers = [
    'Mã GD',
    'Thời gian',
    'Ngày',
    'Hóa chất',
    'Mã chai (Bottle ID)',
    'Số lượng dùng',
    'Đơn vị',
    'Người thực hiện',
    'Dự án (Project)',
    'Thí nghiệm (Experiment)',
    'Mục đích',
    'Tồn chai trước đó',
    'Tồn chai sau khi dùng',
    'Ghi chú',
  ];

  const rows = usageOnly.map((t) => [
    escapeCSV(t.id),
    escapeCSV(t.timestamp),
    escapeCSV(t.date),
    escapeCSV(t.chemicalName),
    escapeCSV(t.bottleCode || 'Tự động trừ'),
    escapeCSV(t.quantity),
    escapeCSV(t.unit),
    escapeCSV(t.user),
    escapeCSV(t.project || ''),
    escapeCSV(t.experiment || ''),
    escapeCSV(t.purpose || ''),
    escapeCSV(t.previousStock),
    escapeCSV(t.newStock),
    escapeCSV(t.notes || ''),
  ].join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_Usage_History_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Purchase List to CSV
 */
export function exportPurchaseListCSV(purchaseItems: PurchaseItem[]) {
  const headers = [
    'Mã yêu cầu',
    'Tên hóa chất',
    'Tồn kho hiện tại',
    'Mức tối thiểu',
    'Mức mục tiêu',
    'Số lượng cần mua đề xuất',
    'Đơn vị',
    'Nhà cung cấp',
    'Độ ưu tiên',
    'Trạng thái đơn hàng',
    'Ghi chú',
  ];

  const rows = purchaseItems.map((p) => [
    escapeCSV(p.id),
    escapeCSV(p.chemicalName),
    escapeCSV(p.currentStock),
    escapeCSV(p.minimumStock),
    escapeCSV(p.targetStock),
    escapeCSV(p.recommendedPurchase),
    escapeCSV(p.unit),
    escapeCSV(p.supplier),
    escapeCSV(p.priority),
    escapeCSV(p.status),
    escapeCSV(p.notes || ''),
  ].join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_Purchase_List_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Expiry Report to CSV
 */
export function exportExpiryReportCSV(bottles: Bottle[], chemicals: Chemical[]) {
  const headers = [
    'Mã chai (Bottle ID)',
    'Tên hóa chất',
    'Số Lot',
    'Thể tích ban đầu',
    'Thể tích còn lại',
    'Đơn vị',
    'Ngày nhận',
    'Ngày mở nắp',
    'Hạn sử dụng',
    'Số ngày còn lại',
    'Trạng thái',
    'Vị trí cất giữ',
  ];

  const rows = bottles.map((b) => {
    const chem = chemicals.find((c) => c.id === b.chemicalId);
    const days = getDaysRemaining(b.expiryDate, '2026-10-01');
    const loc = `${b.location.building} - ${b.location.room} - ${b.location.cabinet} - ${b.location.shelf}`;

    return [
      escapeCSV(b.bottleCode),
      escapeCSV(chem?.name || 'Unknown'),
      escapeCSV(b.lotNumber),
      escapeCSV(b.initialVolume),
      escapeCSV(b.currentVolume),
      escapeCSV(b.unit),
      escapeCSV(b.receivedDate),
      escapeCSV(b.openedDate || 'Chưa mở'),
      escapeCSV(b.expiryDate),
      escapeCSV(days),
      escapeCSV(b.status),
      escapeCSV(loc),
    ].join(',');
  });

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_Expiry_Report_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Stock Movement (Nhập - Xuất - Tồn) Report to CSV
 */
export function exportStockMovementCSV(
  movementRows: Array<{
    code: string;
    name: string;
    casNumber: string;
    category: string;
    unit: string;
    beginningStock: number;
    totalIn: number;
    totalOut: number;
    totalDisposed: number;
    endingStock: number;
    unitPrice: number;
    totalEndingValue: number;
    stockStatus: string;
  }>
) {
  const headers = [
    'Mã hóa chất',
    'Tên hóa chất',
    'Số CAS',
    'Phân loại',
    'Đơn vị tính',
    'Tồn đầu kỳ',
    'Tổng nhập trong kỳ',
    'Tổng xuất trong kỳ',
    'Hao hụt / Tiêu hủy',
    'Tồn cuối kỳ',
    'Đơn giá ước tính (VND)',
    'Giá trị tồn cuối kỳ (VND)',
    'Trạng thái kho',
  ];

  const rows = movementRows.map((r) => [
    escapeCSV(r.code),
    escapeCSV(r.name),
    escapeCSV(r.casNumber),
    escapeCSV(r.category),
    escapeCSV(r.unit),
    escapeCSV(r.beginningStock),
    escapeCSV(r.totalIn),
    escapeCSV(r.totalOut),
    escapeCSV(r.totalDisposed),
    escapeCSV(r.endingStock),
    escapeCSV(r.unitPrice),
    escapeCSV(Math.round(r.totalEndingValue)),
    escapeCSV(r.stockStatus),
  ].join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_BaoCao_NhapXuatTon_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export Physical Count & Discrepancies Audit Report to CSV
 */
export function exportAuditDiscrepancyCSV(
  discrepancies: Array<{
    id: string;
    chemicalName: string;
    bottleCode?: string;
    systemQuantity: number;
    physicalQuantity: number;
    difference: number;
    unit: string;
    reportedBy: string;
    reportedDate: string;
    reason: string;
    status: string;
    resolvedBy?: string;
    resolutionNotes?: string;
  }>
) {
  const headers = [
    'Mã biên bản',
    'Tên hóa chất',
    'Mã chai (Bottle Code)',
    'Tồn sổ sách hệ thống',
    'Tồn kiểm kê thực tế',
    'Chênh lệch (+/-)',
    'Đơn vị tính',
    'Người báo cáo',
    'Ngày phát hiện',
    'Lý do ghi nhận',
    'Trạng thái xử lý',
    'Người duyệt xử lý',
    'Ghi chú giải quyết',
  ];

  const rows = discrepancies.map((d) => [
    escapeCSV(d.id),
    escapeCSV(d.chemicalName),
    escapeCSV(d.bottleCode || 'Toàn lô'),
    escapeCSV(d.systemQuantity),
    escapeCSV(d.physicalQuantity),
    escapeCSV(d.difference),
    escapeCSV(d.unit),
    escapeCSV(d.reportedBy),
    escapeCSV(d.reportedDate),
    escapeCSV(d.reason),
    escapeCSV(d.status === 'RESOLVED' ? 'Đã điều chỉnh kho' : d.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ xử lý'),
    escapeCSV(d.resolvedBy || '—'),
    escapeCSV(d.resolutionNotes || '—'),
  ].join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_BienBan_KiemKe_ChenhLech_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

/**
 * Export User Consumption Summary Report to CSV
 */
export function exportUserConsumptionCSV(
  usersSummary: Array<{
    userName: string;
    department: string;
    role: string;
    txCount: number;
    chemsCount: number;
    totalCost: number;
  }>
) {
  const headers = [
    'Người làm (User)',
    'Đơn vị / Bộ môn',
    'Vai trò',
    'Số lượt sử dụng',
    'Số loại hóa chất đã dùng',
    'Ước tính chi phí tiêu hao (VND)',
  ];

  const rows = usersSummary.map((u) => [
    escapeCSV(u.userName),
    escapeCSV(u.department),
    escapeCSV(u.role),
    escapeCSV(u.txCount),
    escapeCSV(u.chemsCount),
    escapeCSV(Math.round(u.totalCost)),
  ].join(','));

  const csv = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  downloadCSV(`LabChem_BaoCao_TieuHao_NguoiDung_${new Date().toISOString().split('T')[0]}.csv`, csv);
}

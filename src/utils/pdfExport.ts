import { Chemical, InventoryTransaction, Bottle } from '../types';
import { convertUnit } from './units';

export interface ChemicalReportData {
  chemical: Chemical;
  totalStock: number;
  unit: string;
  stockStatus: string;
  stockStatusLabel: string;
  expiryStatus: string;
  expiryStatusLabel: string;
  bottleCount: number;
}

export interface TransactionReportData {
  transaction: InventoryTransaction;
}

/**
 * Escape HTML to prevent injection and rendering issues
 */
function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Common print CSS styles for crisp A4 paper printing and PDF conversion
 */
const BASE_PRINT_CSS = `
  @page {
    size: A4 landscape;
    margin: 12mm 10mm 15mm 10mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background: #ffffff !important;
    }
    .no-print {
      display: none !important;
    }
    .page-break {
      page-break-before: always;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    font-size: 11px;
    line-height: 1.4;
    padding: 20px;
  }
  .report-container {
    max-width: 1100px;
    margin: 0 auto;
    background: #ffffff;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  }
  @media print {
    body { padding: 0; }
    .report-container {
      max-width: 100%;
      padding: 0;
      box-shadow: none;
      border-radius: 0;
    }
  }
  .header-table {
    width: 100%;
    margin-bottom: 20px;
    border-bottom: 2px solid #0f766e;
    padding-bottom: 12px;
  }
  .header-left {
    text-align: left;
    vertical-align: top;
  }
  .header-right {
    text-align: right;
    vertical-align: top;
  }
  .lab-name {
    font-size: 14px;
    font-weight: 800;
    color: #0f766e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .lab-sub {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
  }
  .nation-title {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    text-transform: uppercase;
  }
  .nation-sub {
    font-size: 10px;
    color: #475569;
    font-style: italic;
  }
  .report-title-block {
    text-align: center;
    margin: 18px 0;
  }
  .report-title {
    font-size: 18px;
    font-weight: 900;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .report-subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 4px;
  }
  .meta-grid {
    display: flex;
    justify-content: space-between;
    background: #f1f5f9;
    padding: 10px 14px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 11px;
  }
  .kpi-row {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }
  .kpi-card {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    text-align: center;
  }
  .kpi-val {
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    font-family: monospace;
  }
  .kpi-lbl {
    font-size: 10px;
    color: #64748b;
    margin-top: 2px;
    text-transform: uppercase;
    font-weight: 600;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    font-size: 10.5px;
  }
  .data-table th {
    background: #0f766e;
    color: #ffffff;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #0d9488;
    text-transform: uppercase;
    font-size: 9.5px;
    letter-spacing: 0.3px;
  }
  .data-table td {
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: middle;
  }
  .data-table tr:nth-child(even) {
    background: #f8fafc;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    font-family: monospace;
  }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-warning { background: #fef3c7; color: #92400e; }
  .badge-danger { background: #fee2e2; color: #991b1b; }
  .badge-info { background: #e0f2fe; color: #075985; }
  .badge-gray { background: #f1f5f9; color: #475569; }
  .signature-table {
    width: 100%;
    margin-top: 30px;
    page-break-inside: avoid;
  }
  .sig-col {
    text-align: center;
    vertical-align: top;
    width: 33.33%;
    padding: 0 10px;
  }
  .sig-role {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    color: #0f172a;
  }
  .sig-note {
    font-size: 9.5px;
    color: #64748b;
    font-style: italic;
    margin-top: 2px;
  }
  .sig-space {
    height: 60px;
  }
  .sig-name {
    font-weight: 700;
    font-size: 11px;
    color: #1e293b;
    border-top: 1px dotted #cbd5e1;
    padding-top: 4px;
    display: inline-block;
    min-width: 140px;
  }
  .footer-note {
    margin-top: 20px;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    font-size: 9px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
  .print-bar {
    position: sticky;
    top: 0;
    background: #0f172a;
    color: #ffffff;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .print-btn {
    background: #0d9488;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }
  .print-btn:hover {
    background: #0f766e;
  }
`;

/**
 * Generate full HTML for Chemical Inventory PDF Report
 */
export function generateChemicalInventoryPdfHtml(params: {
  reportCode: string;
  generatedDate: string;
  generatedBy: string;
  roleDisplayName?: string;
  chemicals: ChemicalReportData[];
  filterCategory?: string;
  filterStatus?: string;
  totalChemicals: number;
  totalBottles: number;
  criticalCount: number;
  warningCount: number;
  expiredCount: number;
  notes?: string;
}): string {
  const {
    reportCode,
    generatedDate,
    generatedBy,
    roleDisplayName = 'Quản lý phòng Lab',
    chemicals,
    totalChemicals,
    totalBottles,
    criticalCount,
    warningCount,
    expiredCount,
    notes,
  } = params;

  const rowsHtml = chemicals
    .map((item, idx) => {
      const c = item.chemical;
      let badgeClass = 'badge-success';
      if (item.stockStatus === 'CRITICAL' || item.stockStatus === 'EMPTY') badgeClass = 'badge-danger';
      else if (item.stockStatus === 'LOW' || item.stockStatus === 'WARNING') badgeClass = 'badge-warning';

      let expiryBadge = 'badge-success';
      if (item.expiryStatus === 'EXPIRED') expiryBadge = 'badge-danger';
      else if (item.expiryStatus === 'EXPIRING_SOON') expiryBadge = 'badge-warning';

      const locStr = `${c.storageLocation.cabinet || ''}${c.storageLocation.shelf ? `, Kệ ${c.storageLocation.shelf}` : ''} (${c.storageLocation.room || ''})`;

      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 700; color: #0f766e;">${escapeHtml(c.code)}</td>
          <td>
            <strong>${escapeHtml(c.name)}</strong>
            ${c.englishName ? `<div style="font-size: 9.5px; color: #64748b;">${escapeHtml(c.englishName)}</div>` : ''}
          </td>
          <td style="font-family: monospace;">${escapeHtml(c.casNumber)}</td>
          <td style="font-family: monospace;">${escapeHtml(c.chemicalFormula || '—')}</td>
          <td>${escapeHtml(c.category)}</td>
          <td style="text-align: right; font-weight: 700; font-family: monospace;">
            ${item.totalStock.toLocaleString('vi-VN')} ${escapeHtml(item.unit)}
          </td>
          <td style="text-align: center; font-family: monospace;">${item.bottleCount} chai</td>
          <td style="text-align: right; color: #64748b; font-family: monospace;">${c.minimumStock} ${escapeHtml(c.primaryUnit)}</td>
          <td style="font-size: 9.5px;">${escapeHtml(locStr)}</td>
          <td style="text-align: center;">
            <span class="badge ${badgeClass}">${escapeHtml(item.stockStatusLabel)}</span>
          </td>
          <td style="text-align: center;">
            <span class="badge ${expiryBadge}">${escapeHtml(item.expiryStatusLabel)}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo cáo Tồn kho Hóa chất - ${escapeHtml(reportCode)}</title>
  <style>${BASE_PRINT_CSS}</style>
</head>
<body>
  <div class="print-bar no-print">
    <div>
      <strong>📄 BÁO CÁO TỒN KHO HÓA CHẤT PHÒNG THÍ NGHIỆM</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">(Mã: ${escapeHtml(reportCode)})</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="print-btn">
        🖨️ In Báo Cáo / Lưu PDF
      </button>
      <button onclick="window.close()" class="print-btn" style="background: #475569;">
        Đóng
      </button>
    </div>
  </div>

  <div class="report-container">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="lab-name">Phòng Thí Nghiệm & Kiểm Nghiệm Dược Liệu</div>
          <div class="lab-sub">Hệ Thống Quản Lý Hóa Chất Chuẩn LabChems Anhtra102</div>
          <div class="lab-sub">Địa điểm: Tòa nhà Khoa học & Công nghệ, Phòng Lab 402</div>
        </td>
        <td class="header-right">
          <div class="nation-title">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
          <div class="nation-sub">Độc lập - Tự do - Hạnh phúc</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Số: <strong>${escapeHtml(reportCode)}</strong></div>
        </td>
      </tr>
    </table>

    <div class="report-title-block">
      <h1 class="report-title">BÁO CÁO TỒN KHO HÓA CHẤT HIỆN TẠI</h1>
      <div class="report-subtitle">(CHEMICAL INVENTORY COMPREHENSIVE REPORT)</div>
    </div>

    <div class="meta-grid">
      <div><strong>Ngày xuất báo cáo:</strong> ${escapeHtml(generatedDate)}</div>
      <div><strong>Người lập báo cáo:</strong> ${escapeHtml(generatedBy)} (${escapeHtml(roleDisplayName)})</div>
      <div><strong>Phạm vi dữ liệu:</strong> Toàn bộ kho hóa chất đang hoạt động</div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-val">${totalChemicals}</div>
        <div class="kpi-lbl">Loại hóa chất</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val">${totalBottles}</div>
        <div class="kpi-lbl">Chai vật lý trong kho</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #059669;">${totalChemicals - criticalCount - warningCount}</div>
        <div class="kpi-lbl">Tồn an toàn</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #d97706;">${warningCount}</div>
        <div class="kpi-lbl">Cảnh báo sắp hết</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #dc2626;">${criticalCount}</div>
        <div class="kpi-lbl">Mức nguy cấp</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: ${expiredCount > 0 ? '#dc2626' : '#64748b'};">${expiredCount}</div>
        <div class="kpi-lbl">Hết hạn / Cần xử lý</div>
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">STT</th>
          <th style="width: 70px;">Mã HC</th>
          <th>Tên Hóa Chất</th>
          <th style="width: 85px;">Số CAS</th>
          <th style="width: 80px;">Công Thức</th>
          <th style="width: 80px;">Phân Loại</th>
          <th style="width: 90px; text-align: right;">Tồn Hiện Có</th>
          <th style="width: 65px; text-align: center;">Số Chai</th>
          <th style="width: 70px; text-align: right;">Mức Min</th>
          <th style="width: 130px;">Vị Trí Lưu Trữ</th>
          <th style="width: 75px; text-align: center;">Tồn Kho</th>
          <th style="width: 75px; text-align: center;">Hạn Dùng</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    ${notes ? `
      <div style="margin-bottom: 20px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10.5px;">
        <strong>Ghi chú & Đề xuất của người phụ trách:</strong> ${escapeHtml(notes)}
      </div>
    ` : ''}

    <table class="signature-table">
      <tr>
        <td class="sig-col">
          <div class="sig-role">Người Lập Báo Cáo</div>
          <div class="sig-note">(Ký, ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">${escapeHtml(generatedBy)}</div>
        </td>
        <td class="sig-col">
          <div class="sig-role">Cán Bộ Phụ Trách Kho</div>
          <div class="sig-note">(Ký, ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">Thủ kho hóa chất</div>
        </td>
        <td class="sig-col">
          <div class="sig-role">Trưởng Phòng Thí Nghiệm</div>
          <div class="sig-note">(Ký tên và đóng dấu)</div>
          <div class="sig-space"></div>
          <div class="sig-name">Lab Manager</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      <div>Hệ thống LabChems Anhtra102 · Dữ liệu được trích xuất tự động theo thời gian thực</div>
      <div>Trang 1 / 1 (Hỗ trợ in A4 ngang)</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate full HTML for Transaction History PDF Report
 */
export function generateTransactionHistoryPdfHtml(params: {
  reportCode: string;
  generatedDate: string;
  generatedBy: string;
  roleDisplayName?: string;
  transactions: TransactionReportData[];
  filterType?: string;
  filterTimeRange?: string;
  totalTransactions: number;
  totalStockInQty: number;
  totalUsageQty: number;
  totalStockInCount: number;
  totalUsageCount: number;
  notes?: string;
}): string {
  const {
    reportCode,
    generatedDate,
    generatedBy,
    roleDisplayName = 'Quản lý phòng Lab',
    transactions,
    filterType = 'Tất cả giao dịch',
    filterTimeRange = 'Toàn bộ thời gian',
    totalTransactions,
    totalStockInQty,
    totalUsageQty,
    totalStockInCount,
    totalUsageCount,
    notes,
  } = params;

  const rowsHtml = transactions
    .map((item, idx) => {
      const t = item.transaction;
      const isStockIn = t.type === 'STOCK_IN';
      const typeLabel = isStockIn ? 'NHẬP KHO' : t.type === 'USAGE' ? 'XUẤT SỬ DỤNG' : 'ĐIỀU CHỈNH';
      const badgeClass = isStockIn ? 'badge-success' : t.type === 'USAGE' ? 'badge-info' : 'badge-warning';

      return `
        <tr>
          <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
          <td style="font-family: monospace; font-size: 10px;">${escapeHtml(t.date || t.timestamp.split('T')[0])}</td>
          <td style="text-align: center;">
            <span class="badge ${badgeClass}">${escapeHtml(typeLabel)}</span>
          </td>
          <td>
            <strong>${escapeHtml(t.chemicalName)}</strong>
          </td>
          <td style="font-family: monospace; font-size: 10px; color: #64748b;">
            ${escapeHtml(t.bottleCode || '—')}
          </td>
          <td style="text-align: right; font-weight: 700; font-family: monospace; color: ${isStockIn ? '#166534' : '#0369a1'};">
            ${isStockIn ? '+' : '-'}${Math.abs(t.quantity)} ${escapeHtml(t.unit)}
          </td>
          <td style="text-align: right; font-family: monospace; color: #64748b;">
            ${t.previousStock} ${escapeHtml(t.unit)}
          </td>
          <td style="text-align: right; font-family: monospace; font-weight: 700;">
            ${t.newStock} ${escapeHtml(t.unit)}
          </td>
          <td>
            <strong>${escapeHtml(t.user)}</strong>
          </td>
          <td style="font-size: 9.5px; color: #334155;">
            ${escapeHtml(t.project || t.purpose || 'Nghiên cứu & Thử nghiệm')}
          </td>
          <td style="font-size: 9.5px; color: #64748b;">
            ${escapeHtml(t.notes || '—')}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo cáo Lịch sử Giao dịch - ${escapeHtml(reportCode)}</title>
  <style>${BASE_PRINT_CSS}</style>
</head>
<body>
  <div class="print-bar no-print">
    <div>
      <strong>📄 BÁO CÁO LỊCH SỬ GIAO DỊCH NHẬP KHO & SỬ DỤNG HÓA CHẤT</strong>
      <span style="font-size: 11px; opacity: 0.8; margin-left: 8px;">(Mã: ${escapeHtml(reportCode)})</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="print-btn">
        🖨️ In Báo Cáo / Lưu PDF
      </button>
      <button onclick="window.close()" class="print-btn" style="background: #475569;">
        Đóng
      </button>
    </div>
  </div>

  <div class="report-container">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="lab-name">Phòng Thí Nghiệm & Kiểm Nghiệm Dược Liệu</div>
          <div class="lab-sub">Hệ Thống Quản Lý Hóa Chất Chuẩn LabChems Anhtra102</div>
          <div class="lab-sub">Địa điểm: Tòa nhà Khoa học & Công nghệ, Phòng Lab 402</div>
        </td>
        <td class="header-right">
          <div class="nation-title">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
          <div class="nation-sub">Độc lập - Tự do - Hạnh phúc</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Số: <strong>${escapeHtml(reportCode)}</strong></div>
        </td>
      </tr>
    </table>

    <div class="report-title-block">
      <h1 class="report-title">BÁO CÁO LỊCH SỬ GIAO DỊCH KHO HÓA CHẤT</h1>
      <div class="report-subtitle">(STOCK IN & USAGE TRANSACTION AUDIT REPORT)</div>
    </div>

    <div class="meta-grid">
      <div><strong>Ngày xuất:</strong> ${escapeHtml(generatedDate)}</div>
      <div><strong>Người lập:</strong> ${escapeHtml(generatedBy)} (${escapeHtml(roleDisplayName)})</div>
      <div><strong>Loại giao dịch:</strong> ${escapeHtml(filterType)}</div>
      <div><strong>Khoảng thời gian:</strong> ${escapeHtml(filterTimeRange)}</div>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-val">${totalTransactions}</div>
        <div class="kpi-lbl">Tổng số giao dịch</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #166534;">${totalStockInCount} lượt</div>
        <div class="kpi-lbl">Nhập kho mới</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #0369a1;">${totalUsageCount} lượt</div>
        <div class="kpi-lbl">Xuất kho sử dụng</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #166534;">+${Math.round(totalStockInQty * 10) / 10}</div>
        <div class="kpi-lbl">Tổng lượng nhập vào</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color: #0369a1;">-${Math.round(totalUsageQty * 10) / 10}</div>
        <div class="kpi-lbl">Tổng lượng tiêu hao</div>
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">STT</th>
          <th style="width: 80px;">Thời Gian</th>
          <th style="width: 85px; text-align: center;">Loại GD</th>
          <th>Tên Hóa Chất</th>
          <th style="width: 85px;">Mã Chai</th>
          <th style="width: 90px; text-align: right;">Số Lượng</th>
          <th style="width: 75px; text-align: right;">Tồn Trước</th>
          <th style="width: 75px; text-align: right;">Tồn Sau</th>
          <th style="width: 100px;">Người Thao Tác</th>
          <th style="width: 130px;">Đề Tài / Mục Đích</th>
          <th>Ghi Chú</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    ${notes ? `
      <div style="margin-bottom: 20px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10.5px;">
        <strong>Nhận xét & Đánh giá định kỳ:</strong> ${escapeHtml(notes)}
      </div>
    ` : ''}

    <table class="signature-table">
      <tr>
        <td class="sig-col">
          <div class="sig-role">Người Lập Báo Cáo</div>
          <div class="sig-note">(Ký, ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">${escapeHtml(generatedBy)}</div>
        </td>
        <td class="sig-col">
          <div class="sig-role">Cán Bộ Giám Sát / Thủ Kho</div>
          <div class="sig-note">(Ký, ghi rõ họ tên)</div>
          <div class="sig-space"></div>
          <div class="sig-name">Kiểm soát viên</div>
        </td>
        <td class="sig-col">
          <div class="sig-role">Trưởng Phòng Thí Nghiệm</div>
          <div class="sig-note">(Ký tên và đóng dấu)</div>
          <div class="sig-space"></div>
          <div class="sig-name">Lab Manager</div>
        </td>
      </tr>
    </table>

    <div class="footer-note">
      <div>Hệ thống LabChems Anhtra102 · Dữ liệu kiểm toán giao dịch thời gian thực</div>
      <div>Trang 1 / 1 (Hỗ trợ in A4 ngang)</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open Print Window for direct printing or browser "Save as PDF"
 */
export function openPrintWindow(htmlContent: string, windowTitle = 'Báo cáo LabChems'): void {
  const printWindow = window.open('', '_blank', 'width=1200,height=800,menubar=no,toolbar=no,status=no');
  if (!printWindow) {
    // Popup blocked: fallback to hidden iframe
    printViaIframe(htmlContent);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (err) {
        console.warn('Print trigger note:', err);
      }
    }, 400);
  };
}

/**
 * Fallback hidden iframe printing
 */
function printViaIframe(htmlContent: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  }
}

/**
 * Download Standalone HTML/PDF Report File
 */
export function downloadReportFile(filename: string, htmlContent: string): void {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Configure Vietnamese Unicode fonts on jsPDF instance
 */
async function setupPdfVietnameseFont(doc: any): Promise<void> {
  try {
    const fonts = await import('./freeSansFonts');
    doc.addFileToVFS('FreeSans.ttf', fonts.FREE_SANS_REGULAR_BASE64);
    doc.addFileToVFS('FreeSansBold.ttf', fonts.FREE_SANS_BOLD_BASE64);
    doc.addFont('FreeSans.ttf', 'FreeSans', 'normal');
    doc.addFont('FreeSansBold.ttf', 'FreeSans', 'bold');
    doc.setFont('FreeSans');
  } catch (err) {
    console.warn('Could not load custom Unicode font, falling back to standard font:', err);
  }
}

/**
 * Direct PDF Binary File Generation & Download for Chemical Inventory Report
 */
export async function generateAndDownloadChemicalInventoryPdf(params: {
  reportCode: string;
  generatedDate: string;
  generatedBy: string;
  roleDisplayName?: string;
  chemicals: ChemicalReportData[];
  filterCategory?: string;
  totalChemicals: number;
  totalBottles: number;
  criticalCount: number;
  warningCount: number;
  expiredCount: number;
  notes?: string;
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autotableModule = await import('jspdf-autotable');
  const autoTable = (autotableModule as any).autoTable || (autotableModule as any).default;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  await setupPdfVietnameseFont(doc);

  // Document Dimensions
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const margin = 12;

  // Header Lab Brand & Nation
  doc.setFontSize(10);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('PHÒNG THÍ NGHIỆM & KIỂM NGHIỆM DƯỢC LIỆU', margin, 14);

  doc.setFontSize(8);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Hệ Thống Quản Lý Hóa Chất Chuẩn LabChems Anhtra102 · Phòng Lab 402', margin, 19);

  // Right Side: Nation Header
  doc.setFontSize(9);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', pageWidth - margin, 14, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Độc lập - Tự do - Hạnh phúc', pageWidth - margin, 19, { align: 'right' });
  doc.text(`Số hiệu báo cáo: ${params.reportCode}`, pageWidth - margin, 24, { align: 'right' });

  // Divider Line
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.6);
  doc.line(margin, 26, pageWidth - margin, 26);

  // Report Title
  doc.setFontSize(15);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('BÁO CÁO TỒN KHO HÓA CHẤT HIỆN TẠI', pageWidth / 2, 34, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('(CHEMICAL INVENTORY COMPREHENSIVE REPORT)', pageWidth / 2, 39, { align: 'center' });

  // Meta Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 43, pageWidth - margin * 2, 16, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Ngày lập: ${params.generatedDate}`, margin + 5, 49);
  doc.text(`Người lập: ${params.generatedBy} (${params.roleDisplayName || 'Thành viên'})`, margin + 65, 49);
  doc.text(`Phạm vi: ${params.filterCategory ? `Nhóm [${params.filterCategory}]` : 'Toàn bộ kho hóa chất'}`, margin + 160, 49);

  // Summary Metrics inside box
  const safeCount = Math.max(0, params.totalChemicals - params.criticalCount - params.warningCount);
  doc.setFont('FreeSans', 'bold');
  doc.text(`Tổng HC: ${params.totalChemicals} loại | Chai thực tế: ${params.totalBottles} chai | Tồn an toàn: ${safeCount} | Cảnh báo thiếu: ${params.warningCount} | Nguy cấp: ${params.criticalCount} | Hết hạn: ${params.expiredCount}`, margin + 5, 55);

  // Build Table Rows
  const tableData = params.chemicals.map((item, index) => {
    const c = item.chemical;
    const loc = `${c.storageLocation.cabinet || ''} - ${c.storageLocation.shelf || ''}`.replace(/^ - |- $/g, '').trim() || 'Khu chung';
    return [
      String(index + 1),
      c.code,
      c.name,
      c.casNumber || '—',
      c.chemicalFormula || '—',
      c.category || '—',
      `${item.totalStock.toLocaleString('vi-VN')} ${item.unit}`,
      `${c.minimumStock.toLocaleString('vi-VN')} ${c.primaryUnit}`,
      `${c.targetStock.toLocaleString('vi-VN')} ${c.primaryUnit}`,
      `${item.bottleCount} chai`,
      item.stockStatusLabel,
      item.expiryStatusLabel,
      loc,
    ];
  });

  autoTable(doc, {
    startY: 62,
    head: [[
      'STT',
      'Mã HC',
      'Tên Hóa Chất',
      'Số CAS',
      'Công Thức',
      'Phân Loại',
      'Tồn Hiện Tại',
      'Tối Thiểu',
      'Mục Tiêu',
      'Số Chai',
      'Trạng Thái Kho',
      'Hạn Dùng',
      'Vị Trí Tủ',
    ]],
    body: tableData,
    margin: { left: margin, right: margin, bottom: 20 },
    styles: {
      font: 'FreeSans',
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      font: 'FreeSans',
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      2: { cellWidth: 42, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { cellWidth: 22 },
      6: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      7: { halign: 'right', cellWidth: 16 },
      8: { halign: 'right', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 15 },
      10: { halign: 'center', cellWidth: 22 },
      11: { halign: 'center', cellWidth: 24 },
      12: { cellWidth: 28 },
    },
    didDrawPage: (data: any) => {
      // Footer page numbering & watermark note
      const pageNumber = doc.internal.pages.length - 1;
      doc.setFontSize(7.5);
      doc.setFont('FreeSans', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Hệ thống quản lý LabChems Anhtra102 · Mã hồ sơ: ${params.reportCode} · Xuất ngày: ${params.generatedDate}`,
        margin,
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text(
        `Trang ${data.pageNumber}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

  // Check if we need signature block at end of table
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (pageHeight - finalY < 35) {
    doc.addPage();
  }

  const sigY = (pageHeight - finalY < 35) ? 20 : finalY + 10;
  doc.setFontSize(8.5);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);

  const col1 = margin + 30;
  const col2 = pageWidth / 2;
  const col3 = pageWidth - margin - 30;

  doc.text('NGƯỜI LẬP BÁO CÁO', col1, sigY, { align: 'center' });
  doc.text('THỦ KHO HÓA CHẤT', col2, sigY, { align: 'center' });
  doc.text('TRƯỞNG PHÒNG THÍ NGHIỆM', col3, sigY, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('(Ký, ghi rõ họ tên)', col1, sigY + 4, { align: 'center' });
  doc.text('(Ký, xác nhận tồn)', col2, sigY + 4, { align: 'center' });
  doc.text('(Ký duyệt & đóng dấu)', col3, sigY + 4, { align: 'center' });

  doc.text(params.generatedBy, col1, sigY + 22, { align: 'center' });

  doc.save(`Bao_Cao_Ton_Kho_${params.reportCode}.pdf`);
}

/**
 * Direct PDF Binary File Generation & Download for Transaction History Report
 */
export async function generateAndDownloadTransactionHistoryPdf(params: {
  reportCode: string;
  generatedDate: string;
  generatedBy: string;
  roleDisplayName?: string;
  transactions: TransactionReportData[];
  filterType?: string;
  filterTimeRange?: string;
  totalTransactions: number;
  totalStockInQty: number;
  totalUsageQty: number;
  totalStockInCount: number;
  totalUsageCount: number;
  notes?: string;
}): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autotableModule = await import('jspdf-autotable');
  const autoTable = (autotableModule as any).autoTable || (autotableModule as any).default;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  await setupPdfVietnameseFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Header Lab Brand & Nation
  doc.setFontSize(10);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text('PHÒNG THÍ NGHIỆM & KIỂM NGHIỆM DƯỢC LIỆU', margin, 14);

  doc.setFontSize(8);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Hệ Thống Quản Lý Hóa Chất Chuẩn LabChems Anhtra102 · Dữ Liệu Kiểm Toán Giao Dịch', margin, 19);

  // Right Side: Nation Header
  doc.setFontSize(9);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', pageWidth - margin, 14, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Độc lập - Tự do - Hạnh phúc', pageWidth - margin, 19, { align: 'right' });
  doc.text(`Số hiệu báo cáo: ${params.reportCode}`, pageWidth - margin, 24, { align: 'right' });

  // Divider Line
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.6);
  doc.line(margin, 26, pageWidth - margin, 26);

  // Report Title
  doc.setFontSize(15);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('BÁO CÁO LỊCH SỬ GIAO DỊCH NHẬP KHO & SỬ DỤNG', pageWidth / 2, 34, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('(CHEMICAL INVENTORY TRANSACTION & AUDIT LOG)', pageWidth / 2, 39, { align: 'center' });

  // Meta Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, 43, pageWidth - margin * 2, 16, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Ngày lập: ${params.generatedDate}`, margin + 5, 49);
  doc.text(`Người lập: ${params.generatedBy} (${params.roleDisplayName || 'Thành viên'})`, margin + 65, 49);
  doc.text(`Bộ lọc: ${params.filterType || 'Tất cả'} | Kỳ: ${params.filterTimeRange || 'Toàn bộ'}`, margin + 160, 49);

  doc.setFont('FreeSans', 'bold');
  doc.text(`Tổng giao dịch: ${params.totalTransactions} | Lượt nhập kho: ${params.totalStockInCount} lượt | Lượt xuất dùng: ${params.totalUsageCount} lượt`, margin + 5, 55);

  // Build Table Rows
  const tableData = params.transactions.map((item, index) => {
    const t = item.transaction;
    const isStockIn = t.type === 'STOCK_IN';
    const typeLabel = isStockIn ? 'NHẬP KHO' : t.type === 'USAGE' ? 'XUẤT DÙNG' : 'ĐIỀU CHỈNH';
    const dateFormatted = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '—');
    const changeQty = `${isStockIn ? '+' : '-'}${Math.abs(t.quantity).toLocaleString('vi-VN')} ${t.unit}`;

    return [
      String(index + 1),
      dateFormatted,
      typeLabel,
      t.chemicalName,
      t.bottleCode || 'Tự động',
      changeQty,
      `${t.previousStock.toLocaleString('vi-VN')} ${t.unit}`,
      `${t.newStock.toLocaleString('vi-VN')} ${t.unit}`,
      t.user,
      t.project || t.purpose || 'Thí nghiệm',
      t.notes || '—',
    ];
  });

  autoTable(doc, {
    startY: 62,
    head: [[
      'STT',
      'Ngày / Giờ',
      'Loại GD',
      'Tên Hóa Chất',
      'Mã Chai',
      'Số Lượng',
      'Tồn Trước',
      'Tồn Sau',
      'Người Thực Hiện',
      'Đề Tài / Mục Đích',
      'Ghi Chú',
    ]],
    body: tableData,
    margin: { left: margin, right: margin, bottom: 20 },
    styles: {
      font: 'FreeSans',
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      font: 'FreeSans',
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      3: { cellWidth: 45, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      8: { cellWidth: 26, fontStyle: 'bold' },
      9: { cellWidth: 40 },
      10: { cellWidth: 26 },
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(7.5);
      doc.setFont('FreeSans', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Hệ thống quản lý LabChems Anhtra102 · Mã hồ sơ: ${params.reportCode} · Xuất ngày: ${params.generatedDate}`,
        margin,
        doc.internal.pageSize.getHeight() - 8
      );
      doc.text(
        `Trang ${data.pageNumber}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (pageHeight - finalY < 35) {
    doc.addPage();
  }

  const sigY = (pageHeight - finalY < 35) ? 20 : finalY + 10;
  doc.setFontSize(8.5);
  doc.setFont('FreeSans', 'bold');
  doc.setTextColor(15, 23, 42);

  const col1 = margin + 30;
  const col2 = pageWidth / 2;
  const col3 = pageWidth - margin - 30;

  doc.text('NGƯỜI LẬP BÁO CÁO', col1, sigY, { align: 'center' });
  doc.text('NGƯỜI GIAO DỊCH / THỦ KHO', col2, sigY, { align: 'center' });
  doc.text('TRƯỞNG PHÒNG THÍ NGHIỆM', col3, sigY, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('FreeSans', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('(Ký, ghi rõ họ tên)', col1, sigY + 4, { align: 'center' });
  doc.text('(Ký, xác nhận kiểm tra)', col2, sigY + 4, { align: 'center' });
  doc.text('(Ký duyệt & đóng dấu)', col3, sigY + 4, { align: 'center' });

  doc.text(params.generatedBy, col1, sigY + 22, { align: 'center' });

  doc.save(`Bao_Cao_Lich_Su_Giao_Dich_${params.reportCode}.pdf`);
}

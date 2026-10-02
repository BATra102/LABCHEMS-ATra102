import * as XLSX from 'xlsx';
import { Chemical, Bottle, ChemicalUnit, StorageLocation } from '../types';

export interface ParsedImportRow {
  rowNumber: number;
  chemicalName: string;
  chemicalCode: string;
  englishName: string;
  casNumber: string;
  formula: string;
  molecularWeight?: number;
  grade: string;
  category: string;
  unit: ChemicalUnit;
  bottleCode: string;
  quantity: number;
  lotNumber: string;
  expiryDate: string;
  openedDate?: string;
  location: StorageLocation;
  locationStr: string;
  supplier: string;
  manufacturer: string;
  minimumStock: number;
  warningStock: number;
  targetStock: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: string[];
  isExistingChem: boolean;
  isExistingBottle: boolean;
  existingChemId?: string;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  rows: ParsedImportRow[];
}

/**
 * Tạo file Excel mẫu chuẩn: MẪU_NHẬP_HÓA_CHẤT_PHÒNG_LAB.xlsx
 * Gồm 5 sheet theo quy chuẩn Sections 67 - 72
 */
export const downloadStandardLabExcelTemplate = () => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: DANH_MỤC_HÓA_CHẤT
  const chemicalCatalogData = [
    [
      'Mã hóa chất',
      'Tên hóa chất',
      'Tên tiếng Anh',
      'Số CAS',
      'Công thức',
      'Khối lượng phân tử',
      'Cấp độ',
      'Độ tinh khiết',
      'Nhà sản xuất',
      'Mã sản phẩm',
      'Nhóm hóa chất',
      'Đơn vị mặc định',
      'Mức tối thiểu (Min)',
      'Mức cảnh báo (Warning)',
      'Mức mục tiêu (Target)',
      'Điều kiện bảo quản',
      'Phân loại nguy hiểm',
      'Link SDS',
      'Ghi chú',
    ],
    [
      'HC-001',
      'n-Hexan 99%',
      'n-Hexane AR grade',
      '110-54-3',
      'C6H14',
      '86.18',
      'AR',
      '99%',
      'Merck KGaA',
      '1.04374.2500',
      'Solvents',
      'mL',
      '500',
      '850',
      '1500',
      '15-25°C, Tủ chống cháy nổ, thông gió tốt',
      'H225, H304, H315, H336, H361f, H373, H411',
      'https://www.merckmillipore.com/sds/104374',
      'Dung môi chiết xuất phân đoạn chính',
    ],
    [
      'HC-002',
      'Ethanol 96%',
      'Ethanol 96% AR',
      '64-17-5',
      'C2H5OH',
      '46.07',
      'AR',
      '96%',
      'Xilong Scientific',
      '10009218',
      'Solvents',
      'mL',
      '1000',
      '1500',
      '3000',
      '15-25°C, Tránh nguồn nhiệt, đậy kín',
      'H225, H319',
      'https://www.sigmaaldrich.com/sds/ethanol',
      'Dung môi chiết ngấm kiệt & sắc ký',
    ],
    [
      'HC-003',
      'Cloroform 99.5%',
      'Chloroform AR',
      '67-66-3',
      'CHCl3',
      '119.38',
      'AR',
      '99.5%',
      'Merck KGaA',
      '1.02445.2500',
      'Solvents',
      'mL',
      '300',
      '600',
      '1000',
      'Tránh ánh sáng, chai nâu, tủ hút khí độc',
      'H302, H315, H319, H331, H351, H361d, H372',
      'https://www.merckmillipore.com/sds/102445',
      'Chiết xuất alcaloid & kiểm nghiệm',
    ],
    [
      'HC-004',
      'Axit Sunfuric 98%',
      'Sulfuric acid 98%',
      '7664-93-9',
      'H2SO4',
      '98.08',
      'AR',
      '98%',
      'Merck KGaA',
      '1.00731.1000',
      'Acids',
      'mL',
      '250',
      '500',
      '1000',
      'Tủ axit chuyên dụng chịu ăn mòn cao',
      'H314, H290',
      'https://www.merckmillipore.com/sds/100731',
      'Thuốc thử định tính glycosid & tạo dẫn xuất',
    ],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(chemicalCatalogData);
  XLSX.utils.book_append_sheet(wb, ws1, 'DANH_MỤC_HÓA_CHẤT');

  // Sheet 2: DANH_SÁCH_CHAI
  const bottlesData = [
    [
      'Mã chai',
      'Mã hóa chất',
      'Số lượng ban đầu',
      'Đơn vị',
      'Số lô',
      'Ngày hết hạn',
      'Ngày mở nắp',
      'Vị trí',
      'Nhà cung cấp',
      'Ghi chú',
    ],
    [
      'HEX-003',
      'HC-001',
      '500',
      'mL',
      'LOT-2026-003',
      '2028-10-01',
      '2026-10-01',
      'Tòa A - Phòng 302 - Tủ C2 - Kệ 3',
      'Merck KGaA',
      'Chai nhập lô mới bổ sung',
    ],
    [
      'ETH-003',
      'HC-002',
      '1000',
      'mL',
      'LOT-2026-012',
      '2028-06-15',
      '',
      'Tòa A - Phòng 302 - Tủ C1 - Kệ 1',
      'Xilong Scientific',
      'Chai nguyên tem niêm phong',
    ],
    [
      'CHL-002',
      'HC-003',
      '500',
      'mL',
      'LOT-2026-088',
      '2027-12-31',
      '',
      'Tòa A - Phòng 302 - Tủ C3 - Kệ 2',
      'Merck KGaA',
      'Chai nâu chống quang hóa',
    ],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(bottlesData);
  XLSX.utils.book_append_sheet(wb, ws2, 'DANH_SÁCH_CHAI');

  // Sheet 3: NHẬP_KHO_BAN_ĐẦU
  const stockInData = [
    [
      'Mã phiếu',
      'Mã chai',
      'Số lượng nhập',
      'Đơn vị',
      'Ngày nhập',
      'Nhà cung cấp',
      'Giá mua',
      'Tiền tệ',
      'Người nhận',
      'Ghi chú',
    ],
    [
      'NK-2026-001',
      'HEX-003',
      '500',
      'mL',
      '2026-10-01',
      'Công ty TNHH Hóa Chất Đức Giang',
      '380000',
      'VND',
      'Bùi Anh Trà',
      'Phiếu nhập kho bổ sung quý 4',
    ],
    [
      'NK-2026-002',
      'ETH-003',
      '1000',
      'mL',
      '2026-10-01',
      'Công ty Cổ phần Hóa Dược Trung Ương',
      '180000',
      'VND',
      'Bùi Anh Trà',
      'Phiếu nhập kho phục vụ giảng dạy',
    ],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(stockInData);
  XLSX.utils.book_append_sheet(wb, ws3, 'NHẬP_KHO_BAN_ĐẦU');

  // Sheet 4: NHÀ_CUNG_CẤP
  const supplierData = [
    [
      'Mã nhà cung cấp',
      'Tên nhà cung cấp',
      'Người liên hệ',
      'Email',
      'Số điện thoại',
      'Địa chỉ',
      'Website',
      'Ghi chú',
    ],
    [
      'NCC-01',
      'Merck KGaA Vietnam',
      'Nguyễn Thanh Tùng',
      'tung.nguyen@merck.com',
      '028-3829-1122',
      'Tầng 12, Bitexco, Q.1, TP.HCM',
      'https://www.merckmillipore.com',
      'Hóa chất chuẩn phân tích độ tinh khiết cao',
    ],
    [
      'NCC-02',
      'Xilong Scientific Vietnam',
      'Lê Thị Hương',
      'contact@xilong.vn',
      '024-3987-6543',
      'Hà Nội',
      'http://xilong.com',
      'Dung môi kỹ thuật và tinh khiết AR',
    ],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(supplierData);
  XLSX.utils.book_append_sheet(wb, ws4, 'NHÀ_CUNG_CẤP');

  // Sheet 5: VỊ_TRÍ_LƯU_TRỮ
  const locationData = [
    ['Mã vị trí', 'Tòa nhà', 'Phòng', 'Tủ', 'Kệ', 'Mô tả'],
    ['LOC-01', 'Building A', 'Room 302', 'Cabinet C1', 'Shelf 1', 'Tủ lưu trữ dung môi phân cực'],
    ['LOC-02', 'Building A', 'Room 302', 'Cabinet C2', 'Shelf 3', 'Tủ chống cháy nổ lưu n-Hexan, Ete'],
    ['LOC-03', 'Building A', 'Room 302', 'Cabinet C3', 'Shelf 2', 'Tủ dung môi clo hóa Cloroform, DCM'],
    ['LOC-04', 'Building A', 'Room 302', 'Cabinet C5', 'Shelf 1', 'Tủ axit vô cơ đặc chịu ăn mòn'],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(locationData);
  XLSX.utils.book_append_sheet(wb, ws5, 'VỊ_TRÍ_LƯU_TRỮ');

  XLSX.writeFile(wb, 'MAU_NHAP_HOA_CHAT_PHONG_LAB.xlsx');
};

/**
 * Parse & Validate uploaded Excel / CSV file
 */
export const parseAndValidateExcel = async (
  file: File,
  existingChemicals: Chemical[],
  existingBottles: Bottle[]
): Promise<ValidationSummary> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Map existing by CAS and Code for rapid duplicate check (Section 75)
  const chemByCas = new Map<string, Chemical>();
  const chemByCode = new Map<string, Chemical>();
  existingChemicals.forEach((c) => {
    if (c.casNumber) chemByCas.set(c.casNumber.trim().toLowerCase(), c);
    if (c.code) chemByCode.set(c.code.trim().toUpperCase(), c);
  });

  const existingBottleCodes = new Set(existingBottles.map((b) => b.bottleCode.trim().toUpperCase()));

  const sheetNames = wb.SheetNames;
  let catalogRows: any[] = [];
  let bottleRows: any[] = [];

  // Find sheet by name or fallback to first sheet
  const catalogSheetName = sheetNames.find((s) => s.toUpperCase().includes('DANH_MUC') || s.toUpperCase().includes('HOA_CHAT') || s.toUpperCase().includes('CATALOG'));
  const bottleSheetName = sheetNames.find((s) => s.toUpperCase().includes('CHAI') || s.toUpperCase().includes('BOTTLE'));

  if (catalogSheetName) {
    catalogRows = XLSX.utils.sheet_to_json(wb.Sheets[catalogSheetName]);
  } else if (sheetNames.length > 0) {
    catalogRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetNames[0]]);
  }

  if (bottleSheetName) {
    bottleRows = XLSX.utils.sheet_to_json(wb.Sheets[bottleSheetName]);
  }

  const parsedRows: ParsedImportRow[] = [];
  const validUnits: ChemicalUnit[] = ['mL', 'L', 'µL', 'g', 'kg', 'mg', 'µg', 'bottle', 'vial', 'tube'];

  // Helper to extract location
  const parseLocation = (locStr: string): StorageLocation => {
    if (!locStr) {
      return { building: 'Building A', room: 'Room 302', cabinet: 'Cabinet C1', shelf: 'Shelf 1' };
    }
    const parts = locStr.split(/[-–/]/).map((p) => p.trim());
    return {
      building: parts[0] || 'Building A',
      room: parts[1] || 'Room 302',
      cabinet: parts[2] || 'Cabinet C1',
      shelf: parts[3] || 'Shelf 1',
    };
  };

  // If we have separate bottle rows, join them; otherwise process catalog rows directly
  if (bottleRows.length > 0) {
    // Process bottle rows linked to catalog rows
    bottleRows.forEach((bRow: any, idx: number) => {
      const rowNum = idx + 2;
      const issues: string[] = [];
      let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';

      const chemCode = String(bRow['Mã hóa chất'] || bRow['Chemical Code'] || bRow['Ma hoa chat'] || '').trim();
      const bottleCode = String(bRow['Mã chai'] || bRow['Bottle Code'] || bRow['Ma chai'] || '').trim();
      const rawQty = bRow['Số lượng ban đầu'] ?? bRow['Số lượng'] ?? bRow['Quantity'] ?? bRow['So luong'];
      const unit = String(bRow['Đơn vị'] || bRow['Unit'] || bRow['Don vi'] || 'mL').trim() as ChemicalUnit;
      const lotNumber = String(bRow['Số lô'] || bRow['Lot'] || bRow['So lo'] || '').trim();
      const rawExpiry = String(bRow['Ngày hết hạn'] || bRow['Expiry Date'] || bRow['Hạn dùng'] || bRow['Han dung'] || '').trim();
      const locStr = String(bRow['Vị trí'] || bRow['Location'] || bRow['Vi tri'] || 'Building A - Room 302 - Cabinet C1 - Shelf 1').trim();
      const supplier = String(bRow['Nhà cung cấp'] || bRow['Supplier'] || '').trim();

      // Find matching chemical in catalog sheet or existing DB
      const matchedCatalog = catalogRows.find(
        (c: any) =>
          String(c['Mã hóa chất'] || c['Mã'] || '').trim().toUpperCase() === chemCode.toUpperCase() ||
          String(c['Tên hóa chất'] || c['Tên'] || '').trim().toLowerCase() === chemCode.toLowerCase()
      );

      const existingChem = chemByCode.get(chemCode.toUpperCase());
      const chemName = matchedCatalog
        ? String(matchedCatalog['Tên hóa chất'] || matchedCatalog['Tên'] || chemCode).trim()
        : existingChem
        ? existingChem.name
        : chemCode;

      // Section 74: Validate rules
      if (!chemName) {
        issues.push('LỖI: Thiếu tên hóa chất.');
        status = 'ERROR';
      }

      if (!bottleCode) {
        issues.push('LỖI: Thiếu mã chai.');
        status = 'ERROR';
      } else if (existingBottleCodes.has(bottleCode.toUpperCase())) {
        // Section 75: Duplicate bottle code
        issues.push(`CẢNH BÁO: Mã chai "${bottleCode}" đã tồn tại trong hệ thống (Mặc định: Bỏ qua).`);
        if (status !== 'ERROR') status = 'WARNING';
      }

      const qty = parseFloat(rawQty);
      if (isNaN(qty) || qty <= 0) {
        issues.push('LỖI: Số lượng ban đầu phải là số dương lớn hơn 0.');
        status = 'ERROR';
      }

      if (!validUnits.includes(unit)) {
        issues.push(`LỖI: Đơn vị "${unit}" không hợp lệ. Cho phép: mL, L, g, kg, mg.`);
        status = 'ERROR';
      }

      if (!lotNumber) {
        issues.push('CẢNH BÁO: Thiếu số lô (Lot Number).');
        if (status !== 'ERROR') status = 'WARNING';
      }

      // Check Expiry Date
      let cleanExpiry = rawExpiry;
      if (!cleanExpiry) {
        cleanExpiry = '2028-10-01';
        issues.push('CẢNH BÁO: Thiếu ngày hết hạn. Tự động gán 2028-10-01.');
        if (status !== 'ERROR') status = 'WARNING';
      } else {
        const expDate = new Date(cleanExpiry);
        if (!isNaN(expDate.getTime()) && expDate < new Date('2026-10-01')) {
          issues.push('CẢNH BÁO: Ngày hết hạn đã qua so với ngày tham chiếu hiện tại (2026-10-01).');
          if (status !== 'ERROR') status = 'WARNING';
        }
      }

      const cas = matchedCatalog ? String(matchedCatalog['Số CAS'] || matchedCatalog['CAS'] || '').trim() : existingChem?.casNumber || '';
      if (!cas) {
        issues.push('CẢNH BÁO: Thiếu số CAS.');
        if (status !== 'ERROR') status = 'WARNING';
      }

      const isExistingChem = existingChem !== undefined || (cas && chemByCas.has(cas.toLowerCase()));

      parsedRows.push({
        rowNumber: rowNum,
        chemicalName: chemName,
        chemicalCode: chemCode || (matchedCatalog ? String(matchedCatalog['Mã hóa chất'] || '') : 'HC-NEW'),
        englishName: matchedCatalog ? String(matchedCatalog['Tên tiếng Anh'] || '') : chemName,
        casNumber: cas,
        formula: matchedCatalog ? String(matchedCatalog['Công thức'] || '') : '',
        molecularWeight: matchedCatalog ? parseFloat(matchedCatalog['Khối lượng phân tử']) : undefined,
        grade: matchedCatalog ? String(matchedCatalog['Cấp độ'] || 'AR') : 'AR',
        category: matchedCatalog ? String(matchedCatalog['Nhóm hóa chất'] || 'Solvents') : 'Solvents',
        unit,
        bottleCode,
        quantity: isNaN(qty) ? 0 : qty,
        lotNumber: lotNumber || `LOT-${Date.now().toString(36)}`,
        expiryDate: cleanExpiry,
        location: parseLocation(locStr),
        locationStr: locStr,
        supplier: supplier || (matchedCatalog ? String(matchedCatalog['Nhà sản xuất'] || '') : 'Merck KGaA'),
        manufacturer: matchedCatalog ? String(matchedCatalog['Nhà sản xuất'] || 'Merck KGaA') : 'Merck KGaA',
        minimumStock: matchedCatalog ? parseFloat(matchedCatalog['Mức tối thiểu (Min)']) || 500 : 500,
        warningStock: matchedCatalog ? parseFloat(matchedCatalog['Mức cảnh báo (Warning)']) || 850 : 850,
        targetStock: matchedCatalog ? parseFloat(matchedCatalog['Mức mục tiêu (Target)']) || 1500 : 1500,
        status,
        issues,
        isExistingChem: Boolean(isExistingChem),
        isExistingBottle: existingBottleCodes.has(bottleCode.toUpperCase()),
        existingChemId: existingChem?.id || (cas ? chemByCas.get(cas.toLowerCase())?.id : undefined),
      });
    });
  } else {
    // Single sheet import (Catalog rows with initial stock)
    catalogRows.forEach((cRow: any, idx: number) => {
      const rowNum = idx + 2;
      const issues: string[] = [];
      let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';

      const chemName = String(cRow['Tên hóa chất'] || cRow['Tên'] || cRow['Name'] || cRow['Chemical Name'] || '').trim();
      const chemCode = String(cRow['Mã hóa chất'] || cRow['Mã'] || cRow['Code'] || '').trim();
      const cas = String(cRow['Số CAS'] || cRow['CAS'] || cRow['Cas Number'] || '').trim();
      const unit = String(cRow['Đơn vị mặc định'] || cRow['Đơn vị'] || cRow['Unit'] || 'mL').trim() as ChemicalUnit;
      const rawQty = cRow['Số lượng ban đầu'] ?? cRow['Số lượng'] ?? cRow['Tồn'] ?? 500;
      const bottleCode = String(cRow['Mã chai'] || `${chemCode ? chemCode.split('-')[0] : 'BOT'}-001`).trim();
      const locStr = String(cRow['Vị trí'] || cRow['Điều kiện bảo quản'] || 'Building A - Room 302 - Cabinet C1 - Shelf 1').trim();

      if (!chemName) {
        issues.push('LỖI: Thiếu tên hóa chất.');
        status = 'ERROR';
      }

      if (!cas) {
        issues.push('CẢNH BÁO: Thiếu số CAS.');
        if (status !== 'ERROR') status = 'WARNING';
      }

      const qty = parseFloat(rawQty);
      if (isNaN(qty) || qty <= 0) {
        issues.push('LỖI: Số lượng ban đầu phải lớn hơn 0.');
        status = 'ERROR';
      }

      if (!validUnits.includes(unit)) {
        issues.push(`LỖI: Đơn vị "${unit}" không hợp lệ.`);
        status = 'ERROR';
      }

      const isExistingChem = (cas && chemByCas.has(cas.toLowerCase())) || (chemCode && chemByCode.has(chemCode.toUpperCase()));
      const isExistingBottle = existingBottleCodes.has(bottleCode.toUpperCase());

      if (isExistingBottle) {
        issues.push(`CẢNH BÁO: Mã chai "${bottleCode}" đã tồn tại.`);
        if (status !== 'ERROR') status = 'WARNING';
      }

      parsedRows.push({
        rowNumber: rowNum,
        chemicalName: chemName,
        chemicalCode: chemCode || `HC-${String(idx + 1).padStart(3, '0')}`,
        englishName: String(cRow['Tên tiếng Anh'] || chemName).trim(),
        casNumber: cas,
        formula: String(cRow['Công thức'] || '').trim(),
        molecularWeight: parseFloat(cRow['Khối lượng phân tử']) || undefined,
        grade: String(cRow['Cấp độ'] || 'AR').trim(),
        category: String(cRow['Nhóm hóa chất'] || 'Solvents').trim(),
        unit,
        bottleCode,
        quantity: isNaN(qty) ? 500 : qty,
        lotNumber: String(cRow['Số lô'] || `LOT-${new Date().getFullYear()}-${idx + 1}`).trim(),
        expiryDate: String(cRow['Ngày hết hạn'] || '2028-10-01').trim(),
        location: parseLocation(locStr),
        locationStr: locStr,
        supplier: String(cRow['Nhà sản xuất'] || 'Merck KGaA').trim(),
        manufacturer: String(cRow['Nhà sản xuất'] || 'Merck KGaA').trim(),
        minimumStock: parseFloat(cRow['Mức tối thiểu (Min)']) || 500,
        warningStock: parseFloat(cRow['Mức cảnh báo (Warning)']) || 850,
        targetStock: parseFloat(cRow['Mức mục tiêu (Target)']) || 1500,
        status,
        issues,
        isExistingChem: Boolean(isExistingChem),
        isExistingBottle,
        existingChemId: (cas && chemByCas.get(cas.toLowerCase())?.id) || (chemCode && chemByCode.get(chemCode.toUpperCase())?.id),
      });
    });
  }

  const validRows = parsedRows.filter((r) => r.status === 'VALID').length;
  const warningRows = parsedRows.filter((r) => r.status === 'WARNING').length;
  const errorRows = parsedRows.filter((r) => r.status === 'ERROR').length;

  return {
    totalRows: parsedRows.length,
    validRows,
    warningRows,
    errorRows,
    rows: parsedRows,
  };
};

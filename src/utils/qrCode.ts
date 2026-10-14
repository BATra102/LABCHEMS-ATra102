import QRCode from 'qrcode';
import { Bottle, Chemical, ChemicalUnit } from '../types';

/**
 * Standard prefix for LabChem Bottle and Chemical QR Codes
 */
export const QR_PREFIX = 'LABCHEM:BOTTLE';
export const QR_BOTTLE_PREFIX = 'LABCHEM:BOTTLE';
export const QR_CHEMICAL_PREFIX = 'LABCHEM:CHEMICAL';

/**
 * Generates unique QR ID for a bottle (e.g. "LAB-HX-001")
 */
export function getBottleQrId(bottleCode: string): string {
  const clean = (bottleCode || '').trim().toUpperCase();
  if (!clean) return 'LAB-BOTTLE';
  if (clean.startsWith('LAB-')) return clean;
  return `LAB-${clean}`;
}

/**
 * Generates unique QR ID for a chemical (e.g. "LAB-CHEM-HEX-01")
 */
export function getChemicalQrId(chemicalCodeOrId: string): string {
  const clean = (chemicalCodeOrId || '').trim().toUpperCase();
  if (!clean) return 'LAB-CHEM';
  if (clean.startsWith('LAB-CHEM-')) return clean;
  return `LAB-CHEM-${clean}`;
}

/**
 * Generates secure QR Code Payload encoded in the physical QR sticker.
 * Does NOT include mutable quantities or sensitive data.
 * Format: "LABCHEM:BOTTLE:HX-001" or URL deep link.
 */
export function getBottleQrPayload(bottle: Bottle): string {
  const cleanCode = (bottle.bottleCode || bottle.id || '').trim().toUpperCase();
  return `${QR_BOTTLE_PREFIX}:${cleanCode}`;
}

/**
 * Generates secure QR Code Payload for master chemical category.
 * Format: "LABCHEM:CHEMICAL:HEX-01"
 */
export function getChemicalQrPayload(chem: Chemical): string {
  const cleanCode = (chem.code || chem.id || chem.name).trim().toUpperCase();
  return `${QR_CHEMICAL_PREFIX}:${cleanCode}`;
}

export type ParsedQrType = 'BOTTLE' | 'CHEMICAL' | 'UNKNOWN';

export interface ParsedQrResult {
  type: ParsedQrType;
  identifier: string; // The extracted code, e.g. "HX-001" or "HEX-01" or CAS
  matchedQrId: string;
  rawText: string;
  name?: string;
  casNumber?: string;
  lotNumber?: string;
  volume?: number;
  unit?: ChemicalUnit;
  expiryDate?: string;
  manufacturer?: string;
  catalogNumber?: string;
  storageLocation?: {
    building?: string;
    room?: string;
    cabinet?: string;
    shelf?: string;
  };
  notes?: string;
}

/**
 * Deep parser for scanned QR text from camera, barcode scanner, image upload or manual input.
 * Handles:
 * 1. "LABCHEM:BOTTLE:HX-001" -> type: BOTTLE, id: "HX-001"
 * 2. "LABCHEM:CHEMICAL:HEXANE" -> type: CHEMICAL, id: "HEXANE"
 * 3. Structured JSON: {"name":"Ethanol", "code":"ETH-001", "lot":"LOT2026", "volume":500, "unit":"mL", "cas":"64-17-5", ...}
 * 4. URLs with query params: ?bottle=HX-001, ?chemical=HEX-01, ?code=..., ?cas=...
 * 5. Direct prefix codes: "LAB-HX-001", "HX-001", CAS numbers (e.g. 64-17-5)
 * 6. Supermarket 1D Barcodes: EAN-13, Code 128, UPC, Code 39
 */
export function parseScannedQrDetails(rawInput: string): ParsedQrResult {
  const text = (rawInput || '').trim();
  if (!text) {
    return { type: 'UNKNOWN', identifier: '', matchedQrId: '', rawText: text };
  }

  // 1. JSON parsing (High-density smart laboratory QR codes)
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);

      const name = parsed.name || parsed.ten || parsed.chemicalName || parsed.ten_hoa_chat;
      const casNumber = parsed.cas || parsed.casNumber || parsed.so_cas;
      const lotNumber = parsed.lot || parsed.lotNumber || parsed.so_lo || parsed.batch;
      const volume = parsed.volume || parsed.quantity || parsed.dung_tich || parsed.so_luong
        ? parseFloat(parsed.volume || parsed.quantity || parsed.dung_tich || parsed.so_luong)
        : undefined;
      const unit = (parsed.unit || parsed.don_vi || 'mL') as ChemicalUnit;
      const expiryDate = parsed.expiry || parsed.expiryDate || parsed.hsd || parsed.han_dung;
      const manufacturer = parsed.manufacturer || parsed.nha_san_xuat || parsed.brand;
      const catalogNumber = parsed.catalogNumber || parsed.catNo || parsed.ma_cat;

      if (parsed.bottleCode || parsed.bottleId || parsed.ma_chai) {
        const id = String(parsed.bottleCode || parsed.bottleId || parsed.ma_chai).trim().toUpperCase();
        return {
          type: 'BOTTLE',
          identifier: id,
          matchedQrId: getBottleQrId(id),
          rawText: text,
          name,
          casNumber,
          lotNumber,
          volume,
          unit,
          expiryDate,
          manufacturer,
          catalogNumber,
          notes: parsed.notes || parsed.ghi_chu,
        };
      }

      if (parsed.chemicalCode || parsed.chemicalId || parsed.code || parsed.ma_hoa_chat) {
        const id = String(parsed.chemicalCode || parsed.chemicalId || parsed.code || parsed.ma_hoa_chat).trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: id,
          matchedQrId: getChemicalQrId(id),
          rawText: text,
          name,
          casNumber,
          lotNumber,
          volume,
          unit,
          expiryDate,
          manufacturer,
          catalogNumber,
          notes: parsed.notes || parsed.ghi_chu,
        };
      }

      // If only name or CAS is present in JSON
      if (name || casNumber) {
        const id = (name || casNumber).trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: id,
          matchedQrId: getChemicalQrId(id),
          rawText: text,
          name,
          casNumber,
          lotNumber,
          volume,
          unit,
          expiryDate,
          manufacturer,
          catalogNumber,
        };
      }
    } catch {
      // not valid json, proceed to prefixes
    }
  }

  // 2. Check standard prefix LABCHEM:CHEMICAL:XXXX
  if (text.toUpperCase().startsWith(`${QR_CHEMICAL_PREFIX}:`)) {
    const chemCode = text.substring(QR_CHEMICAL_PREFIX.length + 1).trim().toUpperCase();
    return {
      type: 'CHEMICAL',
      identifier: chemCode,
      matchedQrId: getChemicalQrId(chemCode),
      rawText: text,
    };
  }

  // 3. Check standard prefix LABCHEM:BOTTLE:XXXX
  if (text.toUpperCase().startsWith(`${QR_BOTTLE_PREFIX}:`)) {
    const bottleCode = text.substring(QR_BOTTLE_PREFIX.length + 1).trim().toUpperCase();
    return {
      type: 'BOTTLE',
      identifier: bottleCode,
      matchedQrId: getBottleQrId(bottleCode),
      rawText: text,
    };
  }

  // 4. URL query parameters (e.g. deep link or web app URL)
  if (text.includes('bottle=') || text.includes('chemical=') || text.includes('code=') || text.includes('qr=')) {
    try {
      const url = new URL(text);
      const bParam = url.searchParams.get('bottle');
      if (bParam) {
        const clean = bParam.trim().toUpperCase();
        return {
          type: 'BOTTLE',
          identifier: clean,
          matchedQrId: getBottleQrId(clean),
          rawText: text,
          lotNumber: url.searchParams.get('lot') || undefined,
          expiryDate: url.searchParams.get('exp') || undefined,
        };
      }
      const cParam = url.searchParams.get('chemical') || url.searchParams.get('code') || url.searchParams.get('qr');
      if (cParam) {
        const clean = cParam.trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: clean,
          matchedQrId: getChemicalQrId(clean),
          rawText: text,
          casNumber: url.searchParams.get('cas') || undefined,
        };
      }
    } catch {
      // regex fallback for partial URLs
      const bMatch = text.match(/bottle=([^&]+)/i);
      if (bMatch && bMatch[1]) {
        const clean = decodeURIComponent(bMatch[1]).trim().toUpperCase();
        return {
          type: 'BOTTLE',
          identifier: clean,
          matchedQrId: getBottleQrId(clean),
          rawText: text,
        };
      }
      const cMatch = text.match(/(?:chemical|code|qr)=([^&]+)/i);
      if (cMatch && cMatch[1]) {
        const clean = decodeURIComponent(cMatch[1]).trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: clean,
          matchedQrId: getChemicalQrId(clean),
          rawText: text,
        };
      }
    }
  }

  // 5. Short prefixes: BOTTLE:XXXX or CHEM:XXXX
  if (/^BOTTLE:/i.test(text)) {
    const clean = text.replace(/^BOTTLE:/i, '').trim().toUpperCase();
    return {
      type: 'BOTTLE',
      identifier: clean,
      matchedQrId: getBottleQrId(clean),
      rawText: text,
    };
  }

  if (/^(CHEM|CHEMICAL):/i.test(text)) {
    const clean = text.replace(/^(CHEM|CHEMICAL):/i, '').trim().toUpperCase();
    return {
      type: 'CHEMICAL',
      identifier: clean,
      matchedQrId: getChemicalQrId(clean),
      rawText: text,
    };
  }

  // 6. Prefixes LAB-CHEM- or LAB-
  if (text.toUpperCase().startsWith('LAB-CHEM-')) {
    const clean = text.substring(9).trim().toUpperCase();
    return {
      type: 'CHEMICAL',
      identifier: clean,
      matchedQrId: text.toUpperCase(),
      rawText: text,
    };
  }

  if (text.toUpperCase().startsWith('LAB-')) {
    const clean = text.substring(4).trim().toUpperCase();
    return {
      type: 'BOTTLE',
      identifier: clean,
      matchedQrId: text.toUpperCase(),
      rawText: text,
    };
  }

  // 7. Check if text looks like a CAS Number (e.g. 64-17-5 or 67-64-1)
  if (/^\d{2,7}-\d{2}-\d$/.test(text)) {
    return {
      type: 'CHEMICAL',
      identifier: text,
      casNumber: text,
      matchedQrId: getChemicalQrId(text),
      rawText: text,
    };
  }

  // 8. Generic code (alphanumeric, barcode or catalog number)
  const clean = text.trim();
  return {
    type: 'UNKNOWN',
    identifier: clean,
    matchedQrId: getBottleQrId(clean),
    rawText: text,
  };
}

/**
 * Parses scanned QR text from camera or manual input.
 */
export function parseScannedQrText(rawInput: string): {
  normalizedCode: string;
  matchedQrId: string;
} {
  const details = parseScannedQrDetails(rawInput);
  return {
    normalizedCode: details.identifier,
    matchedQrId: details.matchedQrId,
  };
}

/**
 * Generates crisp base64 Data URL for rendering and printing
 */
export async function generateQrDataUrl(
  text: string,
  width = 300,
  margin = 1
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR Data URL:', err);
    return '';
  }
}

/**
 * Generates vector SVG string for ultra-crisp printing
 */
export async function generateQrSvg(
  text: string,
  width = 256,
  margin = 1
): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      width,
      margin,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR SVG:', err);
    return '';
  }
}

import QRCode from 'qrcode';
import { Bottle, Chemical } from '../types';

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
  const clean = bottleCode.trim().toUpperCase();
  if (clean.startsWith('LAB-')) return clean;
  return `LAB-${clean}`;
}

/**
 * Generates unique QR ID for a chemical (e.g. "LAB-CHEM-HEX-01")
 */
export function getChemicalQrId(chemicalCodeOrId: string): string {
  const clean = chemicalCodeOrId.trim().toUpperCase();
  if (clean.startsWith('LAB-CHEM-')) return clean;
  return `LAB-CHEM-${clean}`;
}

/**
 * Generates secure QR Code Payload encoded in the physical QR sticker.
 * Does NOT include mutable quantities or sensitive data.
 * Format: "LABCHEM:BOTTLE:HX-001" or URL deep link.
 */
export function getBottleQrPayload(bottle: Bottle): string {
  const cleanCode = bottle.bottleCode.trim().toUpperCase();
  return `${QR_BOTTLE_PREFIX}:${cleanCode}`;
}

/**
 * Generates secure QR Code Payload for master chemical category.
 * Format: "LABCHEM:CHEMICAL:HEX-01"
 */
export function getChemicalQrPayload(chem: Chemical): string {
  const cleanCode = (chem.code || chem.id).trim().toUpperCase();
  return `${QR_CHEMICAL_PREFIX}:${cleanCode}`;
}

export type ParsedQrType = 'BOTTLE' | 'CHEMICAL' | 'UNKNOWN';

export interface ParsedQrResult {
  type: ParsedQrType;
  identifier: string; // The extracted code, e.g. "HX-001" or "HEX-01" or CAS
  matchedQrId: string;
  rawText: string;
}

/**
 * Deep parser for scanned QR text from camera, barcode scanner, or manual input.
 * Handles:
 * 1. "LABCHEM:BOTTLE:HX-001" -> type: BOTTLE, id: "HX-001"
 * 2. "LABCHEM:CHEMICAL:HEXANE" -> type: CHEMICAL, id: "HEXANE"
 * 3. JSON e.g. {"bottleCode": "HX-001"} or {"chemicalCode": "HEX-01"}
 * 4. URLs with ?bottle=HX-001 or ?chemical=HEX-01
 * 5. Direct codes: "LAB-HX-001", "HX-001", CAS numbers, etc.
 */
export function parseScannedQrDetails(rawInput: string): ParsedQrResult {
  const text = rawInput.trim();
  if (!text) {
    return { type: 'UNKNOWN', identifier: '', matchedQrId: '', rawText: text };
  }

  // 1. JSON parsing
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.bottleCode || parsed.bottleId) {
        const id = String(parsed.bottleCode || parsed.bottleId).trim().toUpperCase();
        return {
          type: 'BOTTLE',
          identifier: id,
          matchedQrId: getBottleQrId(id),
          rawText: text,
        };
      }
      if (parsed.chemicalCode || parsed.chemicalId || parsed.chemical) {
        const id = String(parsed.chemicalCode || parsed.chemicalId || parsed.chemical).trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: id,
          matchedQrId: getChemicalQrId(id),
          rawText: text,
        };
      }
    } catch {
      // not valid json, proceed to prefixes
    }
  }

  // 2. Check LABCHEM:CHEMICAL:XXXX
  if (text.toUpperCase().startsWith(`${QR_CHEMICAL_PREFIX}:`)) {
    const chemCode = text.substring(QR_CHEMICAL_PREFIX.length + 1).trim().toUpperCase();
    return {
      type: 'CHEMICAL',
      identifier: chemCode,
      matchedQrId: getChemicalQrId(chemCode),
      rawText: text,
    };
  }

  // 3. Check LABCHEM:BOTTLE:XXXX
  if (text.toUpperCase().startsWith(`${QR_BOTTLE_PREFIX}:`)) {
    const bottleCode = text.substring(QR_BOTTLE_PREFIX.length + 1).trim().toUpperCase();
    return {
      type: 'BOTTLE',
      identifier: bottleCode,
      matchedQrId: getBottleQrId(bottleCode),
      rawText: text,
    };
  }

  // 4. URL query parameters
  if (text.includes('bottle=') || text.includes('chemical=')) {
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
        };
      }
      const cParam = url.searchParams.get('chemical');
      if (cParam) {
        const clean = cParam.trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: clean,
          matchedQrId: getChemicalQrId(clean),
          rawText: text,
        };
      }
    } catch {
      // regex fallback for partial URLs
      const bMatch = text.match(/bottle=([^&]+)/i);
      if (bMatch && bMatch[1]) {
        const clean = bMatch[1].trim().toUpperCase();
        return {
          type: 'BOTTLE',
          identifier: clean,
          matchedQrId: getBottleQrId(clean),
          rawText: text,
        };
      }
      const cMatch = text.match(/chemical=([^&]+)/i);
      if (cMatch && cMatch[1]) {
        const clean = cMatch[1].trim().toUpperCase();
        return {
          type: 'CHEMICAL',
          identifier: clean,
          matchedQrId: getChemicalQrId(clean),
          rawText: text,
        };
      }
    }
  }

  // 5. Prefixes LAB-CHEM- or LAB-
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

  // 6. Generic code
  const clean = text.trim().toUpperCase();
  return {
    type: 'UNKNOWN',
    identifier: clean,
    matchedQrId: getBottleQrId(clean),
    rawText: text,
  };
}

/**
 * Parses scanned QR text from camera or manual input.
 * Handles:
 * 1. "LABCHEM:BOTTLE:HX-001"
 * 2. "https://domain.com/?bottle=HX-001"
 * 3. "LAB-HX-001"
 * 4. "HX-001"
 */
export function parseScannedQrText(rawInput: string): {
  normalizedCode: string;
  matchedQrId: string;
} {
  const text = rawInput.trim();
  let code = text;

  // 1. Check LABCHEM:BOTTLE:XXXX
  if (text.toUpperCase().startsWith(`${QR_PREFIX}:`)) {
    code = text.substring(QR_PREFIX.length + 1).trim();
  }
  // 2. Check URL with query param ?bottle=XXXX
  else if (text.includes('bottle=')) {
    try {
      const url = new URL(text);
      const param = url.searchParams.get('bottle');
      if (param) code = param.trim();
    } catch {
      // Not a valid URL, search directly for bottle=
      const match = text.match(/bottle=([^&]+)/i);
      if (match && match[1]) code = match[1].trim();
    }
  }
  // 3. Check LAB-XXXX
  else if (text.toUpperCase().startsWith('LAB-')) {
    code = text.substring(4).trim();
  }

  const cleanCode = code.toUpperCase();
  return {
    normalizedCode: cleanCode,
    matchedQrId: `LAB-${cleanCode}`,
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

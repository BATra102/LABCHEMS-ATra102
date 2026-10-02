import { ChemicalUnit } from '../types';

// Conversion factors to base unit (mL for volume, g for mass)
const VOLUME_FACTORS_TO_ML: Record<string, number> = {
  'µL': 0.001,
  'mL': 1,
  'L': 1000,
};

const MASS_FACTORS_TO_G: Record<string, number> = {
  'µg': 0.000001,
  'mg': 0.001,
  'g': 1,
  'kg': 1000,
};

export function isVolumeUnit(unit: string): boolean {
  return unit in VOLUME_FACTORS_TO_ML;
}

export function isMassUnit(unit: string): boolean {
  return unit in MASS_FACTORS_TO_G;
}

export function isCountUnit(unit: string): boolean {
  return ['bottle', 'vial', 'tube'].includes(unit);
}

/**
 * Checks if two units can be added/subtracted directly.
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (unitA === unitB) return true;
  if (isVolumeUnit(unitA) && isVolumeUnit(unitB)) return true;
  if (isMassUnit(unitA) && isMassUnit(unitB)) return true;
  return false;
}

/**
 * Converts a value from sourceUnit to targetUnit.
 * Returns null if incompatible.
 */
export function convertUnit(
  value: number,
  sourceUnit: ChemicalUnit,
  targetUnit: ChemicalUnit
): number | null {
  if (sourceUnit === targetUnit) return value;

  // Volume conversions
  if (isVolumeUnit(sourceUnit) && isVolumeUnit(targetUnit)) {
    const mlValue = value * VOLUME_FACTORS_TO_ML[sourceUnit];
    return mlValue / VOLUME_FACTORS_TO_ML[targetUnit];
  }

  // Mass conversions
  if (isMassUnit(sourceUnit) && isMassUnit(targetUnit)) {
    const gValue = value * MASS_FACTORS_TO_G[sourceUnit];
    return gValue / MASS_FACTORS_TO_G[targetUnit];
  }

  return null;
}

/**
 * Formats quantity and unit cleanly with tabular numbers
 */
export function formatQuantity(value: number, unit: ChemicalUnit): string {
  // Clean floating point errors
  const cleanVal = Math.round(value * 10000) / 10000;
  return `${cleanVal.toLocaleString('vi-VN')} ${unit}`;
}

export const COMMON_UNITS: ChemicalUnit[] = [
  'mL',
  'L',
  'µL',
  'g',
  'kg',
  'mg',
  'µg',
  'bottle',
  'vial',
  'tube',
];

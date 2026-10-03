import { useMemo } from 'react';
import { useLabContext } from '../context/LabContext';
import { Chemical, Bottle } from '../types';

export const useChemicals = () => {
  const {
    chemicals,
    bottles,
    addChemical,
    updateChemical,
    deleteChemical,
    restoreChemical,
    isSyncing,
    refreshFromSupabase,
  } = useLabContext();

  const activeChemicals = useMemo(
    () => chemicals.filter((c: Chemical) => c.status === 'ACTIVE' || !c.status),
    [chemicals]
  );

  const archivedChemicals = useMemo(
    () => chemicals.filter((c: Chemical) => c.status === 'ARCHIVED'),
    [chemicals]
  );

  const disposedChemicals = useMemo(
    () => chemicals.filter((c: Chemical) => c.status === 'DISPOSED'),
    [chemicals]
  );

  // Helper to calculate total volume of a chemical across active bottles
  const getChemicalCurrentStock = (chemicalId: string): number => {
    return bottles
      .filter((b: Bottle) => b.chemicalId === chemicalId && b.status !== 'DISPOSED' && b.status !== 'EMPTY')
      .reduce((sum: number, b: Bottle) => sum + b.currentVolume, 0);
  };

  // Helper to calculate status of a chemical (CRITICAL, LOW, NORMAL)
  const getStockStatus = (chemical: Chemical): 'CRITICAL' | 'WARNING' | 'NORMAL' => {
    const current = getChemicalCurrentStock(chemical.id);
    const min = chemical.minimumStock || 0;
    const warn = chemical.warningStock || min * 1.5;

    if (current <= min) return 'CRITICAL';
    if (current <= warn) return 'WARNING';
    return 'NORMAL';
  };

  return {
    chemicals,
    activeChemicals,
    archivedChemicals,
    disposedChemicals,
    getChemicalCurrentStock,
    getStockStatus,
    addChemical,
    updateChemical,
    deleteChemical,
    restoreChemical,
    isSyncing,
    refreshFromSupabase,
  };
};

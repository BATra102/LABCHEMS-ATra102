import { useMemo } from 'react';
import { useLabContext } from '../context/LabContext';
import { Bottle } from '../types';
import { locationRequestService } from '../services/locationRequestService';

export const useBottles = () => {
  const {
    bottles,
    recordUsage,
    stockIn,
    updateBottle,
    disposeBottle,
    deleteBottle,
    restoreBottle,
    stockAdjustment,
    isSyncing,
    refreshFromSupabase,
    currentUser,
  } = useLabContext();

  const activeBottles = useMemo(
    () => bottles.filter((b: Bottle) => b.status !== 'DISPOSED' && b.status !== 'EMPTY'),
    [bottles]
  );

  const openBottles = useMemo(
    () => bottles.filter((b: Bottle) => b.status === 'IN_USE'),
    [bottles]
  );

  const expiredBottles = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return bottles.filter(
      (b: Bottle) => b.status !== 'DISPOSED' && b.expiryDate && b.expiryDate < today
    );
  }, [bottles]);

  const expiringWithin90DaysBottles = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 90);
    const targetStr = targetDate.toISOString().split('T')[0];

    return bottles.filter(
      (b: Bottle) =>
        b.status !== 'DISPOSED' &&
        b.expiryDate &&
        b.expiryDate >= todayStr &&
        b.expiryDate <= targetStr
    );
  }, [bottles]);

  const getBottlesByChemical = (chemicalId: string): Bottle[] => {
    return bottles.filter((b: Bottle) => b.chemicalId === chemicalId);
  };

  const findBottleByQrOrCode = (code: string): Bottle | undefined => {
    const trimmed = code.trim().toLowerCase();
    return bottles.find(
      (b: Bottle) =>
        b.id.toLowerCase() === trimmed ||
        b.bottleCode.toLowerCase() === trimmed ||
        (b.qrId && b.qrId.toLowerCase() === trimmed)
    );
  };

  const requestLocationChange = async (params: {
    bottleId: string;
    bottleCode?: string;
    chemicalId?: string;
    chemicalName?: string;
    currentLocation: string;
    requestedLocation: string;
    reason?: string;
  }) => {
    return locationRequestService.createRequest({
      ...params,
      userId: currentUser.id,
      userName: currentUser.name,
    });
  };

  const approveLocationChange = async (requestId: string) => {
    return locationRequestService.reviewRequest(requestId, 'APPROVED', currentUser.id);
  };

  const rejectLocationChange = async (requestId: string) => {
    return locationRequestService.reviewRequest(requestId, 'REJECTED', currentUser.id);
  };

  return {
    bottles,
    activeBottles,
    openBottles,
    expiredBottles,
    expiringWithin90DaysBottles,
    getBottlesByChemical,
    findBottleByQrOrCode,
    recordUsage,
    stockIn,
    updateBottle,
    disposeBottle,
    deleteBottle,
    restoreBottle,
    stockAdjustment,
    requestLocationChange,
    approveLocationChange,
    rejectLocationChange,
    isSyncing,
    refreshFromSupabase,
  };
};

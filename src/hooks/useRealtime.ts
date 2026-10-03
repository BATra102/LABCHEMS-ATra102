import { useLabContext } from '../context/LabContext';

export const useRealtime = () => {
  const {
    isSupabaseConfigured,
    isRealtimeActive,
    isSyncing,
    refreshFromSupabase,
  } = useLabContext();

  return {
    isConfigured: isSupabaseConfigured,
    isRealtimeActive,
    isSyncing,
    refresh: refreshFromSupabase,
  };
};

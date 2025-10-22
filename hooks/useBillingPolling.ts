import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBillingPollingOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onRefresh?: () => void;
  silentUpdate?: boolean; // Si true, no muestra loading durante actualizaciones automáticas
}

export function useBillingPolling(
  fetchData: () => Promise<void> | void,
  dependencies: any[],
  options: UseBillingPollingOptions = {}
) {
  const { refreshInterval = 30000, enabled = true, onRefresh, silentUpdate = true } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const [isPolling, setIsPolling] = useState(false);
  const [isSilentUpdating, setIsSilentUpdating] = useState(false);

  const manualRefresh = useCallback(() => {
    if (onRefresh) onRefresh();
    fetchData();
  }, [fetchData, onRefresh]);

  const silentRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setIsSilentUpdating(true);
    try {
      if (onRefresh) onRefresh();
      // Pasar true para indicar que es una actualización silenciosa
      await fetchData(true);
    } catch (error) {
      console.error('🔄 [BILLING-POLLING] Error en actualización silenciosa:', error);
    } finally {
      if (isMounted.current) {
        setIsSilentUpdating(false);
      }
    }
  }, [fetchData, onRefresh]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (enabled && isMounted.current) {
      setIsPolling(true);
      intervalRef.current = setInterval(() => {
        if (isMounted.current) {
          console.log('🔄 [BILLING-POLLING] Actualización silenciosa iniciada');
          if (silentUpdate) {
            silentRefresh();
          } else {
            if (onRefresh) onRefresh();
            fetchData();
          }
        }
      }, refreshInterval);
    } else {
      setIsPolling(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, enabled, fetchData, onRefresh, silentUpdate, silentRefresh, ...dependencies]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isPolling,
    isSilentUpdating,
    manualRefresh
  };
}

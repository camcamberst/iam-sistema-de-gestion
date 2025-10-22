import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBillingPollingOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onRefresh?: () => void;
}

export function useBillingPolling(
  fetchData: () => Promise<void> | void,
  dependencies: any[],
  options: UseBillingPollingOptions = {}
) {
  const { refreshInterval = 30000, enabled = true, onRefresh } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const [isPolling, setIsPolling] = useState(false);

  const manualRefresh = useCallback(() => {
    if (onRefresh) onRefresh();
    fetchData();
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
          console.log('🔄 [BILLING-POLLING] Actualizando datos automáticamente');
          if (onRefresh) onRefresh();
          fetchData();
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
  }, [refreshInterval, enabled, fetchData, onRefresh, ...dependencies]);

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
    manualRefresh
  };
}

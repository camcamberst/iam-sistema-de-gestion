// =====================================================
// 🔄 HOOK PARA ACTUALIZACIÓN AUTOMÁTICA DEL RESUMEN DE FACTURACIÓN
// =====================================================
// Este hook maneja la actualización automática cuando se guardan datos en la calculadora
// =====================================================

import { useEffect, useCallback } from 'react';

interface UseBillingRefreshOptions {
  refreshInterval?: number; // Intervalo en milisegundos (default: 30 segundos)
  enabled?: boolean; // Si está habilitado (default: true)
  onRefresh?: () => void; // Callback cuando se ejecuta el refresh
}

export function useBillingRefresh(
  loadBillingData: () => void,
  dependencies: any[],
  options: UseBillingRefreshOptions = {}
) {
  const {
    refreshInterval = 30000, // 30 segundos
    enabled = true,
    onRefresh
  } = options;

  const handleRefresh = useCallback(() => {
    if (enabled) {
      console.log('🔄 [BILLING-REFRESH] Ejecutando refresh automático...');
      loadBillingData();
      onRefresh?.();
    }
  }, [enabled, loadBillingData, onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(handleRefresh, refreshInterval);
    
    console.log(`🔄 [BILLING-REFRESH] Auto-refresh habilitado cada ${refreshInterval / 1000} segundos`);

    return () => {
      clearInterval(interval);
      console.log('🔄 [BILLING-REFRESH] Auto-refresh deshabilitado');
    };
  }, [handleRefresh, refreshInterval, enabled, ...dependencies]);

  // Función para refresh manual
  const manualRefresh = useCallback(() => {
    console.log('🔄 [BILLING-REFRESH] Refresh manual ejecutado');
    handleRefresh();
  }, [handleRefresh]);

  return {
    manualRefresh
  };
}

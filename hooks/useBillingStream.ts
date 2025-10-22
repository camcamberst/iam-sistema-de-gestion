import { useEffect, useRef, useCallback, useState } from 'react';

interface BillingStreamOptions {
  enabled?: boolean;
  onUpdate?: (data: any) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface StreamMessage {
  type: 'connected' | 'calculator_updated' | 'history_updated' | 'subscription_active' | 'ping' | 'error';
  modelId?: string;
  event?: string;
  timestamp: string;
  message?: string;
  data?: any;
}

export function useBillingStream(
  fetchData: () => Promise<void> | void,
  dependencies: any[],
  options: BillingStreamOptions = {}
) {
  const { enabled = true, onUpdate, onError, onConnect, onDisconnect } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectedRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    console.log('🔄 [BILLING-STREAM] Conectando al stream...');
    setConnectionStatus('connecting');
    
    // Timeout de conexión para detectar si no se conecta
    const connectionTimeout = setTimeout(() => {
      console.error('🔄 [BILLING-STREAM] Timeout de conexión - usando fallback polling');
      setConnectionStatus('error');
      
      // Fallback a polling cada 30 segundos
      const pollInterval = setInterval(() => {
        if (isMounted.current) {
          console.log('🔄 [BILLING-STREAM] Polling fallback - actualizando datos');
          fetchData();
        }
      }, 30000);
      
      // Guardar referencia para limpiar después
      (eventSourceRef as any).pollInterval = pollInterval;
      
      onError?.(new Error('SSE no disponible - usando polling fallback'));
    }, 10000); // 10 segundos timeout

    try {
      const eventSource = new EventSource('/api/billing-summary/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('🔄 [BILLING-STREAM] Conexión establecida');
        clearTimeout(connectionTimeout);
        isConnectedRef.current = true;
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('🔄 [BILLING-STREAM] Conectado:', message.message);
              break;
              
            case 'subscription_active':
              console.log('🔄 [BILLING-STREAM] Suscripción activa');
              break;
              
            case 'calculator_updated':
            case 'history_updated':
              console.log('🔄 [BILLING-STREAM] Cambio detectado:', {
                type: message.type,
                modelId: message.modelId,
                event: message.event
              });
              
              // Actualizar datos silenciosamente
              fetchData();
              onUpdate?.(message);
              break;
              
            case 'ping':
              // Mantener conexión viva
              break;
              
            case 'error':
              console.error('🔄 [BILLING-STREAM] Error del servidor:', message.message);
              onError?.(new Error(message.message || 'Error del servidor'));
              break;
          }
        } catch (error) {
          console.error('🔄 [BILLING-STREAM] Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('🔄 [BILLING-STREAM] Error de conexión:', error);
        clearTimeout(connectionTimeout);
        isConnectedRef.current = false;
        setConnectionStatus('error');
        onError?.(new Error('Error de conexión al stream'));
        
        // Intentar reconectar
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 [BILLING-STREAM] Reintentando conexión en ${delay}ms (intento ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            disconnect();
            connect();
          }, delay);
        } else {
          console.error('🔄 [BILLING-STREAM] Máximo de intentos de reconexión alcanzado');
          onError?.(new Error('No se pudo conectar al stream después de múltiples intentos'));
        }
      };

    } catch (error) {
      console.error('🔄 [BILLING-STREAM] Error al crear conexión:', error);
      setConnectionStatus('error');
      onError?.(error as Error);
    }
  }, [enabled, fetchData, onUpdate, onError, onConnect]);

  const disconnect = useCallback(() => {
    console.log('🔄 [BILLING-STREAM] Desconectando...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Limpiar polling fallback si existe
    if ((eventSourceRef as any).pollInterval) {
      clearInterval((eventSourceRef as any).pollInterval);
      (eventSourceRef as any).pollInterval = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    isConnectedRef.current = false;
    setConnectionStatus('disconnected');
    onDisconnect?.();
  }, [onDisconnect]);

  const reconnect = useCallback(() => {
    console.log('🔄 [BILLING-STREAM] Reconectando manualmente...');
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [disconnect, connect]);

  // Conectar/desconectar basado en enabled
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Reconectar cuando cambien las dependencias
  useEffect(() => {
    if (isConnectedRef.current) {
      console.log('🔄 [BILLING-STREAM] Dependencias cambiaron, reconectando...');
      reconnect();
    }
  }, dependencies);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    isConnected: isConnectedRef.current,
    reconnect,
    disconnect
  };
}

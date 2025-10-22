import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Configurar headers para SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const stream = new ReadableStream({
    start(controller) {
      console.log('🔄 [BILLING-STREAM] Cliente conectado al stream de actualizaciones');

      // Función para enviar datos
      const sendData = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      };

      // Enviar mensaje de conexión
      sendData({ 
        type: 'connected', 
        message: 'Conectado al stream de actualizaciones',
        timestamp: new Date().toISOString()
      });

      // Configurar suscripción a cambios en calculator_totals
      const subscription = supabase
        .channel('billing-updates')
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'calculator_totals'
          },
          (payload) => {
            console.log('🔄 [BILLING-STREAM] Cambio detectado en calculator_totals:', payload);
            
            // Enviar notificación de cambio
            sendData({
              type: 'calculator_updated',
              modelId: payload.new?.model_id || payload.old?.model_id,
              event: payload.eventType,
              timestamp: new Date().toISOString(),
              data: payload.new || payload.old
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'calculator_history'
          },
          (payload) => {
            console.log('🔄 [BILLING-STREAM] Cambio detectado en calculator_history:', payload);
            
            sendData({
              type: 'history_updated',
              modelId: payload.new?.model_id || payload.old?.model_id,
              event: payload.eventType,
              timestamp: new Date().toISOString(),
              data: payload.new || payload.old
            });
          }
        )
        .subscribe((status) => {
          console.log('🔄 [BILLING-STREAM] Estado de suscripción:', status);
          
          if (status === 'SUBSCRIBED') {
            sendData({
              type: 'subscription_active',
              message: 'Suscripción activa - escuchando cambios',
              timestamp: new Date().toISOString()
            });
          }
        });

      // Función de limpieza
      const cleanup = () => {
        console.log('🔄 [BILLING-STREAM] Limpiando conexión');
        subscription.unsubscribe();
        controller.close();
      };

      // Limpiar cuando se cierre la conexión
      request.signal.addEventListener('abort', cleanup);
      
      // Enviar ping cada 30 segundos para mantener conexión viva
      const pingInterval = setInterval(() => {
        sendData({
          type: 'ping',
          timestamp: new Date().toISOString()
        });
      }, 30000);

      // Limpiar ping interval
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
      });
    }
  });

  return new Response(stream, { headers });
}

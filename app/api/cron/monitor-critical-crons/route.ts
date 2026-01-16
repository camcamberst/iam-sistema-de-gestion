import { NextRequest, NextResponse } from 'next/server';
import { monitorCriticalCrons } from '@/lib/alerts/cron-failure-alerts';

/**
 * GET: Monitorea cron jobs críticos y envía alertas si fallan
 * 
 * Este endpoint debe ejecutarse cada 30 minutos para verificar
 * que los cron jobs críticos se están ejecutando correctamente.
 * 
 * Si detecta que un cron no se ejecutó, envía alertas inmediatas
 * a todos los super_admin.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [CRON-MONITOR-API] Iniciando monitoreo de cron jobs críticos...');

    await monitorCriticalCrons();

    return NextResponse.json({
      success: true,
      message: 'Monitoreo completado',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CRON-MONITOR-API] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

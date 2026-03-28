import { NextRequest, NextResponse } from 'next/server';
import { isEarlyFreezeTime, isEarlyFreezeRelevantDay } from '@/utils/period-closure-dates';


export const dynamic = 'force-dynamic';

/**
 * GET: Cron job para congelación anticipada (medianoche Europa Central)
 * 
 * IMPORTANTE: Se ejecuta SOLO el último día de cada período:
 * - Día 15: último día del período 1-15 (P1)
 * - Último día del mes: último día del período 16-31 (P2)
 *   Puede ser día 28, 29, 30 o 31 dependiendo del mes
 * 
 * El congelamiento se ejecuta a medianoche Europa Central (aproximadamente 18:00-19:00 Colombia)
 * del último día de cada período, antes del cierre completo que ocurre a medianoche Colombia.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON-EARLY-FREEZE] Verificando congelación anticipada...');

    // Verificar que es el último día de un período (15 o 31)
    if (!isEarlyFreezeRelevantDay()) {
      const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const day = parseInt(currentDate.split('-')[2]);
      
      return NextResponse.json({
        success: true,
        message: 'No es el último día de un período (debe ser día 15 o el último día del mes)',
        current_day: day
      });
    }

    // Verificar que es momento de congelación (medianoche Europa Central)
    if (!isEarlyFreezeTime()) {
      return NextResponse.json({
        success: true,
        message: 'No es momento de congelación anticipada (medianoche Europa Central)'
      });
    }

    // Llamar al endpoint de early-freeze
    const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    const inferredBaseUrl = request.nextUrl?.origin;
    const baseUrl =
      envBaseUrl ||
      (vercelHost ? `https://${vercelHost}` : '') ||
      inferredBaseUrl ||
      'https://iam-sistema-de-gestion.vercel.app';

    const response = await fetch(`${baseUrl}/api/calculator/period-closure/early-freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CRON-EARLY-FREEZE] Error en early-freeze:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Error ejecutando congelación anticipada',
        details: errorData
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ [CRON-EARLY-FREEZE] Congelación anticipada ejecutada:', result);

    return NextResponse.json({
      success: true,
      message: 'Congelación anticipada ejecutada exitosamente',
      execution_time: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ [CRON-EARLY-FREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


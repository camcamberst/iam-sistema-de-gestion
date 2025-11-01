import { NextRequest, NextResponse } from 'next/server';
import { isFullClosureTime, isClosureDay } from '@/utils/period-closure-dates';

/**
 * GET: Cron job para cierre completo (00:00 Colombia)
 * Se ejecuta los días 1 y 16
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON-FULL-CLOSE] Verificando cierre completo...');

    // Verificar que es día de cierre
    if (!isClosureDay()) {
      const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const day = parseInt(currentDate.split('-')[2]);
      
      return NextResponse.json({
        success: true,
        message: 'No es día de cierre (1 o 16)',
        current_day: day
      });
    }

    // Verificar que es momento de cierre (00:00 Colombia)
    if (!isFullClosureTime()) {
      return NextResponse.json({
        success: true,
        message: 'No es momento de cierre completo (00:00 Colombia)'
      });
    }

    // Llamar al endpoint de close-period
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/calculator/period-closure/close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CRON-FULL-CLOSE] Error en close-period:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Error ejecutando cierre completo',
        details: errorData
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ [CRON-FULL-CLOSE] Cierre completo ejecutado:', result);

    return NextResponse.json({
      success: true,
      message: 'Cierre completo ejecutado exitosamente',
      execution_time: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ [CRON-FULL-CLOSE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


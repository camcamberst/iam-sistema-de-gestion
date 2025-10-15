import { NextRequest, NextResponse } from 'next/server';
import { getTimezoneInfo, getCronScheduleForEuropeanMidnight } from '@/utils/timezone-detector';

/**
 * API para obtener y actualizar el schedule de cron jobs
 * basado en el horario de verano/invierno europeo
 */

// GET: Obtener información actual del timezone y schedule recomendado
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON-SCHEDULE] Obteniendo información de timezone...');
    
    const timezoneInfo = getTimezoneInfo();
    const cronSchedule = getCronScheduleForEuropeanMidnight();
    
    // Calcular próximos cierres
    const today = new Date();
    const nextClosures = [];
    
    // Próximo cierre día 15/16
    const next15th = new Date(today.getFullYear(), today.getMonth(), 15);
    if (next15th <= today) {
      next15th.setMonth(next15th.getMonth() + 1);
    }
    
    // Próximo cierre día 30/31
    const next30th = new Date(today.getFullYear(), today.getMonth(), 30);
    if (next30th <= today) {
      next30th.setMonth(next30th.getMonth() + 1);
    }
    
    nextClosures.push({
      date: next15th.toISOString().split('T')[0],
      description: `Cierre quincena 1 (días 1-15)`,
      colombiaTime: timezoneInfo.colombiaTimeForEuropeanMidnight,
      europeanTime: '00:00'
    });
    
    nextClosures.push({
      date: next30th.toISOString().split('T')[0],
      description: `Cierre quincena 2 (días 16-31)`,
      colombiaTime: timezoneInfo.colombiaTimeForEuropeanMidnight,
      europeanTime: '00:00'
    });
    
    return NextResponse.json({
      success: true,
      timezone: timezoneInfo,
      cronSchedule: {
        current: cronSchedule,
        description: `Ejecutar días 15 y 30 a las ${timezoneInfo.colombiaTimeForEuropeanMidnight} Colombia`,
        vercelFormat: cronSchedule
      },
      nextClosures: nextClosures,
      instructions: {
        vercelJson: {
          path: '/api/cron/auto-close-calculator',
          schedule: cronSchedule
        },
        explanation: `Este schedule ejecutará los cierres automáticos a las ${timezoneInfo.colombiaTimeForEuropeanMidnight} Colombia, que coincide con las 00:00 Europa Central`
      }
    });

  } catch (error: any) {
    console.error('❌ [CRON-SCHEDULE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error obteniendo información de timezone'
    }, { status: 500 });
  }
}

// POST: Actualizar el schedule (para uso futuro si se necesita automatización)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'update-schedule') {
      console.log('🔄 [CRON-SCHEDULE] Actualizando schedule de cron...');
      
      const timezoneInfo = getTimezoneInfo();
      const cronSchedule = getCronScheduleForEuropeanMidnight();
      
      // Aquí se podría implementar lógica para actualizar automáticamente
      // el vercel.json o notificar al administrador del cambio
      
      return NextResponse.json({
        success: true,
        message: 'Schedule actualizado',
        newSchedule: cronSchedule,
        timezone: timezoneInfo,
        note: 'Recuerda actualizar manualmente el vercel.json con el nuevo schedule'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ [CRON-SCHEDULE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error actualizando schedule'
    }, { status: 500 });
  }
}

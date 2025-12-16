import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getColombiaDate, 
  getColombiaDateTime,
  isEarlyFreezeRelevantDay,
  getCurrentPeriodType
} from '@/utils/period-closure-dates';
import { freezePlatformsForModel } from '@/lib/calculator/period-closure-helpers';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET: Cron job para congelar DX Live a las 10:00 AM Colombia en días de cierre de período
 * Se ejecuta los días 1, 15, 16 y 31 a las 15:00 UTC (10:00 AM Colombia)
 * DX Live sigue la misma lógica de cierre de período que las plataformas especiales,
 * pero cierra a las 10:00 AM Colombia en lugar de medianoche Europa Central.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON-DXLIVE-FREEZE] Verificando congelación de DX Live...');

    // Verificar que es día relevante para early freeze (1, 15, 16 o 31)
    if (!isEarlyFreezeRelevantDay()) {
      const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const day = parseInt(currentDate.split('-')[2]);
      
      return NextResponse.json({
        success: true,
        message: 'No es día de cierre de período (1, 15, 16 o 31)',
        current_day: day
      });
    }

    // Verificar que es 10:00 AM Colombia (con tolerancia de ±5 minutos)
    const colombiaTime = getColombiaDateTime();
    const [currentHour, currentMinute] = colombiaTime.split(' ')[1]?.split(':') || ['00', '00'];
    const hour = parseInt(currentHour);
    const minute = parseInt(currentMinute);

    const isTargetTime = hour === 10 && minute >= 0 && minute <= 10;

    if (!isTargetTime) {
      return NextResponse.json({
        success: true,
        message: `No es hora de congelación de DX Live (10:00 AM Colombia). Hora actual: ${hour}:${String(minute).padStart(2, '0')}`
      });
    }

    const currentDate = getColombiaDate();
    const periodType = getCurrentPeriodType();
    
    console.log(`🔒 [CRON-DXLIVE-FREEZE] Iniciando congelación de DX Live a las 10:00 AM Colombia...`);

    // Verificar si ya se ejecutó hoy
    const { data: existingStatus } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('id')
      .eq('period_date', currentDate)
      .eq('platform_id', 'dxlive')
      .limit(1);

    if (existingStatus && existingStatus.length > 0) {
      console.log('⚠️ [CRON-DXLIVE-FREEZE] DX Live ya fue congelado hoy');
      return NextResponse.json({
        success: true,
        message: 'DX Live ya fue congelado hoy',
        already_executed: true
      });
    }

    // Obtener todos los modelos activos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ [CRON-DXLIVE-FREEZE] Error obteniendo modelos:', modelsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo modelos'
      }, { status: 500 });
    }

    console.log(`🔄 [CRON-DXLIVE-FREEZE] Procesando ${models?.length || 0} modelos...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Para cada modelo, congelar DX Live
    for (const model of models || []) {
      try {
        const freezeResult = await freezePlatformsForModel(
          currentDate,
          model.id,
          ['dxlive']
        );

        if (freezeResult.success) {
          successCount++;
          results.push({
            model_id: model.id,
            model_email: model.email,
            status: 'success'
          });

          // Notificar al modelo vía AIM Botty
          await sendBotNotification(
            model.id,
            'periodo_cerrado',
            'DX Live ha sido bloqueado para edición. El período está cerrado para esta plataforma.'
          );
        } else {
          errorCount++;
          results.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: freezeResult.error
          });
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [CRON-DXLIVE-FREEZE] Error procesando modelo ${model.email}:`, error);
        results.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log('✅ [CRON-DXLIVE-FREEZE] Congelación de DX Live completada:', {
      total: models?.length || 0,
      success: successCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Congelación de DX Live completada',
      period_date: currentDate,
      period_type: periodType,
      results: {
        total_models: models?.length || 0,
        successful: successCount,
        failed: errorCount
      },
      frozen_platform: 'dxlive',
      details: results
    });

  } catch (error) {
    console.error('❌ [CRON-DXLIVE-FREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


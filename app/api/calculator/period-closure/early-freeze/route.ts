import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 

export const dynamic = 'force-dynamic';

  getColombiaDate, 
  getCurrentPeriodType,
  isEarlyFreezeTime,
  EARLY_FREEZE_PLATFORMS
} from '@/utils/period-closure-dates';
import { 
  updateClosureStatus,
  freezePlatformsForModel 
} from '@/lib/calculator/period-closure-helpers';
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
 * POST: Congela las 10 plataformas especiales (medianoche Europa Central)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔒 [EARLY-FREEZE] Iniciando congelación anticipada...');

    const currentDate = getColombiaDate();
    const periodType = getCurrentPeriodType();

    // Verificar modo testing desde header
    const testingMode = request.headers.get('x-testing-mode') === 'true';
    
    // Verificar que es momento de congelación (o si está en modo testing)
    if (!testingMode && !isEarlyFreezeTime()) {
      console.log('⏰ [EARLY-FREEZE] No es momento de congelación anticipada');
      return NextResponse.json({
        success: false,
        error: 'No es momento de congelación anticipada (medianoche Europa Central)'
      }, { status: 400 });
    }
    
    if (testingMode) {
      console.log('🧪 [EARLY-FREEZE] MODO TESTING ACTIVADO');
    }

    // Verificar si ya se ejecutó hoy
    const { data: existingStatus } = await supabase
      .from('calculator_period_closure_status')
      .select('id, status')
      .eq('period_date', currentDate)
      .eq('status', 'early_freezing')
      .single();

    if (existingStatus) {
      console.log('⚠️ [EARLY-FREEZE] Ya se ejecutó la congelación hoy');
      return NextResponse.json({
        success: true,
        message: 'Congelación anticipada ya ejecutada',
        already_executed: true
      });
    }

    // Actualizar estado
    await updateClosureStatus(currentDate, periodType, 'early_freezing');

    // Obtener todos los modelos activos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ [EARLY-FREEZE] Error obteniendo modelos:', modelsError);
      await updateClosureStatus(currentDate, periodType, 'failed', {
        error: 'Error obteniendo modelos'
      });
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo modelos'
      }, { status: 500 });
    }

    console.log(`🔄 [EARLY-FREEZE] Procesando ${models?.length || 0} modelos...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Para cada modelo, congelar las 10 plataformas especiales
    for (const model of models || []) {
      try {
        const freezeResult = await freezePlatformsForModel(
          currentDate,
          model.id,
          EARLY_FREEZE_PLATFORMS as any
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
            'Las plataformas especiales (SUPERFOON, LIVECREATOR, MDH, 777, XMODELS, BIG7, MONDO, VX, BABESTATION, DIRTYFANS) han sido bloqueadas para edición. El período está cerrado para estas plataformas.'
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
        console.error(`❌ [EARLY-FREEZE] Error procesando modelo ${model.email}:`, error);
        results.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // Actualizar estado a closing_calculators
    await updateClosureStatus(currentDate, periodType, 'closing_calculators', {
      models_processed: models?.length || 0,
      success_count: successCount,
      error_count: errorCount
    });

    console.log('✅ [EARLY-FREEZE] Congelación anticipada completada:', {
      total: models?.length || 0,
      success: successCount,
      errors: errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Congelación anticipada completada',
      period_date: currentDate,
      period_type: periodType,
      results: {
        total_models: models?.length || 0,
        successful: successCount,
        failed: errorCount
      },
      frozen_platforms: EARLY_FREEZE_PLATFORMS,
      details: results
    });

  } catch (error) {
    console.error('❌ [EARLY-FREEZE] Error:', error);
    const currentDate = getColombiaDate();
    const periodType = getCurrentPeriodType();
    
    await updateClosureStatus(currentDate, periodType, 'failed', {
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


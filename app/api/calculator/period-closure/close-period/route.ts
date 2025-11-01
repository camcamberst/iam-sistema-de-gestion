import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getColombiaDate, 
  getCurrentPeriodType,
  getPeriodToClose,
  getNewPeriodAfterClosure,
  isFullClosureTime,
  isClosureDay
} from '@/utils/period-closure-dates';
import { 
  updateClosureStatus,
  archiveModelValues,
  resetModelValues
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
 * POST: Cierra período completo (00:00 Colombia)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔒 [CLOSE-PERIOD] Iniciando cierre completo de período...');

    const todayDate = getColombiaDate();
    
    // 🔧 CORRECCIÓN: Obtener el período que se debe CERRAR (no el actual)
    // Día 1: cierra período 16-31 del mes anterior
    // Día 16: cierra período 1-15 del mes actual
    const { periodDate: periodToCloseDate, periodType: periodToCloseType } = getPeriodToClose();
    
    // Obtener el período que inicia después del cierre
    const { periodDate: newPeriodDate, periodType: newPeriodType } = getNewPeriodAfterClosure();
    
    console.log(`📅 [CLOSE-PERIOD] Fecha de hoy: ${todayDate}`);
    console.log(`📦 [CLOSE-PERIOD] Período a cerrar: ${periodToCloseDate} (${periodToCloseType})`);
    console.log(`🆕 [CLOSE-PERIOD] Nuevo período que inicia: ${newPeriodDate} (${newPeriodType})`);

    // Verificar modo testing desde header
    const testingMode = request.headers.get('x-testing-mode') === 'true';
    
    // Verificar que es día de cierre y hora correcta (o si está en modo testing)
    if (!testingMode && !isClosureDay()) {
      return NextResponse.json({
        success: false,
        error: 'No es día de cierre (días 1 y 16)'
      }, { status: 400 });
    }

    if (!testingMode && !isFullClosureTime()) {
      return NextResponse.json({
        success: false,
        error: 'No es momento de cierre completo (00:00 Colombia)'
      }, { status: 400 });
    }
    
    if (testingMode) {
      console.log('🧪 [CLOSE-PERIOD] MODO TESTING ACTIVADO');
    }

    // Verificar estado actual (usar la fecha del período a cerrar)
    const { data: currentStatus } = await supabase
      .from('calculator_period_closure_status')
      .select('status')
      .eq('period_date', periodToCloseDate)
      .eq('period_type', periodToCloseType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (currentStatus?.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Período ya fue cerrado',
        already_closed: true
      });
    }

    // Actualizar estado a closing_calculators (usar período a cerrar)
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'closing_calculators');

    // Obtener todos los modelos activos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ [CLOSE-PERIOD] Error obteniendo modelos:', modelsError);
      await updateClosureStatus(periodToCloseDate, periodToCloseType, 'failed', {
        error: 'Error obteniendo modelos'
      });
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo modelos'
      }, { status: 500 });
    }

    console.log(`🔄 [CLOSE-PERIOD] Procesando ${models?.length || 0} modelos...`);

    // FASE 1: Archivar valores de todas las calculadoras
    const archiveResults = [];
    let archiveSuccessCount = 0;
    let archiveErrorCount = 0;

    for (const model of models || []) {
      try {
        // Archivar valores del período que se está cerrando
        const archiveResult = await archiveModelValues(model.id, periodToCloseDate, periodToCloseType);
        
        if (archiveResult.success) {
          archiveSuccessCount++;
          archiveResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'archived',
            archived_count: archiveResult.archived
          });
        } else {
          archiveErrorCount++;
          archiveResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: archiveResult.error
          });
        }
      } catch (error) {
        archiveErrorCount++;
        console.error(`❌ [CLOSE-PERIOD] Error archivando modelo ${model.email}:`, error);
        archiveResults.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`✅ [CLOSE-PERIOD] Archivo completado: ${archiveSuccessCount} exitosos, ${archiveErrorCount} errores`);

    // FASE 2: Esperar 2.5 minutos (150 segundos) para que Resumen de Facturación reciba última actualización
    console.log('⏳ [CLOSE-PERIOD] Esperando para última actualización del resumen...');
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'waiting_summary');
    
    // TEMPORAL PARA TESTING: 5 segundos en lugar de 150 segundos
    const waitTime = testingMode ? 5000 : 150000;
    if (testingMode) {
      console.log('🧪 [CLOSE-PERIOD] Modo testing: espera reducida a 5 segundos');
    }
    await new Promise(resolve => setTimeout(resolve, waitTime));

    console.log('✅ [CLOSE-PERIOD] Tiempo de espera completado');

    // FASE 3: El resumen de facturación se actualiza automáticamente leyendo de calculator_history
    // No necesitamos endpoint especial - solo esperamos y luego continuamos
    
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'closing_summary');

    // FASE 4: Resetear todas las calculadoras (eliminar valores del período cerrado)
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'archiving');

    const resetResults = [];
    let resetSuccessCount = 0;
    let resetErrorCount = 0;

    for (const model of models || []) {
      try {
        // Resetear valores del período cerrado (eliminar de model_values)
        const resetResult = await resetModelValues(model.id, periodToCloseDate, periodToCloseType);
        
        if (resetResult.success) {
          resetSuccessCount++;
          resetResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'reset',
            deleted_count: resetResult.deleted
          });
        } else {
          resetErrorCount++;
          resetResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: resetResult.error
          });
        }
      } catch (error) {
        resetErrorCount++;
        console.error(`❌ [CLOSE-PERIOD] Error reseteando modelo ${model.email}:`, error);
        resetResults.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // FASE 5: Notificar a modelos
    for (const model of models || []) {
      try {
        await sendBotNotification(
          model.id,
          'periodo_cerrado',
          'El período ha cerrado. Tus valores han sido archivados y puedes revisarlos en "Mi Historial". La calculadora se ha reiniciado para el nuevo período. Puedes comenzar a ingresar valores nuevamente.'
        );
      } catch (error) {
        console.error(`❌ [CLOSE-PERIOD] Error notificando modelo ${model.email}:`, error);
      }
    }

    // FASE 6: Notificar a admins/super_admins
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, name')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true);

    for (const admin of admins || []) {
      try {
        await sendBotNotification(
          admin.id,
          'periodo_cerrado',
          `Período ${periodToCloseType} (${periodToCloseDate}) cerrado exitosamente. El resumen está disponible en "Consulta Histórica" del Dashboard de Sedes. Nuevo período ${newPeriodType} (${newPeriodDate}) iniciado.`
        );
      } catch (error) {
        console.error(`❌ [CLOSE-PERIOD] Error notificando admin ${admin.email}:`, error);
      }
    }

    // FASE 7: Marcar como completado
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'completed', {
      archive_results: {
        total: models?.length || 0,
        successful: archiveSuccessCount,
        failed: archiveErrorCount
      },
      reset_results: {
        total: models?.length || 0,
        successful: resetSuccessCount,
        failed: resetErrorCount
      },
      completed_at: new Date().toISOString()
    });

    console.log('✅ [CLOSE-PERIOD] Cierre completo exitoso');

    return NextResponse.json({
      success: true,
      message: 'Cierre de período completado exitosamente',
      period_date: periodToCloseDate,
      period_type: periodToCloseType,
      new_period_date: newPeriodDate,
      new_period_type: newPeriodType,
      archive_summary: {
        total: models?.length || 0,
        successful: archiveSuccessCount,
        failed: archiveErrorCount
      },
      reset_summary: {
        total: models?.length || 0,
        successful: resetSuccessCount,
        failed: resetErrorCount
      },
      details: {
        archived: archiveResults,
        reset: resetResults
      }
    });

  } catch (error) {
    console.error('❌ [CLOSE-PERIOD] Error:', error);
    const { periodDate: periodToCloseDate, periodType: periodToCloseType } = getPeriodToClose();

    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'failed', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      failed_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


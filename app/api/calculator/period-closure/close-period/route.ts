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
  atomicArchiveAndReset
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

const pad = (value: number) => String(value).padStart(2, '0');

const computeNextPeriodFromReference = (
  periodDate: string,
  periodType: '1-15' | '16-31'
): { periodDate: string; periodType: '1-15' | '16-31' } => {
  const [yearStr, monthStr] = periodDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    console.warn('⚠️ [CLOSE-PERIOD] No se pudo interpretar periodDate forzado, usando cálculo predeterminado');
    return getNewPeriodAfterClosure();
  }

  if (periodType === '1-15') {
    return {
      periodDate: `${year}-${pad(month)}-16`,
      periodType: '16-31'
    };
  }

  const nextMonthDate = new Date(year, month - 1 + 1, 1);
  return {
    periodDate: `${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}-01`,
    periodType: '1-15'
  };
};

/**
 * POST: Cierra período completo (00:00 Colombia)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔒 [CLOSE-PERIOD] Iniciando cierre completo de período...');

    const todayDate = getColombiaDate();
    const testingMode = request.headers.get('x-testing-mode') === 'true';
    const forcePeriodDateHeader = request.headers.get('x-force-period-date');
    const forcePeriodTypeHeader = request.headers.get('x-force-period-type');
    const forceCloseSecret = request.headers.get('x-force-close-secret');
    const cronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    const forcedBySecret = !!(forceCloseSecret && forceCloseSecret === cronSecret);
    
    // Verificar si es super_admin autenticado
    let isSuperAdmin = false;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        // Usar cliente anon para verificar usuario, o decodificar JWT si fuera necesario
        // Pero dado que tenemos service role client, podemos usar auth.getUser(token) si supabase lo permite
        // O mejor, creamos un cliente separado para validar auth
        const supabaseAuth = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
        );
        
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
        
        if (user && !authError) {
          // Verificar rol en tabla users con el cliente admin
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
            
          if (userData?.role === 'super_admin') {
            isSuperAdmin = true;
            console.log('🛡️ [CLOSE-PERIOD] Super Admin autenticado solicitando cierre manual:', user.email);
          }
        }
      } catch (e) {
        console.warn('⚠️ [CLOSE-PERIOD] Error validando super admin:', e);
      }
    }

    const bypassGuardrails = testingMode || forcedBySecret || isSuperAdmin;
    const validForcedType = forcePeriodTypeHeader === '1-15' || forcePeriodTypeHeader === '16-31';
    const canForceOverride = !!(
      (forcePeriodDateHeader && validForcedType && bypassGuardrails)
    );

    let { periodDate: periodToCloseDate, periodType: periodToCloseType } = getPeriodToClose();
    let forcedOverrideApplied = false;

    if (canForceOverride && forcePeriodDateHeader && validForcedType) {
      periodToCloseDate = forcePeriodDateHeader;
      periodToCloseType = forcePeriodTypeHeader as '1-15' | '16-31';
      forcedOverrideApplied = true;
      console.log('🛠️ [CLOSE-PERIOD] Período forzado vía encabezados:', {
        periodToCloseDate,
        periodToCloseType
      });
    }
    
    // 🔧 CORRECCIÓN: Obtener el período que se debe CERRAR (no el actual)
    // Día 1: cierra período 16-31 del mes anterior
    // Día 16: cierra período 1-15 del mes actual
    // Obtener el período que inicia después del cierre
    const {
      periodDate: newPeriodDate,
      periodType: newPeriodType
    } = forcedOverrideApplied
      ? computeNextPeriodFromReference(periodToCloseDate, periodToCloseType)
      : getNewPeriodAfterClosure();
    
    console.log(`📅 [CLOSE-PERIOD] Fecha de hoy: ${todayDate}`);
    console.log(`📦 [CLOSE-PERIOD] Período a cerrar: ${periodToCloseDate} (${periodToCloseType})`);
    console.log(`🆕 [CLOSE-PERIOD] Nuevo período que inicia: ${newPeriodDate} (${newPeriodType})`);

    // Verificar que es día de cierre y hora correcta (o si está en modo testing)
    if (!bypassGuardrails && !isClosureDay()) {
      return NextResponse.json({
        success: false,
        error: 'No es día de cierre (días 1 y 16)'
      }, { status: 400 });
    }

    if (!bypassGuardrails && !isFullClosureTime()) {
      return NextResponse.json({
        success: false,
        error: 'No es momento de cierre completo (00:00 Colombia)'
      }, { status: 400 });
    }
    
    if (bypassGuardrails) {
      console.log('🧪 [CLOSE-PERIOD] MODO BYPASS ACTIVADO', {
        testingMode,
        forcedBySecret
      });
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
      if (!bypassGuardrails) {
        return NextResponse.json({
          success: true,
          message: 'Período ya fue cerrado',
          already_closed: true
        });
      }
      console.warn('⚠️ [CLOSE-PERIOD] Reejecución forzada sobre período marcado como completado');
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

    // FASE 1: Archivar y Resetear valores de todas las calculadoras DE FORMA ATÓMICA
    const closureResults = [];
    let closureSuccessCount = 0;
    let closureErrorCount = 0;

    for (const model of models || []) {
      try {
        // Ejecutar cierre atómico (archivar + borrar en una transacción)
        const result = await atomicArchiveAndReset(model.id, periodToCloseDate, periodToCloseType);
        
        if (result.success) {
          closureSuccessCount++;
          closureResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'completed',
            archived_count: result.archived,
            deleted_count: result.deleted
          });
        } else {
          closureErrorCount++;
          closureResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: result.error
          });
        }
      } catch (error) {
        closureErrorCount++;
        console.error(`❌ [CLOSE-PERIOD] Error cerrando modelo ${model.email}:`, error);
        closureResults.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`✅ [CLOSE-PERIOD] Proceso completado: ${closureSuccessCount} exitosos, ${closureErrorCount} errores`);

    // FASE 2: Esperar 2.5 minutos (150 segundos) para que Resumen de Facturación reciba última actualización
    console.log('⏳ [CLOSE-PERIOD] Esperando para última actualización del resumen...');
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'waiting_summary');
    
    // TEMPORAL PARA TESTING: 5 segundos en lugar de 150 segundos
    const waitTime = bypassGuardrails ? 5000 : 150000;
    if (bypassGuardrails) {
      console.log('🧪 [CLOSE-PERIOD] Modo bypass: espera reducida a 5 segundos');
    }
    await new Promise(resolve => setTimeout(resolve, waitTime));

    console.log('✅ [CLOSE-PERIOD] Tiempo de espera completado');

    // FASE 3: El resumen de facturación se actualiza automáticamente leyendo de calculator_history
    // No necesitamos endpoint especial - solo esperamos y luego continuamos
    
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'closing_summary');

    // FASE 4: (ELIMINADA - YA SE HIZO EN FASE 1 ATÓMICA)
    // El borrado ya ocurrió de forma segura dentro de atomicArchiveAndReset

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
        successful: closureSuccessCount,
        failed: closureErrorCount
      },
      reset_results: {
        total: models?.length || 0,
        successful: closureSuccessCount, // En modelo atómico, si se archiva se resetea
        failed: closureErrorCount
      },
      completed_at: new Date().toISOString()
    });

    console.log('✅ [CLOSE-PERIOD] Cierre completo exitoso');

    return NextResponse.json({
      success: true,
      message: 'Cierre de período completado exitosamente (MODO ATÓMICO)',
      period_date: periodToCloseDate,
      period_type: periodToCloseType,
      new_period_date: newPeriodDate,
      new_period_type: newPeriodType,
      archive_summary: {
        total: models?.length || 0,
        successful: closureSuccessCount,
        failed: closureErrorCount
      },
      reset_summary: {
        total: models?.length || 0,
        successful: closureSuccessCount,
        failed: closureErrorCount
      },
      details: {
        closure: closureResults
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


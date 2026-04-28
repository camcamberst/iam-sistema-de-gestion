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
  atomicArchiveAndReset,
  createBackupSnapshot
} from '@/lib/calculator/period-closure-helpers';
import { sendBotNotification } from '@/lib/chat/bot-notifications';
import { calculateAndSaveAllAffiliatesBilling } from '@/lib/affiliates/billing';

export const dynamic = 'force-dynamic';


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

    // FASE 1.5: CREAR BACKUP DE SEGURIDAD antes del archivado
    console.log('💾 [CLOSE-PERIOD] Creando backups de seguridad antes del archivado...');
    const backupResults = [];
    let backupSuccessCount = 0;
    let backupErrorCount = 0;

    for (const model of models || []) {
      try {
        const backupResult = await createBackupSnapshot(model.id, periodToCloseDate, periodToCloseType);
        if (backupResult.success) {
          backupSuccessCount++;
          backupResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'success',
            snapshot_id: backupResult.snapshotId
          });
        } else {
          backupErrorCount++;
          console.error(`❌ [CLOSE-PERIOD] Error creando backup para ${model.email}:`, backupResult.error);
          backupResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: backupResult.error
          });
        }
      } catch (error) {
        backupErrorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`❌ [CLOSE-PERIOD] Error crítico creando backup para ${model.email}:`, error);
        backupResults.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: errorMsg
        });
      }
    }

    console.log(`💾 [CLOSE-PERIOD] Backups completados: ${backupSuccessCount} exitosos, ${backupErrorCount} errores`);
    
    // Continuar con el proceso incluso si algunos backups fallan (no es crítico)
    if (backupErrorCount > 0) {
      console.warn(`⚠️ [CLOSE-PERIOD] ${backupErrorCount} backups fallaron, pero continuando con el archivado...`);
    }

    // FASE 2: Archivar y Resetear valores de todas las calculadoras DE FORMA ATÓMICA
    const closureResults = [];
    let closureSuccessCount = 0;
    let closureErrorCount = 0;

    for (const model of models || []) {
      try {
        // Ejecutar cierre atómico (archivar + borrar en una transacción)
        const result = await atomicArchiveAndReset(model.id, periodToCloseDate, periodToCloseType);
        
        if (result.success) {
          // 🔒 VALIDACIÓN ADICIONAL: Verificar que el archivo fue exitoso antes de continuar
          if (result.archived === 0 && result.deleted > 0) {
            // Caso especial: No había valores para archivar, pero se eliminaron valores residuales
            console.log(`⚠️ [CLOSE-PERIOD] Modelo ${model.email}: No había valores para archivar (puede ser normal si el período ya estaba limpio)`);
          } else if (result.archived === 0) {
            // No se archivó nada y no se eliminó nada - puede ser normal si no había valores
            console.log(`ℹ️ [CLOSE-PERIOD] Modelo ${model.email}: No había valores para procesar`);
          }
          
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
          const errorMsg = result.error || 'Error desconocido en atomicArchiveAndReset';
          console.error(`❌ [CLOSE-PERIOD] Error en cierre atómico para ${model.email}:`, errorMsg);
          closureResults.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: errorMsg
          });
        }
      } catch (error) {
        closureErrorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`❌ [CLOSE-PERIOD] Error cerrando modelo ${model.email}:`, error);
        closureResults.push({
          model_id: model.id,
          model_email: model.email,
          status: 'error',
          error: errorMsg
        });
      }
    }

    console.log(`✅ [CLOSE-PERIOD] Proceso de archivo completado: ${closureSuccessCount} exitosos, ${closureErrorCount} errores`);
    
    // 📊 RESUMEN DEL ARCHIVO COMPLETO: Verificar que todos los modelos tienen archivo completo con detalle por plataforma
    if (closureSuccessCount > 0) {
      console.log(`📊 [CLOSE-PERIOD] Verificando integridad del archivo completo generado...`);
      const { data: archiveSummary, error: summaryError } = await supabase
        .from('calculator_history')
        .select('model_id, platform_id')
        .eq('period_date', periodToCloseDate)
        .eq('period_type', periodToCloseType);
      
      if (!summaryError && archiveSummary) {
        const platformsByModel = new Map<string, Set<string>>();
        archiveSummary.forEach((record: any) => {
          if (!platformsByModel.has(record.model_id)) {
            platformsByModel.set(record.model_id, new Set());
          }
          platformsByModel.get(record.model_id)?.add(record.platform_id);
        });
        
        console.log(`✅ [CLOSE-PERIOD] Archivo completo generado correctamente:`);
        console.log(`   - Total modelos con archivo: ${platformsByModel.size}`);
        console.log(`   - Total registros archivados: ${archiveSummary.length}`);
        console.log(`   - Promedio de plataformas por modelo: ${(archiveSummary.length / platformsByModel.size).toFixed(1)}`);
        
        // Verificar que cada modelo exitoso tiene al menos una plataforma archivada
        const modelsWithoutPlatforms = Array.from(closureResults)
          .filter(r => r.status === 'completed' && r.archived_count === 0)
          .map(r => r.model_email);
        
        if (modelsWithoutPlatforms.length > 0) {
          console.warn(`⚠️ [CLOSE-PERIOD] ${modelsWithoutPlatforms.length} modelos marcados como exitosos pero sin plataformas archivadas: ${modelsWithoutPlatforms.join(', ')}`);
        }
      } else if (summaryError) {
        console.error(`❌ [CLOSE-PERIOD] Error obteniendo resumen del archivo:`, summaryError);
      }
    }

    // 🔒 VALIDACIÓN CRÍTICA: Si hay errores significativos, detener el proceso antes de resetear
    const errorThreshold = Math.floor((models?.length || 0) * 0.1); // 10% de errores es el umbral
    if (closureErrorCount > errorThreshold && !bypassGuardrails) {
      const errorMsg = `Demasiados errores en el archivo (${closureErrorCount} de ${models?.length || 0}). El proceso se detiene para evitar pérdida de datos.`;
      console.error(`❌ [CLOSE-PERIOD] ${errorMsg}`);
      await updateClosureStatus(periodToCloseDate, periodToCloseType, 'failed', {
        error: errorMsg,
        archive_results: {
          total: models?.length || 0,
          successful: closureSuccessCount,
          failed: closureErrorCount
        },
        failed_at: new Date().toISOString()
      });
      return NextResponse.json({
        success: false,
        error: errorMsg,
        archive_summary: {
          total: models?.length || 0,
          successful: closureSuccessCount,
          failed: closureErrorCount
        },
        details: {
          closure: closureResults
        }
      }, { status: 500 });
    }

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

    // FASE 4: Calcular y guardar facturación de afiliados
    console.log('💰 [CLOSE-PERIOD] Calculando facturación de afiliados...');
    const periodTypeForAffiliates = periodToCloseType === '1-15' ? 'P1' : 'P2';
    
    // Obtener tasa USD_COP actual
    const { data: rate } = await supabase
      .from('rates')
      .select('value')
      .eq('kind', 'USD→COP')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false })
      .limit(1)
      .single();
    
    const usdCopRate = rate?.value ? parseFloat(rate.value) : undefined;
    
    const affiliateBillingResult = await calculateAndSaveAllAffiliatesBilling(
      periodToCloseDate,
      periodTypeForAffiliates,
      usdCopRate
    );
    
    console.log(`✅ [CLOSE-PERIOD] Facturación de afiliados calculada: ${affiliateBillingResult.success} exitosos, ${affiliateBillingResult.errors} errores`);

    // FASE 5: (ELIMINADA - YA SE HIZO EN FASE 1 ATÓMICA)
    // El borrado ya ocurrió de forma segura dentro de atomicArchiveAndReset

    // FASE 6: Notificar a modelos
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

    // FASE 8: Limpiar registros de early freeze del período cerrado
    // IMPORTANTE: Limpiar TODOS los registros de este período, no solo los del período actual
    // porque el early freeze puede haberse ejecutado con diferentes period_date
    console.log('🧹 [CLOSE-PERIOD] Limpiando registros de early freeze del período cerrado...');
    
    // Calcular todas las posibles fechas del período (puede haber registros con diferentes fechas)
    const [year, month] = periodToCloseDate.split('-').map(Number);
    let periodStartDate: string;
    let periodEndDate: string;
    
    if (periodToCloseType === '1-15') {
      periodStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
      periodEndDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      periodStartDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate();
      periodEndDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    // Limpiar por period_date exacto (el que se usó en el cierre)
    const { data: deletedData1, error: cleanupError1 } = await supabase
      .from('calculator_early_frozen_platforms')
      .delete()
      .eq('period_date', periodToCloseDate)
      .select();
    
    // También limpiar por rango de fechas del período (por si hay registros con otras fechas)
    // Pero solo si no se eliminaron ya en el paso anterior
    const { data: deletedData2, error: cleanupError2 } = await supabase
      .from('calculator_early_frozen_platforms')
      .delete()
      .gte('period_date', periodStartDate)
      .lte('period_date', periodEndDate)
      .neq('period_date', periodToCloseDate) // Excluir los que ya se eliminaron
      .select();
    
    const deletedCount1 = deletedData1?.length || 0;
    const deletedCount2 = deletedData2?.length || 0;
    const totalDeleted = deletedCount1 + deletedCount2;
    
    if (cleanupError1 || cleanupError2) {
      console.error('❌ [CLOSE-PERIOD] Error limpiando early freeze:', cleanupError1 || cleanupError2);
      // No es crítico, continuar con el proceso
    } else {
      console.log(`✅ [CLOSE-PERIOD] Registros de early freeze limpiados: ${totalDeleted} registros eliminados`);
    }

    // FASE 9: Marcar como completado
    await updateClosureStatus(periodToCloseDate, periodToCloseType, 'completed', {
      backup_summary: {
        total: models?.length || 0,
        successful: backupSuccessCount,
        failed: backupErrorCount
      },
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
      backup_summary: {
        total: models?.length || 0,
        successful: backupSuccessCount,
        failed: backupErrorCount
      },
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


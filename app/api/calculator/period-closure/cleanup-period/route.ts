import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getPeriodToClose, getNewPeriodAfterClosure, isClosureDay } from '@/utils/period-closure-dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

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

interface CleanupResult {
  success: boolean;
  records_archived?: number;
  records_deleted?: number;
  totals_reset?: number;
  calculators_unfrozen?: boolean;
  execution_time_ms?: number;
  error?: string;
  validation_errors?: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  stats?: {
    models_in_history: number;
    models_with_values: number;
    total_records_in_history: number;
    total_records_in_values: number;
  };
}

/**
 * POST: Limpiar y resetear período después de archivar
 * 
 * Este endpoint SOLO se puede ejecutar si:
 * 1. Ya se ejecutó el archivado (existe calculator_history)
 * 2. Todos los datos están correctamente archivados
 * 3. No hay procesos en ejecución
 * 
 * Proceso:
 * 1. VALIDAR que se puede limpiar
 * 2. Adquirir lock anti-concurrencia
 * 3. Soft Delete: Mover model_values a archived_model_values
 * 4. Resetear calculator_totals a 0.00
 * 5. Descongelar todas las calculadoras
 * 6. Crear anuncio de Botty sobre nuevo período
 * 7. Liberar lock
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let lockId: string | null = null;
  let batchId: string | null = null;

  try {
    // 1. OBTENER Y VALIDAR USUARIO
    const body = await request.json();
    const { userId, groupId } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId es requerido'
      }, { status: 400 });
    }

    // Obtener información del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, affiliate_studio_id, groups:user_groups(group_id)')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 });
    }

    // Verificar rol
    const allowedRoles = ['super_admin', 'admin', 'superadmin_aff', 'admin_aff'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para ejecutar esta operación'
      }, { status: 403 });
    }

    console.log(`🧹 [CLEANUP-PERIOD] Iniciando limpieza por ${user.email} (${user.role})`);

    // 2. VALIDAR QUE ES DÍA DE CIERRE
    if (!isClosureDay()) {
      return NextResponse.json({
        success: false,
        error: 'Solo se puede limpiar en días 1 o 16'
      }, { status: 400 });
    }

    // 3. OBTENER PERÍODO A LIMPIAR
    const periodToClose = getPeriodToClose();
    const newPeriod = getNewPeriodAfterClosure();
    console.log(`📅 [CLEANUP-PERIOD] Período a limpiar:`, periodToClose);
    console.log(`🆕 [CLEANUP-PERIOD] Nuevo período:`, newPeriod);

    // 4. VALIDACIONES CRÍTICAS ANTES DE LIMPIAR
    const validation = await validateBeforeCleanup(
      periodToClose.periodDate,
      periodToClose.periodType,
      user
    );

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Validación fallida: No se puede ejecutar la limpieza',
        validation_errors: validation.errors
      }, { status: 400 });
    }

    console.log(`✅ [CLEANUP-PERIOD] Validaciones pasadas:`, validation.stats);

    // 5. ADQUIRIR LOCK ANTI-CONCURRENCIA
    const { data: lockResult } = await supabase.rpc('acquire_period_closure_lock', {
      p_period_date: periodToClose.periodDate,
      p_period_type: periodToClose.periodType,
      p_operation_type: 'cleanup',
      p_user_id: userId,
      p_user_email: user.email,
      p_user_name: user.name || user.email
    });

    if (!lockResult || !lockResult.success) {
      return NextResponse.json({
        success: false,
        error: 'El proceso de limpieza ya está en ejecución',
        locked_by: lockResult?.locked_by,
        locked_at: lockResult?.locked_at
      }, { status: 409 });
    }

    lockId = lockResult.lock_id;
    console.log(`🔒 [CLEANUP-PERIOD] Lock adquirido: ${lockId}`);

    // 6. REGISTRAR INICIO EN AUDIT LOG
    batchId = crypto.randomUUID();
    await supabase.from('period_closure_audit_log').insert({
      operation_type: 'cleanup_start',
      period_date: periodToClose.periodDate,
      period_type: periodToClose.periodType,
      batch_id: batchId,
      user_id: userId,
      user_email: user.email,
      user_role: user.role,
      user_group_id: groupId,
      status: 'success',
      details: {
        action: 'Iniciando limpieza de período',
        lock_id: lockId,
        validation_stats: validation.stats
      }
    });

    // 7. SOFT DELETE: Mover model_values a archived_model_values
    console.log(`📦 [CLEANUP-PERIOD] Moviendo datos a archivo...`);
    const archivedRecords = await softDeleteModelValues(
      periodToClose.periodDate,
      periodToClose.periodType,
      batchId,
      userId
    );
    console.log(`✅ [CLEANUP-PERIOD] ${archivedRecords} registros movidos a archived_model_values`);

    // 8. RESETEAR CALCULATOR_TOTALS A 0.00
    console.log(`🔄 [CLEANUP-PERIOD] Reseteando totales...`);
    const totalsReset = await resetCalculatorTotals(periodToClose.periodDate);
    console.log(`✅ [CLEANUP-PERIOD] ${totalsReset} totales reseteados`);

    // 9. DESCONGELAR TODAS LAS CALCULADORAS
    console.log(`🔓 [CLEANUP-PERIOD] Descongelando calculadoras...`);
    await unfreezeAllCalculators();
    console.log(`✅ [CLEANUP-PERIOD] Calculadoras descongeladas`);

    // 10. ACTUALIZAR ESTADO DE CIERRE
    await supabase
      .from('calculator_period_closure_status')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('period_date', periodToClose.periodDate)
      .eq('period_type', periodToClose.periodType);

    // 11. CREAR ANUNCIO DE BOTTY
    console.log(`📢 [CLEANUP-PERIOD] Creando anuncio de nuevo período...`);
    await createPeriodChangeAnnouncement(
      periodToClose,
      newPeriod,
      userId,
      user.email
    );

    // 12. REGISTRAR RESULTADO EN AUDIT LOG
    const executionTime = Date.now() - startTime;
    await supabase.from('period_closure_audit_log').insert({
      operation_type: 'cleanup_complete',
      period_date: periodToClose.periodDate,
      period_type: periodToClose.periodType,
      batch_id: batchId,
      user_id: userId,
      user_email: user.email,
      user_role: user.role,
      user_group_id: groupId,
      status: 'success',
      records_affected: archivedRecords,
      execution_time_ms: executionTime,
      details: {
        records_archived: archivedRecords,
        totals_reset: totalsReset,
        new_period: newPeriod
      }
    });

    // 13. LIBERAR LOCK
    await supabase.rpc('release_period_closure_lock', {
      p_lock_id: lockId,
      p_status: 'completed'
    });

    console.log(`✅ [CLEANUP-PERIOD] Limpieza completada exitosamente`);

    // 14. RESPONDER
    const response: CleanupResult = {
      success: true,
      records_archived: archivedRecords,
      totals_reset: totalsReset,
      calculators_unfrozen: true,
      execution_time_ms: executionTime
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [CLEANUP-PERIOD] Error:', error);

    // Liberar lock si existe
    if (lockId) {
      await supabase.rpc('release_period_closure_lock', {
        p_lock_id: lockId,
        p_status: 'failed',
        p_failure_reason: error.message
      });
    }

    // Registrar error en audit log
    if (batchId) {
      await supabase.from('period_closure_audit_log').insert({
        operation_type: 'cleanup_error',
        period_date: getPeriodToClose().periodDate,
        period_type: getPeriodToClose().periodType,
        batch_id: batchId,
        user_id: userId,
        status: 'failed',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime
      });
    }

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * VALIDACIONES CRÍTICAS antes de permitir limpieza
 */
async function validateBeforeCleanup(
  periodDate: string,
  periodType: string,
  user: any
): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    // 1. VERIFICAR QUE SE EJECUTÓ EL ARCHIVADO
    const { data: historyRecords, error: historyError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id')
      .eq('period_date', periodDate);

    if (historyError) {
      errors.push(`Error verificando historial: ${historyError.message}`);
      return { valid: false, errors };
    }

    if (!historyRecords || historyRecords.length === 0) {
      errors.push('❌ NO SE HA EJECUTADO EL ARCHIVADO. Debes crear el archivo histórico primero.');
      return { valid: false, errors };
    }

    // 2. VERIFICAR QUE HAY BACKUP EN CALC_SNAPSHOTS
    const { data: snapshot, error: snapshotError } = await supabase
      .from('calc_snapshots')
      .select('id')
      .eq('period_date', periodDate)
      .single();

    if (snapshotError && snapshotError.code !== 'PGRST116') {
      errors.push(`Error verificando snapshot: ${snapshotError.message}`);
    }

    if (!snapshot) {
      errors.push('⚠️ NO EXISTE BACKUP DE SEGURIDAD. Es recomendable tener un snapshot.');
    }

    // 3. CONTAR MODELOS EN HISTORIAL vs VALORES ACTUALES
    const modelsInHistory = new Set(
      historyRecords
        .filter(r => r.platform_id !== '__CONSOLIDATED_TOTAL__')
        .map(r => r.model_id)
    );

    const { data: currentValues, error: valuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id')
      .eq('period_date', periodDate);

    if (valuesError) {
      errors.push(`Error obteniendo valores actuales: ${valuesError.message}`);
      return { valid: false, errors };
    }

    const modelsWithValues = new Set(currentValues?.map(v => v.model_id) || []);

    // 4. VERIFICAR QUE TODAS LAS MODELOS CON VALORES ESTÁN EN EL HISTORIAL
    const missingInHistory: string[] = [];
    for (const modelId of modelsWithValues) {
      if (!modelsInHistory.has(modelId)) {
        missingInHistory.push(modelId);
      }
    }

    if (missingInHistory.length > 0) {
      errors.push(
        `❌ HAY ${missingInHistory.length} MODELOS CON VALORES QUE NO ESTÁN EN EL HISTORIAL. ` +
        `El archivado está incompleto.`
      );
    }

    // 5. VERIFICAR INTEGRIDAD DE TOTALES
    const { data: totalsInValues } = await supabase
      .rpc('calculate_period_totals', { p_period_date: periodDate });

    const { data: totalsInHistory } = await supabase
      .from('calculator_history')
      .select('model_id, value')
      .eq('period_date', periodDate)
      .eq('platform_id', '__CONSOLIDATED_TOTAL__');

    // Esta validación es informativa, no bloqueante
    if (totalsInValues && totalsInHistory && totalsInHistory.length > 0) {
      console.log(`  ℹ️ Verificación de totales: ${totalsInHistory.length} consolidados en historial`);
    }

    // 6. VERIFICAR QUE NO HAY LOCK ACTIVO DE ARCHIVADO
    const { data: activeLock } = await supabase
      .from('period_closure_locks')
      .select('operation_type, locked_by, admin_email')
      .eq('period_date', periodDate)
      .eq('status', 'active')
      .single();

    if (activeLock && activeLock.operation_type === 'archive') {
      errors.push(
        `❌ HAY UN PROCESO DE ARCHIVADO EN EJECUCIÓN por ${activeLock.admin_email}. ` +
        `Espera a que termine.`
      );
    }

    // Resultado
    const stats = {
      models_in_history: modelsInHistory.size,
      models_with_values: modelsWithValues.size,
      total_records_in_history: historyRecords.length,
      total_records_in_values: currentValues?.length || 0
    };

    if (errors.length > 0) {
      return { valid: false, errors, stats };
    }

    return { valid: true, errors: [], stats };

  } catch (error: any) {
    errors.push(`Error en validación: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Soft Delete: Mover model_values a archived_model_values
 */
async function softDeleteModelValues(
  periodDate: string,
  periodType: string,
  batchId: string,
  userId: string
): Promise<number> {
  try {
    // 1. Obtener todos los valores del período
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('period_date', periodDate);

    if (valuesError) {
      throw new Error(`Error obteniendo valores: ${valuesError.message}`);
    }

    if (!values || values.length === 0) {
      console.log(`  ℹ️ No hay valores para archivar`);
      return 0;
    }

    // 2. Extraer año y mes del período
    const [year, month] = periodDate.split('-').map(Number);

    // 3. Preparar registros para archived_model_values
    const archivedRecords = values.map(v => ({
      id: v.id,
      model_id: v.model_id,
      platform_id: v.platform_id,
      value: v.value,
      period_date: v.period_date,
      created_at: v.created_at,
      updated_at: v.updated_at,
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_batch_id: batchId,
      period_type: periodType,
      period_year: year,
      period_month: month,
      original_table: 'model_values',
      archive_reason: 'manual_period_closure',
      can_restore: true
    }));

    // 4. Insertar en archived_model_values
    const { error: archiveError } = await supabase
      .from('archived_model_values')
      .insert(archivedRecords);

    if (archiveError) {
      throw new Error(`Error insertando en archived_model_values: ${archiveError.message}`);
    }

    // 5. ELIMINAR de model_values (Soft delete completado)
    const { error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .eq('period_date', periodDate);

    if (deleteError) {
      throw new Error(`Error eliminando de model_values: ${deleteError.message}`);
    }

    console.log(`  ✅ ${values.length} registros movidos a archived_model_values`);
    return values.length;

  } catch (error: any) {
    console.error(`  ❌ Error en softDeleteModelValues: ${error.message}`);
    throw error;
  }
}

/**
 * Resetear calculator_totals a 0.00 para el nuevo período
 */
async function resetCalculatorTotals(periodDate: string): Promise<number> {
  try {
    // Obtener todos los totales del período cerrado
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('id')
      .eq('period_date', periodDate);

    if (totalsError) {
      throw new Error(`Error obteniendo totales: ${totalsError.message}`);
    }

    if (!totals || totals.length === 0) {
      console.log(`  ℹ️ No hay totales para resetear`);
      return 0;
    }

    // Eliminar los totales del período cerrado
    const { error: deleteError } = await supabase
      .from('calculator_totals')
      .delete()
      .eq('period_date', periodDate);

    if (deleteError) {
      throw new Error(`Error eliminando totales: ${deleteError.message}`);
    }

    console.log(`  ✅ ${totals.length} totales reseteados`);
    return totals.length;

  } catch (error: any) {
    console.error(`  ❌ Error en resetCalculatorTotals: ${error.message}`);
    throw error;
  }
}

/**
 * Descongelar todas las calculadoras
 */
async function unfreezeAllCalculators(): Promise<void> {
  try {
    // Limpiar todos los registros de congelación
    const { error: deleteError } = await supabase
      .from('calculator_frozen_platforms')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos

    if (deleteError) {
      throw new Error(`Error descongelando: ${deleteError.message}`);
    }

    // Actualizar estado de cierre
    const { error: updateError } = await supabase
      .from('calculator_period_closure_status')
      .update({ frozen: false })
      .eq('frozen', true);

    if (updateError) {
      console.warn(`  ⚠️ Error actualizando estado de cierre: ${updateError.message}`);
    }

    console.log(`  ✅ Calculadoras descongeladas`);

  } catch (error: any) {
    console.error(`  ❌ Error en unfreezeAllCalculators: ${error.message}`);
    throw error;
  }
}

/**
 * Crear anuncio de Botty sobre el cambio de período
 */
async function createPeriodChangeAnnouncement(
  closedPeriod: { periodDate: string; periodType: string },
  newPeriod: { periodDate: string; periodType: string },
  userId: string,
  adminEmail: string
): Promise<void> {
  try {
    const announcement = {
      title: '🔄 Nuevo Período Iniciado',
      message: `El período ${closedPeriod.periodType} ha sido cerrado exitosamente. ` +
               `Ya puedes empezar a registrar valores para el período ${newPeriod.periodType}.`,
      type: 'period_change',
      priority: 'high',
      created_by: userId,
      metadata: {
        closed_period: closedPeriod,
        new_period: newPeriod,
        closed_by: adminEmail,
        closed_at: new Date().toISOString()
      }
    };

    // Insertar en tabla de anuncios (si existe)
    const { error: announcementError } = await supabase
      .from('announcements')
      .insert(announcement);

    if (announcementError) {
      console.warn(`  ⚠️ Error creando anuncio: ${announcementError.message}`);
    } else {
      console.log(`  ✅ Anuncio de Botty creado`);
    }

  } catch (error: any) {
    console.warn(`  ⚠️ Error en createPeriodChangeAnnouncement: ${error.message}`);
    // No fallar la operación completa por esto
  }
}

/**
 * GET: Verificar si se puede ejecutar la limpieza
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId es requerido'
      }, { status: 400 });
    }

    // Obtener usuario
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, affiliate_studio_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 });
    }

    // Validar
    const periodToClose = getPeriodToClose();
    const validation = await validateBeforeCleanup(
      periodToClose.periodDate,
      periodToClose.periodType,
      user
    );

    return NextResponse.json({
      success: true,
      can_cleanup: validation.valid,
      validation_errors: validation.errors,
      stats: validation.stats
    });

  } catch (error: any) {
    console.error('❌ [CLEANUP-PERIOD] GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

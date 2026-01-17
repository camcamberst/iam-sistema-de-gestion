import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getCurrentPeriodType, getPeriodToClose, isClosureDay } from '@/utils/period-closure-dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para operaciones largas

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

interface ArchiveResult {
  success: boolean;
  batch_id?: string;
  models_archived?: number;
  records_archived?: number;
  history_records_created?: number;
  snapshot_created?: boolean;
  execution_time_ms?: number;
  error?: string;
  partial?: {
    models_attempted: number;
    models_succeeded: number;
    models_failed: number;
    failed_models: Array<{
      model_id: string;
      model_name: string;
      error: string;
      retry_count: number;
    }>;
  };
}

/**
 * POST: Crear archivo histórico del período cerrado
 * 
 * Este endpoint archiva los datos del período que acaba de cerrar:
 * - Día 1: Archiva período 16-31 del mes anterior
 * - Día 16: Archiva período 1-15 del mes actual
 * 
 * Proceso:
 * 1. Validar que es día de archivado (1 o 16)
 * 2. Adquirir lock anti-concurrencia
 * 3. Para cada modelo activa:
 *    - Crear registros en calculator_history
 *    - Crear backup en calc_snapshots
 *    - Implementar reintentos si falla (máx 3)
 * 4. Registrar en audit_log
 * 5. Liberar lock
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let lockId: string | null = null;
  let batchId: string | null = null;
  let userId: string | null = null;

  try {
    // 1. OBTENER Y VALIDAR USUARIO
    const body = await request.json();
    const userIdFromBody = body.userId;
    const groupId = body.groupId;
    userId = userIdFromBody;

    if (!userIdFromBody) {
      return NextResponse.json({
        success: false,
        error: 'userId es requerido'
      }, { status: 400 });
    }

    // Obtener información del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, affiliate_studio_id, groups:user_groups(group_id)')
      .eq('id', userIdFromBody)
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

    console.log(`📦 [ARCHIVE-PERIOD] Iniciando archivado por ${user.email} (${user.role})`);

    // 2. VALIDAR QUE ES DÍA DE CIERRE
    if (!isClosureDay()) {
      return NextResponse.json({
        success: false,
        error: 'Solo se puede archivar en días 1 o 16'
      }, { status: 400 });
    }

    // 3. OBTENER PERÍODO A CERRAR
    const periodToClose = getPeriodToClose();
    console.log(`📅 [ARCHIVE-PERIOD] Período a cerrar:`, periodToClose);

    // 4. VERIFICAR QUE NO EXISTA ARCHIVO PREVIO
    const { data: existingHistory } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('period_date', periodToClose.periodDate)
      .limit(1);

    if (existingHistory && existingHistory.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un archivo histórico para este período'
      }, { status: 400 });
    }

    // 5. ADQUIRIR LOCK ANTI-CONCURRENCIA
    const { data: lockResult } = await supabase.rpc('acquire_period_closure_lock', {
      p_period_date: periodToClose.periodDate,
      p_period_type: periodToClose.periodType,
      p_operation_type: 'archive',
      p_user_id: userIdFromBody,
      p_user_email: user.email,
      p_user_name: user.name || user.email
    });

    if (!lockResult || !lockResult.success) {
      return NextResponse.json({
        success: false,
        error: 'El proceso de archivado ya está en ejecución',
        locked_by: lockResult?.locked_by,
        locked_at: lockResult?.locked_at
      }, { status: 409 });
    }

    lockId = lockResult.lock_id;
    console.log(`🔒 [ARCHIVE-PERIOD] Lock adquirido: ${lockId}`);

    // 6. REGISTRAR INICIO EN AUDIT LOG
    batchId = crypto.randomUUID();
    await supabase.from('period_closure_audit_log').insert({
      operation_type: 'archive_start',
      period_date: periodToClose.periodDate,
      period_type: periodToClose.periodType,
      batch_id: batchId,
      user_id: userIdFromBody,
      user_email: user.email,
      user_role: user.role,
      user_group_id: groupId,
      status: 'success',
      details: {
        action: 'Iniciando archivado de período',
        lock_id: lockId
      }
    });

    // 7. OBTENER MODELOS A ARCHIVAR
    let modelsQuery = supabase
      .from('users')
      .select('id, name, email, affiliate_studio_id, groups:user_groups(group_id)')
      .eq('role', 'modelo')
      .eq('active', true);

    // Filtrar por permisos según el rol
    if (user.role === 'superadmin_aff' || user.role === 'admin_aff') {
      // Afiliados solo ven sus modelos
      modelsQuery = modelsQuery.eq('affiliate_studio_id', user.affiliate_studio_id);
    } else if (user.role === 'admin') {
      // Admin de Innova solo ve modelos de sus grupos
      const userGroupIds = user.groups?.map((g: any) => g.group_id) || [];
      if (userGroupIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Admin sin grupos asignados'
        }, { status: 403 });
      }
      
      // Esta consulta es compleja, vamos a filtrar después
      // modelsQuery = modelsQuery.in('groups.group_id', userGroupIds);
    }

    const { data: models, error: modelsError } = await modelsQuery;

    if (modelsError || !models) {
      throw new Error(`Error obteniendo modelos: ${modelsError?.message}`);
    }

    // Filtrar modelos por grupos si es admin
    let filteredModels = models;
    if (user.role === 'admin') {
      const userGroupIds = user.groups?.map((g: any) => g.group_id) || [];
      filteredModels = models.filter(model => {
        const modelGroupIds = (model as any).groups?.map((g: any) => g.group_id) || [];
        return modelGroupIds.some((gid: string) => userGroupIds.includes(gid));
      });
    }

    console.log(`👥 [ARCHIVE-PERIOD] ${filteredModels.length} modelos a archivar`);

    if (filteredModels.length === 0) {
      // Liberar lock
      await supabase.rpc('release_period_closure_lock', {
        p_lock_id: lockId,
        p_status: 'completed'
      });

      return NextResponse.json({
        success: true,
        message: 'No hay modelos para archivar',
        models_archived: 0
      });
    }

    // 8. ARCHIVAR CADA MODELO CON REINTENTOS
    const results = {
      succeeded: [] as string[],
      failed: [] as Array<{ model_id: string; model_name: string; error: string; retry_count: number }>
    };

    for (let i = 0; i < filteredModels.length; i++) {
      const model = filteredModels[i];
      
      // Actualizar progreso del lock
      await supabase.rpc('update_lock_progress', {
        p_lock_id: lockId,
        p_models_processed: i,
        p_models_total: filteredModels.length
      });

      // Intentar archivar con reintentos
      const archiveResult = await archiveModelWithRetry(
        model.id,
        model.name || model.email,
        periodToClose.periodDate,
        periodToClose.periodType,
        batchId,
        userIdFromBody
      );

      if (archiveResult.success) {
        results.succeeded.push(model.id);
      } else {
        results.failed.push({
          model_id: model.id,
          model_name: model.name || model.email,
          error: archiveResult.error || 'Error desconocido',
          retry_count: archiveResult.retry_count || 0
        });
      }
    }

    // Actualizar progreso final
    await supabase.rpc('update_lock_progress', {
      p_lock_id: lockId,
      p_models_processed: filteredModels.length,
      p_models_total: filteredModels.length
    });

    // 9. CREAR SNAPSHOT CONSOLIDADO
    const snapshotCreated = await createPeriodSnapshot(
      periodToClose.periodDate,
      periodToClose.periodType,
      batchId,
      userId
    );

    // 10. REGISTRAR RESULTADO EN AUDIT LOG
    const executionTime = Date.now() - startTime;
    const isPartial = results.failed.length > 0;
    const status = results.failed.length === filteredModels.length ? 'failed' : 
                   isPartial ? 'partial' : 'success';

    await supabase.from('period_closure_audit_log').insert({
      operation_type: 'archive_complete',
      period_date: periodToClose.periodDate,
      period_type: periodToClose.periodType,
      batch_id: batchId,
      user_id: userIdFromBody,
      user_email: user.email,
      user_role: user.role,
      user_group_id: groupId,
      status,
      models_affected: results.succeeded.length,
      execution_time_ms: executionTime,
      details: {
        models_attempted: filteredModels.length,
        models_succeeded: results.succeeded.length,
        models_failed: results.failed.length,
        failed_models: results.failed,
        snapshot_created: snapshotCreated
      }
    });

    // 11. LIBERAR LOCK
    await supabase.rpc('release_period_closure_lock', {
      p_lock_id: lockId,
      p_status: status === 'failed' ? 'failed' : 'completed',
      p_failure_reason: isPartial ? `${results.failed.length} modelos fallaron` : null
    });

    console.log(`✅ [ARCHIVE-PERIOD] Completado: ${results.succeeded.length}/${filteredModels.length} modelos archivados`);

    // 12. RESPONDER
    const response: ArchiveResult = {
      success: true,
      batch_id: batchId,
      models_archived: results.succeeded.length,
      snapshot_created: snapshotCreated,
      execution_time_ms: executionTime
    };

    if (isPartial) {
      response.partial = {
        models_attempted: filteredModels.length,
        models_succeeded: results.succeeded.length,
        models_failed: results.failed.length,
        failed_models: results.failed
      };
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [ARCHIVE-PERIOD] Error:', error);

    // Liberar lock si existe
    if (lockId) {
      await supabase.rpc('release_period_closure_lock', {
        p_lock_id: lockId,
        p_status: 'failed',
        p_failure_reason: error.message
      });
    }

    // Registrar error en audit log
    if (batchId && userId) {
      await supabase.from('period_closure_audit_log').insert({
        operation_type: 'archive_error',
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
 * Archiva los datos de una modelo con reintentos inteligentes
 * Máximo 3 intentos antes de fallar
 */
async function archiveModelWithRetry(
  modelId: string,
  modelName: string,
  periodDate: string,
  periodType: string,
  batchId: string,
  userId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; error?: string; retry_count: number }> {
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  📝 [${modelName}] Intento ${attempt}/${maxRetries}...`);
      
      await archiveModelData(modelId, periodDate, periodType, batchId, userId);
      
      console.log(`  ✅ [${modelName}] Archivado exitoso`);
      return { success: true, retry_count: attempt - 1 };
      
    } catch (error: any) {
      lastError = error.message;
      console.error(`  ⚠️ [${modelName}] Intento ${attempt} falló: ${lastError}`);
      
      // Si es el último intento, fallar
      if (attempt === maxRetries) {
        console.error(`  ❌ [${modelName}] Falló después de ${maxRetries} intentos`);
        return { success: false, error: lastError, retry_count: maxRetries };
      }
      
      // Esperar antes del siguiente intento (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  
  return { success: false, error: lastError, retry_count: maxRetries };
}

/**
 * Archiva los datos de una modelo específica
 * Crea registros en calculator_history
 */
async function archiveModelData(
  modelId: string,
  periodDate: string,
  periodType: string,
  batchId: string,
  userId: string
): Promise<void> {
  // 1. Obtener valores de la modelo para este período
  const { data: modelValues, error: valuesError } = await supabase
    .from('model_values')
    .select('*')
    .eq('model_id', modelId)
    .eq('period_date', periodDate);

  if (valuesError) {
    throw new Error(`Error obteniendo valores: ${valuesError.message}`);
  }

  if (!modelValues || modelValues.length === 0) {
    console.log(`  ℹ️ Modelo ${modelId} no tiene valores para archivar`);
    return;
  }

  // 2. Obtener totales calculados
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('*')
    .eq('model_id', modelId)
    .eq('period_date', periodDate)
    .single();

  if (totalsError && totalsError.code !== 'PGRST116') {
    throw new Error(`Error obteniendo totales: ${totalsError.message}`);
  }

  // 3. Crear registros en calculator_history (uno por plataforma)
  const historyRecords = modelValues.map(mv => ({
    model_id: modelId,
    period_date: periodDate,
    period_type: periodType,
    platform_id: mv.platform_id,
    value: mv.value,
    created_by: userId,
    batch_id: batchId,
    metadata: {
      archived_at: new Date().toISOString(),
      original_created_at: mv.created_at,
      original_updated_at: mv.updated_at
    }
  }));

  const { error: historyError } = await supabase
    .from('calculator_history')
    .insert(historyRecords);

  if (historyError) {
    throw new Error(`Error creando historial: ${historyError.message}`);
  }

  // 4. Si hay totales, crear registro consolidado
  if (totals) {
    const { error: consolidatedError } = await supabase
      .from('calculator_history')
      .insert({
        model_id: modelId,
        period_date: periodDate,
        period_type: periodType,
        platform_id: '__CONSOLIDATED_TOTAL__',
        value: totals.total_usd || 0,
        created_by: userId,
        batch_id: batchId,
        metadata: {
          archived_at: new Date().toISOString(),
          is_consolidated: true,
          ...totals
        }
      });

    if (consolidatedError) {
      console.warn(`  ⚠️ Error creando total consolidado: ${consolidatedError.message}`);
    }
  }

  console.log(`  ✅ ${modelValues.length} registros archivados para modelo ${modelId}`);
}

/**
 * Crea snapshot consolidado del período completo
 */
async function createPeriodSnapshot(
  periodDate: string,
  periodType: string,
  batchId: string,
  userId: string
): Promise<boolean> {
  try {
    // Obtener todos los valores del período
    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('period_date', periodDate);

    if (valuesError || !allValues) {
      console.error(`  ❌ Error obteniendo valores para snapshot: ${valuesError?.message}`);
      return false;
    }

    // Obtener todos los totales
    const { data: allTotals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('period_date', periodDate);

    if (totalsError) {
      console.error(`  ⚠️ Error obteniendo totales para snapshot: ${totalsError.message}`);
    }

    // Crear snapshot
    const { error: snapshotError } = await supabase
      .from('calc_snapshots')
      .insert({
        period_date: periodDate,
        period_type: periodType,
        snapshot_data: {
          values: allValues,
          totals: allTotals || [],
          archived_at: new Date().toISOString(),
          batch_id: batchId,
          created_by: userId
        },
        created_by: userId
      });

    if (snapshotError) {
      console.error(`  ❌ Error creando snapshot: ${snapshotError.message}`);
      return false;
    }

    console.log(`  ✅ Snapshot creado para período ${periodDate}`);
    return true;

  } catch (error: any) {
    console.error(`  ❌ Error en createPeriodSnapshot: ${error.message}`);
    return false;
  }
}

/**
 * GET: Obtener estado del archivado
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodDate = searchParams.get('periodDate');

    if (!periodDate) {
      return NextResponse.json({
        success: false,
        error: 'periodDate es requerido'
      }, { status: 400 });
    }

    // Verificar si existe archivo
    const { data: historyExists } = await supabase
      .from('calculator_history')
      .select('batch_id, created_at')
      .eq('period_date', periodDate)
      .limit(1);

    // Verificar lock activo
    const { data: activeLock } = await supabase
      .from('period_closure_locks')
      .select('*')
      .eq('period_date', periodDate)
      .eq('operation_type', 'archive')
      .eq('status', 'active')
      .single();

    // Obtener último log
    const { data: lastLog } = await supabase
      .from('period_closure_audit_log')
      .select('*')
      .eq('period_date', periodDate)
      .in('operation_type', ['archive_start', 'archive_complete', 'archive_error'])
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      archived: !!(historyExists && historyExists.length > 0),
      in_progress: !!activeLock,
      lock: activeLock,
      last_log: lastLog
    });

  } catch (error: any) {
    console.error('❌ [ARCHIVE-PERIOD] GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

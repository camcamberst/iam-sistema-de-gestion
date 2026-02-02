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

    // Obtener información del usuario (sin relación user_groups para evitar errores de esquema)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, affiliate_studio_id')
      .eq('id', userIdFromBody)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({
        success: false,
        error: userError?.message ? `Usuario: ${userError.message}` : 'Usuario no encontrado'
      }, { status: 404 });
    }

    // Para admin, cargar grupos desde user_groups por separado
    let user = { ...userRow, groups: [] as { group_id: string }[] };
    if (userRow.role === 'admin') {
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userIdFromBody);
      user.groups = (userGroups || []).map((r: { group_id: string }) => ({ group_id: r.group_id }));
    }

    // Solo super_admin puede ejecutar el cierre de período (evitar duplicados y conflictos)
    if (user.role !== 'super_admin') {
      return NextResponse.json({
        success: false,
        error: 'Solo el super admin puede ejecutar el cierre de período'
      }, { status: 403 });
    }

    console.log(`📦 [ARCHIVE-PERIOD] Iniciando archivado por ${user.email} (super_admin)`);

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
    const { data: lockResult, error: lockError } = await supabase.rpc('acquire_period_closure_lock', {
      p_period_date: periodToClose.periodDate,
      p_period_type: periodToClose.periodType,
      p_operation_type: 'archive',
      p_user_id: userIdFromBody,
      p_user_email: user.email,
      p_user_name: user.name || user.email
    });

    if (lockError) {
      return NextResponse.json({
        success: false,
        error: `Lock: ${lockError.message}. ¿Está creada la función acquire_period_closure_lock en Supabase?`
      }, { status: 500 });
    }
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

    // 7. OBTENER MODELOS A ARCHIVAR (sin relación user_groups para evitar errores de esquema)
    let modelsQuery = supabase
      .from('users')
      .select('id, name, email, affiliate_studio_id')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (user.role === 'superadmin_aff' || user.role === 'admin_aff') {
      modelsQuery = modelsQuery.eq('affiliate_studio_id', user.affiliate_studio_id);
    } else if (user.role === 'admin') {
      const userGroupIds = user.groups?.map((g: { group_id: string }) => g.group_id) || [];
      if (userGroupIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Admin sin grupos asignados'
        }, { status: 403 });
      }
    }

    const { data: models, error: modelsError } = await modelsQuery;

    if (modelsError || !models) {
      return NextResponse.json({
        success: false,
        error: modelsError?.message ? `Modelos: ${modelsError.message}` : 'Error obteniendo modelos'
      }, { status: 500 });
    }

    // Filtrar modelos por grupos si es admin (consultando user_groups por separado)
    let filteredModels = models;
    if (user.role === 'admin' && models.length > 0) {
      const modelIds = models.map((m: { id: string }) => m.id);
      const { data: modelGroups, error: mgError } = await supabase
        .from('user_groups')
        .select('user_id, group_id')
        .in('user_id', modelIds);
      if (mgError) {
        return NextResponse.json({
          success: false,
          error: `Grupos de modelos: ${mgError.message}`
        }, { status: 500 });
      }
      const userGroupIds = user.groups.map((g: { group_id: string }) => g.group_id);
      const modelIdsInGroups = new Set(
        (modelGroups || [])
          .filter((r: { group_id: string }) => userGroupIds.includes(r.group_id))
          .map((r: { user_id: string }) => r.user_id)
      );
      filteredModels = models.filter((m: { id: string }) => modelIdsInGroups.has(m.id));
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
      userIdFromBody
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
    const message = error?.message ?? String(error);
    console.error('❌ [ARCHIVE-PERIOD] Error:', message, error);

    // Liberar lock si existe
    if (lockId) {
      await supabase.rpc('release_period_closure_lock', {
        p_lock_id: lockId,
        p_status: 'failed',
        p_failure_reason: message
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
        error_message: message,
        execution_time_ms: Date.now() - startTime
      });
    }

    return NextResponse.json({
      success: false,
      error: message
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
 * Calcula USD bruto por plataforma (misma lógica que Mi Calculadora y archive-p2-enero)
 */
function calculateUsdBrutoArchive(
  value: number,
  platformId: string,
  currency: string,
  rates: { eur_usd: number; gbp_usd: number; usd_cop: number }
): number {
  const n = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (currency === 'EUR') {
    if (n === 'big7') return (value * rates.eur_usd) * 0.84;
    if (n === 'mondo') return (value * rates.eur_usd) * 0.78;
    return value * rates.eur_usd;
  }
  if (currency === 'GBP') {
    if (n === 'aw') return (value * rates.gbp_usd) * 0.677;
    return value * rates.gbp_usd;
  }
  if (currency === 'USD') {
    if (n === 'cmd' || n === 'camlust' || n === 'skypvt') return value * 0.75;
    if (n === 'chaturbate' || n === 'myfreecams' || n === 'stripchat') return value * 0.05;
    if (n === 'dxlive') return value * 0.60;
    if (n === 'secretfriends') return value * 0.5;
    return value;
  }
  return 0;
}

/**
 * Archiva los datos de una modelo específica en calculator_history.
 * Misma lógica que el cierre P2 enero: rango de fechas, último valor por plataforma,
 * tasas activas, porcentaje por plataforma (Superfoon 100%), value_usd_bruto/modelo/cop.
 */
async function archiveModelData(
  modelId: string,
  periodDate: string,
  periodType: string,
  batchId: string,
  userId: string
): Promise<void> {
  const [year, month] = periodDate.split('-').map(Number);
  const startDate = periodType === '1-15'
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : periodDate;
  const endDate = periodType === '1-15'
    ? `${year}-${String(month).padStart(2, '0')}-15`
    : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

  // 1. Valores en el rango del período (último por plataforma)
  const { data: rows, error: valuesError } = await supabase
    .from('model_values')
    .select('platform_id, value, updated_at')
    .eq('model_id', modelId)
    .gte('period_date', startDate)
    .lte('period_date', endDate)
    .order('updated_at', { ascending: false });

  if (valuesError) throw new Error(`Error obteniendo valores: ${valuesError.message}`);
  if (!rows?.length) {
    console.log(`  ℹ️ Modelo ${modelId} no tiene valores para archivar`);
    return;
  }

  const byPlatform = new Map<string, number>();
  for (const r of rows as { platform_id: string; value: number | null; updated_at: string }[]) {
    if (r.platform_id === '__CONSOLIDATED_TOTAL__') continue;
    if (!byPlatform.has(r.platform_id)) byPlatform.set(r.platform_id, Number(r.value) || 0);
  }

  // 2. Tasas activas
  const { data: ratesRows } = await supabase
    .from('rates')
    .select('kind, value')
    .eq('active', true)
    .is('valid_to', null)
    .order('valid_from', { ascending: false });
  const rates = {
    eur_usd: (ratesRows || []).find((r: { kind: string }) => r.kind === 'EUR→USD')?.value ?? 1.01,
    gbp_usd: (ratesRows || []).find((r: { kind: string }) => r.kind === 'GBP→USD')?.value ?? 1.20,
    usd_cop: (ratesRows || []).find((r: { kind: string }) => r.kind === 'USD→COP')?.value ?? 3900
  };

  // 3. Config del modelo (porcentaje) y moneda por plataforma
  const { data: config } = await supabase
    .from('calculator_config')
    .select('percentage_override, group_percentage')
    .eq('model_id', modelId)
    .eq('active', true)
    .single();
  const modelPct = config?.percentage_override ?? config?.group_percentage ?? 80;

  const platformIds = Array.from(byPlatform.keys());
  const { data: platformsData } = await supabase
    .from('calculator_platforms')
    .select('id, currency')
    .in('id', platformIds);
  const currencyByPlatform: Record<string, string> = {};
  (platformsData || []).forEach((p: { id: string; currency?: string }) => { currencyByPlatform[p.id] = p.currency || 'USD'; });

  // 4. Construir registros con cálculos (igual que P2 enero)
  const historyRecords: Array<{
    model_id: string;
    period_date: string;
    period_type: string;
    platform_id: string;
    value: number;
    rate_eur_usd: number;
    rate_gbp_usd: number;
    rate_usd_cop: number;
    platform_percentage: number;
    value_usd_bruto: number;
    value_usd_modelo: number;
    value_cop_modelo: number;
    archived_at?: string;
  }> = [];

  for (const [platformId, value] of byPlatform.entries()) {
    const currency = currencyByPlatform[platformId] || 'USD';
    const isSuperfoon = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'superfoon';
    const platformPercentage = isSuperfoon ? 100 : modelPct;
    const valueUsdBruto = calculateUsdBrutoArchive(value, platformId, currency, rates);
    const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
    const valueCopModelo = valueUsdModelo * rates.usd_cop;
    historyRecords.push({
      model_id: modelId,
      period_date: startDate,
      period_type: periodType,
      platform_id: platformId,
      value,
      rate_eur_usd: rates.eur_usd,
      rate_gbp_usd: rates.gbp_usd,
      rate_usd_cop: rates.usd_cop,
      platform_percentage: platformPercentage,
      value_usd_bruto: Math.round(valueUsdBruto * 100) / 100,
      value_usd_modelo: Math.round(valueUsdModelo * 100) / 100,
      value_cop_modelo: Math.round(valueCopModelo),
      archived_at: new Date().toISOString()
    });
  }

  const { error: historyError } = await supabase
    .from('calculator_history')
    .insert(historyRecords);

  if (historyError) {
    throw new Error(`Error creando historial: ${historyError.message}`);
  }

  // 5. Fila consolidada (valor = suma de valores por plataforma, sin mezclar monedas en totales USD/COP)
  const totalValue = Array.from(byPlatform.values()).reduce((a, b) => a + b, 0);
  const { error: consolidatedError } = await supabase
    .from('calculator_history')
    .insert({
      model_id: modelId,
      period_date: startDate,
      period_type: periodType,
      platform_id: '__CONSOLIDATED_TOTAL__',
      value: totalValue,
      rate_eur_usd: rates.eur_usd,
      rate_gbp_usd: rates.gbp_usd,
      rate_usd_cop: rates.usd_cop,
      archived_at: new Date().toISOString()
    });

  if (consolidatedError) {
    console.warn(`  ⚠️ Error creando total consolidado: ${consolidatedError.message}`);
  }

  console.log(`  ✅ ${historyRecords.length} registros archivados para modelo ${modelId}`);
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

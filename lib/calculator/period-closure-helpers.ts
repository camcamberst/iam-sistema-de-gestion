/**
 * 🔧 HELPERS PARA CIERRE DE PERÍODOS
 * 
 * Funciones auxiliares para el proceso de cierre
 */

import { createClient } from '@supabase/supabase-js';
import { ClosureStatus } from './period-closure-states';
import { EARLY_FREEZE_PLATFORMS } from '@/utils/period-closure-dates';

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
 * Crea o actualiza el estado de cierre de período
 */
export const updateClosureStatus = async (
  periodDate: string,
  periodType: '1-15' | '16-31',
  status: ClosureStatus,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verificar si existe registro
    const { data: existing } = await supabase
      .from('calculator_period_closure_status')
      .select('id')
      .eq('period_date', periodDate)
      .single();

    if (existing) {
      // Actualizar
      const { error } = await supabase
        .from('calculator_period_closure_status')
        .update({
          status,
          metadata: metadata || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Crear nuevo
      const { error } = await supabase
        .from('calculator_period_closure_status')
        .insert({
          period_date: periodDate,
          period_type: periodType,
          status,
          metadata: metadata || {}
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error actualizando estado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Marca plataformas como congeladas anticipadamente
 */
export const freezePlatformsForModel = async (
  periodDate: string,
  modelId: string,
  platformIds: string[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const records = platformIds.map(platformId => ({
      period_date: periodDate,
      model_id: modelId,
      platform_id: platformId,
      frozen_at: new Date().toISOString()
    }));

    // Usar upsert para evitar duplicados
    const { error } = await supabase
      .from('calculator_early_frozen_platforms')
      .upsert(records, {
        onConflict: 'period_date,model_id,platform_id',
        ignoreDuplicates: false
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error congelando plataformas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Verifica si una plataforma está congelada para un modelo
 */
export const isPlatformFrozen = async (
  periodDate: string,
  modelId: string,
  platformId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('id')
      .eq('period_date', periodDate)
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return !!data;
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error verificando congelación:', error);
    return false;
  }
};

/**
 * Obtiene todas las plataformas congeladas para un modelo
 */
export const getFrozenPlatformsForModel = async (
  periodDate: string,
  modelId: string
): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('platform_id')
      .eq('period_date', periodDate)
      .eq('model_id', modelId);

    if (error) throw error;

    return data?.map(r => r.platform_id) || [];
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error obteniendo plataformas congeladas:', error);
    return [];
  }
};

/**
 * Calcula USD bruto desde un valor de plataforma según su moneda y reglas específicas
 */
const calculateUsdBruto = (
  value: number,
  platformId: string,
  currency: string,
  rates: { eur_usd: number; gbp_usd: number; usd_cop: number }
): number => {
  if (currency === 'EUR') {
    if (platformId === 'big7') {
      return (value * rates.eur_usd) * 0.84; // 16% impuesto
    } else if (platformId === 'mondo') {
      return (value * rates.eur_usd) * 0.78; // 22% descuento
    } else {
      return value * rates.eur_usd;
    }
  } else if (currency === 'GBP') {
    if (platformId === 'aw') {
      return (value * rates.gbp_usd) * 0.677; // 32.3% descuento
    } else {
      return value * rates.gbp_usd;
    }
  } else if (currency === 'USD') {
    if (platformId === 'cmd' || platformId === 'camlust' || platformId === 'skypvt') {
      return value * 0.75; // 25% descuento
    } else if (platformId === 'chaturbate' || platformId === 'myfreecams' || platformId === 'stripchat') {
      return value * 0.05; // 100 tokens = 5 USD
    } else if (platformId === 'dxlive') {
      return value * 0.60; // 100 pts = 60 USD
    } else if (platformId === 'secretfriends') {
      return value * 0.5; // 50% descuento
    } else if (platformId === 'superfoon') {
      return value; // 100% directo
    } else {
      // MDH, livejasmin, imlive, hegre, dirtyfans, camcontacts, etc.
      return value;
    }
  }
  return 0;
};

/**
 * Archiva y resetea valores de un modelo de forma ATÓMICA usando RPC
 */
export const atomicArchiveAndReset = async (
  modelId: string,
  periodDate: string, // Fecha de referencia (ej: 2025-10-16 para período 16-31)
  periodType: '1-15' | '16-31'
): Promise<{ success: boolean; archived: number; deleted: number; error?: string }> => {
  try {
    // Calcular rango de fechas del período
    const [year, month] = periodDate.split('-').map(Number);
    let startDate: string;
    let endDate: string;
    
    if (periodType === '1-15') {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    console.log(`⚛️ [ATOMIC-CLOSE] Iniciando cierre atómico para ${periodType}: ${startDate} a ${endDate}`);

    // 1. Obtener tasas activas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) throw ratesError;

    const rates = {
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900
    };

    // 2. Obtener configuración del modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') throw configError;

    const modelPercentage = config?.percentage_override || config?.group_percentage || 80;

    // 3. Obtener información de plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true);

    if (platformsError) throw platformsError;

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // 4. Obtener valores en el rango del período
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (valuesError) throw valuesError;

    if (!values || values.length === 0) {
      console.log(`⚛️ [ATOMIC-CLOSE] No hay valores para archivar en el rango ${startDate} a ${endDate}`);
      return { success: true, archived: 0, deleted: 0 };
    }

    // 5. Consolidar valores (último update por plataforma)
    const valuesByPlatform = new Map<string, any>();
    for (const value of values) {
      const existing = valuesByPlatform.get(value.platform_id);
      if (!existing || new Date(value.updated_at) > new Date(existing.updated_at)) {
        valuesByPlatform.set(value.platform_id, value);
      }
    }

    // 6. Preparar datos históricos con cálculos
    const historyRecords = [];
    for (const [platformId, value] of Array.from(valuesByPlatform.entries())) {
      const platform = platformMap.get(platformId);
      const currency = platform?.currency || 'USD';
      const isSuperfoon = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'superfoon';
      const platformPercentage = isSuperfoon ? 100 : modelPercentage;
      
      const valueUsdBruto = calculateUsdBruto(Number(value.value), platformId, currency, rates);
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      const valueCopModelo = valueUsdModelo * rates.usd_cop;

      historyRecords.push({
        model_id: value.model_id,
        platform_id: platformId,
        value: Number(value.value),
        original_updated_at: value.updated_at,
        rate_eur_usd: rates.eur_usd,
        rate_gbp_usd: rates.gbp_usd,
        rate_usd_cop: rates.usd_cop,
        platform_percentage: platformPercentage,
        value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
        value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
        value_cop_modelo: parseFloat(valueCopModelo.toFixed(2))
      });
    }

    // 7. ARCHIVAR VALORES EN CALCULATOR_HISTORY (sin RPC, operaciones directas)
    console.log(`📝 [ATOMIC-CLOSE] Archivando ${historyRecords.length} registros en calculator_history...`);
    
    // Preparar registros con campos completos para calculator_history
    const historyInserts = historyRecords.map(record => ({
      model_id: record.model_id,
      platform_id: record.platform_id,
      period_date: startDate,
      period_type: periodType,
      value: record.value,
      rate_eur_usd: record.rate_eur_usd,
      rate_gbp_usd: record.rate_gbp_usd,
      rate_usd_cop: record.rate_usd_cop,
      platform_percentage: record.platform_percentage,
      value_usd_bruto: record.value_usd_bruto,
      value_usd_modelo: record.value_usd_modelo,
      value_cop_modelo: record.value_cop_modelo,
      archived_at: new Date().toISOString()
    }));

    // Insertar en calculator_history (upsert para evitar duplicados)
    if (historyInserts.length > 0) {
      const { error: historyError } = await supabase
        .from('calculator_history')
        .upsert(historyInserts, { 
          onConflict: 'model_id,platform_id,period_date,period_type',
          ignoreDuplicates: false 
        });

      if (historyError) {
        console.error(`❌ [ATOMIC-CLOSE] Error archivando en history:`, historyError);
        throw historyError;
      }

      // 🔒 VALIDACIÓN CRÍTICA: Verificar que el archivo completo se generó correctamente
      // IMPORTANTE: El archivo debe tener detalle por plataforma, no solo totales consolidados
      console.log(`🔍 [ATOMIC-CLOSE] Validando que el archivo completo se generó correctamente...`);
      const { data: verificationData, error: verificationError } = await supabase
        .from('calculator_history')
        .select('id, model_id, platform_id, period_date, period_type, value_usd_bruto, value_usd_modelo, value_cop_modelo')
        .eq('model_id', modelId)
        .eq('period_date', startDate)
        .eq('period_type', periodType);

      if (verificationError) {
        console.error(`❌ [ATOMIC-CLOSE] Error verificando inserción:`, verificationError);
        throw new Error(`Validación fallida: No se pudo verificar la inserción en calculator_history: ${verificationError.message}`);
      }

      const verifiedCount = verificationData?.length || 0;
      if (verifiedCount < historyInserts.length) {
        const errorMsg = `Validación fallida: Se intentaron insertar ${historyInserts.length} registros pero solo se verificaron ${verifiedCount} en calculator_history`;
        console.error(`❌ [ATOMIC-CLOSE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // 🔒 VALIDACIÓN ADICIONAL: Verificar que el archivo tiene el detalle completo por plataforma
      const verifiedPlatforms = new Set(verificationData?.map((r: any) => r.platform_id) || []);
      const expectedPlatforms = new Set(historyInserts.map(r => r.platform_id));
      
      if (verifiedPlatforms.size !== expectedPlatforms.size) {
        const errorMsg = `Validación fallida: Se esperaban ${expectedPlatforms.size} plataformas pero se verificaron ${verifiedPlatforms.size}. Plataformas esperadas: ${Array.from(expectedPlatforms).join(', ')}. Plataformas verificadas: ${Array.from(verifiedPlatforms).join(', ')}`;
        console.error(`❌ [ATOMIC-CLOSE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // 🔒 VALIDACIÓN DE INTEGRIDAD: Verificar que todos los registros tienen los campos calculados
      const incompleteRecords = verificationData?.filter((r: any) => 
        r.value_usd_bruto === null || r.value_usd_bruto === undefined ||
        r.value_usd_modelo === null || r.value_usd_modelo === undefined ||
        r.value_cop_modelo === null || r.value_cop_modelo === undefined
      ) || [];

      if (incompleteRecords.length > 0) {
        const errorMsg = `Validación fallida: ${incompleteRecords.length} registros no tienen los campos calculados completos (value_usd_bruto, value_usd_modelo, value_cop_modelo)`;
        console.error(`❌ [ATOMIC-CLOSE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ [ATOMIC-CLOSE] Validación exitosa: ${verifiedCount} registros verificados con detalle completo por plataforma`);
      console.log(`   📊 Plataformas archivadas: ${Array.from(verifiedPlatforms).join(', ')}`);
    }

    console.log(`✅ [ATOMIC-CLOSE] ${historyInserts.length} registros archivados y verificados`);

    // 🛡️ PASO 1: CREAR BACKUP DE SEGURIDAD FÍSICO ANTES DE CUALQUIER DELETE
    console.log(`🛡️ [ATOMIC-CLOSE] Creando backup de seguridad FÍSICO antes del DELETE...`);
    
    const { data: backupResult, error: backupError } = await supabase.rpc('create_safety_backup_before_delete', {
      p_model_id: modelId,
      p_period_start_date: startDate,
      p_period_end_date: endDate,
      p_period_type: periodType
    });

    if (backupError || !backupResult || backupResult.length === 0 || !backupResult[0].success) {
      const errorMsg = backupError?.message || backupResult?.[0]?.error_message || 'Error desconocido';
      console.error(`❌ [ATOMIC-CLOSE] FALLO CRÍTICO: No se pudo crear backup de seguridad: ${errorMsg}`);
      throw new Error(`SEGURIDAD: No se puede eliminar datos sin backup. Error: ${errorMsg}`);
    }

    const backedUpCount = backupResult[0].backed_up_count || 0;
    console.log(`🛡️ [ATOMIC-CLOSE] Backup de seguridad creado: ${backedUpCount} registros respaldados`);

    // 🔒 PASO 2: VERIFICAR QUE EL BACKUP COINCIDE CON LOS DATOS A ELIMINAR
    if (backedUpCount !== values.length) {
      const errorMsg = `SEGURIDAD: Backup incompleto. Esperados: ${values.length}, Respaldados: ${backedUpCount}`;
      console.error(`❌ [ATOMIC-CLOSE] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 🔒 PASO 3: VERIFICAR QUE CALCULATOR_HISTORY TIENE TODOS LOS REGISTROS
    console.log(`🔍 [ATOMIC-CLOSE] Verificación FINAL antes del DELETE...`);
    
    const { data: finalVerification, error: finalVerificationError } = await supabase.rpc('verify_history_and_mark_backup', {
      p_model_id: modelId,
      p_period_start_date: startDate,
      p_period_type: periodType
    });

    if (finalVerificationError || !finalVerification || finalVerification.length === 0 || !finalVerification[0].success) {
      const errorMsg = finalVerificationError?.message || finalVerification?.[0]?.error_message || 'Verificación falló';
      console.error(`❌ [ATOMIC-CLOSE] FALLO CRÍTICO: Verificación final falló: ${errorMsg}`);
      throw new Error(`SEGURIDAD: No se puede eliminar datos. Verificación falló: ${errorMsg}`);
    }

    const historyCount = finalVerification[0].history_count || 0;
    const backupCount = finalVerification[0].backup_count || 0;
    
    console.log(`✅ [ATOMIC-CLOSE] Verificación FINAL exitosa:`);
    console.log(`   - Registros en calculator_history: ${historyCount}`);
    console.log(`   - Plataformas en backup: ${backupCount}`);
    console.log(`   - Backup marcado como verificado`);

    // 8. SOLO AHORA, DESPUÉS DE TRIPLE VERIFICACIÓN, ELIMINAR VALORES DE MODEL_VALUES
    console.log(`🗑️ [ATOMIC-CLOSE] INICIANDO DELETE (protegido por triple verificación)...`);
    console.log(`   ⚠️  Este DELETE está protegido por:`);
    console.log(`   ✅ Backup físico en model_values_safety_backup`);
    console.log(`   ✅ Archivo completo en calculator_history`);
    console.log(`   ✅ Verificación cruzada exitosa`);
    
    const { data: deletedData, error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .select();

    if (deleteError) {
      console.error(`❌ [ATOMIC-CLOSE] Error eliminando model_values:`, deleteError);
      console.error(`⚠️  IMPORTANTE: Los datos están PROTEGIDOS en model_values_safety_backup`);
      throw deleteError;
    }

    const deletedCount = deletedData?.length || 0;
    console.log(`✅ [ATOMIC-CLOSE] ${deletedCount} valores eliminados de model_values`);

    // 🔒 PASO 4: MARCAR EN BACKUP QUE EL DELETE SE COMPLETÓ
    await supabase
      .from('model_values_safety_backup')
      .update({ deleted_from_model_values: true })
      .eq('model_id', modelId)
      .eq('period_start_date', startDate)
      .eq('period_type', periodType);

    console.log(`✅ [ATOMIC-CLOSE] Éxito: Archivados ${historyInserts.length}, Borrados ${deletedCount}, Respaldados ${backedUpCount}`);
    return { 
      success: true, 
      archived: historyInserts.length, 
      deleted: deletedCount 
    };

  } catch (error) {
    console.error('❌ [ATOMIC-CLOSE] Error crítico:', error);
    return {
      success: false,
      archived: 0,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Crea un backup de seguridad de los valores de un modelo antes del archivado
 * Guarda todos los valores de model_values y las tasas aplicadas en calc_snapshots
 */
export const createBackupSnapshot = async (
  modelId: string,
  periodDate: string,
  periodType: '1-15' | '16-31'
): Promise<{ success: boolean; error?: string; snapshotId?: string }> => {
  try {
    // Calcular rango de fechas del período
    const [year, month] = periodDate.split('-').map(Number);
    let startDate: string;
    let endDate: string;
    
    if (periodType === '1-15') {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    console.log(`💾 [BACKUP] Creando snapshot para modelo ${modelId}, período ${periodType}: ${startDate} a ${endDate}`);

    // 1. Obtener todos los valores de model_values del período
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (valuesError) {
      console.error(`❌ [BACKUP] Error obteniendo valores:`, valuesError);
      throw valuesError;
    }

    // 2. Obtener tasas activas en ese momento
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('*')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error(`❌ [BACKUP] Error obteniendo tasas:`, ratesError);
      throw ratesError;
    }

    // 3. Obtener configuración del modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error(`❌ [BACKUP] Error obteniendo configuración:`, configError);
      throw configError;
    }

    // 4. Preparar datos del snapshot
    const snapshotData = {
      period_date: periodDate,
      period_type: periodType,
      period_start: startDate,
      period_end: endDate,
      model_values: values || [],
      rates: ratesData || [],
      model_config: config || null,
      created_at: new Date().toISOString()
    };

    // 5. Preparar datos del snapshot
    // La tabla calc_snapshots requiere period_id (UUID), pero nuestro sistema usa period_date y period_type
    // Generamos un UUID determinístico basado en period_date y period_type para mantener consistencia
    // Usamos crypto para generar un UUID determinístico desde period_date + period_type + model_id
    const periodReference = `${periodDate}_${periodType}_${modelId}`;
    
    // Generar UUID determinístico usando crypto (disponible en Node.js)
    const crypto = require('crypto');
    const periodIdHash = crypto.createHash('sha256').update(periodReference).digest('hex');
    // Convertir a UUID v4 format (8-4-4-4-12)
    const periodId = `${periodIdHash.substring(0, 8)}-${periodIdHash.substring(8, 12)}-${periodIdHash.substring(12, 16)}-${periodIdHash.substring(16, 20)}-${periodIdHash.substring(20, 32)}`;

    const snapshotRecord = {
      model_id: modelId,
      period_id: periodId,
      totals_json: {
        period_date: periodDate,
        period_type: periodType,
        period_start: startDate,
        period_end: endDate,
        values: values || [],
        total_platforms: values?.length || 0,
        total_value: values?.reduce((sum: number, v: any) => sum + (Number(v.value) || 0), 0) || 0,
        snapshot_metadata: {
          created_at: new Date().toISOString(),
          backup_purpose: 'period_closure_safety_backup'
        }
      },
      rates_applied_json: {
        rates: ratesData || [],
        model_config: config || null,
        snapshot_timestamp: new Date().toISOString(),
        period_reference: periodReference
      }
    };

    // 6. Guardar en calc_snapshots usando upsert para evitar duplicados
    const { data: snapshotResult, error: snapshotError } = await supabase
      .from('calc_snapshots')
      .upsert(snapshotRecord, {
        onConflict: 'model_id,period_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (snapshotError) {
      console.error(`❌ [BACKUP] Error guardando snapshot:`, snapshotError);
      throw snapshotError;
    }

    console.log(`✅ [BACKUP] Snapshot creado exitosamente: ${snapshotResult?.id}`);
    return {
      success: true,
      snapshotId: snapshotResult?.id
    };

  } catch (error) {
    console.error('❌ [BACKUP] Error crítico creando snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Archiva valores de un modelo para el período
 * IMPORTANTE: Busca valores en el RANGO del período y calcula todas las métricas necesarias
 */
export const archiveModelValues = async (
  modelId: string,
  periodDate: string, // Fecha de referencia (ej: 2025-10-16 para período 16-31)
  periodType: '1-15' | '16-31'
): Promise<{ success: boolean; archived: number; error?: string }> => {
  try {
    // Calcular rango de fechas del período
    const [year, month] = periodDate.split('-').map(Number);
    let startDate: string;
    let endDate: string;
    
    if (periodType === '1-15') {
      // Período 1-15: del día 1 al 15 del mes
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      // Período 16-31: del día 16 al último día del mes
      startDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate(); // Último día del mes
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    console.log(`📦 [ARCHIVE] Buscando valores para período ${periodType}: ${startDate} a ${endDate}`);

    // 1. Obtener tasas activas al momento del archivo
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) throw ratesError;

    const rates = {
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900
    };

    console.log(`📊 [ARCHIVE] Tasas aplicadas:`, rates);

    // 2. Obtener configuración del modelo (porcentajes por plataforma)
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') throw configError;

    // Porcentaje base del modelo
    const modelPercentage = config?.percentage_override || config?.group_percentage || 80;

    // 3. Obtener información de plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .eq('active', true);

    if (platformsError) throw platformsError;

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));

    // 4. El porcentaje es general para todas las plataformas del modelo
    // (no hay porcentajes específicos por plataforma en la configuración actual)

    // 5. Obtener valores en el rango del período
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (valuesError) throw valuesError;

    if (!values || values.length === 0) {
      console.log(`📦 [ARCHIVE] No hay valores para archivar en el rango ${startDate} a ${endDate}`);
      return { success: true, archived: 0 };
    }

    console.log(`📦 [ARCHIVE] Encontrados ${values.length} valores para archivar`);

    // 6. Agrupar valores por plataforma (tomar el último valor por plataforma)
    const valuesByPlatform = new Map<string, any>();
    for (const value of values) {
      const existing = valuesByPlatform.get(value.platform_id);
      if (!existing || new Date(value.updated_at) > new Date(existing.updated_at)) {
        valuesByPlatform.set(value.platform_id, value);
      }
    }

    // 7. Preparar datos históricos con todos los cálculos
    const historicalData: any[] = [];

    for (const [platformId, value] of Array.from(valuesByPlatform.entries())) {
      const platform = platformMap.get(platformId);
      const currency = platform?.currency || 'USD';
      // Usar el porcentaje general del modelo (aplicado a todas las plataformas)
      const platformPercentage = modelPercentage;
      
      // Calcular USD bruto
      const valueUsdBruto = calculateUsdBruto(Number(value.value), platformId, currency, rates);
      
      // Calcular USD modelo (después del porcentaje)
      const valueUsdModelo = valueUsdBruto * (platformPercentage / 100);
      
      // Calcular COP modelo
      const valueCopModelo = valueUsdModelo * rates.usd_cop;

      historicalData.push({
        model_id: value.model_id,
        platform_id: platformId,
        value: Number(value.value),
        period_date: startDate, // Usar fecha de inicio del período para agrupación
        period_type: periodType,
        archived_at: new Date().toISOString(),
        original_updated_at: value.updated_at,
        // Nuevos campos
        rate_eur_usd: rates.eur_usd,
        rate_gbp_usd: rates.gbp_usd,
        rate_usd_cop: rates.usd_cop,
        platform_percentage: platformPercentage,
        value_usd_bruto: parseFloat(valueUsdBruto.toFixed(2)),
        value_usd_modelo: parseFloat(valueUsdModelo.toFixed(2)),
        value_cop_modelo: parseFloat(valueCopModelo.toFixed(2))
      });
    }

    // 8. Insertar en historial
    const { error: archiveError } = await supabase
      .from('calculator_history')
      .insert(historicalData);

    if (archiveError) throw archiveError;

    console.log(`✅ [ARCHIVE] ${historicalData.length} valores archivados exitosamente con cálculos completos`);
    return { success: true, archived: historicalData.length };
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error archivando valores:', error);
    return {
      success: false,
      archived: 0,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Resetea valores de un modelo (elimina del período cerrado)
 * IMPORTANTE: Elimina valores en el RANGO del período, no solo una fecha específica
 */
export const resetModelValues = async (
  modelId: string,
  periodDate: string, // Fecha de referencia (ej: 2025-10-16 para período 16-31)
  periodType: '1-15' | '16-31' // Tipo de período (requerido)
): Promise<{ success: boolean; deleted: number; error?: string }> => {
  try {
    // Calcular rango de fechas del período
    const [year, month] = periodDate.split('-').map(Number);
    let startDate: string;
    let endDate: string;
    
    if (periodType === '1-15') {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    
    console.log(`🗑️ [RESET] Eliminando valores del período ${periodType}: ${startDate} a ${endDate}`);

    // Eliminar valores en el rango del período
    const { data, error } = await supabase
      .from('model_values')
      .delete()
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .select();

    if (error) throw error;

    console.log(`✅ [RESET] ${data?.length || 0} valores eliminados exitosamente`);
    return { success: true, deleted: data?.length || 0 };
  } catch (error) {
    console.error('❌ [CLOSURE-HELPERS] Error reseteando valores:', error);
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};


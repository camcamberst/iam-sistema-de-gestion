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


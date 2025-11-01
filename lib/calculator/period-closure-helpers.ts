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
 * Archiva valores de un modelo para el período
 * IMPORTANTE: Busca valores en el RANGO del período, no solo una fecha específica
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

    // Obtener valores en el rango del período
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

    // Preparar datos históricos
    // IMPORTANTE: period_date en calculator_history debe ser la fecha del período (startDate o periodDate según lógica)
    // pero mantenemos la fecha original del valor para referencia
    const historicalData = values.map(value => ({
      model_id: value.model_id,
      platform_id: value.platform_id,
      value: value.value,
      period_date: startDate, // Usar fecha de inicio del período para agrupación
      period_type: periodType,
      archived_at: new Date().toISOString(),
      original_updated_at: value.updated_at
    }));

    // Insertar en historial
    const { error: archiveError } = await supabase
      .from('calculator_history')
      .insert(historicalData);

    if (archiveError) throw archiveError;

    console.log(`✅ [ARCHIVE] ${values.length} valores archivados exitosamente`);
    return { success: true, archived: values.length };
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


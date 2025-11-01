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
 */
export const archiveModelValues = async (
  modelId: string,
  periodDate: string,
  periodType: '1-15' | '16-31'
): Promise<{ success: boolean; archived: number; error?: string }> => {
  try {
    // Obtener valores actuales
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) throw valuesError;

    if (!values || values.length === 0) {
      return { success: true, archived: 0 };
    }

    // Preparar datos históricos
    const historicalData = values.map(value => ({
      model_id: value.model_id,
      platform_id: value.platform_id,
      value: value.value,
      period_date: value.period_date,
      period_type: periodType,
      archived_at: new Date().toISOString(),
      original_updated_at: value.updated_at
    }));

    // Insertar en historial
    const { error: archiveError } = await supabase
      .from('calculator_history')
      .insert(historicalData);

    if (archiveError) throw archiveError;

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
 * Resetea valores de un modelo (elimina del período actual)
 */
export const resetModelValues = async (
  modelId: string,
  periodDate: string
): Promise<{ success: boolean; deleted: number; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('model_values')
      .delete()
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .select();

    if (error) throw error;

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


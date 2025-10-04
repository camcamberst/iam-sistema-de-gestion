import { createClient } from '@supabase/supabase-js';

// Usar service role key para bypass RLS
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

export interface AnticipoResult {
  anticipos: any[];
  total: number;
  count: number;
  periodIds: string[];
}

/**
 * Obtener anticipos confirmados del mes actual
 * @param modelId ID de la modelo
 * @param periodDate Fecha del período (opcional, por defecto usa fecha actual)
 * @returns Resultado con anticipos, total y conteo
 */
export async function getAnticiposConfirmadosDelMes(
  modelId: string, 
  periodDate?: string
): Promise<AnticipoResult> {
  try {
    // Obtener todos los períodos del mes actual
    const currentDate = new Date(periodDate || new Date().toISOString().split('T')[0]);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // getMonth() es 0-based
    
    console.log('🔍 [ANTICIPOS-UTILS] Buscando períodos del mes:', year, month);
    
    const { data: monthPeriods, error: monthPeriodsError } = await supabase
      .from('periods')
      .select('id')
      .gte('start_date', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('start_date', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);
    
    if (monthPeriodsError) {
      console.error('❌ [ANTICIPOS-UTILS] Error al obtener períodos del mes:', monthPeriodsError);
      throw new Error('Error al obtener períodos del mes');
    }
    
    const periodIds = monthPeriods?.map(p => p.id) || [];
    console.log('🔍 [ANTICIPOS-UTILS] Períodos del mes encontrados:', periodIds);
    
    // Obtener anticipos confirmados del mes
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado, period_id, created_at, realized_at')
      .eq('model_id', modelId)
      .in('period_id', periodIds)
      .eq('estado', 'confirmado');
    
    if (anticiposError) {
      console.error('❌ [ANTICIPOS-UTILS] Error al obtener anticipos:', anticiposError);
      throw new Error('Error al obtener anticipos');
    }
    
    // Calcular total
    const total = anticipos?.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0) || 0;
    
    console.log('✅ [ANTICIPOS-UTILS] Anticipos encontrados:', {
      count: anticipos?.length || 0,
      total,
      periodIds
    });
    
    return {
      anticipos: anticipos || [],
      total,
      count: anticipos?.length || 0,
      periodIds
    };
    
  } catch (error: any) {
    console.error('❌ [ANTICIPOS-UTILS] Error general:', error);
    throw error;
  }
}

/**
 * Obtener anticipos por período específico (lógica antigua)
 * @param modelId ID de la modelo
 * @param periodId ID del período específico
 * @returns Resultado con anticipos, total y conteo
 */
export async function getAnticiposPorPeriodo(
  modelId: string, 
  periodId: string
): Promise<AnticipoResult> {
  try {
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado, period_id, created_at, realized_at')
      .eq('model_id', modelId)
      .eq('period_id', periodId)
      .eq('estado', 'confirmado');
    
    if (anticiposError) {
      console.error('❌ [ANTICIPOS-UTILS] Error al obtener anticipos por período:', anticiposError);
      throw new Error('Error al obtener anticipos por período');
    }
    
    const total = anticipos?.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0) || 0;
    
    return {
      anticipos: anticipos || [],
      total,
      count: anticipos?.length || 0,
      periodIds: [periodId]
    };
    
  } catch (error: any) {
    console.error('❌ [ANTICIPOS-UTILS] Error general:', error);
    throw error;
  }
}

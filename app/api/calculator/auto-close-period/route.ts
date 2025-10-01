import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCalculatorDate, getCurrentCalculatorPeriod } from '@/utils/calculator-dates';

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

// POST: Cierre automático de período
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [AUTO-CLOSE] Iniciando cierre automático de período...');
    
    const currentDate = getCalculatorDate();
    const period = getCurrentCalculatorPeriod();
    
    console.log('🔄 [AUTO-CLOSE] Fecha actual:', currentDate);
    console.log('🔄 [AUTO-CLOSE] Período:', period.description);
    
    // 1. Obtener todas las configuraciones activas
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('model_id, active')
      .eq('active', true);
    
    if (configsError) {
      console.error('❌ [AUTO-CLOSE] Error obteniendo configuraciones:', configsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo configuraciones' 
      }, { status: 500 });
    }
    
    console.log('🔄 [AUTO-CLOSE] Configuraciones encontradas:', configs?.length || 0);
    
    // 2. Para cada modelo, archivar valores y resetear calculadora
    const results = [];
    
    for (const config of configs || []) {
      try {
        console.log(`🔄 [AUTO-CLOSE] Procesando modelo: ${config.model_id}`);
        
        // Obtener valores actuales del período
        const { data: currentValues, error: valuesError } = await supabase
          .from('model_values')
          .select('*')
          .eq('model_id', config.model_id)
          .eq('period_date', currentDate);
        
        if (valuesError) {
          console.error(`❌ [AUTO-CLOSE] Error obteniendo valores para ${config.model_id}:`, valuesError);
          continue;
        }
        
        // Si hay valores, archivarlos
        if (currentValues && currentValues.length > 0) {
          console.log(`🔄 [AUTO-CLOSE] Archivando ${currentValues.length} valores para ${config.model_id}`);
          
          // Insertar en tabla histórica
          const historicalData = currentValues.map(value => ({
            model_id: value.model_id,
            platform_id: value.platform_id,
            value: value.value,
            period_date: value.period_date,
            period_type: period.type,
            archived_at: new Date().toISOString(),
            original_updated_at: value.updated_at
          }));
          
          const { error: archiveError } = await supabase
            .from('calculator_history')
            .insert(historicalData);
          
          if (archiveError) {
            console.error(`❌ [AUTO-CLOSE] Error archivando valores para ${config.model_id}:`, archiveError);
            continue;
          }
          
          console.log(`✅ [AUTO-CLOSE] Valores archivados para ${config.model_id}`);
        }
        
        // Eliminar valores actuales (resetear calculadora)
        const { error: deleteError } = await supabase
          .from('model_values')
          .delete()
          .eq('model_id', config.model_id)
          .eq('period_date', currentDate);
        
        if (deleteError) {
          console.error(`❌ [AUTO-CLOSE] Error eliminando valores para ${config.model_id}:`, deleteError);
          continue;
        }
        
        console.log(`✅ [AUTO-CLOSE] Calculadora reseteada para ${config.model_id}`);
        
        results.push({
          model_id: config.model_id,
          status: 'success',
          values_archived: currentValues?.length || 0
        });
        
      } catch (error) {
        console.error(`❌ [AUTO-CLOSE] Error procesando modelo ${config.model_id}:`, error);
        results.push({
          model_id: config.model_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }
    
    console.log('✅ [AUTO-CLOSE] Cierre automático completado');
    console.log('📊 [AUTO-CLOSE] Resultados:', results);
    
    return NextResponse.json({
      success: true,
      message: 'Cierre automático completado',
      period: period.description,
      date: currentDate,
      results: results,
      summary: {
        total_models: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    });
    
  } catch (error) {
    console.error('❌ [AUTO-CLOSE] Error en cierre automático:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// GET: Verificar estado del sistema
export async function GET(request: NextRequest) {
  try {
    const currentDate = getCalculatorDate();
    const period = getCurrentCalculatorPeriod();
    
    // Obtener estadísticas del sistema
    const { data: activeConfigs } = await supabase
      .from('calculator_config')
      .select('model_id')
      .eq('active', true);
    
    const { data: currentValues } = await supabase
      .from('model_values')
      .select('model_id')
      .eq('period_date', currentDate);
    
    const { data: historicalCount } = await supabase
      .from('calculator_history')
      .select('id', { count: 'exact' });
    
    return NextResponse.json({
      success: true,
      system_status: {
        current_date: currentDate,
        current_period: period.description,
        active_models: activeConfigs?.length || 0,
        models_with_values: new Set(currentValues?.map(v => v.model_id) || []).size,
        total_historical_records: historicalCount?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ [AUTO-CLOSE] Error verificando estado:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error verificando estado del sistema' 
    }, { status: 500 });
  }
}

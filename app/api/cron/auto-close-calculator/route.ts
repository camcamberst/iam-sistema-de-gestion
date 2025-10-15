import { NextRequest, NextResponse } from 'next/server';
import { getColombiaDate, getCurrentCalculatorPeriod, createPeriodIfNeeded } from '@/utils/calculator-dates';

// CRON JOB: Cierre automático de calculadora
// Se ejecuta los días 15 y 30 a las 17:00 Colombia (sincronizado con medianoche europea)
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON] Iniciando cierre automático de calculadora...');
    
    const currentDate = getColombiaDate();
    const period = getCurrentCalculatorPeriod();
    
    console.log('🕐 [CRON] Fecha actual:', currentDate);
    console.log('🕐 [CRON] Período:', period.description);
    
    // Verificar si es un día de corte (15 o 30)
    const today = new Date();
    const day = today.getDate();
    
    if (day !== 15 && day !== 30) {
      console.log('🕐 [CRON] No es día de corte. Día actual:', day);
      return NextResponse.json({
        success: true,
        message: 'No es día de corte automático',
        current_day: day,
        cutoff_days: [15, 30]
      });
    }
    
    console.log('🕐 [CRON] Es día de corte. Ejecutando cierre automático...');
    
    // Importar y ejecutar directamente la lógica de cierre automático
    const { createClient } = await import('@supabase/supabase-js');
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

    // Ejecutar lógica de cierre automático directamente
    console.log('🔄 [CRON] Ejecutando lógica de cierre automático...');
    
    // 1. Crear período actual si no existe
    const currentPeriod = await createPeriodIfNeeded(currentDate);
    console.log('✅ [CRON] Período actual:', currentPeriod);
    
    // 2. Obtener todas las configuraciones activas
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('model_id, active')
      .eq('active', true);
    
    if (configsError) {
      console.error('❌ [CRON] Error obteniendo configuraciones:', configsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo configuraciones'
      }, { status: 500 });
    }
    
    console.log('🔄 [CRON] Configuraciones encontradas:', configs?.length || 0);
    
    // 3. Para cada modelo, archivar valores y resetear calculadora
    const results = [];
    
    for (const config of configs || []) {
      try {
        // Obtener valores actuales del modelo
        const { data: currentValues, error: valuesError } = await supabase
          .from('model_values')
          .select('*')
          .eq('model_id', config.model_id)
          .eq('period_date', currentDate);
        
        if (valuesError) {
          console.error(`❌ [CRON] Error obteniendo valores para ${config.model_id}:`, valuesError);
          results.push({
            model_id: config.model_id,
            status: 'error',
            error: valuesError.message
          });
          continue;
        }
        
        // Archivar valores a calculator_history
        if (currentValues && currentValues.length > 0) {
          const historyRecords = currentValues.map(value => ({
            model_id: value.model_id,
            platform_id: value.platform_id,
            value: value.value,
            period_date: value.period_date,
            period_type: currentPeriod.type,
            archived_at: new Date().toISOString(),
            original_updated_at: value.updated_at
          }));
          
          const { error: historyError } = await supabase
            .from('calculator_history')
            .insert(historyRecords);
          
          if (historyError) {
            console.error(`❌ [CRON] Error archivando valores para ${config.model_id}:`, historyError);
          }
        }
        
        // Eliminar valores actuales (reset calculadora)
        const { error: deleteError } = await supabase
          .from('model_values')
          .delete()
          .eq('model_id', config.model_id)
          .eq('period_date', currentDate);
        
        if (deleteError) {
          console.error(`❌ [CRON] Error eliminando valores para ${config.model_id}:`, deleteError);
        }
        
        results.push({
          model_id: config.model_id,
          status: 'success',
          values_archived: currentValues?.length || 0
        });
        
        console.log(`✅ [CRON] Modelo ${config.model_id} procesado: ${currentValues?.length || 0} valores archivados`);
        
      } catch (modelError) {
        console.error(`❌ [CRON] Error procesando modelo ${config.model_id}:`, modelError);
        results.push({
          model_id: config.model_id,
          status: 'error',
          error: modelError instanceof Error ? modelError.message : 'Error desconocido'
        });
      }
    }
    
    const result = {
      success: true,
      message: 'Cierre automático completado',
      period: period.description,
      date: currentDate,
      current_period: currentPeriod,
      results: results,
      summary: {
        total_models: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    };
    
    console.log('✅ [CRON] Cierre automático completado:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Cierre automático ejecutado exitosamente',
      execution_time: new Date().toISOString(),
      period: period.description,
      date: currentDate,
      results: result
    });
    
  } catch (error) {
    console.error('❌ [CRON] Error en cron job:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// POST: Ejecutar manualmente (para testing)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [CRON-MANUAL] Ejecutando cierre manual...');
    
    const currentDate = getColombiaDate();
    const period = getCurrentCalculatorPeriod();
    
    // Llamar al endpoint de cierre automático
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CRON-MANUAL] Error en cierre automático:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Error ejecutando cierre automático',
        details: errorData
      }, { status: 500 });
    }
    
    const result = await response.json();
    
    console.log('✅ [CRON-MANUAL] Cierre manual completado:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Cierre manual ejecutado exitosamente',
      execution_time: new Date().toISOString(),
      period: period.description,
      date: currentDate,
      results: result
    });
    
  } catch (error) {
    console.error('❌ [CRON-MANUAL] Error en cierre manual:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

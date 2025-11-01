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
    
    // 2. Obtener TODOS los modelos activos (sin filtro de configuración)
    const { data: allModels, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'modelo')
      .eq('is_active', true);
    
    if (modelsError) {
      console.error('❌ [CRON] Error obteniendo modelos:', modelsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo modelos'
      }, { status: 500 });
    }
    
    console.log('🔄 [CRON] Modelos encontrados:', allModels?.length || 0);
    
    // 3. Para cada modelo, archivar valores y resetear calculadora
    const results = [];
    
    for (const model of allModels || []) {
      try {
        console.log(`🔄 [CRON] Procesando modelo: ${model.email} (${model.id})`);
        
        // Obtener valores actuales del modelo
        const { data: currentValues, error: valuesError } = await supabase
          .from('model_values')
          .select('*')
          .eq('model_id', model.id)
          .eq('period_date', currentDate);
        
        if (valuesError) {
          console.error(`❌ [CRON] Error obteniendo valores para ${model.id}:`, valuesError);
          results.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: valuesError.message
          });
          continue;
        }
        
        // Usar función SQL para limpieza completa
        const { data: cleanupResult, error: cleanupError } = await supabase
          .rpc('cleanup_calculator_period', {
            p_period_date: currentDate,
            p_period_type: currentPeriod.type
          });
        
        if (cleanupError) {
          console.error(`❌ [CRON] Error en limpieza completa para ${model.email}:`, cleanupError);
          results.push({
            model_id: model.id,
            model_email: model.email,
            status: 'error',
            error: cleanupError.message
          });
          continue;
        }
        
        if (cleanupResult && cleanupResult.success) {
          console.log(`✅ [CRON] Limpieza completa exitosa para ${model.email}:`, {
            archived: cleanupResult.archived_values,
            deleted_values: cleanupResult.deleted_values,
            deleted_totals: cleanupResult.deleted_totals,
            notifications: cleanupResult.notifications_sent
          });
        } else {
          console.error(`❌ [CRON] Limpieza falló para ${model.email}:`, cleanupResult?.error);
        }
        
        results.push({
          model_id: model.id,
          model_email: model.email,
          status: 'success',
          values_archived: cleanupResult?.archived_values || 0,
          values_deleted: cleanupResult?.deleted_values || 0,
          totals_deleted: cleanupResult?.deleted_totals || 0,
          notifications_sent: cleanupResult?.notifications_sent || 0
        });
        
        console.log(`✅ [CRON] Modelo ${model.email} procesado: ${cleanupResult?.archived_values || 0} valores archivados, ${cleanupResult?.deleted_values || 0} valores eliminados, ${cleanupResult?.deleted_totals || 0} totales eliminados`);
        
      } catch (modelError) {
        console.error(`❌ [CRON] Error procesando modelo ${model.email}:`, modelError);
        results.push({
          model_id: model.id,
          model_email: model.email,
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

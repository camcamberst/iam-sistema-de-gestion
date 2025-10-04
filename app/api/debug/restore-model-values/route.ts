import { NextRequest, NextResponse } from 'next/server';
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

// POST: Restaurar valores de modelo desde historial
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [RESTORE] Iniciando restauración de valores...');
    
    const { modelId, periodDate } = await request.json();
    
    if (!modelId || !periodDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y periodDate son requeridos' 
      }, { status: 400 });
    }
    
    console.log('🔄 [RESTORE] Restaurando valores para:', { modelId, periodDate });
    
    // 1. Obtener valores del historial
    const { data: historicalValues, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);
    
    if (historyError) {
      console.error('❌ [RESTORE] Error obteniendo historial:', historyError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo historial' 
      }, { status: 500 });
    }
    
    if (!historicalValues || historicalValues.length === 0) {
      console.log('⚠️ [RESTORE] No hay valores históricos para restaurar');
      return NextResponse.json({
        success: true,
        message: 'No hay valores históricos para restaurar',
        restored_count: 0
      });
    }
    
    console.log('🔄 [RESTORE] Encontrados valores históricos:', historicalValues.length);
    
    // 2. Restaurar valores a model_values
    const valuesToRestore = historicalValues.map(h => ({
      model_id: h.model_id,
      platform_id: h.platform_id,
      value: h.value,
      period_date: periodDate
    }));
    
    const { data: restoredValues, error: restoreError } = await supabase
      .from('model_values')
      .insert(valuesToRestore)
      .select();
    
    if (restoreError) {
      console.error('❌ [RESTORE] Error restaurando valores:', restoreError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error restaurando valores' 
      }, { status: 500 });
    }
    
    console.log('✅ [RESTORE] Valores restaurados exitosamente:', restoredValues?.length || 0);
    
    return NextResponse.json({
      success: true,
      message: 'Valores restaurados exitosamente',
      restored_count: restoredValues?.length || 0,
      historical_count: historicalValues.length,
      values: restoredValues
    });
    
  } catch (error) {
    console.error('❌ [RESTORE] Error en restauración:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// GET: Verificar valores históricos disponibles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const periodDate = searchParams.get('periodDate');
    
    if (!modelId || !periodDate) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y periodDate son requeridos' 
      }, { status: 400 });
    }
    
    // Obtener valores del historial
    const { data: historicalValues, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);
    
    if (historyError) {
      console.error('❌ [RESTORE] Error obteniendo historial:', historyError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo historial' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      historical_count: historicalValues?.length || 0,
      values: historicalValues || []
    });
    
  } catch (error) {
    console.error('❌ [RESTORE] Error verificando historial:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

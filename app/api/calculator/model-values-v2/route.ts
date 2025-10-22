import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener valores de modelo (soporta periodDate opcional)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MODEL-VALUES-V2] Loading values:', { modelId, periodDate });
    console.log('🔍 [MODEL-VALUES-V2] Service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 🔍 DEBUG: Verificar si hay datos en la tabla (consulta simple)
    console.log('🔍 [MODEL-VALUES-V2] Starting database query...');
    
    // 1. Intentar cargar valores actuales de model_values
    // 🔧 SOLUCIÓN DEFINITIVA: Buscar datos recientes sin filtro estricto de fecha
    // El sistema híbrido de timezone causa más problemas que beneficios
    console.log('🔍 [MODEL-VALUES-V2] Buscando datos recientes sin filtro de fecha específico...');

    // Buscar los valores más recientes de los últimos 7 días para evitar problemas de timezone
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: allRecentValues, error: currentError } = await supabase
      .from('model_values')
      .select(`
        model_id, platform_id, value, period_date, updated_at
      `)
      .eq('model_id', modelId)
      .gte('period_date', sevenDaysAgoStr) // Últimos 7 días
      .order('updated_at', { ascending: false })
      .limit(200); // Límite más amplio para asegurar que encontramos datos

    console.log('🔍 [MODEL-VALUES-V2] Found recent values:', allRecentValues?.length || 0);

    // Obtener solo el valor más reciente por plataforma
    const platformMap = new Map<string, any>();
    allRecentValues?.forEach((value: any) => {
      if (!platformMap.has(value.platform_id)) {
        platformMap.set(value.platform_id, value);
      }
    });

    const currentValues = Array.from(platformMap.values());
    console.log('🔍 [MODEL-VALUES-V2] Unique platform values:', currentValues.length);

    console.log('🔍 [MODEL-VALUES-V2] Found values:', currentValues?.length || 0);

    console.log('🔍 [MODEL-VALUES-V2] Current values query completed. Values:', currentValues);
    console.log('🔍 [MODEL-VALUES-V2] Current values count:', currentValues?.length || 0);

    if (currentError) {
      console.error('❌ [MODEL-VALUES-V2] Database error:', currentError);
      return NextResponse.json({ 
        success: false, 
        error: currentError.message,
        details: currentError,
        modelId,
        periodDate
      }, { status: 500 });
    }

    console.log('✅ [MODEL-VALUES-V2] Success! Returning data:', currentValues || []);
    return NextResponse.json({ 
      success: true, 
      data: currentValues || [],
      count: currentValues?.length || 0,
      modelId,
      periodDate
    });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// POST: Guardar valores de modelo (lote) con upsert por (model_id, platform_id, period_date)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, values, periodDate } = body;

    if (!modelId || !values) {
      return NextResponse.json({ success: false, error: 'modelId y values son requeridos' }, { status: 400 });
    }

    // 🔧 SOLUCIÓN DEFINITIVA: Usar fecha de Colombia para consistencia
    const effectiveDate = getColombiaDate();
    console.log('🔍 [MODEL-VALUES-V2] Saving values:', { modelId, effectiveDate, values });

    const rows = Object.entries(values).map(([platformId, value]) => ({
      model_id: modelId,
      platform_id: platformId,
      value: Number.parseFloat(String(value)) || 0,
      period_date: effectiveDate
    }));

    console.log('🔍 [MODEL-VALUES-V2] Rows to upsert:', rows);

    const { data, error } = await supabase
      .from('model_values')
      .upsert(rows, { onConflict: 'model_id,platform_id,period_date' })
      .select();

    if (error) {
      console.error('❌ [MODEL-VALUES-V2] Error al guardar valores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [MODEL-VALUES-V2] Values saved successfully:', data);
    return NextResponse.json({ success: true, data: data || [], message: 'Valores guardados correctamente' });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCalculatorDate } from '@/utils/calculator-dates';

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

// GET: Obtener valores de modelo (soporta periodDate opcional)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getCalculatorDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MODEL-VALUES-V2] Loading values:', { modelId, periodDate });
    console.log('🔍 [MODEL-VALUES-V2] Service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 🔍 DEBUG: Verificar si hay datos en la tabla (consulta simple)
    console.log('🔍 [MODEL-VALUES-V2] Starting database query...');
    
    const { data: values, error } = await supabase
      .from('model_values')
      .select(`
        model_id, platform_id, value, period_date, updated_at
      `)
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .order('platform_id');

    console.log('🔍 [MODEL-VALUES-V2] Query completed. Values:', values);
    console.log('🔍 [MODEL-VALUES-V2] Query error:', error);
    console.log('🔍 [MODEL-VALUES-V2] Values count:', values?.length || 0);
    console.log('🔍 [MODEL-VALUES-V2] Values type:', typeof values);
    console.log('🔍 [MODEL-VALUES-V2] Values is array:', Array.isArray(values));

    if (error) {
      console.error('❌ [MODEL-VALUES-V2] Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error,
        modelId,
        periodDate
      }, { status: 500 });
    }

    console.log('✅ [MODEL-VALUES-V2] Success! Returning data:', values || []);
    return NextResponse.json({ 
      success: true, 
      data: values || [],
      count: values?.length || 0,
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

    const effectiveDate = periodDate || new Date().toISOString().split('T')[0];
    console.log('🔍 [MODEL-VALUES-V2] Saving values:', { modelId, effectiveDate, values });

    const rows = Object.entries(values).map(([platformId, value]) => ({
      model_id: modelId,
      platform_id: platformId,
      value: Number.parseFloat(String(value)) || 0,
      period_date: effectiveDate
    }));

    const { data, error } = await supabase
      .from('model_values')
      .upsert(rows, { onConflict: 'model_id,platform_id,period_date' })
      .select();

    if (error) {
      console.error('Error al guardar valores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [], message: 'Valores guardados correctamente' });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener valores de modelo (soporta periodDate opcional)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || new Date().toISOString().split('T')[0];

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MODEL-VALUES-V2] Loading values:', { modelId, periodDate });

    const { data: values, error } = await supabase
      .from('model_values')
      .select(`
        model_id, platform_id, value, period_date, updated_at
      `)
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .order('platform_id');

    if (error) {
      console.error('Error al obtener valores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: values || [] });

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

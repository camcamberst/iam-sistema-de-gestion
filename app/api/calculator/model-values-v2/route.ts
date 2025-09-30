import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener valores de modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MODEL-VALUES-V2] Loading values for userId:', userId);

    // Obtener valores de la modelo
    const { data: values, error } = await supabase
      .from('model_values')
      .select(`
        *,
        platform:calculator_platforms(id, name, currency, token_rate, discount_factor, tax_rate, direct_payout)
      `)
      .eq('model_id', userId)
      .eq('period_date', new Date().toISOString().split('T')[0]) // Hoy
      .order('platform_id');

    if (error) {
      console.error('Error al obtener valores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('🔍 [MODEL-VALUES-V2] Found values:', values);
    return NextResponse.json({ success: true, values: values || [] });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// POST: Guardar valores de modelo
export async function POST(request: NextRequest) {
  try {
    const { modelId, platformId, value } = await request.json();

    if (!modelId || !platformId || value === undefined) {
      return NextResponse.json({ success: false, error: 'modelId, platformId y value son requeridos' }, { status: 400 });
    }

    console.log('🔍 [MODEL-VALUES-V2] Saving value:', { modelId, platformId, value });

    // Upsert valor (insertar o actualizar)
    const { data, error } = await supabase
      .from('model_values')
      .upsert({
        model_id: modelId,
        platform_id: platformId,
        value: parseFloat(value) || 0,
        period_date: new Date().toISOString().split('T')[0] // Hoy
      }, {
        onConflict: 'model_id,platform_id,period_date'
      })
      .select()
      .single();

    if (error) {
      console.error('Error al guardar valor:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('🔍 [MODEL-VALUES-V2] Saved value:', data);
    return NextResponse.json({ success: true, value: data });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

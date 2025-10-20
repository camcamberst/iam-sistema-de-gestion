import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

// GET: Obtener ganancias del día actual
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!modelId) {
      return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
    }

    console.log('🔍 [DAILY-EARNINGS] Getting earnings for:', { modelId, date });

    const { data: earnings, error } = await supabase
      .from('daily_earnings')
      .select('earnings_amount, earnings_date, updated_at')
      .eq('model_id', modelId)
      .eq('earnings_date', date)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [DAILY-EARNINGS] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const earningsAmount = earnings?.earnings_amount || 0;
    console.log('✅ [DAILY-EARNINGS] Found earnings:', earningsAmount);

    return NextResponse.json({
      success: true,
      earnings: earningsAmount,
      date: date,
      modelId: modelId
    });

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST: Guardar/actualizar ganancias del día
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, earnings, date } = body;

    if (!modelId || earnings === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y earnings son requeridos' 
      }, { status: 400 });
    }

    const earningsDate = date || new Date().toISOString().split('T')[0];
    console.log('🔍 [DAILY-EARNINGS] Saving earnings:', { modelId, earnings, earningsDate });

    const { data, error } = await supabase
      .from('daily_earnings')
      .upsert({
        model_id: modelId,
        earnings_date: earningsDate,
        earnings_amount: parseFloat(earnings.toString())
      }, { 
        onConflict: 'model_id,earnings_date' 
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [DAILY-EARNINGS] Error saving:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [DAILY-EARNINGS] Earnings saved successfully:', data);

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Ganancias del día guardadas correctamente'
    });

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

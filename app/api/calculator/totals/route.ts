import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener totales consolidados de una modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CALCULATOR-TOTALS] Obteniendo totales:', { modelId, periodDate });

    const { data: totals, error } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener totales:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [CALCULATOR-TOTALS] Totales obtenidos:', totals);
    return NextResponse.json({ 
      success: true, 
      data: totals || null,
      modelId,
      periodDate
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-TOTALS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// POST: Guardar/actualizar totales consolidados
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, periodDate, totalUsdBruto, totalUsdModelo, totalCopModelo } = body;

    if (!modelId || !periodDate || totalUsdBruto === undefined || totalUsdModelo === undefined || totalCopModelo === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId, periodDate, totalUsdBruto, totalUsdModelo y totalCopModelo son requeridos' 
      }, { status: 400 });
    }

    console.log('🔍 [CALCULATOR-TOTALS] Guardando totales:', { 
      modelId, 
      periodDate, 
      totalUsdBruto, 
      totalUsdModelo, 
      totalCopModelo 
    });

    const { data, error } = await supabase
      .from('calculator_totals')
      .upsert({
        model_id: modelId,
        period_date: periodDate,
        total_usd_bruto: Number.parseFloat(String(totalUsdBruto)) || 0,
        total_usd_modelo: Number.parseFloat(String(totalUsdModelo)) || 0,
        total_cop_modelo: Number.parseFloat(String(totalCopModelo)) || 0,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'model_id,period_date' 
      })
      .select();

    if (error) {
      console.error('❌ [CALCULATOR-TOTALS] Error al guardar totales:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [CALCULATOR-TOTALS] Totales guardados:', data);
    return NextResponse.json({ 
      success: true, 
      data: data?.[0] || null,
      message: 'Totales guardados correctamente' 
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-TOTALS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// GET: Obtener totales de múltiples modelos (para resumen de sede)
export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelIds = searchParams.get('modelIds')?.split(',') || [];
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (modelIds.length === 0) {
    return NextResponse.json({ success: false, error: 'modelIds es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CALCULATOR-TOTALS] Obteniendo totales múltiples:', { modelIds, periodDate });

    const { data: totals, error } = await supabase
      .from('calculator_totals')
      .select(`
        *,
        users!inner(email, name)
      `)
      .in('model_id', modelIds)
      .eq('period_date', periodDate);

    if (error) {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener totales múltiples:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [CALCULATOR-TOTALS] Totales múltiples obtenidos:', totals?.length || 0);
    return NextResponse.json({ 
      success: true, 
      data: totals || [],
      count: totals?.length || 0,
      periodDate
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-TOTALS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, normalizeToPeriodStartDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener totales consolidados de una modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const rawPeriodDate = searchParams.get('periodDate') || getColombiaPeriodStartDate();
  // Normalizar periodDate para buscar en el bucket correcto
  const periodDate = normalizeToPeriodStartDate(rawPeriodDate);

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    // P2 enero 2026: Mi Calculadora debe mostrar siempre 0 (cierre atípico ya archivado)
    const P2_ENERO_PERIOD_DATE = '2026-01-16';
    if (periodDate === P2_ENERO_PERIOD_DATE) {
      return NextResponse.json({
        success: true,
        data: { total_usd_bruto: 0, total_usd_modelo: 0, total_cop_modelo: 0 },
        modelId,
        periodDate
      });
    }

    console.log('🔍 [CALCULATOR-TOTALS] Obteniendo totales:', { modelId, periodDate, rawPeriodDate });

    // 🔧 IMPORTANTE: Buscar en el rango del período completo para capturar totales guardados en cualquier día
    const [year, month, day] = periodDate.split('-').map(Number);
    const isP2 = day >= 16;
    const periodStart = periodDate; // Ya está normalizado (1 o 16)
    const periodEndObj = new Date(year, month - 1, isP2 ? new Date(year, month, 0).getDate() : 15);
    const periodEnd = periodEndObj.toISOString().split('T')[0];
    
    const { data: totals, error } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener totales:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Si hay múltiples totales, tomar el más reciente
    const latestTotal = totals && totals.length > 0 ? totals[0] : null;
    
    console.log('✅ [CALCULATOR-TOTALS] Totales obtenidos:', latestTotal);
    return NextResponse.json({ 
      success: true, 
      data: latestTotal,
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

    if (!modelId || totalUsdBruto === undefined || totalUsdModelo === undefined || totalCopModelo === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId, totalUsdBruto, totalUsdModelo y totalCopModelo son requeridos' 
      }, { status: 400 });
    }

    console.log('🔍 [CALCULATOR-TOTALS] Guardando totales:', { 
      modelId, 
      periodDate, 
      totalUsdBruto, 
      totalUsdModelo, 
      totalCopModelo 
    });

    // 🔧 CRÍTICO: Normalizar periodDate a la fecha de inicio del período (1 o 16)
    // Esto asegura que todos los totales se guarden en el mismo "bucket" del período
    // independientemente del día específico en que se guarde
    const rawPeriodDate = periodDate || getColombiaPeriodStartDate();
    const periodDateCo = normalizeToPeriodStartDate(rawPeriodDate);
    
    console.log('🔍 [CALCULATOR-TOTALS] Fecha normalizada:', { 
      original: periodDate, 
      normalized: periodDateCo 
    });

    const { data, error } = await supabase
      .from('calculator_totals')
      .upsert({
        model_id: modelId,
        period_date: periodDateCo,
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
      message: 'Totales guardados correctamente',
      periodDate: periodDateCo
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
  const rawPeriodDate = searchParams.get('periodDate') || getColombiaPeriodStartDate();
  // Normalizar periodDate para buscar en el bucket correcto
  const periodDate = normalizeToPeriodStartDate(rawPeriodDate);

  if (modelIds.length === 0) {
    return NextResponse.json({ success: false, error: 'modelIds es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CALCULATOR-TOTALS] Obteniendo totales múltiples:', { modelIds, periodDate, rawPeriodDate });

    // 🔧 IMPORTANTE: Buscar en el rango del período completo para capturar totales guardados en cualquier día
    const [year, month, day] = periodDate.split('-').map(Number);
    const isP2 = day >= 16;
    const periodStart = periodDate; // Ya está normalizado (1 o 16)
    const periodEndObj = new Date(year, month - 1, isP2 ? new Date(year, month, 0).getDate() : 15);
    const periodEnd = periodEndObj.toISOString().split('T')[0];
    
    const { data: totals, error } = await supabase
      .from('calculator_totals')
      .select(`
        *,
        users!inner(email, name)
      `)
      .in('model_id', modelIds)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener totales múltiples:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Agrupar por model_id y tomar el más reciente si hay múltiples
    const totalsByModel = new Map();
    if (totals && totals.length > 0) {
      totals.forEach(t => {
        const existing = totalsByModel.get(t.model_id);
        if (!existing || new Date(t.updated_at) > new Date(existing.updated_at)) {
          totalsByModel.set(t.model_id, t);
        }
      });
    }
    
    const uniqueTotals = Array.from(totalsByModel.values());
    console.log('✅ [CALCULATOR-TOTALS] Totales múltiples obtenidos:', uniqueTotals.length, 'de', totals?.length || 0, 'registros');
    return NextResponse.json({ 
      success: true, 
      data: uniqueTotals,
      count: uniqueTotals.length,
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


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
    // 🔧 FIX SOSTENIBLE: Usar filtro de fecha inteligente para manejar timezone
    const getCurrentPeriodDates = () => {
      const now = new Date();
      return {
        colombia: now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
        europe: now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
      };
    };

    const dates = getCurrentPeriodDates();
    console.log('🔍 [MODEL-VALUES-V2] Searching in dates:', dates);

    // Buscar en ambas fechas para manejar desfase de timezone + límite de seguridad
    const { data: currentValues, error: currentError } = await supabase
      .from('model_values')
      .select(`
        model_id, platform_id, value, period_date, updated_at
      `)
      .eq('model_id', modelId)
      .in('period_date', [dates.colombia, dates.europe])
      .order('updated_at', { ascending: false })
      .limit(100); // 🔧 LÍMITE DE SEGURIDAD: máximo 100 registros

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

    const effectiveDate = periodDate || getColombiaDate();
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

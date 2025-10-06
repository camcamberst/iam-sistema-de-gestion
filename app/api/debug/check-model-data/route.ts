import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Verificar todos los datos de una modelo específica
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId') || 'fe54995d-1828-4721-8153-53fce6f4fe56';

  try {
    console.log('🔍 [DEBUG-MODEL-DATA] Checking all data for modelId:', modelId);

    // 1. Verificar si existe la modelo
    const { data: modelUser, error: modelError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', modelId)
      .single();

    if (modelError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Modelo no encontrada',
        details: modelError 
      });
    }

    // 2. Buscar TODOS los valores guardados (sin filtro de fecha)
    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .order('updated_at', { ascending: false });

    // 3. Buscar configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId);

    // 4. Agrupar valores por fecha
    const valuesByDate: Record<string, any[]> = {};
    allValues?.forEach(value => {
      const date = value.period_date;
      if (!valuesByDate[date]) {
        valuesByDate[date] = [];
      }
      valuesByDate[date].push(value);
    });

    // 5. Obtener fechas disponibles
    const availableDates = Object.keys(valuesByDate).sort().reverse();

    return NextResponse.json({
      success: true,
      model: modelUser,
      totalValues: allValues?.length || 0,
      availableDates,
      valuesByDate,
      hasConfig: !!config?.length,
      config: config?.[0] || null,
      summary: {
        totalRecords: allValues?.length || 0,
        uniqueDates: availableDates.length,
        latestDate: availableDates[0] || null,
        hasRecentData: availableDates.some(date => {
          const daysDiff = Math.abs(new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7; // Datos de los últimos 7 días
        })
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-MODEL-DATA] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

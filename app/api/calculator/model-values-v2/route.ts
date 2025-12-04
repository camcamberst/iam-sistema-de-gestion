import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate, normalizeToPeriodStartDate } from '@/utils/calculator-dates';
import { isPlatformFrozen, getFrozenPlatformsForModel } from '@/lib/calculator/period-closure-helpers';

export const dynamic = 'force-dynamic';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener valores de modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  
  const rawPeriodDate = searchParams.get('periodDate') || getColombiaPeriodStartDate();
  const periodDate = normalizeToPeriodStartDate(rawPeriodDate);

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MODEL-VALUES-V2] Loading values (Enhanced Auto-Repair):', { modelId, periodDate });
    
    // Calcular rango del periodo completo
    const isP2 = parseInt(periodDate.split('-')[2]) >= 16;
    const periodStart = periodDate; // Start date is the normalized date (1 or 16)
    const periodEndObj = new Date(periodDate);
    if (isP2) {
      // Fin de mes
      periodEndObj.setMonth(periodEndObj.getMonth() + 1);
      periodEndObj.setDate(0);
    } else {
      // Día 15
      periodEndObj.setDate(15);
    }
    const periodEnd = periodEndObj.toISOString().split('T')[0];

    // 🔧 ESTRATEGIA ROBUSTA: Obtener TODOS los valores dentro del rango del periodo
    // Esto incluye el bucket principal (ej: día 16) Y cualquier valor "húerfano" guardado en días intermedios (ej: día 28)
    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [MODEL-VALUES-V2] Database error:', valuesError);
      return NextResponse.json({ success: false, error: valuesError.message }, { status: 500 });
    }

    // Consolidar: Para cada plataforma, tomar el valor más reciente (updated_at)
    // Esto resuelve el conflicto entre "0s viejos en el bucket" vs "valores reales nuevos en orphans"
    const consolidatedMap = new Map();
    allValues?.forEach((val: any) => {
      // Si ya tenemos un valor para esta plataforma, solo lo reemplazamos si el actual es más reciente
      // Pero como ya ordenamos por updated_at DESC, el primero que encontramos es el más reciente.
      if (!consolidatedMap.has(val.platform_id)) {
        consolidatedMap.set(val.platform_id, val);
      }
    });
    
    const consolidatedValues = Array.from(consolidatedMap.values());

    console.log('✅ [MODEL-VALUES-V2] Consolidated values:', {
      totalFound: allValues?.length || 0,
      uniquePlatforms: consolidatedValues.length,
      periodRange: `${periodStart} to ${periodEnd}`
    });

// En GET:
    // ... (después de obtener valores)
    
    // Obtener plataformas congeladas para este modelo y fecha
    const frozenPlatforms = await getFrozenPlatformsForModel(periodDate, modelId); // Usar fecha normalizada

    return NextResponse.json({ 
      success: true, 
      data: consolidatedValues,
      count: consolidatedValues.length,
      modelId,
      periodDate,
      frozenPlatforms // <--- Nuevo campo
    });

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
    const body = await request.json();
    const { modelId, values, periodDate } = body;

    if (!modelId || !values) {
      return NextResponse.json({ success: false, error: 'modelId y values son requeridos' }, { status: 400 });
    }

    // 🔧 SOLUCIÓN DEFINITIVA: Usar SIEMPRE fecha de inicio de período normalizada
    const rawEffectiveDate = periodDate || getColombiaPeriodStartDate();
    const effectiveDate = normalizeToPeriodStartDate(rawEffectiveDate);
    
    // 🔒 CANDADO EUROPEO INTELIGENTE: Verificar si hay cambios reales en plataformas congeladas
    const frozenPlatformsInPayload = [];
    for (const platformId of Object.keys(values)) {
      // Verificar si la plataforma está congelada
      const isFrozen = await isPlatformFrozen(effectiveDate, modelId, platformId);
      if (isFrozen) {
        frozenPlatformsInPayload.push(platformId);
      }
    }

    // Si hay plataformas congeladas involucradas, verificar si sus valores han cambiado
    if (frozenPlatformsInPayload.length > 0) {
      console.log(`🔒 [MODEL-VALUES-V2] Verificando cambios en plataformas congeladas:`, frozenPlatformsInPayload);
      
      // Obtener valores actuales de la BD para comparar
      const { data: currentValues } = await supabase
        .from('model_values')
        .select('platform_id, value')
        .eq('model_id', modelId)
        .eq('period_date', effectiveDate) // Comparar contra el bucket actual
        .in('platform_id', frozenPlatformsInPayload);

      const currentValuesMap = new Map(currentValues?.map((v: any) => [v.platform_id, Number(v.value)]) || []);

      for (const platformId of frozenPlatformsInPayload) {
        const newValue = Number(values[platformId]);
        const currentValue = currentValuesMap.get(platformId) || 0;

        // Si el valor cambió (con tolerancia mínima para floats), BLOQUEAR
        if (Math.abs(newValue - currentValue) > 0.01) {
           console.warn(`🔒 [MODEL-VALUES-V2] RECHAZADO por Early Freeze: ${platformId} cambió de ${currentValue} a ${newValue}`);
           return NextResponse.json({ 
             success: false, 
             error: `La plataforma '${platformId}' ya cerró facturación (horario europeo). No se permiten cambios en este momento.` 
           }, { status: 403 });
        } else {
          console.log(`✅ [MODEL-VALUES-V2] Permitido: ${platformId} no cambió de valor (${currentValue})`);
        }
      }
    }

    console.log('🔍 [MODEL-VALUES-V2] Saving values (FORCED BUCKET):', { 
      modelId, 
      normalizedBucket: effectiveDate,
      valuesCount: Object.keys(values).length 
    });

    const rows = Object.entries(values).map(([platformId, value]) => ({
      model_id: modelId,
      platform_id: platformId,
      value: Number.parseFloat(String(value)) || 0,
      period_date: effectiveDate, // SIEMPRE al bucket 1 o 16
      updated_at: new Date().toISOString()
    }));

    if (rows.length === 0) {
       return NextResponse.json({ success: true, data: [], message: 'No values to save' });
    }

    const { data, error } = await supabase
      .from('model_values')
      .upsert(rows, { onConflict: 'model_id,platform_id,period_date' })
      .select();

    if (error) {
      console.error('❌ [MODEL-VALUES-V2] Error al guardar valores:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [MODEL-VALUES-V2] Values saved successfully to bucket:', effectiveDate);
    return NextResponse.json({ success: true, data: data || [], message: 'Valores guardados correctamente' });

  } catch (error: any) {
    console.error('❌ [MODEL-VALUES-V2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

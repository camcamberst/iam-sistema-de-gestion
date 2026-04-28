import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate, normalizeToPeriodStartDate, getPeriodDetails } from '@/utils/calculator-dates';
import { isPlatformFrozen, getFrozenPlatformsForModel } from '@/lib/calculator/period-closure-helpers';

export const dynamic = 'force-dynamic';

// P2 enero 2026: Mi Calculadora debe mostrar siempre 0 (cierre atípico ya archivado)
const P2_ENERO_PERIOD_DATE = '2026-01-16';

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
    // P2 enero: devolver siempre 0 para Mi Calculadora (cierre atípico)
    if (periodDate === P2_ENERO_PERIOD_DATE) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          count: 0,
          modelId,
          periodDate,
          frozenPlatforms: []
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache'
          }
        }
      );
    }

    console.log('🔍 [MODEL-VALUES-V2] Loading values (Enhanced Auto-Repair):', { modelId, periodDate });
    
    // Calcular rango del periodo completo
    const periodStart = periodDate; // Start date is the normalized date (1 or 16)
    const { endDate: periodEnd } = getPeriodDetails(periodStart);

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

    return NextResponse.json(
      {
        success: true,
        data: consolidatedValues,
        count: consolidatedValues.length,
        modelId,
        periodDate,
        frozenPlatforms
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache'
        }
      }
    );

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

    // P2 enero 2026: no permitir guardar valores (cierre atípico; Mi Calculadora en 0)
    if (effectiveDate === P2_ENERO_PERIOD_DATE) {
      return NextResponse.json({
        success: false,
        error: 'El período P2 enero (16-31) está cerrado. No se pueden guardar valores.'
      }, { status: 400 });
    }
    
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

    // Auto-sync calculator_totals para que billing-summary y billetera tengan datos frescos
    try {
      const { endDate: periodEnd } = getPeriodDetails(effectiveDate);

      const { data: allVals } = await supabase
        .from('model_values')
        .select('platform_id, value, updated_at')
        .eq('model_id', modelId)
        .gte('period_date', effectiveDate)
        .lte('period_date', periodEnd)
        .order('updated_at', { ascending: false });

      if (allVals && allVals.length > 0) {
        const latestByPlatform = new Map<string, any>();
        allVals.forEach(v => { if (!latestByPlatform.has(v.platform_id)) latestByPlatform.set(v.platform_id, v); });

        const pIds = [...latestByPlatform.keys()];
        const { data: cpRows } = await supabase
          .from('calculator_platforms').select('id, currency').in('id', pIds);
        const currMap: Record<string, string> = {};
        (cpRows || []).forEach((p: any) => { currMap[p.id] = p.currency || 'USD'; });

        const { data: ratesRows } = await supabase
          .from('rates').select('kind, value').eq('active', true).is('valid_to', null);
        const r = { usd_cop: 3900, eur_usd: 1.01, gbp_usd: 1.20 };
        (ratesRows || []).forEach((rt: any) => {
          if (rt.kind === 'USD→COP') r.usd_cop = rt.value;
          if (rt.kind === 'EUR→USD') r.eur_usd = rt.value;
          if (rt.kind === 'GBP→USD') r.gbp_usd = rt.value;
        });

        const { data: cfg } = await supabase
          .from('calculator_config').select('percentage_override, group_percentage')
          .eq('model_id', modelId).eq('active', true).maybeSingle();

        const { data: platformOverrides } = await supabase
          .from('calculator_config_platforms').select('platform_id, percentage_override')
          .eq('model_id', modelId);

        const pctOverrides: Record<string, number> = {};
        (platformOverrides || []).forEach((po: any) => {
          if (po.percentage_override) pctOverrides[po.platform_id] = po.percentage_override;
        });

        const basePct = cfg?.percentage_override || cfg?.group_percentage || 70;

        let totalBruto = 0;
        let totalModelo = 0;
        
        latestByPlatform.forEach((mv, pid) => {
          if (!mv.value || mv.value <= 0) return;
          const cur = currMap[pid] || 'USD';
          let ub = 0;
          if (cur === 'EUR') {
            if (pid === 'big7') ub = (mv.value * r.eur_usd) * 0.84;
            else if (pid === 'mondo') ub = (mv.value * r.eur_usd) * 0.78;
            else if (['modelka', 'xmodels', '777', 'vx', 'livecreator', 'mow'].includes(pid)) ub = mv.value * r.eur_usd;
            else ub = mv.value * r.eur_usd;
          } else if (cur === 'GBP') {
            if (pid === 'aw') ub = (mv.value * r.gbp_usd) * 0.677;
            else ub = mv.value * r.gbp_usd;
          } else {
            if (['cmd', 'camlust', 'skypvt'].includes(pid)) ub = mv.value * 0.75;
            else if (['chaturbate', 'myfreecams', 'stripchat'].includes(pid)) ub = mv.value * 0.05;
            else if (pid === 'dxlive') ub = mv.value * 0.60;
            else if (pid === 'secretfriends') ub = mv.value * 0.5;
            else if (pid === 'superfoon') ub = mv.value;
            else if (['mdh', 'livejasmin', 'imlive', 'hegre', 'dirtyfans', 'camcontacts'].includes(pid)) ub = mv.value;
            else ub = mv.value;
          }
          totalBruto += ub;
          
          const platformPct = pctOverrides[pid] || basePct;
          
          if (pid === 'superfoon') {
            totalModelo += ub; // 100% directo
          } else {
            totalModelo += ub * (platformPct / 100);
          }
        });

        const totalCop = totalModelo * r.usd_cop;

        await supabase.from('calculator_totals').upsert({
          model_id: modelId,
          period_date: effectiveDate,
          total_usd_bruto: Math.round(totalBruto * 100) / 100,
          total_usd_modelo: Math.round(totalModelo * 100) / 100,
          total_cop_modelo: Math.round(totalCop),
          updated_at: new Date().toISOString()
        }, { onConflict: 'model_id,period_date' });

        console.log('✅ [MODEL-VALUES-V2] Auto-sync calculator_totals:', {
          modelId, bruto: Math.round(totalBruto * 100) / 100, modelo: Math.round(totalModelo * 100) / 100
        });
      }
    } catch (syncErr: any) {
      console.error('⚠️ [MODEL-VALUES-V2] Auto-sync totals failed (non-blocking):', syncErr.message);
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

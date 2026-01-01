/**
 * Endpoint de verificación: Revisar estado del archivado de P2 de Diciembre
 * Verifica si hay registros en calculator_history y valores en model_values
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function GET(request: NextRequest) {
  try {
    const startDate = '2025-12-16';
    const endDate = '2025-12-31';
    const periodType = '16-31';

    // 1. Verificar registros en calculator_history
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id, period_date, period_type, value, archived_at')
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (historyError) {
      return NextResponse.json({
        success: false,
        error: `Error consultando calculator_history: ${historyError.message}`
      }, { status: 500 });
    }

    // 2. Verificar valores en model_values
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();

    const { data: modelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, period_date, value, updated_at')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (modelValuesError) {
      return NextResponse.json({
        success: false,
        error: `Error consultando model_values: ${modelValuesError.message}`
      }, { status: 500 });
    }

    // 3. Agrupar por modelo
    const modelosEnHistory = new Set<string>();
    const modelosEnModelValues = new Set<string>();
    
    history?.forEach(h => modelosEnHistory.add(h.model_id));
    modelValues?.forEach(v => modelosEnModelValues.add(v.model_id));

    // 4. Contar plataformas por modelo
    const plataformasPorModelo = new Map<string, number>();
    modelValues?.forEach(v => {
      const count = plataformasPorModelo.get(v.model_id) || 0;
      plataformasPorModelo.set(v.model_id, count + 1);
    });

    // 5. Obtener emails de modelos
    const todosLosModelIds = Array.from(new Set([
      ...Array.from(modelosEnHistory),
      ...Array.from(modelosEnModelValues)
    ]));

    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', todosLosModelIds);

    const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    // 6. Preparar resumen
    const resumen = {
      registros_en_history: history?.length || 0,
      registros_en_model_values: modelValues?.length || 0,
      modelos_en_history: modelosEnHistory.size,
      modelos_en_model_values: modelosEnModelValues.size,
      modelos_solo_en_model_values: Array.from(modelosEnModelValues).filter(id => !modelosEnHistory.has(id)).length,
      fecha_limite: fechaLimiteISO
    };

    // 7. Preparar detalles por modelo
    const detalles = Array.from(modelosEnModelValues).map(modelId => {
      const enHistory = modelosEnHistory.has(modelId);
      const plataformas = plataformasPorModelo.get(modelId) || 0;
      const email = emailMap.get(modelId) || modelId;

      return {
        model_id: modelId,
        email,
        en_history: enHistory,
        plataformas_en_model_values: plataformas,
        necesita_archivado: !enHistory
      };
    });

    return NextResponse.json({
      success: true,
      resumen,
      detalles: detalles.slice(0, 50), // Limitar a 50 para no sobrecargar
      total_modelos: detalles.length
    });

  } catch (error: any) {
    console.error('❌ [VERIFY-ARCHIVE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}


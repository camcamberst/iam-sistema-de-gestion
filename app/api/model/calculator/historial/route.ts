import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

/**
 * GET: Obtener historial de calculadora de un modelo
 * Consulta los períodos archivados desde calculator_history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'modelId es requerido'
      }, { status: 400 });
    }

    // Obtener todos los períodos archivados para este modelo
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        id,
        platform_id,
        value,
        period_date,
        period_type,
        archived_at,
        calculator_platforms (
          id,
          name,
          currency
        )
      `)
      .eq('model_id', modelId)
      .order('period_date', { ascending: false })
      .order('archived_at', { ascending: false });

    if (historyError) {
      console.error('❌ [CALCULATOR-HISTORIAL] Error obteniendo historial:', historyError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener historial'
      }, { status: 500 });
    }

    // Agrupar por período (period_date + period_type)
    const periodsMap = new Map<string, {
      period_date: string;
      period_type: string;
      archived_at: string;
      platforms: Array<{
        platform_id: string;
        platform_name: string;
        platform_currency: string;
        value: number;
      }>;
      total_value: number;
    }>();

    (history || []).forEach((item: any) => {
      const periodKey = `${item.period_date}-${item.period_type}`;
      
      if (!periodsMap.has(periodKey)) {
        periodsMap.set(periodKey, {
          period_date: item.period_date,
          period_type: item.period_type,
          archived_at: item.archived_at,
          platforms: [],
          total_value: 0
        });
      }

      const period = periodsMap.get(periodKey)!;
      period.platforms.push({
        platform_id: item.platform_id,
        platform_name: item.calculator_platforms?.name || item.platform_id,
        platform_currency: item.calculator_platforms?.currency || 'USD',
        value: parseFloat(item.value) || 0
      });
      period.total_value += parseFloat(item.value) || 0;
    });

    // Convertir a array y ordenar por fecha descendente
    const periods = Array.from(periodsMap.values()).sort((a, b) => {
      const dateA = new Date(a.period_date);
      const dateB = new Date(b.period_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      // Si la fecha es igual, ordenar por period_type (1-15 primero, luego 16-31)
      return a.period_type === '1-15' ? -1 : 1;
    });

    return NextResponse.json({
      success: true,
      periods,
      total_periods: periods.length
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}


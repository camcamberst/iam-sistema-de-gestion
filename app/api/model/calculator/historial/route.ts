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

    // PASO 1: Obtener datos básicos de calculator_history (sin join para mayor seguridad)
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('id, platform_id, value, period_date, period_type, archived_at')
      .eq('model_id', modelId)
      .order('period_date', { ascending: false });

    if (historyError) {
      console.error('❌ [CALCULATOR-HISTORIAL] Error obteniendo historial:', historyError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener historial'
      }, { status: 500 });
    }

    if (!history || history.length === 0) {
      return NextResponse.json({
        success: true,
        periods: [],
        total_periods: 0
      });
    }

    // PASO 2: Obtener información de plataformas por separado (consulta opcional, con fallback)
    const platformIds = [...new Set((history || []).map((h: any) => h.platform_id).filter(Boolean))];
    let platformsMap: Map<string, { name: string; currency: string }> = new Map();
    
    if (platformIds.length > 0) {
      const { data: platformsData } = await supabase
        .from('calculator_platforms')
        .select('id, name, currency')
        .in('id', platformIds);
      
      // Crear mapa de plataformas para acceso rápido (fallback si falla la consulta)
      if (platformsData) {
        platformsData.forEach((p: any) => {
          platformsMap.set(p.id, {
            name: p.name || p.id,
            currency: p.currency || 'USD'
          });
        });
      }
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

    // PASO 3: Procesar y agrupar datos con validaciones
    history.forEach((item: any) => {
      // Validar datos antes de procesar
      if (!item.period_date || !item.period_type || !item.platform_id) {
        console.warn('⚠️ [CALCULATOR-HISTORIAL] Registro con datos incompletos:', item);
        return; // Saltar este registro
      }

      const periodKey = `${item.period_date}-${item.period_type}`;
      const platformInfo = platformsMap.get(item.platform_id);
      
      // Convertir value de forma segura (manejar DECIMAL y null)
      const numValue = item.value != null ? Number(item.value) : 0;
      const safeValue = isNaN(numValue) ? 0 : numValue;
      
      if (!periodsMap.has(periodKey)) {
        periodsMap.set(periodKey, {
          period_date: item.period_date,
          period_type: item.period_type,
          archived_at: item.archived_at || new Date().toISOString(),
          platforms: [],
          total_value: 0
        });
      }

      const period = periodsMap.get(periodKey)!;
      period.platforms.push({
        platform_id: item.platform_id,
        platform_name: platformInfo?.name || item.platform_id,
        platform_currency: platformInfo?.currency || 'USD',
        value: safeValue
      });
      period.total_value += safeValue;
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


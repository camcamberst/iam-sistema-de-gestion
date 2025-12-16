import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/period-closure-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * POST: Limpiar registros de plataformas congeladas
 * Endpoint de diagnóstico y limpieza manual
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const forceCleanup = searchParams.get('force') === 'true';
    const secret = request.headers.get('x-cleanup-secret');
    const cronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    
    // Verificar secret para seguridad
    if (secret !== cronSecret) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    const currentColombiaDate = getColombiaDate();
    const currentDay = parseInt(currentColombiaDate.split('-')[2]);
    const [currentYear, currentMonth] = currentColombiaDate.split('-');
    const currentPeriodDate = currentDay <= 15 
      ? `${currentYear}-${currentMonth}-01`
      : `${currentYear}-${currentMonth}-16`;

    console.log('🧹 [CLEANUP-FROZEN] Iniciando limpieza de plataformas congeladas...', {
      modelId: modelId?.substring(0, 8),
      currentPeriodDate,
      forceCleanup
    });

    let deletedCount = 0;

    if (modelId) {
      // Limpiar para un modelo específico
      if (forceCleanup) {
        // Limpieza forzada: eliminar TODOS los registros del modelo
        const { data: deletedData, error: deleteError } = await supabase
          .from('calculator_early_frozen_platforms')
          .delete()
          .eq('model_id', modelId)
          .select();
        
        if (deleteError) {
          console.error('❌ [CLEANUP-FROZEN] Error en limpieza forzada:', deleteError);
          return NextResponse.json({
            success: false,
            error: deleteError.message
          }, { status: 500 });
        }
        
        deletedCount = deletedData?.length || 0;
        console.log(`✅ [CLEANUP-FROZEN] Limpieza forzada: ${deletedCount} registros eliminados para modelo ${modelId.substring(0, 8)}`);
      } else {
        // Limpieza normal: eliminar registros de períodos cerrados y fuera del período actual
        // 1. Eliminar registros de períodos cerrados
        const { data: closedPeriods } = await supabase
          .from('calculator_period_closure_status')
          .select('period_date')
          .eq('status', 'completed');
        
        if (closedPeriods && closedPeriods.length > 0) {
          const closedPeriodDates = closedPeriods.map(p => p.period_date);
          const { data: deletedClosed, error: deleteClosedError } = await supabase
            .from('calculator_early_frozen_platforms')
            .delete()
            .eq('model_id', modelId)
            .in('period_date', closedPeriodDates)
            .select();
          
          if (!deleteClosedError) {
            deletedCount += deletedClosed?.length || 0;
            console.log(`✅ [CLEANUP-FROZEN] Eliminados ${deletedClosed?.length || 0} registros de períodos cerrados`);
          }
        }
        
        // 2. Eliminar registros fuera del período actual
        const { data: deletedCurrent, error: deleteCurrentError } = await supabase
          .from('calculator_early_frozen_platforms')
          .delete()
          .eq('model_id', modelId)
          .neq('period_date', currentPeriodDate)
          .select();
        
        if (!deleteCurrentError) {
          deletedCount += deletedCurrent?.length || 0;
          console.log(`✅ [CLEANUP-FROZEN] Eliminados ${deletedCurrent?.length || 0} registros fuera del período actual`);
        }
      }
    } else {
      // Limpiar para todos los modelos
      // Eliminar registros de períodos cerrados
      const { data: closedPeriods } = await supabase
        .from('calculator_period_closure_status')
        .select('period_date')
        .eq('status', 'completed');
      
      if (closedPeriods && closedPeriods.length > 0) {
        const closedPeriodDates = closedPeriods.map(p => p.period_date);
        const { data: deletedAll, error: deleteAllError } = await supabase
          .from('calculator_early_frozen_platforms')
          .delete()
          .in('period_date', closedPeriodDates)
          .select();
        
        if (!deleteAllError) {
          deletedCount = deletedAll?.length || 0;
          console.log(`✅ [CLEANUP-FROZEN] Eliminados ${deletedCount} registros de períodos cerrados (todos los modelos)`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      current_period_date: currentPeriodDate,
      message: `Limpieza completada: ${deletedCount} registros eliminados`
    });

  } catch (error) {
    console.error('❌ [CLEANUP-FROZEN] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * GET: Diagnosticar estado de plataformas congeladas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    const currentColombiaDate = getColombiaDate();
    const currentDay = parseInt(currentColombiaDate.split('-')[2]);
    const [currentYear, currentMonth] = currentColombiaDate.split('-');
    const currentPeriodDate = currentDay <= 15 
      ? `${currentYear}-${currentMonth}-01`
      : `${currentYear}-${currentMonth}-16`;

    let query = supabase
      .from('calculator_early_frozen_platforms')
      .select('period_date, platform_id, model_id, frozen_at')
      .order('frozen_at', { ascending: false })
      .limit(100);

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data: frozenRecords, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Agrupar por período
    const byPeriod = new Map();
    frozenRecords?.forEach(record => {
      const key = record.period_date;
      if (!byPeriod.has(key)) {
        byPeriod.set(key, []);
      }
      byPeriod.get(key).push(record);
    });

    // Verificar períodos cerrados
    const { data: closedPeriods } = await supabase
      .from('calculator_period_closure_status')
      .select('period_date, period_type, status')
      .eq('status', 'completed');

    return NextResponse.json({
      success: true,
      current_period_date: currentPeriodDate,
      total_records: frozenRecords?.length || 0,
      records_by_period: Object.fromEntries(byPeriod),
      closed_periods: closedPeriods || [],
      records_in_closed_periods: frozenRecords?.filter(r => 
        closedPeriods?.some(cp => cp.period_date === r.period_date)
      ).length || 0
    });

  } catch (error) {
    console.error('❌ [CLEANUP-FROZEN] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


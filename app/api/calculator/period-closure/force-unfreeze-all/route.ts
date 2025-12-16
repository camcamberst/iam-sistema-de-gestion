import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * POST: Forzar desbloqueo de TODAS las plataformas (EMERGENCIA)
 * Este endpoint limpia TODOS los registros de early freeze inmediatamente
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-unfreeze-secret');
    const cronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    
    // Verificar secret para seguridad
    if (secret !== cronSecret) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    console.log('🚨 [FORCE-UNFREEZE] Iniciando desbloqueo forzado de TODAS las plataformas...');

    // Eliminar TODOS los registros de early freeze
    const { data: deletedData, error: deleteError } = await supabase
      .from('calculator_early_frozen_platforms')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (usando un ID que no existe)
      .select();

    if (deleteError) {
      console.error('❌ [FORCE-UNFREEZE] Error:', deleteError);
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 });
    }

    const deletedCount = deletedData?.length || 0;
    console.log(`✅ [FORCE-UNFREEZE] Desbloqueo completado: ${deletedCount} registros eliminados`);

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      message: `Todas las plataformas han sido desbloqueadas. ${deletedCount} registros eliminados.`
    });

  } catch (error) {
    console.error('❌ [FORCE-UNFREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * GET: Verificar estado actual de plataformas congeladas
 */
export async function GET(request: NextRequest) {
  try {
    const { data: frozenRecords, error } = await supabase
      .from('calculator_early_frozen_platforms')
      .select('period_date, platform_id, model_id, frozen_at')
      .order('frozen_at', { ascending: false })
      .limit(100);

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

    return NextResponse.json({
      success: true,
      total_records: frozenRecords?.length || 0,
      records_by_period: Object.fromEntries(byPeriod),
      records: frozenRecords || []
    });

  } catch (error) {
    console.error('❌ [FORCE-UNFREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}


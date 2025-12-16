import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

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
 * POST: Limpia valores residuales del período anterior que no se eliminaron durante el cierre
 * Solo accesible para super_admin o con cron secret
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP-RESIDUAL] Iniciando limpieza de valores residuales...');

    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedCronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    
    let isAuthorized = cronSecret === expectedCronSecret;
    
    if (!isAuthorized && authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabaseAuth = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
        );
        
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
        
        if (user && !authError) {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
            
          if (userData?.role === 'super_admin') {
            isAuthorized = true;
            console.log('🛡️ [CLEANUP-RESIDUAL] Super Admin autenticado:', user.email);
          }
        }
      } catch (e) {
        console.warn('⚠️ [CLEANUP-RESIDUAL] Error validando auth:', e);
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    // Determinar el período anterior que se debe limpiar
    const todayDate = getColombiaDate();
    const [year, month, day] = todayDate.split('-').map(Number);
    
    let startDate: string;
    let endDate: string;
    let periodType: '1-15' | '16-31';
    
    if (day >= 16) {
      // Estamos en P2, limpiar P1 (1-15 del mes actual)
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
      periodType = '1-15';
    } else {
      // Estamos en P1, limpiar P2 del mes anterior (16-último día)
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-16`;
      endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDay}`;
      periodType = '16-31';
    }

    console.log(`📅 [CLEANUP-RESIDUAL] Limpiando período ${periodType}: ${startDate} a ${endDate}`);

    // Verificar cuántos valores residuales hay
    const { data: residualValues, error: countError } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, value, period_date')
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (countError) {
      console.error('❌ [CLEANUP-RESIDUAL] Error contando valores:', countError);
      throw countError;
    }

    const residualCount = residualValues?.length || 0;
    console.log(`🔍 [CLEANUP-RESIDUAL] Encontrados ${residualCount} valores residuales`);

    if (residualCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay valores residuales para limpiar',
        period: { startDate, endDate, periodType },
        deleted: 0
      });
    }

    // Eliminar valores residuales
    const { data: deletedData, error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .select();

    if (deleteError) {
      console.error('❌ [CLEANUP-RESIDUAL] Error eliminando valores:', deleteError);
      throw deleteError;
    }

    const deletedCount = deletedData?.length || 0;
    console.log(`✅ [CLEANUP-RESIDUAL] Eliminados ${deletedCount} valores residuales`);

    // Agrupar por modelo para el reporte
    const modelSummary: Record<string, number> = {};
    deletedData?.forEach((row: any) => {
      modelSummary[row.model_id] = (modelSummary[row.model_id] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      message: `Limpieza completada: ${deletedCount} valores residuales eliminados`,
      period: { startDate, endDate, periodType },
      deleted: deletedCount,
      models_affected: Object.keys(modelSummary).length,
      summary: modelSummary
    });

  } catch (error) {
    console.error('❌ [CLEANUP-RESIDUAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * GET: Muestra información sobre valores residuales sin eliminar
 */
export async function GET(request: NextRequest) {
  try {
    const todayDate = getColombiaDate();
    const [year, month, day] = todayDate.split('-').map(Number);
    
    let startDate: string;
    let endDate: string;
    let periodType: '1-15' | '16-31';
    
    if (day >= 16) {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
      periodType = '1-15';
    } else {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-16`;
      endDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${lastDay}`;
      periodType = '16-31';
    }

    // Contar valores residuales
    const { data: residualValues, error } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, value, period_date')
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (error) throw error;

    const residualCount = residualValues?.length || 0;
    
    // Agrupar por modelo
    const modelSummary: Record<string, { count: number; platforms: string[] }> = {};
    residualValues?.forEach((row: any) => {
      if (!modelSummary[row.model_id]) {
        modelSummary[row.model_id] = { count: 0, platforms: [] };
      }
      modelSummary[row.model_id].count++;
      if (!modelSummary[row.model_id].platforms.includes(row.platform_id)) {
        modelSummary[row.model_id].platforms.push(row.platform_id);
      }
    });

    return NextResponse.json({
      success: true,
      current_date: todayDate,
      previous_period: { startDate, endDate, periodType },
      residual_count: residualCount,
      models_with_residuals: Object.keys(modelSummary).length,
      summary: modelSummary
    });

  } catch (error) {
    console.error('❌ [CLEANUP-RESIDUAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 });
  }
}


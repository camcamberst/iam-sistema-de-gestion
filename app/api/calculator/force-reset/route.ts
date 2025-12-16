import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * POST: Fuerza reset de TODOS los valores en model_values
 * PELIGROSO - Solo usar cuando es necesario resetear las calculadoras después de un cierre fallido
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔥 [FORCE-RESET] Iniciando reset forzado de model_values...');

    // Verificar autorización
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedCronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    
    if (cronSecret !== expectedCronSecret) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 });
    }

    // Contar valores antes de eliminar
    const { count: beforeCount } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true });

    console.log(`🔍 [FORCE-RESET] Valores antes del reset: ${beforeCount}`);

    // Eliminar TODOS los valores de model_values
    const { error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .gte('period_date', '2000-01-01'); // Esto elimina todos los registros

    if (deleteError) {
      console.error('❌ [FORCE-RESET] Error eliminando:', deleteError);
      throw deleteError;
    }

    // Verificar que se eliminaron
    const { count: afterCount } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ [FORCE-RESET] Reset completado. Valores eliminados: ${beforeCount}, Restantes: ${afterCount}`);

    return NextResponse.json({
      success: true,
      message: `Reset forzado completado`,
      deleted: beforeCount || 0,
      remaining: afterCount || 0
    });

  } catch (error) {
    console.error('❌ [FORCE-RESET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 });
  }
}


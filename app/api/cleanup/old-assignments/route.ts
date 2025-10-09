import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] Iniciando limpieza automática de asignaciones antiguas...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Eliminar registros is_active=false que tengan más de 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: deleteResult, error: deleteError } = await supabase
      .from('modelo_assignments')
      .delete()
      .eq('is_active', false)
      .lt('assigned_at', sevenDaysAgo.toISOString());

    if (deleteError) {
      console.error('❌ [CLEANUP] Error eliminando asignaciones antiguas:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando asignaciones antiguas' },
        { status: 500 }
      );
    }

    console.log('✅ [CLEANUP] Asignaciones antiguas eliminadas:', deleteResult);

    // Verificar estado actual
    const { data: currentAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id, room_id, jornada, is_active, assigned_at')
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      console.error('❌ [CLEANUP] Error verificando estado actual:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Error verificando estado actual' },
        { status: 500 }
      );
    }

    const activeCount = currentAssignments?.filter(a => a.is_active).length || 0;
    const inactiveCount = currentAssignments?.filter(a => !a.is_active).length || 0;

    console.log(`📊 [CLEANUP] Estado actual: ${activeCount} activas, ${inactiveCount} inactivas`);

    return NextResponse.json({
      success: true,
      message: 'Limpieza automática completada',
      deleted_count: Array.isArray(deleteResult) ? deleteResult.length : 0,
      current_state: {
        active: activeCount,
        inactive: inactiveCount,
        total: currentAssignments?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

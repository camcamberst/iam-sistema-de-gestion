import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] Iniciando limpieza de asignaciones fantasma...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verificar estado actual
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id, room_id, jornada, is_active, assigned_at')
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      console.error('❌ [CLEANUP] Error obteniendo asignaciones:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    console.log('🔍 [CLEANUP] Estado actual de asignaciones:', allAssignments);

    // 2. Eliminar físicamente todas las asignaciones inactivas
    const { data: deleteResult, error: deleteError } = await supabase
      .from('modelo_assignments')
      .delete()
      .eq('is_active', false);

    if (deleteError) {
      console.error('❌ [CLEANUP] Error eliminando asignaciones inactivas:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando asignaciones inactivas' },
        { status: 500 }
      );
    }

    console.log('✅ [CLEANUP] Asignaciones inactivas eliminadas:', deleteResult);

    // 3. Verificar estado final
    const { data: finalAssignments, error: finalError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id, room_id, jornada, is_active, assigned_at')
      .order('assigned_at', { ascending: false });

    if (finalError) {
      console.error('❌ [CLEANUP] Error verificando estado final:', finalError);
      return NextResponse.json(
        { success: false, error: 'Error verificando estado final' },
        { status: 500 }
      );
    }

    console.log('🔍 [CLEANUP] Estado final de asignaciones:', finalAssignments);

    return NextResponse.json({
      success: true,
      message: 'Limpieza completada',
      before: allAssignments,
      after: finalAssignments,
      deleted_count: allAssignments?.filter(a => !a.is_active).length || 0
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

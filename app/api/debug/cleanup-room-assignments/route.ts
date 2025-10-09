import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 [CLEANUP] Iniciando limpieza de asignaciones de ROOM01...');

    // 1. Obtener todas las asignaciones de ROOM01
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('*')
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c'); // ROOM01

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: `Error obteniendo asignaciones: ${fetchError.message}`
      });
    }

    console.log('🔍 [CLEANUP] Asignaciones encontradas:', allAssignments?.length || 0);
    console.log('🔍 [CLEANUP] Asignaciones:', allAssignments);

    // 2. Eliminar TODAS las asignaciones de ROOM01
    const { error: deleteError } = await supabase
      .from('modelo_assignments')
      .delete()
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c');

    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: `Error eliminando asignaciones: ${deleteError.message}`
      });
    }

    console.log('✅ [CLEANUP] Todas las asignaciones de ROOM01 eliminadas');

    // 3. Crear solo la asignación de MAÑANA (la que sabemos que funciona)
    const { data: newAssignment, error: insertError } = await supabase
      .from('modelo_assignments')
      .insert({
        model_id: 'fe54995d-1828-4721-8153-53fce6f4fe56', // Melanié
        room_id: '17227f3e-9150-428e-a8a8-cca92ee6978c', // ROOM01
        jornada: 'MAÑANA',
        is_active: true,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Error creando asignación de MAÑANA: ${insertError.message}`
      });
    }

    console.log('✅ [CLEANUP] Asignación de MAÑANA recreada:', newAssignment);

    // 4. Verificar el estado final
    const { data: finalAssignments, error: finalError } = await supabase
      .from('modelo_assignments')
      .select('*')
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c')
      .eq('is_active', true);

    if (finalError) {
      return NextResponse.json({
        success: false,
        error: `Error verificando estado final: ${finalError.message}`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Limpieza completada exitosamente',
      deleted_count: allAssignments?.length || 0,
      created_assignment: newAssignment,
      final_assignments: finalAssignments,
      summary: {
        before_cleanup: allAssignments?.length || 0,
        after_cleanup: finalAssignments?.length || 0,
        only_morning_assigned: true
      }
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'room_id es requerido' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 [GHOST CLEANUP] Iniciando limpieza agresiva para room:', roomId);

    // 1. Obtener todas las asignaciones inactivas del room
    const { data: inactiveAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', false);

    if (fetchError) {
      console.error('❌ [GHOST CLEANUP] Error obteniendo asignaciones inactivas:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones inactivas' },
        { status: 500 }
      );
    }

    console.log(`🔍 [GHOST CLEANUP] Encontradas ${inactiveAssignments?.length || 0} asignaciones inactivas`);

    // 2. Eliminar FÍSICAMENTE todas las asignaciones inactivas
    const { error: deleteError } = await supabase
      .from('modelo_assignments')
      .delete()
      .eq('room_id', roomId)
      .eq('is_active', false);

    if (deleteError) {
      console.error('❌ [GHOST CLEANUP] Error eliminando asignaciones fantasma:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando asignaciones fantasma' },
        { status: 500 }
      );
    }

    console.log(`✅ [GHOST CLEANUP] Eliminadas ${inactiveAssignments?.length || 0} asignaciones fantasma`);

    // 3. Verificar el estado final
    const { data: finalAssignments, error: finalError } = await supabase
      .from('modelo_assignments')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true);

    if (finalError) {
      console.error('❌ [GHOST CLEANUP] Error verificando estado final:', finalError);
    }

    console.log(`✅ [GHOST CLEANUP] Estado final: ${finalAssignments?.length || 0} asignaciones activas`);

    return NextResponse.json({
      success: true,
      message: `Limpieza agresiva completada. ${inactiveAssignments?.length || 0} asignaciones fantasma eliminadas.`,
      deleted_count: inactiveAssignments?.length || 0,
      remaining_active: finalAssignments?.length || 0,
      deleted_assignments: inactiveAssignments
    });

  } catch (error) {
    console.error('❌ [GHOST CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

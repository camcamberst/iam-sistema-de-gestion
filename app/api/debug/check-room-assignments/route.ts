import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 [DEBUG] Verificando asignaciones para room:', roomId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener TODAS las asignaciones (activas e inactivas)
    const { data: allAssignments, error: allError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        jornada,
        assigned_at,
        is_active,
        model_id,
        room_id
      `)
      .eq('room_id', roomId)
      .order('jornada', { ascending: true });

    if (allError) {
      console.error('❌ [DEBUG] Error obteniendo todas las asignaciones:', allError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    // Obtener solo las activas (como hace el endpoint normal)
    const { data: activeAssignments, error: activeError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        jornada,
        assigned_at,
        is_active,
        model_id,
        room_id
      `)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('jornada', { ascending: true });

    if (activeError) {
      console.error('❌ [DEBUG] Error obteniendo asignaciones activas:', activeError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones activas' },
        { status: 500 }
      );
    }

    console.log('🔍 [DEBUG] Todas las asignaciones:', allAssignments);
    console.log('🔍 [DEBUG] Solo activas:', activeAssignments);

    return NextResponse.json({
      success: true,
      room_id: roomId,
      all_assignments: allAssignments,
      active_assignments: activeAssignments,
      summary: {
        total: allAssignments?.length || 0,
        active: activeAssignments?.length || 0,
        inactive: (allAssignments?.length || 0) - (activeAssignments?.length || 0)
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
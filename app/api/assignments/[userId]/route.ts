import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// =====================================================
// 📋 GET - Obtener asignaciones de un usuario específico
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    console.log('🔍 [ASSIGNMENTS API] Obteniendo asignaciones para usuario:', params.userId);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener asignaciones del usuario con información de room
    const { data: assignments, error } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        jornada,
        room_id,
        group_id,
        assigned_at,
        is_active,
        group_rooms!inner(
          room_name
        ),
        groups!inner(
          name
        )
      `)
      .eq('model_id', params.userId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ [ASSIGNMENTS API] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    // Formatear asignaciones
    const formattedAssignments = (assignments || []).map(assignment => ({
      id: assignment.id,
      jornada: assignment.jornada,
      room_id: assignment.room_id,
      room_name: assignment.group_rooms?.[0]?.room_name || null,
      group_id: assignment.group_id,
      group_name: assignment.groups?.name || null,
      assigned_at: assignment.assigned_at,
      is_active: assignment.is_active
    }));

    console.log('✅ [ASSIGNMENTS API] Asignaciones obtenidas:', formattedAssignments.length);

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments
    });

  } catch (error) {
    console.error('❌ [ASSIGNMENTS API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

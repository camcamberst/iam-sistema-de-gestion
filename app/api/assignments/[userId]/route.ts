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

    // Primero intentar obtener de modelo_assignments
    const { data: assignments, error: assignmentsError } = await supabase
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

    let formattedAssignments = [];

    if (assignmentsError) {
      console.error('❌ [ASSIGNMENTS API] Error en modelo_assignments:', assignmentsError);
    } else if (assignments && assignments.length > 0) {
      // Formatear asignaciones de modelo_assignments
      formattedAssignments = assignments.map(assignment => ({
        id: assignment.id,
        jornada: assignment.jornada,
        room_id: assignment.room_id,
        room_name: assignment.group_rooms?.[0]?.room_name || null,
        group_id: assignment.group_id,
        group_name: assignment.groups?.[0]?.name || null,
        assigned_at: assignment.assigned_at,
        is_active: assignment.is_active
      }));
    } else {
      // Si no hay asignaciones en modelo_assignments, buscar en jornada_states
      console.log('🔍 [ASSIGNMENTS API] No hay asignaciones en modelo_assignments, buscando en jornada_states...');
      
      const { data: jornadaStates, error: jornadaError } = await supabase
        .from('jornada_states')
        .select(`
          id,
          jornada,
          room_id,
          group_id,
          updated_at,
          model_id,
          state,
          group_rooms!inner(
            room_name
          ),
          groups!inner(
            name
          )
        `)
        .eq('model_id', params.userId)
        .eq('state', 'OCUPADA')
        .order('updated_at', { ascending: false });

      if (jornadaError) {
        console.error('❌ [ASSIGNMENTS API] Error en jornada_states:', jornadaError);
      } else if (jornadaStates && jornadaStates.length > 0) {
        // Formatear asignaciones de jornada_states
        formattedAssignments = jornadaStates.map(jornada => ({
          id: jornada.id,
          jornada: jornada.jornada,
          room_id: jornada.room_id,
          room_name: jornada.group_rooms?.[0]?.room_name || null,
          group_id: jornada.group_id,
          group_name: jornada.groups?.[0]?.name || null,
          assigned_at: jornada.updated_at,
          is_active: true
        }));
        console.log('✅ [ASSIGNMENTS API] Asignaciones encontradas en jornada_states:', formattedAssignments.length);
      }
    }

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

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const supabase = supabaseServer;

export async function GET() {
  try {
    console.log('🔍 [API] Obteniendo todas las asignaciones...');

    // Obtener todas las asignaciones activas con información completa
    const { data: assignments, error: assignmentsError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at,
        is_active,
        users!inner(
          id,
          name,
          email
        ),
        group_rooms!inner(
          id,
          room_name,
          groups!inner(
            id,
            name
          )
        )
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (assignmentsError) {
      console.error('❌ [API] Error obteniendo asignaciones:', assignmentsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones de la base de datos' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Asignaciones obtenidas:', assignments?.length || 0);

    // Formatear los datos para el frontend
    const formattedAssignments = assignments?.map(assignment => ({
      id: assignment.id,
      model_id: assignment.model_id,
      modelo_name: (assignment.users as any)?.name || 'Modelo desconocido',
      modelo_email: (assignment.users as any)?.email || '',
      group_id: (assignment.group_rooms as any)?.groups?.id || '',
      grupo_name: (assignment.group_rooms as any)?.groups?.name || 'Grupo desconocido',
      room_id: assignment.room_id,
      room_name: (assignment.group_rooms as any)?.room_name || 'Room desconocido',
      jornada: assignment.jornada,
      assigned_at: assignment.assigned_at,
      is_active: assignment.is_active
    })) || [];

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments
    });

  } catch (error) {
    console.error('❌ [API] Error inesperado:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

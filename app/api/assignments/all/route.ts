import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const supabase = supabaseServer;

export async function GET() {
  try {
    console.log('🔍 [API] Obteniendo todas las asignaciones...');

    // Usar room_assignments_detailed (room_assignments es la fuente actual, modelo_assignments está deprecada)
    const { data: assignments, error: assignmentsError } = await supabase
      .from('room_assignments_detailed')
      .select('id, model_id, room_id, jornada, assigned_at, model_name, model_email, room_name, group_name, group_id')
      .order('assigned_at', { ascending: false });

    if (assignmentsError) {
      console.error('❌ [API] Error obteniendo asignaciones:', assignmentsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones de la base de datos' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Asignaciones obtenidas:', assignments?.length || 0);

    const formattedAssignments = (assignments || []).map((a: any) => ({
      id: a.id,
      model_id: a.model_id,
      modelo_name: a.model_name || 'Modelo desconocido',
      modelo_email: a.model_email || '',
      group_id: a.group_id || '',
      grupo_name: a.group_name || 'Grupo desconocido',
      room_id: a.room_id,
      room_name: a.room_name || 'Room desconocido',
      jornada: a.jornada,
      assigned_at: a.assigned_at,
      is_active: true
    }));

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

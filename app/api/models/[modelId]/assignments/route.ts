import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    const { modelId } = params;

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'ID de modelo requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener asignaciones activas del modelo
    const { data: assignments, error } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        room_id,
        jornada,
        assigned_at,
        is_active
      `)
      .eq('model_id', modelId)
      .eq('is_active', true);

    if (error) {
      console.error('Error obteniendo asignaciones del modelo:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones del modelo' },
        { status: 500 }
      );
    }

    // Obtener información de rooms por separado
    const formattedAssignments = [];
    if (assignments && assignments.length > 0) {
      for (const assignment of assignments) {
        // Obtener información del room
        const { data: roomData, error: roomError } = await supabase
          .from('group_rooms')
          .select(`
            room_name,
            groups!inner(
              name
            )
          `)
          .eq('id', assignment.room_id)
          .single();

        if (roomError) {
          console.warn('Error obteniendo información del room:', roomError);
        }

        formattedAssignments.push({
          id: assignment.id,
          room_id: assignment.room_id,
          room_name: roomData?.room_name || 'Room desconocido',
          group_name: roomData?.groups?.[0]?.name || 'Grupo desconocido',
          jornada: assignment.jornada,
          assigned_at: assignment.assigned_at
        });
      }
    }

    console.log(`✅ [API] Asignaciones encontradas para modelo ${modelId}:`, formattedAssignments.length);

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments
    });

  } catch (error) {
    console.error('Error en GET /api/models/[modelId]/assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

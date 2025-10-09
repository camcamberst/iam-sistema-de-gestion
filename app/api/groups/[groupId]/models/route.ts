import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener modelos del grupo específico
    // Como la columna groups no existe, vamos a filtrar por asignaciones existentes
    // Solo mostrar modelos que ya están asignados a rooms de este grupo
    
    // 1. Obtener rooms del grupo
    const { data: groupRooms, error: roomsError } = await supabase
      .from('group_rooms')
      .select('id')
      .eq('group_id', groupId);

    if (roomsError) {
      console.error('Error obteniendo rooms del grupo:', roomsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo rooms del grupo' },
        { status: 500 }
      );
    }

    const roomIds = groupRooms?.map(room => room.id) || [];

    // 2. Obtener modelos que están asignados a rooms de este grupo
    const { data: assignments, error: assignmentsError } = await supabase
      .from('modelo_assignments')
      .select('model_id')
      .in('room_id', roomIds)
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('Error obteniendo asignaciones:', assignmentsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    const assignedModelIds = assignments?.map(a => a.model_id) || [];

    // 3. Obtener información de los modelos asignados
    let models = [];
    if (assignedModelIds.length > 0) {
      const { data: assignedModels, error: modelsError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          role,
          is_active
        `)
        .in('id', assignedModelIds)
        .eq('role', 'modelo')
        .eq('is_active', true);

      if (modelsError) {
        console.error('Error obteniendo modelos asignados:', modelsError);
        return NextResponse.json(
          { success: false, error: 'Error obteniendo modelos asignados' },
          { status: 500 }
        );
      }

      models = assignedModels || [];
    }

    console.log(`✅ [API] Modelos encontrados para grupo ${groupId}:`, models?.length || 0);

    return NextResponse.json({
      success: true,
      models: models || []
    });

  } catch (error) {
    console.error('Error en GET /api/groups/[groupId]/models:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todas las asignaciones activas
    const { data: allAssignments, error: allError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        is_active,
        assigned_at
      `)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (allError) {
      return NextResponse.json({
        success: false,
        error: `Error obteniendo todas las asignaciones: ${allError.message}`
      });
    }

    // Obtener información de rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('group_rooms')
      .select('id, room_name, group_id');

    if (roomsError) {
      return NextResponse.json({
        success: false,
        error: `Error obteniendo rooms: ${roomsError.message}`
      });
    }

    // Obtener información de modelos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      return NextResponse.json({
        success: false,
        error: `Error obteniendo modelos: ${modelsError.message}`
      });
    }

    // Formatear datos
    const formattedData = allAssignments?.map(assignment => {
      const room = rooms?.find(r => r.id === assignment.room_id);
      const model = models?.find(m => m.id === assignment.model_id);
      
      return {
        assignment_id: assignment.id,
        room_name: room?.room_name || 'Room no encontrado',
        room_id: assignment.room_id,
        jornada: assignment.jornada,
        model_name: model?.name || 'Modelo no encontrado',
        model_email: model?.email || 'Email no encontrado',
        model_id: assignment.model_id,
        assigned_at: assignment.assigned_at,
        is_active: assignment.is_active
      };
    }) || [];

    return NextResponse.json({
      success: true,
      total_assignments: formattedData.length,
      assignments: formattedData,
      summary: {
        by_room: formattedData.reduce((acc, assignment) => {
          const key = assignment.room_name;
          if (!acc[key]) acc[key] = {};
          if (!acc[key][assignment.jornada]) acc[key][assignment.jornada] = [];
          acc[key][assignment.jornada].push(assignment.model_name);
          return acc;
        }, {} as any),
        duplicates: formattedData.filter((assignment, index) => 
          formattedData.findIndex(a => 
            a.room_id === assignment.room_id && 
            a.jornada === assignment.jornada && 
            a.model_id === assignment.model_id
          ) !== index
        )
      }
    });

  } catch (error) {
    console.error('Error en debug room assignments:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

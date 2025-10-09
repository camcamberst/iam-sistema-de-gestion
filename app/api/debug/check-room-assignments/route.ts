import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todas las asignaciones activas para ROOM01
    const { data: assignments, error } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        is_active,
        assigned_at
      `)
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c') // ROOM01 ID
      .eq('is_active', true)
      .order('jornada', { ascending: true });

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Error obteniendo asignaciones: ${error.message}`
      });
    }

    // Obtener información de la modelo
    const modelId = 'fe54995d-1828-4721-8153-53fce6f4fe56'; // Melanié ID
    const { data: modelData, error: modelError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', modelId)
      .single();

    return NextResponse.json({
      success: true,
      room_id: '17227f3e-9150-428e-a8a8-cca92ee6978c',
      model_id: modelId,
      assignments: assignments || [],
      model_info: modelData,
      model_error: modelError,
      summary: {
        total_assignments: assignments?.length || 0,
        by_jornada: assignments?.reduce((acc, assignment) => {
          acc[assignment.jornada] = assignment;
          return acc;
        }, {} as any) || {}
      }
    });

  } catch (error) {
    console.error('Error en check-room-assignments:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

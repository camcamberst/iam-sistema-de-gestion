import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    console.log('🏠 [API] Obteniendo asignaciones del room:', params.roomId);
    
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [API] Variables de entorno faltantes');
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Obtener asignaciones del room con información de la modelo
    const { data: assignments, error } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        jornada,
        assigned_at,
        is_active,
        model_id,
        users!inner(
          id,
          name,
          email
        )
      `)
      .eq('room_id', params.roomId)
      .eq('is_active', true)
      .order('jornada', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo asignaciones:', error);
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${error.message}` },
        { status: 500 }
      );
    }

    // Formatear datos para el frontend
    const formattedAssignments = assignments?.map(assignment => ({
      id: assignment.id,
      jornada: assignment.jornada,
      assigned_at: assignment.assigned_at,
      is_active: assignment.is_active,
      model_id: assignment.model_id,
      modelo_name: assignment.users?.[0]?.name || 'Modelo no especificada',
      modelo_email: assignment.users?.[0]?.email || 'Email no disponible'
    })) || [];

    console.log('✅ [API] Asignaciones obtenidas:', formattedAssignments.length);

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

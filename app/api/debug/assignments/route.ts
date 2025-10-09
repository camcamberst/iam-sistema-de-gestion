import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');
    const assignmentId = searchParams.get('assignment_id');

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = {};

    if (assignmentId) {
      // Verificar asignación específica
      const { data: specificAssignment, error: specificError } = await supabase
        .from('modelo_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
        
      result.specificAssignment = { data: specificAssignment, error: specificError };
    }

    if (roomId) {
      // Verificar todas las asignaciones del room (activas e inactivas)
      const { data: allAssignments, error: allError } = await supabase
        .from('modelo_assignments')
        .select('*')
        .eq('room_id', roomId)
        .order('jornada', { ascending: true });
        
      result.allAssignments = { data: allAssignments, error: allError };

      // Verificar solo asignaciones activas
      const { data: activeAssignments, error: activeError } = await supabase
        .from('modelo_assignments')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .order('jornada', { ascending: true });
        
      result.activeAssignments = { data: activeAssignments, error: activeError };

      // Verificar duplicados manualmente
      const duplicateCheck = allAssignments?.reduce((acc: any, assignment: any) => {
        const key = `${assignment.model_id}-${assignment.jornada}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(assignment);
        return acc;
      }, {});
      
      const duplicates = Object.values(duplicateCheck || {}).filter((group: any) => group.length > 1);
      result.duplicates = { data: duplicates, error: null };
    }

    return NextResponse.json({
      success: true,
      debug: result
    });

  } catch (error) {
    console.error('Error en debug assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Diagnosticando asignaciones de room...');
    
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Obtener todas las asignaciones para ROOM01
    const { data: assignments, error } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at,
        is_active
      `)
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c')
      .order('jornada', { ascending: true })
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ [DEBUG] Error obteniendo asignaciones:', error);
      return NextResponse.json(
        { success: false, error: `Error: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('🔍 [DEBUG] Asignaciones encontradas:', assignments?.length || 0);

    // Agrupar por jornada para identificar duplicados
    const groupedByJornada = assignments?.reduce((acc, assignment) => {
      if (!acc[assignment.jornada]) {
        acc[assignment.jornada] = [];
      }
      acc[assignment.jornada].push(assignment);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Identificar duplicados
    const duplicates = [];
    const toKeep = [];
    
    for (const [jornada, jornadaAssignments] of Object.entries(groupedByJornada)) {
      if (jornadaAssignments.length > 1) {
        // Ordenar por fecha de asignación (más reciente primero)
        jornadaAssignments.sort((a, b) => 
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
        );
        
        // Mantener solo el más reciente
        toKeep.push(jornadaAssignments[0]);
        
        // Marcar los demás como duplicados
        duplicates.push(...jornadaAssignments.slice(1));
      } else {
        toKeep.push(jornadaAssignments[0]);
      }
    }

    return NextResponse.json({
      success: true,
      total_assignments: assignments?.length || 0,
      grouped_by_jornada: groupedByJornada,
      duplicates_found: duplicates.length,
      duplicates: duplicates,
      to_keep: toKeep,
      summary: {
        MAÑANA: groupedByJornada['MAÑANA']?.length || 0,
        TARDE: groupedByJornada['TARDE']?.length || 0,
        NOCHE: groupedByJornada['NOCHE']?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 [DEBUG] Limpiando asignaciones duplicadas...');
    
    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Obtener todas las asignaciones para ROOM01
    const { data: assignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at,
        is_active
      `)
      .eq('room_id', '17227f3e-9150-428e-a8a8-cca92ee6978c')
      .order('jornada', { ascending: true })
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Agrupar por jornada y model_id
    const groupedByJornadaAndModel = assignments?.reduce((acc, assignment) => {
      const key = `${assignment.jornada}-${assignment.model_id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(assignment);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Identificar IDs a eliminar (mantener solo el más reciente)
    const idsToDelete = [];
    
    for (const [key, groupAssignments] of Object.entries(groupedByJornadaAndModel)) {
      if (groupAssignments.length > 1) {
        // Ordenar por fecha (más reciente primero)
        groupAssignments.sort((a, b) => 
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
        );
        
        // Agregar todos excepto el primero (más reciente) a la lista de eliminación
        idsToDelete.push(...groupAssignments.slice(1).map(a => a.id));
      }
    }

    console.log('🧹 [DEBUG] IDs a eliminar:', idsToDelete);

    if (idsToDelete.length > 0) {
      // Eliminar duplicados
      const { error: deleteError } = await supabase
        .from('modelo_assignments')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        return NextResponse.json(
          { success: false, error: `Error eliminando duplicados: ${deleteError.message}` },
          { status: 500 }
        );
      }

      console.log('✅ [DEBUG] Duplicados eliminados:', idsToDelete.length);
    }

    return NextResponse.json({
      success: true,
      deleted_count: idsToDelete.length,
      deleted_ids: idsToDelete,
      message: `Se eliminaron ${idsToDelete.length} asignaciones duplicadas`
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

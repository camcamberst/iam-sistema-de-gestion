import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] Ejecutando limpieza completa de duplicados...');
    
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
    
    // 1. Obtener todas las asignaciones activas
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at,
        is_active
      `)
      .eq('is_active', true)
      .order('room_id', { ascending: true })
      .order('jornada', { ascending: true })
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      console.error('❌ [CLEANUP] Error obteniendo asignaciones:', fetchError);
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${fetchError.message}` },
        { status: 500 }
      );
    }

    console.log('🔍 [CLEANUP] Total de asignaciones activas:', allAssignments?.length || 0);

    // 2. Agrupar por room_id + jornada + model_id
    const groupedAssignments = allAssignments?.reduce((acc, assignment) => {
      const key = `${assignment.room_id}-${assignment.jornada}-${assignment.model_id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(assignment);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // 3. Identificar duplicados y preparar eliminación
    const idsToDelete = [];
    const cleanupDetails = [];

    for (const [key, assignments] of Object.entries(groupedAssignments)) {
      if (assignments.length > 1) {
        // Ordenar por fecha (más reciente primero)
        assignments.sort((a, b) => 
          new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
        );
        
        // Mantener solo el primero (más reciente), eliminar el resto
        const toKeep = assignments[0];
        const toDelete = assignments.slice(1);
        
        idsToDelete.push(...toDelete.map(a => a.id));
        
        cleanupDetails.push({
          key,
          kept: {
            id: toKeep.id,
            assigned_at: toKeep.assigned_at
          },
          deleted: toDelete.map(a => ({
            id: a.id,
            assigned_at: a.assigned_at
          }))
        });
      }
    }

    console.log('🧹 [CLEANUP] IDs a eliminar:', idsToDelete.length);
    console.log('🧹 [CLEANUP] Detalles de limpieza:', cleanupDetails);

    // 4. Ejecutar eliminación
    let deleteResult = null;
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('modelo_assignments')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('❌ [CLEANUP] Error eliminando duplicados:', deleteError);
        return NextResponse.json(
          { success: false, error: `Error eliminando duplicados: ${deleteError.message}` },
          { status: 500 }
        );
      }

      deleteResult = {
        deleted_count: idsToDelete.length,
        deleted_ids: idsToDelete
      };
    }

    // 5. Verificar resultado
    const { data: remainingAssignments, error: verifyError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at
      `)
      .eq('is_active', true)
      .order('room_id', { ascending: true })
      .order('jornada', { ascending: true });

    if (verifyError) {
      console.error('❌ [CLEANUP] Error verificando resultado:', verifyError);
    }

    // 6. Verificar que no quedan duplicados
    const remainingGrouped = remainingAssignments?.reduce((acc, assignment) => {
      const key = `${assignment.room_id}-${assignment.jornada}-${assignment.model_id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(assignment);
      return acc;
    }, {} as Record<string, any[]>) || {};

    const remainingDuplicates = Object.entries(remainingGrouped)
      .filter(([key, assignments]) => assignments.length > 1)
      .map(([key, assignments]) => ({
        key,
        count: assignments.length,
        assignments: assignments.map(a => ({ id: a.id, assigned_at: a.assigned_at }))
      }));

    console.log('✅ [CLEANUP] Limpieza completada');
    console.log('🔍 [CLEANUP] Asignaciones restantes:', remainingAssignments?.length || 0);
    console.log('🔍 [CLEANUP] Duplicados restantes:', remainingDuplicates.length);

    return NextResponse.json({
      success: true,
      cleanup_summary: {
        total_assignments_before: allAssignments?.length || 0,
        duplicates_found: idsToDelete.length,
        total_assignments_after: remainingAssignments?.length || 0,
        remaining_duplicates: remainingDuplicates.length
      },
      delete_result: deleteResult,
      cleanup_details: cleanupDetails,
      remaining_assignments: remainingAssignments,
      remaining_duplicates: remainingDuplicates,
      message: `Limpieza completada: ${idsToDelete.length} duplicados eliminados, ${remainingAssignments?.length || 0} asignaciones restantes`
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno en limpieza' },
      { status: 500 }
    );
  }
}

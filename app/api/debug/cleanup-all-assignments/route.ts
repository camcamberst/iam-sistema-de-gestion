import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 [DEBUG] Limpiando TODAS las inconsistencias...');
    
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
    
    // Obtener TODAS las asignaciones activas
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select(`
        id,
        model_id,
        room_id,
        group_id,
        jornada,
        assigned_at,
        is_active
      `)
      .eq('is_active', true)
      .order('room_id', { ascending: true })
      .order('jornada', { ascending: true })
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${fetchError.message}` },
        { status: 500 }
      );
    }

    console.log('🔍 [DEBUG] Total de asignaciones a analizar:', allAssignments?.length || 0);

    const cleanupResults = {
      total_processed: allAssignments?.length || 0,
      duplicates_removed: 0,
      invalid_assignments_removed: 0,
      rooms_cleaned: new Set(),
      details: []
    };

    // Agrupar por room_id
    const groupedByRoom = allAssignments?.reduce((acc, assignment) => {
      if (!acc[assignment.room_id]) {
        acc[assignment.room_id] = [];
      }
      acc[assignment.room_id].push(assignment);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Limpiar cada room
    for (const [roomId, roomAssignments] of Object.entries(groupedByRoom)) {
      console.log(`🧹 [DEBUG] Limpiando room ${roomId}: ${roomAssignments.length} asignaciones`);
      
      // Agrupar por jornada + modelo (combinación única)
      const groupedByJornadaModel = roomAssignments.reduce((acc, assignment) => {
        const key = `${assignment.jornada}-${assignment.model_id}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(assignment);
        return acc;
      }, {} as Record<string, any[]>);

      const idsToDelete = [];

      // Para cada combinación jornada-modelo, mantener solo la más reciente
      for (const [key, modelAssignments] of Object.entries(groupedByJornadaModel)) {
        if ((modelAssignments as any[]).length > 1) {
          // Ordenar por fecha (más reciente primero)
          (modelAssignments as any[]).sort((a, b) => 
            new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
          );
          
          // Agregar todos excepto el primero (más reciente) a la lista de eliminación
          const duplicates = (modelAssignments as any[]).slice(1);
          idsToDelete.push(...duplicates.map(a => a.id));
          
          cleanupResults.duplicates_removed += duplicates.length;
          cleanupResults.rooms_cleaned.add(roomId);
          
          cleanupResults.details.push({
            room_id: roomId,
            jornada: modelAssignments[0].jornada,
            model_id: modelAssignments[0].model_id,
            duplicates_removed: duplicates.length,
            kept_assignment: modelAssignments[0].id,
            removed_assignments: duplicates.map(a => a.id)
          });
        }
      }

      // Eliminar duplicados de este room
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('modelo_assignments')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error(`❌ [DEBUG] Error eliminando duplicados del room ${roomId}:`, deleteError);
          cleanupResults.details.push({
            room_id: roomId,
            error: `Error eliminando duplicados: ${deleteError.message}`
          });
        } else {
          console.log(`✅ [DEBUG] Eliminados ${idsToDelete.length} duplicados del room ${roomId}`);
        }
      }
    }

    // Verificar y eliminar asignaciones con IDs de modelos inválidos
    const uniqueModelIds = [...new Set(allAssignments?.map(a => a.model_id) || [])];
    const invalidModelIds = [];

    for (const modelId of uniqueModelIds) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', modelId)
        .single();

      if (userError || !userData) {
        invalidModelIds.push(modelId);
      }
    }

    if (invalidModelIds.length > 0) {
      const { data: invalidAssignments, error: invalidFetchError } = await supabase
        .from('modelo_assignments')
        .select('id, model_id, room_id, jornada')
        .in('model_id', invalidModelIds)
        .eq('is_active', true);

      if (!invalidFetchError && invalidAssignments) {
        const invalidIds = invalidAssignments.map(a => a.id);
        
        const { error: deleteInvalidError } = await supabase
          .from('modelo_assignments')
          .delete()
          .in('id', invalidIds);

        if (!deleteInvalidError) {
          cleanupResults.invalid_assignments_removed = invalidIds.length;
          console.log(`✅ [DEBUG] Eliminadas ${invalidIds.length} asignaciones con modelos inválidos`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      cleanup_results: cleanupResults,
      summary: {
        total_duplicates_removed: cleanupResults.duplicates_removed,
        total_invalid_removed: cleanupResults.invalid_assignments_removed,
        rooms_affected: cleanupResults.rooms_cleaned.size,
        total_cleaned: cleanupResults.duplicates_removed + cleanupResults.invalid_assignments_removed
      },
      message: `Limpieza completada: ${cleanupResults.duplicates_removed} duplicados y ${cleanupResults.invalid_assignments_removed} inválidos eliminados`
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

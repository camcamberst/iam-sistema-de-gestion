import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Analizando TODAS las asignaciones...');
    
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
    const { data: allAssignments, error } = await supabase
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

    if (error) {
      console.error('❌ [DEBUG] Error obteniendo asignaciones:', error);
      return NextResponse.json(
        { success: false, error: `Error: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('🔍 [DEBUG] Total de asignaciones activas:', allAssignments?.length || 0);

    // Analizar inconsistencias
    const analysis = {
      total_assignments: allAssignments?.length || 0,
      rooms_with_assignments: new Set(),
      duplicates_by_room_jornada: {},
      duplicates_by_room_jornada_model: {},
      invalid_model_ids: [],
      summary: {}
    };

    // Agrupar por room_id
    const groupedByRoom = allAssignments?.reduce((acc, assignment) => {
      if (!acc[assignment.room_id]) {
        acc[assignment.room_id] = [];
      }
      acc[assignment.room_id].push(assignment);
      analysis.rooms_with_assignments.add(assignment.room_id);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Analizar cada room
    for (const [roomId, roomAssignments] of Object.entries(groupedByRoom)) {
      console.log(`🔍 [DEBUG] Analizando room ${roomId}: ${roomAssignments.length} asignaciones`);
      
      // Agrupar por jornada
      const groupedByJornada = roomAssignments.reduce((acc, assignment) => {
        if (!acc[assignment.jornada]) {
          acc[assignment.jornada] = [];
        }
        acc[assignment.jornada].push(assignment);
        return acc;
      }, {} as Record<string, any[]>);

      // Verificar duplicados por jornada (múltiples modelos en la misma jornada)
      for (const [jornada, jornadaAssignments] of Object.entries(groupedByJornada)) {
        if (jornadaAssignments.length > 1) {
          const key = `${roomId}-${jornada}`;
          analysis.duplicates_by_room_jornada[key] = {
            room_id: roomId,
            jornada,
            count: jornadaAssignments.length,
            assignments: jornadaAssignments
          };
        }
      }

      // Verificar duplicados por jornada + modelo (misma modelo asignada múltiples veces)
      const groupedByJornadaModel = roomAssignments.reduce((acc, assignment) => {
        const key = `${assignment.jornada}-${assignment.model_id}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(assignment);
        return acc;
      }, {} as Record<string, any[]>);

      for (const [key, modelAssignments] of Object.entries(groupedByJornadaModel)) {
        if (modelAssignments.length > 1) {
          analysis.duplicates_by_room_jornada_model[key] = {
            room_id: roomId,
            key,
            count: modelAssignments.length,
            assignments: modelAssignments
          };
        }
      }

      // Resumen por room
      analysis.summary[roomId] = {
        total_assignments: roomAssignments.length,
        jornadas: Object.keys(groupedByJornada),
        duplicates_by_jornada: Object.keys(groupedByJornada).filter(j => 
          groupedByJornada[j].length > 1
        ),
        duplicates_by_model: Object.keys(groupedByJornadaModel).filter(k => 
          groupedByJornadaModel[k].length > 1
        )
      };
    }

    // Verificar IDs de modelos inválidos
    const uniqueModelIds = [...new Set(allAssignments?.map(a => a.model_id) || [])];
    for (const modelId of uniqueModelIds) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', modelId)
        .single();

      if (userError || !userData) {
        analysis.invalid_model_ids.push({
          model_id: modelId,
          error: userError?.message || 'Usuario no encontrado'
        });
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      grouped_by_room: groupedByRoom,
      recommendations: {
        total_duplicates_found: Object.keys(analysis.duplicates_by_room_jornada).length + 
                               Object.keys(analysis.duplicates_by_room_jornada_model).length,
        rooms_with_issues: Object.keys(analysis.summary).filter(roomId => 
          analysis.summary[roomId].duplicates_by_jornada.length > 0 || 
          analysis.summary[roomId].duplicates_by_model.length > 0
        ),
        invalid_model_count: analysis.invalid_model_ids.length
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

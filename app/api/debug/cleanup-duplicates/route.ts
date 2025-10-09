import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [CLEANUP] Iniciando limpieza de asignaciones duplicadas...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obtener todas las asignaciones activas
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id, room_id, jornada, is_active, assigned_at')
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (fetchError) {
      console.error('❌ [CLEANUP] Error obteniendo asignaciones:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    console.log('🔍 [CLEANUP] Asignaciones activas encontradas:', allAssignments);

    // 2. Identificar duplicados (mismo model_id + room_id + jornada)
    const duplicates = [];
    const seen = new Set();

    for (const assignment of allAssignments || []) {
      const key = `${assignment.model_id}-${assignment.room_id}-${assignment.jornada}`;
      
      if (seen.has(key)) {
        // Es un duplicado, mantener solo el más reciente
        duplicates.push(assignment);
        console.log(`🔄 [CLEANUP] Duplicado encontrado: ${assignment.jornada} - ${assignment.id}`);
      } else {
        seen.add(key);
      }
    }

    console.log(`📊 [CLEANUP] Duplicados encontrados: ${duplicates.length}`);

    // 3. Eliminar duplicados (mantener solo el más reciente)
    if (duplicates.length > 0) {
      const duplicateIds = duplicates.map(d => d.id);
      
      const { data: deleteResult, error: deleteError } = await supabase
        .from('modelo_assignments')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) {
        console.error('❌ [CLEANUP] Error eliminando duplicados:', deleteError);
        return NextResponse.json(
          { success: false, error: 'Error eliminando duplicados' },
          { status: 500 }
        );
      }

      console.log('✅ [CLEANUP] Duplicados eliminados:', duplicateIds);
    }

    // 4. Verificar estado final
    const { data: finalAssignments, error: finalError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id, room_id, jornada, is_active, assigned_at')
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (finalError) {
      console.error('❌ [CLEANUP] Error verificando estado final:', finalError);
      return NextResponse.json(
        { success: false, error: 'Error verificando estado final' },
        { status: 500 }
      );
    }

    console.log('🔍 [CLEANUP] Estado final:', finalAssignments);

    return NextResponse.json({
      success: true,
      message: 'Limpieza de duplicados completada',
      duplicates_found: duplicates.length,
      duplicates_removed: duplicateIds?.length || 0,
      final_state: finalAssignments
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

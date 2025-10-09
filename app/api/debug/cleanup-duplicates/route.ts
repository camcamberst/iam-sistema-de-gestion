import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('room_id');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'room_id es requerido' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración de base de datos faltante' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 [CLEANUP] Iniciando limpieza de duplicados para room:', roomId);

    // Obtener todas las asignaciones del room
    const { data: allAssignments, error: fetchError } = await supabase
      .from('modelo_assignments')
      .select('*')
      .eq('room_id', roomId)
      .order('assigned_at', { ascending: false }); // Más reciente primero

    if (fetchError) {
      console.error('❌ [CLEANUP] Error obteniendo asignaciones:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo asignaciones' },
        { status: 500 }
      );
    }

    // Agrupar por modelo_id y jornada
    const grouped = allAssignments?.reduce((acc: any, assignment: any) => {
      const key = `${assignment.model_id}-${assignment.jornada}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(assignment);
      return acc;
    }, {});

    const cleanupResults = [];
    let totalDeactivated = 0;

    // Para cada grupo, mantener solo la más reciente activa
    for (const [key, assignments] of Object.entries(grouped || {})) {
      const group = assignments as any[];
      const activeAssignments = group.filter(a => a.is_active);
      
      if (activeAssignments.length > 1) {
        console.log(`🔍 [CLEANUP] Grupo ${key} tiene ${activeAssignments.length} asignaciones activas`);
        
        // Ordenar por assigned_at (más reciente primero)
        activeAssignments.sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
        
        // Mantener la más reciente, desactivar las demás
        const toKeep = activeAssignments[0];
        const toDeactivate = activeAssignments.slice(1);
        
        console.log(`✅ [CLEANUP] Manteniendo: ${toKeep.id} (${toKeep.assigned_at})`);
        
        for (const assignment of toDeactivate) {
          console.log(`🗑️ [CLEANUP] Desactivando: ${assignment.id} (${assignment.assigned_at})`);
          
          const { error: deactivateError } = await supabase
            .from('modelo_assignments')
            .update({ is_active: false })
            .eq('id', assignment.id);
            
          if (deactivateError) {
            console.error(`❌ [CLEANUP] Error desactivando ${assignment.id}:`, deactivateError);
            cleanupResults.push({
              assignment_id: assignment.id,
              action: 'deactivate',
              success: false,
              error: deactivateError.message
            });
          } else {
            cleanupResults.push({
              assignment_id: assignment.id,
              action: 'deactivate',
              success: true
            });
            totalDeactivated++;
          }
        }
      }
    }

    console.log(`✅ [CLEANUP] Limpieza completada. Total desactivadas: ${totalDeactivated}`);

    return NextResponse.json({
      success: true,
      message: `Limpieza completada. ${totalDeactivated} asignaciones duplicadas desactivadas.`,
      total_deactivated: totalDeactivated,
      cleanup_results: cleanupResults
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

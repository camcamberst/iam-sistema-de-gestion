import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// =====================================================
// 📋 GET - Obtener asignaciones por room
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 [ROOM-ASSIGNMENTS] Obteniendo asignaciones para room:', roomId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener asignaciones del room usando la vista detallada
    const { data: assignments, error } = await supabase
      .from('room_assignments_detailed')
      .select('*')
      .eq('room_id', roomId)
      .order('jornada', { ascending: true });

    if (error) {
      console.error('❌ [ROOM-ASSIGNMENTS] Error obteniendo asignaciones:', error);
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ [ROOM-ASSIGNMENTS] Asignaciones obtenidas:', assignments?.length || 0);

    return NextResponse.json({
      success: true,
      assignments: assignments || []
    });

  } catch (error) {
    console.error('❌ [ROOM-ASSIGNMENTS] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Gestionar asignaciones (assign/remove/move)
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, model_id, room_id, jornada, from_room_id, from_jornada } = body;

    console.log('🔄 [ROOM-ASSIGNMENTS] Acción recibida:', {
      action,
      model_id,
      room_id,
      jornada,
      from_room_id,
      from_jornada
    });

    // Validar parámetros requeridos
    if (!action || !model_id || !room_id || !jornada) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos: action, model_id, room_id, jornada' },
        { status: 400 }
      );
    }

    if (!['assign', 'remove', 'move'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Debe ser: assign, remove, move' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ejecutar acción según el tipo
    switch (action) {
      case 'assign':
        return await handleAssign(supabase, model_id, room_id, jornada);
      
      case 'remove':
        return await handleRemove(supabase, model_id, room_id, jornada);
      
      case 'move':
        if (!from_room_id || !from_jornada) {
          return NextResponse.json(
            { success: false, error: 'Para mover se requiere: from_room_id, from_jornada' },
            { status: 400 }
          );
        }
        return await handleMove(supabase, model_id, from_room_id, from_jornada, room_id, jornada);
      
      default:
        return NextResponse.json(
          { success: false, error: 'Acción no implementada' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ [ROOM-ASSIGNMENTS] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// 🔧 FUNCIONES AUXILIARES
// =====================================================

async function handleAssign(supabase: any, model_id: string, room_id: string, jornada: string) {
  console.log('➕ [ASSIGN] Asignando modelo:', { model_id, room_id, jornada });

  // Verificar si ya existe la asignación
  const { data: existing, error: checkError } = await supabase
    .from('room_assignments')
    .select('id')
    .eq('model_id', model_id)
    .eq('room_id', room_id)
    .eq('jornada', jornada)
    .single();

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('❌ [ASSIGN] Error verificando asignación existente:', checkError);
    return NextResponse.json(
      { success: false, error: 'Error verificando asignación existente' },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json(
      { success: false, error: 'La modelo ya está asignada en esta jornada y room' },
      { status: 400 }
    );
  }

  // Crear nueva asignación
  const { data: newAssignment, error: insertError } = await supabase
    .from('room_assignments')
    .insert({
      model_id,
      room_id,
      jornada,
      assigned_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ [ASSIGN] Error creando asignación:', insertError);
    
    // Manejar error de constraint único (modelo ya en otra jornada)
    if (insertError.code === '23505' && insertError.message.includes('model_id')) {
      return NextResponse.json(
        { success: false, error: 'La modelo ya está asignada en otra jornada' },
        { status: 400 }
      );
    }
    
    // Manejar error de máximo 2 modelos por room+jornada
    if (insertError.message.includes('Máximo 2 modelos')) {
      return NextResponse.json(
        { success: false, error: 'Máximo 2 modelos permitidas por room y jornada' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error creando asignación' },
      { status: 500 }
    );
  }

  console.log('✅ [ASSIGN] Asignación creada:', newAssignment.id);
  return NextResponse.json({
    success: true,
    message: 'Modelo asignada exitosamente',
    assignment: newAssignment
  });
}

async function handleRemove(supabase: any, model_id: string, room_id: string, jornada: string) {
  console.log('🗑️ [REMOVE] Eliminando asignación:', { model_id, room_id, jornada });

  // Eliminar asignación (DELETE físico)
  const { data: deletedAssignment, error: deleteError } = await supabase
    .from('room_assignments')
    .delete()
    .eq('model_id', model_id)
    .eq('room_id', room_id)
    .eq('jornada', jornada)
    .select()
    .single();

  if (deleteError) {
    console.error('❌ [REMOVE] Error eliminando asignación:', deleteError);
    
    if (deleteError.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error eliminando asignación' },
      { status: 500 }
    );
  }

  console.log('✅ [REMOVE] Asignación eliminada:', deletedAssignment.id);
  return NextResponse.json({
    success: true,
    message: 'Modelo eliminada exitosamente',
    deleted_assignment: deletedAssignment
  });
}

async function handleMove(supabase: any, model_id: string, from_room_id: string, from_jornada: string, to_room_id: string, to_jornada: string) {
  console.log('🔄 [MOVE] Moviendo modelo:', {
    model_id,
    from: { room_id: from_room_id, jornada: from_jornada },
    to: { room_id: to_room_id, jornada: to_jornada }
  });

  // Transacción: Eliminar anterior + Crear nueva
  const { data, error } = await supabase.rpc('move_room_assignment', {
    p_model_id: model_id,
    p_from_room_id: from_room_id,
    p_from_jornada: from_jornada,
    p_to_room_id: to_room_id,
    p_to_jornada: to_jornada
  });

  if (error) {
    console.error('❌ [MOVE] Error moviendo asignación:', error);
    return NextResponse.json(
      { success: false, error: 'Error moviendo asignación' },
      { status: 500 }
    );
  }

  console.log('✅ [MOVE] Asignación movida exitosamente');
  return NextResponse.json({
    success: true,
    message: 'Modelo movida exitosamente'
  });
}

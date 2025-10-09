import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model_id, room_id, jornada, action } = body;

    if (!model_id || !room_id || !jornada || !action) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    if (!['move', 'assign'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Debe ser "move" o "assign"' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'move') {
      // MOVER: Desactivar todas las asignaciones existentes del modelo
      const { error: deactivateError } = await supabase
        .from('modelo_assignments')
        .update({ is_active: false })
        .eq('model_id', model_id)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error desactivando asignaciones existentes:', deactivateError);
        return NextResponse.json(
          { success: false, error: 'Error desactivando asignaciones existentes' },
          { status: 500 }
        );
      }

      console.log(`✅ [API] Asignaciones existentes desactivadas para modelo ${model_id}`);
    }

    // Verificar si ya existe una asignación activa en el mismo room/jornada
    // PERO solo si es de un modelo DIFERENTE (para permitir "doblar" del mismo modelo)
    const { data: existingAssignment, error: checkError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id')
      .eq('room_id', room_id)
      .eq('jornada', jornada)
      .eq('is_active', true)
      .neq('model_id', model_id); // Excluir el modelo actual

    if (checkError) {
      console.error('Error verificando asignaciones existentes:', checkError);
      return NextResponse.json(
        { success: false, error: 'Error verificando asignaciones existentes' },
        { status: 500 }
      );
    }

    // Solo rechazar si hay OTRA modelo (diferente) asignada en el mismo room/jornada
    if (existingAssignment && existingAssignment.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Ya hay otra modelo asignada en este room y jornada' },
        { status: 400 }
      );
    }

    // Verificar si el mismo modelo ya está asignado en la misma jornada (evitar duplicados exactos)
    const { data: sameModelAssignment, error: sameModelError } = await supabase
      .from('modelo_assignments')
      .select('id, model_id')
      .eq('room_id', room_id)
      .eq('jornada', jornada)
      .eq('model_id', model_id)
      .eq('is_active', true);

    if (sameModelError) {
      console.error('Error verificando asignación del mismo modelo:', sameModelError);
      return NextResponse.json(
        { success: false, error: 'Error verificando asignación del mismo modelo' },
        { status: 500 }
      );
    }

    // Si el mismo modelo ya está asignado en la misma jornada, rechazar
    if (sameModelAssignment && sameModelAssignment.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Esta modelo ya está asignada en esta jornada' },
        { status: 400 }
      );
    }

    // Crear nueva asignación
    const { data: newAssignment, error: insertError } = await supabase
      .from('modelo_assignments')
      .insert({
        model_id,
        room_id,
        jornada,
        is_active: true,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creando nueva asignación:', insertError);
      return NextResponse.json(
        { success: false, error: 'Error creando nueva asignación' },
        { status: 500 }
      );
    }

    console.log(`✅ [API] Nueva asignación creada:`, {
      model_id,
      room_id,
      jornada,
      action,
      assignment_id: newAssignment.id
    });

    return NextResponse.json({
      success: true,
      message: `Modelo ${action === 'move' ? 'movida' : 'asignada'} exitosamente`,
      assignment: newAssignment
    });

  } catch (error) {
    console.error('Error en POST /api/assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

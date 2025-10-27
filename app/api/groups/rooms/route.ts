import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🏠 [API] Obteniendo rooms...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rooms, error } = await supabase
      .from('group_rooms')
      .select(`
        id,
        room_name,
        group_id,
        is_active,
        groups!inner(
          id,
          name
        )
      `)
      .order('room_name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo rooms:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo rooms' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Rooms obtenidos:', rooms?.length || 0);

    return NextResponse.json({
      success: true,
      rooms: rooms || []
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🏠 [API] Creando room...');
    
    const { room_name, group_id } = await request.json();
    
    if (!room_name || !room_name.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre del room es requerido' },
        { status: 400 }
      );
    }

    if (!group_id) {
      return NextResponse.json(
        { success: false, error: 'El grupo es requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que el grupo existe
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { success: false, error: 'El grupo seleccionado no existe' },
        { status: 400 }
      );
    }

    const { data: room, error } = await supabase
      .from('group_rooms')
      .insert({
        room_name: room_name.trim(),
        group_id: group_id,
        is_active: true
      })
      .select(`
        id,
        room_name,
        group_id,
        is_active,
        groups!inner(
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('❌ [API] Error creando room:', error);
      
      // Manejar error de duplicado
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Ya existe un room con ese nombre en este grupo' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Error creando room' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Room creado:', room);

    return NextResponse.json({
      success: true,
      room
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando room...');
    
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('id');
    
    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'ID del room es requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que el room existe
    const { data: room, error: roomError } = await supabase
      .from('group_rooms')
      .select('id, room_name, group_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { success: false, error: 'El room no existe' },
        { status: 404 }
      );
    }

    // Verificar si hay asignaciones activas en este room
    const { data: assignments, error: assignmentsError } = await supabase
      .from('room_assignments')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_active', true);

    if (assignmentsError) {
      console.error('❌ [API] Error verificando asignaciones:', assignmentsError);
      return NextResponse.json(
        { success: false, error: 'Error verificando asignaciones del room' },
        { status: 500 }
      );
    }

    if (assignments && assignments.length > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar el room "${room.room_name}" porque tiene ${assignments.length} asignación(es) activa(s). Primero elimine las asignaciones.` },
        { status: 400 }
      );
    }

    // Eliminar el room
    const { error: deleteError } = await supabase
      .from('group_rooms')
      .delete()
      .eq('id', roomId);

    if (deleteError) {
      console.error('❌ [API] Error eliminando room:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando room' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Room eliminado:', room.room_name);

    return NextResponse.json({
      success: true,
      message: `Room "${room.room_name}" eliminado correctamente`
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}
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
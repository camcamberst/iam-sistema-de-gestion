import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/sedes/disponibilidad
 * Calcula disponibilidad de rooms y jornadas.
 * Fuentes: jornada_states (state=OCUPADA) + room_assignments (usadas en Gestión Sedes).
 * Query params:
 *   - sedeId: una sede → devuelve solo esa sede
 *   - sedeIds: varias sedes separadas por coma → devuelve todas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId');
    const sedeIdsParam = searchParams.get('sedeIds');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let targetSedeIds: string[] = [];
    if (sedeId) {
      targetSedeIds = [sedeId];
    } else if (sedeIdsParam) {
      targetSedeIds = sedeIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (targetSedeIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere sedeId o sedeIds' },
        { status: 400 }
      );
    }

    // 1. Obtener rooms de las sedes (group_rooms donde group_id in targetSedeIds)
    const { data: rooms, error: roomsError } = await supabase
      .from('group_rooms')
      .select(`
        id,
        room_name,
        group_id,
        groups!inner(id, name)
      `)
      .in('group_id', targetSedeIds)
      .order('room_name', { ascending: true });

    if (roomsError) {
      console.error('❌ [DISPONIBILIDAD] Error obteniendo rooms:', roomsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo rooms' },
        { status: 500 }
      );
    }

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({
        success: true,
        rows: [],
        summary: null
      });
    }

    const roomIds = rooms.map((r: any) => r.id);

    // 2. Fuente A: jornada_states (state=OCUPADA = slot ocupado, usada al crear modelo)
    const { data: jornadaStates } = await supabase
      .from('jornada_states')
      .select('room_id, jornada, state')
      .in('group_id', targetSedeIds)
      .in('room_id', roomIds);

    // 3. Fuente B: room_assignments (usado por Gestión Sedes para asignar)
    const { data: assignments } = await supabase
      .from('room_assignments')
      .select('room_id, jornada')
      .in('room_id', roomIds);

    console.log('📊 [DISPONIBILIDAD] Rooms:', rooms?.length, 'jornada_states:', (jornadaStates || []).length, 'room_assignments:', (assignments || []).length);

    // 4. Combinar fuentes: count = max(room_assignments, jornada_states OCUPADA cuenta como 1)
    const countMap: Record<string, number> = {};
    (assignments || []).forEach((a: any) => {
      const key = `${a.room_id}|${a.jornada}`;
      countMap[key] = (countMap[key] || 0) + 1;
    });
    (jornadaStates || []).forEach((j: any) => {
      if (j.state === 'OCUPADA') {
        const key = `${j.room_id}|${j.jornada}`;
        countMap[key] = Math.max(countMap[key] || 0, 1);
      }
    });

    // 5. Construir filas: disponible si count < 2 (máx 2 por slot)
    const rows = rooms.map((room: any) => {
      const manana = (countMap[`${room.id}|MAÑANA`] || 0) < 2;
      const tarde = (countMap[`${room.id}|TARDE`] || 0) < 2;
      const noche = (countMap[`${room.id}|NOCHE`] || 0) < 2;
      return {
        sede_id: room.group_id,
        sede_nombre: (room.groups as any)?.name || 'Sede',
        room_id: room.id,
        room_name: room.room_name,
        manana,
        tarde,
        noche
      };
    });

    // 5. Resumen (solo si es una sede): solo lo relevante = disponibilidad
    let summary = null;
    if (targetSedeIds.length === 1) {
      const espaciosDisponibles = rows.reduce((acc: number, r: any) =>
        acc + (r.manana ? 1 : 0) + (r.tarde ? 1 : 0) + (r.noche ? 1 : 0), 0);
      summary = {
        sede_nombre: rows[0]?.sede_nombre || 'Sede',
        rooms_totales: rows.length,
        total_espacios: rows.length * 3,
        espacios_disponibles: espaciosDisponibles
      };
    }

    return NextResponse.json({
      success: true,
      rows,
      summary
    });

  } catch (error) {
    console.error('❌ [DISPONIBILIDAD] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

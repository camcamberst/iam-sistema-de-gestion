import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Convierte resultado RPC (1 fila por room+jornada) → formato frontend (1 fila por room con manana/tarde/noche) */
function rpcRowsToFrontend(rpcRows: Array<{ sede_id: string; sede_nombre: string; room_id: string; room_name: string; jornada: string; disponible: boolean }>) {
  const byRoom = new Map<string, { sede_id: string; sede_nombre: string; room_id: string; room_name: string; manana: boolean; tarde: boolean; noche: boolean }>();
  for (const r of rpcRows) {
    const key = r.room_id;
    const existing = byRoom.get(key) ?? {
      sede_id: r.sede_id,
      sede_nombre: r.sede_nombre,
      room_id: r.room_id,
      room_name: r.room_name,
      manana: false,
      tarde: false,
      noche: false
    };
    if (r.jornada === 'MAÑANA') existing.manana = r.disponible;
    else if (r.jornada === 'TARDE') existing.tarde = r.disponible;
    else if (r.jornada === 'NOCHE') existing.noche = r.disponible;
    byRoom.set(key, existing);
  }
  return Array.from(byRoom.values()).sort((a, b) => a.room_name.localeCompare(b.room_name));
}

/**
 * GET /api/sedes/disponibilidad
 * Usa función RPC get_disponibilidad_por_sedes (mismo SQL que el diagnóstico).
 * Query params: sedeId o sedeIds (varias separadas por coma)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId');
    const sedeIdsParam = searchParams.get('sedeIds');

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

    // 1. Intentar RPC (función ejecuta en BD, bypass RLS, misma lógica que el SQL diagnóstico)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_disponibilidad_por_sedes', {
      p_sede_ids: targetSedeIds
    });

    if (!rpcError && rpcData !== null && Array.isArray(rpcData)) {
      const rows = rpcRowsToFrontend(rpcData);
      let summary = null;
      if (targetSedeIds.length === 1) {
        const espaciosDisponibles = rows.reduce((acc: number, r) =>
          acc + (r.manana ? 1 : 0) + (r.tarde ? 1 : 0) + (r.noche ? 1 : 0), 0);
        summary = {
          sede_nombre: rows[0]?.sede_nombre || 'Sede',
          rooms_totales: rows.length,
          total_espacios: rows.length * 3,
          espacios_disponibles: espaciosDisponibles
        };
      }
      console.log('✅ [DISPONIBILIDAD] RPC OK:', rows.length, 'rooms, sedeIds:', targetSedeIds);
      return NextResponse.json({ success: true, rows, summary });
    }

    // 2. Fallback si la función RPC no existe: usar queries manuales
    if (rpcError) {
      console.warn('⚠️ [DISPONIBILIDAD] RPC falló, usando fallback:', rpcError.message);
    }

    const { data: rooms, error: roomsError } = await supabase
      .from('group_rooms')
      .select('id, room_name, group_id, groups!inner(id, name)')
      .in('group_id', targetSedeIds)
      .order('room_name', { ascending: true });

    if (roomsError) {
      console.error('❌ [DISPONIBILIDAD] Error fallback rooms:', roomsError);
      return NextResponse.json({ success: false, error: roomsError.message }, { status: 500 });
    }

    if (!rooms || rooms.length === 0) {
      return NextResponse.json({ success: true, rows: [], summary: null });
    }

    const roomIdSet = new Set(rooms.map((r: any) => r.id));
    const { data: assignments, error: assignError } = await supabase
      .from('room_assignments')
      .select('room_id, jornada');

    if (assignError) {
      return NextResponse.json({ success: false, error: assignError.message }, { status: 500 });
    }

    const relevantAssignments = (assignments || []).filter((a: any) => roomIdSet.has(a.room_id));
    const countMap: Record<string, number> = {};
    relevantAssignments.forEach((a: any) => {
      const key = `${a.room_id}|${a.jornada}`;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    const rows = rooms.map((room: any) => ({
      sede_id: room.group_id,
      sede_nombre: (room.groups as any)?.name || 'Sede',
      room_id: room.id,
      room_name: room.room_name,
      manana: (countMap[`${room.id}|MAÑANA`] || 0) < 2,
      tarde: (countMap[`${room.id}|TARDE`] || 0) < 2,
      noche: (countMap[`${room.id}|NOCHE`] || 0) < 2
    }));

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

    return NextResponse.json({ success: true, rows, summary });

  } catch (error) {
    console.error('❌ [DISPONIBILIDAD] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

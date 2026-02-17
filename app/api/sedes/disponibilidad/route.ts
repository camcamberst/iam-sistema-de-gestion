import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

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

    if (rpcError) {
      console.error('❌ [DISPONIBILIDAD] RPC error:', rpcError.message, 'sedeIds:', targetSedeIds);
      return NextResponse.json(
        {
          success: false,
          error: 'Ejecuta db/disponibilidad/func_get_disponibilidad.sql en Supabase SQL Editor.',
          debug: process.env.NODE_ENV === 'development' ? rpcError.message : undefined
        },
        { status: 500 }
      );
    }

    const rows = rpcRowsToFrontend(Array.isArray(rpcData) ? rpcData : []);
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
    console.log('✅ [DISPONIBILIDAD] RPC OK:', rows.length, 'rooms');
    return NextResponse.json({ success: true, rows, summary });

  } catch (error) {
    console.error('❌ [DISPONIBILIDAD] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Test directo del RPC sin usar request.url
 */
export async function GET() {
  try {
    const sedeId = '11d3e936-8cf6-460a-8826-612092ffd7e5'; // Sede MP

    console.log('🧪 [TEST-RPC-SIMPLE] Probando RPC...');
    console.log('🧪 [TEST-RPC-SIMPLE] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🧪 [TEST-RPC-SIMPLE] SERVICE_ROLE_KEY existe:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Primero probar una consulta simple
    const { data: testGroups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name')
      .limit(1);

    if (groupsError) {
      return NextResponse.json({
        success: false,
        step: 'GROUPS_TEST',
        error: groupsError.message,
        details: groupsError
      });
    }

    // Luego probar el RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_disponibilidad_por_sedes', {
      p_sede_ids: [sedeId]
    });

    if (rpcError) {
      console.error('❌ [TEST-RPC-SIMPLE] Error:', rpcError);
      return NextResponse.json({
        success: false,
        step: 'RPC_CALL',
        error: rpcError.message,
        details: rpcError,
        sedeId,
        groupsWork: !!testGroups
      });
    }

    const sedeMP_slots = Array.isArray(rpcData) ? rpcData.filter((r: any) => r.sede_nombre === 'Sede MP') : [];

    return NextResponse.json({
      success: true,
      step: 'RPC_CALL',
      sedeId,
      groupsWork: !!testGroups,
      totalRows: Array.isArray(rpcData) ? rpcData.length : 0,
      sedeMP_slots: sedeMP_slots.length,
      sample_sedeMP: sedeMP_slots.slice(0, 10),
      // ¿Hay asignaciones > 0?
      hasOcupados: sedeMP_slots.some((s: any) => s.asignaciones > 0),
      ocupadosCount: sedeMP_slots.filter((s: any) => s.asignaciones >= 2).length
    });

  } catch (error) {
    console.error('❌ [TEST-RPC-SIMPLE] Error general:', error);
    return NextResponse.json({
      success: false,
      step: 'GENERAL_ERROR',
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
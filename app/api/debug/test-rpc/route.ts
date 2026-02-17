import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Endpoint de prueba para verificar que el RPC funcione desde Vercel
 * GET /api/debug/test-rpc?sedeId=11d3e936-8cf6-460a-8826-612092ffd7e5
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId') || '11d3e936-8cf6-460a-8826-612092ffd7e5'; // Sede MP por defecto

    console.log('🧪 [TEST-RPC] Probando RPC con sedeId:', sedeId);
    console.log('🧪 [TEST-RPC] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🧪 [TEST-RPC] SERVICE_ROLE_KEY definida:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Llamada RPC directa
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_disponibilidad_por_sedes', {
      p_sede_ids: [sedeId]
    });

    if (rpcError) {
      console.error('❌ [TEST-RPC] Error:', rpcError);
      return NextResponse.json({
        success: false,
        test: 'RPC_CALL',
        error: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code,
        sedeId
      });
    }

    console.log('✅ [TEST-RPC] RPC OK, filas:', Array.isArray(rpcData) ? rpcData.length : 'no es array');
    console.log('🧪 [TEST-RPC] Primeras 3 filas:', Array.isArray(rpcData) ? rpcData.slice(0, 3) : rpcData);

    return NextResponse.json({
      success: true,
      test: 'RPC_CALL',
      sedeId,
      resultType: typeof rpcData,
      isArray: Array.isArray(rpcData),
      rowCount: Array.isArray(rpcData) ? rpcData.length : null,
      sample: Array.isArray(rpcData) ? rpcData.slice(0, 5) : rpcData
    });

  } catch (error) {
    console.error('❌ [TEST-RPC] Error general:', error);
    return NextResponse.json({
      success: false,
      test: 'RPC_CALL',
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
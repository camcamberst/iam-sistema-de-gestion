import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST] Probando conexión a Supabase...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('🧪 [TEST] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🧪 [TEST] Key presente:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Probar conexión básica
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ [TEST] Error en conexión básica:', testError);
      return NextResponse.json(
        { success: false, error: 'Error de conexión: ' + testError.message },
        { status: 500 }
      );
    }

    console.log('✅ [TEST] Conexión básica exitosa');

    // Probar tabla groups
    const { data: groupsData, error: groupsError } = await supabase
      .from('groups')
      .select('*')
      .limit(5);

    if (groupsError) {
      console.error('❌ [TEST] Error en tabla groups:', groupsError);
      return NextResponse.json(
        { success: false, error: 'Error en tabla groups: ' + groupsError.message },
        { status: 500 }
      );
    }

    console.log('✅ [TEST] Tabla groups accesible. Datos:', groupsData);

    return NextResponse.json({
      success: true,
      message: 'Conexión exitosa',
      groupsCount: groupsData?.length || 0,
      groups: groupsData
    });

  } catch (error) {
    console.error('❌ [TEST] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Verificar estructura de calculator_history
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [CHECK-STRUCTURE] Verificando estructura de calculator_history...');

    // Obtener estructura de la tabla
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'calculator_history'
        ORDER BY ordinal_position;
      `
    });

    if (columnsError) {
      console.error('❌ Error obteniendo estructura:', columnsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener estructura de la tabla' 
      }, { status: 500 });
    }

    // Obtener una muestra de datos
    const { data: sampleData, error: sampleError } = await supabase
      .from('calculator_history')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.error('❌ Error obteniendo muestra:', sampleError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener muestra de datos' 
      }, { status: 500 });
    }

    // Contar registros totales
    const { count: totalRecords, error: countError } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error contando registros:', countError);
    }

    console.log('✅ [CHECK-STRUCTURE] Verificación completada');

    return NextResponse.json({
      success: true,
      message: 'Estructura de calculator_history verificada',
      structure: {
        columns: columns || [],
        totalRecords: totalRecords || 0,
        sampleData: sampleData || []
      }
    });

  } catch (error: any) {
    console.error('❌ [CHECK-STRUCTURE] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

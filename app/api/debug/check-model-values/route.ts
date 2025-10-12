import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Verificar datos en model_values
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    console.log('🔍 [DEBUG] Verificando datos en model_values para modelId:', modelId);

    // 1. Contar total de registros
    const { count: totalCount, error: countError } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error contando registros:', countError);
    }

    // 2. Obtener registros recientes (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentData, error: recentError } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', sevenDaysAgoStr)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (recentError) {
      console.error('❌ Error obteniendo datos recientes:', recentError);
    }

    // 3. Si se proporciona modelId, obtener datos específicos
    let modelSpecificData = null;
    if (modelId) {
      const { data: modelData, error: modelError } = await supabase
        .from('model_values')
        .select('*')
        .eq('model_id', modelId)
        .gte('period_date', sevenDaysAgoStr)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (modelError) {
        console.error('❌ Error obteniendo datos del modelo:', modelError);
      } else {
        modelSpecificData = modelData;
      }
    }

    // 4. Obtener estructura de la tabla
    const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'model_values'
        ORDER BY ordinal_position;
      `
    });

    console.log('✅ [DEBUG] Verificación completada');

    return NextResponse.json({
      success: true,
      message: 'Verificación de model_values completada',
      data: {
        totalRecords: totalCount || 0,
        recentRecords: recentData?.length || 0,
        modelSpecificRecords: modelSpecificData?.length || 0,
        recentData: recentData || [],
        modelSpecificData: modelSpecificData || [],
        tableStructure: columns || [],
        queryDate: sevenDaysAgoStr
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

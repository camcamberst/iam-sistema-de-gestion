import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Consolidar datos con fechas inconsistentes debido al sistema híbrido de timezone
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [CONSOLIDATE-DATES] Iniciando consolidación de fechas...');

    // 1. Obtener todos los valores agrupados por modelo y plataforma
    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .order('updated_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [CONSOLIDATE-DATES] Error loading values:', valuesError);
      return NextResponse.json({ success: false, error: valuesError.message }, { status: 500 });
    }

    console.log('🔍 [CONSOLIDATE-DATES] Total values found:', allValues?.length || 0);

    // 2. Agrupar por modelo y plataforma, manteniendo solo el más reciente
    const consolidatedMap = new Map<string, any>();
    
    allValues?.forEach((value: any) => {
      const key = `${value.model_id}-${value.platform_id}`;
      
      if (!consolidatedMap.has(key)) {
        // Usar fecha actual para consolidar
        const todayDate = new Date().toISOString().split('T')[0];
        consolidatedMap.set(key, {
          ...value,
          period_date: todayDate, // Normalizar a fecha actual
          consolidated: true
        });
      }
    });

    const consolidatedValues = Array.from(consolidatedMap.values());
    console.log('🔍 [CONSOLIDATE-DATES] Consolidated values:', consolidatedValues.length);

    // 3. Eliminar valores antiguos y insertar consolidados
    const { error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos

    if (deleteError) {
      console.error('❌ [CONSOLIDATE-DATES] Error deleting old values:', deleteError);
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    // 4. Insertar valores consolidados
    const rowsToInsert = consolidatedValues.map(value => ({
      model_id: value.model_id,
      platform_id: value.platform_id,
      value: value.value,
      period_date: value.period_date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('model_values')
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error('❌ [CONSOLIDATE-DATES] Error inserting consolidated values:', insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    console.log('✅ [CONSOLIDATE-DATES] Consolidation completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Fechas consolidadas exitosamente',
      summary: {
        originalValues: allValues?.length || 0,
        consolidatedValues: consolidatedValues.length,
        insertedValues: insertedData?.length || 0,
        newDate: new Date().toISOString().split('T')[0]
      }
    });

  } catch (error: any) {
    console.error('❌ [CONSOLIDATE-DATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Procesar datos históricos para generar estadísticas quincenales
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [PROCESS-HISTORICAL-QUINCENAL] Iniciando procesamiento de datos históricos...');

    // Obtener todas las modelos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo');

    if (modelsError) {
      console.error('❌ [PROCESS-HISTORICAL-QUINCENAL] Error obteniendo modelos:', modelsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener modelos' 
      }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos para procesar',
        processed: 0
      });
    }

    let processedCount = 0;
    const results = [];

    // Procesar cada modelo
    for (const model of models) {
      console.log(`👤 Procesando datos históricos para: ${model.email}`);
      
      try {
        // Obtener datos históricos de calculator_history para esta modelo
        const { data: historicalData, error: historyError } = await supabase
          .from('calculator_history')
          .select(`
            platform_id,
            period_date,
            usd_modelo,
            usd_bruto,
            value
          `)
          .eq('model_id', model.id)
          .order('period_date', { ascending: true });

        if (historyError) {
          console.error(`❌ Error obteniendo historial para ${model.email}:`, historyError);
          results.push({
            model: model.email,
            success: false,
            error: historyError.message
          });
          continue;
        }

        if (!historicalData || historicalData.length === 0) {
          console.log(`⚠️ No hay datos históricos para ${model.email}`);
          results.push({
            model: model.email,
            success: true,
            message: 'No hay datos históricos',
            quincenas: 0
          });
          continue;
        }

        // Agrupar datos por plataforma y quincena
        const platformQuincenas = new Map<string, Map<string, {
          totalUsd: number;
          days: Set<string>;
          periodStart: Date;
          periodEnd: Date;
        }>>();

        historicalData.forEach(record => {
          const date = new Date(record.period_date);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = date.getDate();
          const quincena = day >= 1 && day <= 15 ? '1' : '2';
          const quincenaKey = `${year}-${month}-${quincena}`;
          const platformId = record.platform_id;

          if (!platformQuincenas.has(platformId)) {
            platformQuincenas.set(platformId, new Map());
          }

          const platformMap = platformQuincenas.get(platformId)!;
          if (!platformMap.has(quincenaKey)) {
            platformMap.set(quincenaKey, {
              totalUsd: 0,
              days: new Set(),
              periodStart: date,
              periodEnd: date
            });
          }

          const quincenaData = platformMap.get(quincenaKey)!;
          // Usar usd_modelo si existe, sino usd_bruto, sino value
          const usdValue = record.usd_modelo || record.usd_bruto || record.value || 0;
          quincenaData.totalUsd += usdValue;
          quincenaData.days.add(record.period_date);
          quincenaData.periodStart = quincenaData.periodStart < date ? quincenaData.periodStart : date;
          quincenaData.periodEnd = quincenaData.periodEnd > date ? quincenaData.periodEnd : date;
        });

        // Procesar cada plataforma y quincena
        let modelQuincenas = 0;
        for (const [platformId, quincenas] of Array.from(platformQuincenas.entries())) {
          for (const [quincenaKey, data] of Array.from(quincenas.entries())) {
            try {
              const dailyAvg = data.days.size > 0 ? data.totalUsd / data.days.size : 0;
              
              // Insertar estadística quincenal
              const { error: insertError } = await supabase
                .from('platform_quincenal_stats')
                .upsert({
                  model_id: model.id,
                  platform_id: platformId,
                  quincena: quincenaKey,
                  daily_avg_usd: Math.round(dailyAvg * 100) / 100,
                  total_days: data.days.size,
                  total_usd_modelo: Math.round(data.totalUsd * 100) / 100,
                  period_start: data.periodStart.toISOString().split('T')[0],
                  period_end: data.periodEnd.toISOString().split('T')[0]
                }, {
                  onConflict: 'model_id,platform_id,quincena'
                });

              if (insertError) {
                console.error(`❌ Error insertando estadística para ${model.email} - ${platformId} - ${quincenaKey}:`, insertError);
              } else {
                modelQuincenas++;
                console.log(`✅ Procesado ${model.email} - ${platformId} - ${quincenaKey}: $${dailyAvg.toFixed(2)} (${data.days.size} días)`);
              }
            } catch (error) {
              console.error(`❌ Error procesando quincena ${quincenaKey} para ${model.email}:`, error);
            }
          }
        }

        results.push({
          model: model.email,
          success: true,
          quincenas: modelQuincenas,
          platforms: platformQuincenas.size
        });

        processedCount++;

      } catch (error) {
        console.error(`❌ Error procesando ${model.email}:`, error);
        results.push({
          model: model.email,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`✅ [PROCESS-HISTORICAL-QUINCENAL] Proceso completado. ${processedCount} modelos procesados`);

    return NextResponse.json({
      success: true,
      message: `Datos históricos procesados: ${processedCount} modelos`,
      processed: processedCount,
      totalModels: models.length,
      results
    });

  } catch (error: any) {
    console.error('❌ [PROCESS-HISTORICAL-QUINCENAL] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// GET: Verificar datos históricos disponibles
export async function GET(request: NextRequest) {
  try {
    // Obtener resumen de datos históricos por modelo
    const { data: historicalSummary, error } = await supabase
      .from('calculator_history')
      .select(`
        model_id,
        period_date,
        platform_id,
        usd_modelo,
        users!inner(email, name)
      `)
      .order('period_date', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener datos históricos' 
      }, { status: 500 });
    }

    // Agrupar por modelo
    const modelSummary = historicalSummary?.reduce((acc: any, record: any) => {
      const modelEmail = record.users?.email || 'Unknown';
      if (!acc[modelEmail]) {
        acc[modelEmail] = {
          email: modelEmail,
          name: record.users?.name || 'Unknown',
          totalRecords: 0,
          platforms: new Set(),
          dateRange: { earliest: null, latest: null }
        };
      }
      
      acc[modelEmail].totalRecords++;
      acc[modelEmail].platforms.add(record.platform_id);
      
      const recordDate = new Date(record.period_date);
      if (!acc[modelEmail].dateRange.earliest || recordDate < acc[modelEmail].dateRange.earliest) {
        acc[modelEmail].dateRange.earliest = recordDate;
      }
      if (!acc[modelEmail].dateRange.latest || recordDate > acc[modelEmail].dateRange.latest) {
        acc[modelEmail].dateRange.latest = recordDate;
      }
      
      return acc;
    }, {}) || {};

    // Convertir Set a Array y formatear fechas
    Object.values(modelSummary).forEach((model: any) => {
      model.platforms = Array.from(model.platforms);
      model.dateRange.earliest = model.dateRange.earliest?.toISOString().split('T')[0];
      model.dateRange.latest = model.dateRange.latest?.toISOString().split('T')[0];
    });

    return NextResponse.json({
      success: true,
      totalRecords: historicalSummary?.length || 0,
      models: Object.values(modelSummary),
      message: 'Datos históricos disponibles para procesamiento'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Actualizar estadísticas quincenales para todas las modelos y plataformas
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [UPDATE-QUINCENAL-STATS] Iniciando actualización de estadísticas quincenales...');

    // Obtener todas las modelos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo');

    if (modelsError) {
      console.error('❌ [UPDATE-QUINCENAL-STATS] Error obteniendo modelos:', modelsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener modelos' 
      }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos para actualizar',
        updated: 0
      });
    }

    // Obtener todas las plataformas activas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, name')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [UPDATE-QUINCENAL-STATS] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener plataformas' 
      }, { status: 500 });
    }

    // Calcular quincena actual
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentDay = currentDate.getDate();
    const currentQuincena = currentDay >= 1 && currentDay <= 15 ? '1' : '2';
    const quincenaKey = `${currentYear}-${currentMonth}-${currentQuincena}`;

    console.log(`📅 Procesando quincena: ${quincenaKey}`);

    let updatedCount = 0;
    const results = [];

    // Procesar cada modelo
    for (const model of models) {
      console.log(`👤 Procesando modelo: ${model.email}`);
      
      // Procesar cada plataforma para esta modelo
      for (const platform of platforms) {
        try {
          // Verificar si la modelo tiene esta plataforma en su portafolio
          const { data: portfolioData, error: portfolioError } = await supabase
            .from('modelo_plataformas')
            .select('id, status')
            .eq('model_id', model.id)
            .eq('platform_id', platform.id)
            .eq('status', 'confirmada')
            .single();

          if (portfolioError || !portfolioData) {
            // La modelo no tiene esta plataforma activa, saltar
            continue;
          }

          // Actualizar estadísticas quincenales para esta modelo-plataforma
          const { error: updateError } = await supabase.rpc('update_quincenal_stats', {
            p_model_id: model.id,
            p_platform_id: platform.id,
            p_quincena: quincenaKey
          });

          if (updateError) {
            console.error(`❌ [UPDATE-QUINCENAL-STATS] Error actualizando ${model.email} - ${platform.name}:`, updateError);
            results.push({
              model: model.email,
              platform: platform.name,
              success: false,
              error: updateError.message
            });
          } else {
            console.log(`✅ [UPDATE-QUINCENAL-STATS] Actualizado ${model.email} - ${platform.name}`);
            results.push({
              model: model.email,
              platform: platform.name,
              success: true,
              quincena: quincenaKey
            });
            updatedCount++;
          }

        } catch (error) {
          console.error(`❌ [UPDATE-QUINCENAL-STATS] Error procesando ${model.email} - ${platform.name}:`, error);
          results.push({
            model: model.email,
            platform: platform.name,
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
    }

    console.log(`✅ [UPDATE-QUINCENAL-STATS] Proceso completado. ${updatedCount} estadísticas actualizadas`);

    return NextResponse.json({
      success: true,
      message: `Estadísticas quincenales actualizadas: ${updatedCount} registros`,
      quincena: quincenaKey,
      updated: updatedCount,
      totalModels: models.length,
      totalPlatforms: platforms?.length || 0,
      results
    });

  } catch (error: any) {
    console.error('❌ [UPDATE-QUINCENAL-STATS] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// GET: Verificar estado de las estadísticas quincenales
export async function GET(request: NextRequest) {
  try {
    const { data: stats, error } = await supabase
      .from('platform_quincenal_stats')
      .select(`
        model_id,
        platform_id,
        quincena,
        daily_avg_usd,
        total_days,
        total_usd_modelo,
        created_at,
        users!inner(email, name),
        calculator_platforms!inner(name)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener estadísticas' 
      }, { status: 500 });
    }

    // Agrupar por modelo para mostrar resumen
    const summary = stats?.reduce((acc: any, stat: any) => {
      const modelEmail = stat.users?.email || 'Unknown';
      if (!acc[modelEmail]) {
        acc[modelEmail] = {
          email: modelEmail,
          name: stat.users?.name || 'Unknown',
          platforms: []
        };
      }
      acc[modelEmail].platforms.push({
        platform: stat.calculator_platforms?.name || stat.platform_id,
        quincena: stat.quincena,
        daily_avg: stat.daily_avg_usd,
        total_days: stat.total_days,
        total_usd: stat.total_usd_modelo
      });
      return acc;
    }, {}) || {};

    return NextResponse.json({
      success: true,
      totalRecords: stats?.length || 0,
      summary: Object.values(summary),
      recentStats: stats?.slice(0, 10) || []
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

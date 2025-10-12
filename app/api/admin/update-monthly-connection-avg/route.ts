import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Actualizar promedios mensuales de conexión para todas las modelos
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [UPDATE-MONTHLY-AVG] Iniciando actualización de promedios mensuales...');

    // Obtener todas las modelos
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo');

    if (modelsError) {
      console.error('❌ [UPDATE-MONTHLY-AVG] Error obteniendo modelos:', modelsError);
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

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    
    // Calcular días de trabajo en el mes (26 días considerando descansos)
    const workingDaysInMonth = 26;

    let updatedCount = 0;
    const results = [];

    // Procesar cada modelo
    for (const model of models) {
      try {
        // Contar días con actividad en el mes actual
        const { data: activityData, error: activityError } = await supabase
          .from('calculator_history')
          .select('period_date')
          .eq('model_id', model.id)
          .gte('period_date', `${currentMonth}-01`)
          .lt('period_date', `${currentMonth}-${daysInMonth + 1}`);

        if (activityError) {
          console.error(`❌ [UPDATE-MONTHLY-AVG] Error obteniendo actividad para ${model.email}:`, activityError);
          continue;
        }

        // Contar días únicos con actividad
        const uniqueDays = new Set(activityData?.map(d => d.period_date) || []).size;
        
        // Calcular promedio mensual
        const monthlyAvg = workingDaysInMonth > 0 
          ? Math.round((uniqueDays / workingDaysInMonth) * 100 * 100) / 100 // Redondear a 2 decimales
          : 0;

        // Actualizar el registro del usuario
        const { error: updateError } = await supabase
          .from('users')
          .update({
            monthly_connection_avg: monthlyAvg,
            last_avg_calculation_date: currentDate.toISOString().split('T')[0],
            last_avg_month: currentMonth
          })
          .eq('id', model.id);

        if (updateError) {
          console.error(`❌ [UPDATE-MONTHLY-AVG] Error actualizando ${model.email}:`, updateError);
          results.push({
            model: model.email,
            success: false,
            error: updateError.message
          });
        } else {
          console.log(`✅ [UPDATE-MONTHLY-AVG] Actualizado ${model.email}: ${monthlyAvg}% (${uniqueDays}/${workingDaysInMonth} días)`);
          results.push({
            model: model.email,
            success: true,
            monthlyAvg,
            daysActive: uniqueDays,
            workingDays: workingDaysInMonth
          });
          updatedCount++;
        }

      } catch (error) {
        console.error(`❌ [UPDATE-MONTHLY-AVG] Error procesando ${model.email}:`, error);
        results.push({
          model: model.email,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`✅ [UPDATE-MONTHLY-AVG] Proceso completado. ${updatedCount}/${models.length} modelos actualizados`);

    return NextResponse.json({
      success: true,
      message: `Promedios mensuales actualizados para ${updatedCount} de ${models.length} modelos`,
      currentMonth,
      updated: updatedCount,
      total: models.length,
      results
    });

  } catch (error: any) {
    console.error('❌ [UPDATE-MONTHLY-AVG] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// GET: Verificar estado de los promedios mensuales
export async function GET(request: NextRequest) {
  try {
    const { data: models, error } = await supabase
      .from('users')
      .select('id, email, name, monthly_connection_avg, last_avg_calculation_date, last_avg_month')
      .eq('role', 'modelo')
      .order('last_avg_calculation_date', { ascending: false });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener datos' 
      }, { status: 500 });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const upToDate = models?.filter(m => m.last_avg_month === currentMonth).length || 0;

    return NextResponse.json({
      success: true,
      currentMonth,
      totalModels: models?.length || 0,
      upToDate,
      needsUpdate: (models?.length || 0) - upToDate,
      models: models?.map(m => ({
        email: m.email,
        name: m.name,
        monthlyAvg: m.monthly_connection_avg,
        lastCalculation: m.last_avg_calculation_date,
        lastMonth: m.last_avg_month,
        isCurrentMonth: m.last_avg_month === currentMonth
      }))
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

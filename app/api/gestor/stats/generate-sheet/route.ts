import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/gestor/stats/generate-sheet
 * 
 * Genera automáticamente la planilla de Stats para un MES completo
 * Crea registros vacíos (valor 0) para cada modelo activo y cada plataforma activa
 * para AMBOS períodos (P1 y P2) del mes
 * agrupados por grupo/sede
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { year, month, groupId } = body;

    // Validar parámetros - ahora recibimos año y mes, no periodDate y periodType
    let targetYear: number;
    let targetMonth: number;

    if (year && month) {
      targetYear = parseInt(year);
      targetMonth = parseInt(month);
    } else {
      // Si no se proporcionan, usar el mes actual
      const currentDate = getColombiaDate();
      const [y, m] = currentDate.split('-').map(Number);
      targetYear = y;
      targetMonth = m;
    }

    // Validar mes
    if (targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json({
        success: false,
        error: 'Mes inválido (debe ser entre 1 y 12)'
      }, { status: 400 });
    }

    // Fechas de inicio de ambos períodos del mes
    const periodDateP1 = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const periodDateP2 = `${targetYear}-${String(targetMonth).padStart(2, '0')}-16`;

    console.log(`📊 [GENERATE-SHEET] Generando planilla mensual para ${targetYear}-${String(targetMonth).padStart(2, '0')} (P1: ${periodDateP1}, P2: ${periodDateP2})`);

    // 1. Obtener todas las plataformas activas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [GENERATE-SHEET] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo plataformas'
      }, { status: 500 });
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay plataformas activas'
      }, { status: 400 });
    }

    console.log(`✅ [GENERATE-SHEET] ${platforms.length} plataformas activas encontradas`);

    // 2. Obtener todos los grupos activos (o un grupo específico si se proporciona)
    let groupsQuery = supabase
      .from('groups')
      .select('id')
      .eq('is_active', true);

    if (groupId) {
      groupsQuery = groupsQuery.eq('id', groupId);
    }

    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) {
      console.error('❌ [GENERATE-SHEET] Error obteniendo grupos:', groupsError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo grupos'
      }, { status: 500 });
    }

    if (!groups || groups.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay grupos activos'
      }, { status: 400 });
    }

    console.log(`✅ [GENERATE-SHEET] ${groups.length} grupos activos encontrados`);

    // 3. Para cada grupo, obtener modelos activos
    const allRecords: any[] = [];
    let totalModels = 0;

    for (const group of groups) {
      // Obtener usuarios del grupo
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', group.id);

      if (userGroupsError) {
        console.warn(`⚠️ [GENERATE-SHEET] Error obteniendo usuarios del grupo ${group.id}:`, userGroupsError);
        continue;
      }

      if (!userGroups || userGroups.length === 0) {
        console.log(`⚠️ [GENERATE-SHEET] Grupo ${group.id} no tiene usuarios asignados`);
        continue;
      }

      const userIds = userGroups.map(ug => ug.user_id);

      // Obtener modelos activos del grupo
      const { data: models, error: modelsError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'modelo')
        .eq('is_active', true)
        .in('id', userIds);

      if (modelsError) {
        console.warn(`⚠️ [GENERATE-SHEET] Error obteniendo modelos del grupo ${group.id}:`, modelsError);
        continue;
      }

      if (!models || models.length === 0) {
        console.log(`⚠️ [GENERATE-SHEET] Grupo ${group.id} no tiene modelos activos`);
        continue;
      }

      console.log(`✅ [GENERATE-SHEET] Grupo ${group.id}: ${models.length} modelos activos`);

      // 4. Crear registros para cada modelo y plataforma para AMBOS períodos (P1 y P2)
      for (const model of models) {
        for (const platform of platforms) {
          // Crear registro para P1 (1-15)
          const { data: existingP1 } = await supabase
            .from('gestor_stats_values')
            .select('id')
            .eq('model_id', model.id)
            .eq('platform_id', platform.id)
            .eq('period_date', periodDateP1)
            .eq('period_type', '1-15')
            .single();

          if (!existingP1) {
            allRecords.push({
              model_id: model.id,
              group_id: group.id,
              platform_id: platform.id,
              period_date: periodDateP1,
              period_type: '1-15',
              value: 0  // Valor inicial en 0
            });
          }

          // Crear registro para P2 (16-31)
          const { data: existingP2 } = await supabase
            .from('gestor_stats_values')
            .select('id')
            .eq('model_id', model.id)
            .eq('platform_id', platform.id)
            .eq('period_date', periodDateP2)
            .eq('period_type', '16-31')
            .single();

          if (!existingP2) {
            allRecords.push({
              model_id: model.id,
              group_id: group.id,
              platform_id: platform.id,
              period_date: periodDateP2,
              period_type: '16-31',
              value: 0  // Valor inicial en 0
            });
          }
        }
        totalModels++;
      }
    }

    if (allRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'La planilla ya existe para este mes',
        recordsCreated: 0,
        totalModels,
        totalGroups: groups.length,
        year: targetYear,
        month: targetMonth
      });
    }

    console.log(`📝 [GENERATE-SHEET] Creando ${allRecords.length} registros para ambos períodos...`);

    // 5. Insertar registros en batch
    const { data: inserted, error: insertError } = await supabase
      .from('gestor_stats_values')
      .insert(allRecords)
      .select('id');

    if (insertError) {
      console.error('❌ [GENERATE-SHEET] Error insertando registros:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Error insertando registros',
        details: insertError.message
      }, { status: 500 });
    }

    console.log(`✅ [GENERATE-SHEET] Planilla mensual generada exitosamente: ${inserted?.length || 0} registros creados`);

    return NextResponse.json({
      success: true,
      message: 'Planilla mensual generada exitosamente',
      recordsCreated: inserted?.length || 0,
      totalModels,
      totalGroups: groups.length,
      year: targetYear,
      month: targetMonth,
      periodDateP1,
      periodDateP2
    });

  } catch (error: any) {
    console.error('❌ [GENERATE-SHEET] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/gestor/stats/generate-sheet
 * 
 * Verifica el estado de la planilla para un mes específico
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    let targetYear: number;
    let targetMonth: number;

    if (yearParam && monthParam) {
      targetYear = parseInt(yearParam);
      targetMonth = parseInt(monthParam);
    } else {
      // Usar mes actual
      const currentDate = getColombiaDate();
      const [y, m] = currentDate.split('-').map(Number);
      targetYear = y;
      targetMonth = m;
    }

    const periodDateP1 = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const periodDateP2 = `${targetYear}-${String(targetMonth).padStart(2, '0')}-16`;

    // Verificar registros para ambos períodos
    const { data: stats, error } = await supabase
      .from('gestor_stats_values')
      .select('id, model_id, group_id, platform_id, period_type')
      .in('period_date', [periodDateP1, periodDateP2])
      .in('period_type', ['1-15', '16-31']);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Error consultando planilla'
      }, { status: 500 });
    }

    const p1Count = stats?.filter(s => s.period_type === '1-15').length || 0;
    const p2Count = stats?.filter(s => s.period_type === '16-31').length || 0;

    return NextResponse.json({
      success: true,
      year: targetYear,
      month: targetMonth,
      periodDateP1,
      periodDateP2,
      totalRecords: stats?.length || 0,
      p1Records: p1Count,
      p2Records: p2Count,
      exists: (stats?.length || 0) > 0,
      complete: p1Count > 0 && p2Count > 0
    });

  } catch (error: any) {
    console.error('❌ [GENERATE-SHEET] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}


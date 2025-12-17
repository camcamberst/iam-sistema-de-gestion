import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/gestor/stats/generate-sheet
 * 
 * Genera automáticamente la planilla de Stats para un período específico
 * Crea registros vacíos (valor 0) para cada modelo activo y cada plataforma activa
 * agrupados por grupo/sede
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { periodDate, periodType, groupId } = body;

    // Validar parámetros
    if (!periodDate || !periodType) {
      // Si no se proporcionan, usar el período actual
      const currentDate = getColombiaDate();
      const [year, month, day] = currentDate.split('-').map(Number);
      const defaultPeriodType = day <= 15 ? '1-15' : '16-31';
      const defaultPeriodDate = day <= 15 
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-${String(month).padStart(2, '0')}-16`;

      return NextResponse.json({
        success: false,
        error: 'Parámetros requeridos: periodDate y periodType',
        suggestion: {
          periodDate: defaultPeriodDate,
          periodType: defaultPeriodType
        }
      }, { status: 400 });
    }

    console.log(`📊 [GENERATE-SHEET] Generando planilla para período ${periodDate} (${periodType})`);

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

      // 4. Crear registros para cada modelo y plataforma
      for (const model of models) {
        for (const platform of platforms) {
          // Verificar si ya existe un registro para este modelo, plataforma y período
          const { data: existing } = await supabase
            .from('gestor_stats_values')
            .select('id')
            .eq('model_id', model.id)
            .eq('platform_id', platform.id)
            .eq('period_date', periodDate)
            .eq('period_type', periodType)
            .single();

          // Solo crear si no existe
          if (!existing) {
            allRecords.push({
              model_id: model.id,
              group_id: group.id,
              platform_id: platform.id,
              period_date: periodDate,
              period_type: periodType,
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
        message: 'La planilla ya existe para este período',
        recordsCreated: 0,
        totalModels,
        totalGroups: groups.length
      });
    }

    console.log(`📝 [GENERATE-SHEET] Creando ${allRecords.length} registros...`);

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

    console.log(`✅ [GENERATE-SHEET] Planilla generada exitosamente: ${inserted?.length || 0} registros creados`);

    return NextResponse.json({
      success: true,
      message: 'Planilla generada exitosamente',
      recordsCreated: inserted?.length || 0,
      totalModels,
      totalGroups: groups.length,
      periodDate,
      periodType
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
 * Verifica el estado de la planilla para un período específico
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodDate = searchParams.get('periodDate');
    const periodType = searchParams.get('periodType') as '1-15' | '16-31' | null;

    if (!periodDate || !periodType) {
      // Usar período actual
      const currentDate = getColombiaDate();
      const [year, month, day] = currentDate.split('-').map(Number);
      const defaultPeriodType = day <= 15 ? '1-15' : '16-31';
      const defaultPeriodDate = day <= 15 
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-${String(month).padStart(2, '0')}-16`;

      const { data: stats } = await supabase
        .from('gestor_stats_values')
        .select('id, model_id, group_id, platform_id')
        .eq('period_date', defaultPeriodDate)
        .eq('period_type', defaultPeriodType);

      return NextResponse.json({
        success: true,
        periodDate: defaultPeriodDate,
        periodType: defaultPeriodType,
        totalRecords: stats?.length || 0,
        exists: (stats?.length || 0) > 0
      });
    }

    const { data: stats, error } = await supabase
      .from('gestor_stats_values')
      .select('id, model_id, group_id, platform_id')
      .eq('period_date', periodDate)
      .eq('period_type', periodType);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Error consultando planilla'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      periodDate,
      periodType,
      totalRecords: stats?.length || 0,
      exists: (stats?.length || 0) > 0
    });

  } catch (error: any) {
    console.error('❌ [GENERATE-SHEET] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}


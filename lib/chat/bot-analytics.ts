// Bot Analytics - Consultas analíticas según jerarquía de roles
// ================================================================

import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from './aim-botty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface AnalyticsQuery {
  type: 
    | 'productivity_by_sede'
    | 'productivity_by_group'
    | 'top_models'
    | 'productivity_trend'
    | 'period_comparison'
    | 'group_ranking'
    | 'sede_ranking'
    | 'model_statistics';
  params?: {
    sedeId?: string;
    groupId?: string;
    modelId?: string;
    startDate?: string;
    endDate?: string;
    period?: 'P1' | 'P2' | 'both';
    months?: number; // Para tendencias
    limit?: number; // Para rankings
  };
}

export interface AnalyticsResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Cliente Supabase con service role
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Ejecutar consulta analítica según rol y tipo
 */
export async function executeAnalyticsQuery(
  query: AnalyticsQuery,
  userId: string,
  userRole: 'super_admin' | 'admin' | 'modelo'
): Promise<AnalyticsResult> {
  const supabase = getSupabaseClient();

  try {
    // Verificar permisos según rol
    if (!hasPermissionForQuery(query.type, userRole)) {
      return {
        success: false,
        error: `No tienes permisos para ejecutar esta consulta analítica: ${query.type}`
      };
    }

    switch (query.type) {
      case 'productivity_by_sede':
        return await getProductivityBySede(supabase, query.params, userRole, userId);
      
      case 'productivity_by_group':
        return await getProductivityByGroup(supabase, query.params, userRole, userId);
      
      case 'top_models':
        return await getTopModels(supabase, query.params, userRole, userId);
      
      case 'productivity_trend':
        return await getProductivityTrend(supabase, query.params, userRole, userId);
      
      case 'period_comparison':
        return await getPeriodComparison(supabase, query.params, userRole, userId);
      
      case 'group_ranking':
        return await getGroupRanking(supabase, query.params, userRole, userId);
      
      case 'sede_ranking':
        return await getSedeRanking(supabase, query.params, userRole, userId);
      
      case 'model_statistics':
        return await getModelStatistics(supabase, query.params, userRole, userId);
      
      default:
        return {
          success: false,
          error: `Tipo de consulta no reconocida: ${query.type}`
        };
    }
  } catch (error: any) {
    console.error('❌ [BOT-ANALYTICS] Error ejecutando consulta:', error);
    return {
      success: false,
      error: error.message || 'Error ejecutando consulta analítica'
    };
  }
}

/**
 * Verificar permisos según rol
 */
function hasPermissionForQuery(
  queryType: AnalyticsQuery['type'],
  role: 'super_admin' | 'admin' | 'modelo'
): boolean {
  // Super admin tiene acceso a todo
  if (role === 'super_admin') return true;

  // Admin tiene acceso limitado a sus grupos
  if (role === 'admin') {
    const adminQueries: AnalyticsQuery['type'][] = [
      'productivity_by_group',
      'top_models',
      'productivity_trend',
      'group_ranking',
      'model_statistics'
    ];
    return adminQueries.includes(queryType);
  }

  // Modelo solo puede ver sus propias estadísticas
  if (role === 'modelo') {
    return queryType === 'model_statistics';
  }

  return false;
}

/**
 * Productividad por sede (últimos N meses)
 */
async function getProductivityBySede(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  try {
    const months = params?.months || 6; // Por defecto último semestre
    const startDate = params?.startDate || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = params?.endDate || new Date().toISOString().split('T')[0];

    console.log('📊 [BOT-ANALYTICS] Productividad por sede:', { startDate, endDate });

    // Obtener datos históricos por periodo
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        period_date,
        period_type,
        model_id,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        users!inner(
          id,
          email,
          name,
          organization_id,
          user_groups(
            groups!inner(
              id,
              name,
              organization_id
            )
          )
        )
      `)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .neq('model_id', AIM_BOTTY_ID);

    if (historyError) {
      console.error('❌ [BOT-ANALYTICS] Error obteniendo historial:', historyError);
      return { success: false, error: 'Error obteniendo datos históricos' };
    }

    // Agrupar por organización (sede)
    const sedeMap = new Map<string, {
      sedeId: string;
      sedeName: string;
      totalUsdBruto: number;
      totalUsdModelo: number;
      totalCopModelo: number;
      totalModels: Set<string>;
      periods: Set<string>;
    }>();

    // Obtener nombres de organizaciones
    const orgIds = Array.from(new Set(historyData?.map((item: any) => item.users?.organization_id).filter(Boolean) || []));
    const { data: organizations } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds.length > 0 ? orgIds : ['00000000-0000-0000-0000-000000000000']);

    const orgMap = new Map<string, string>();
    organizations?.forEach((org: any) => {
      orgMap.set(org.id, org.name);
    });

    historyData?.forEach((item: any) => {
      const orgId = item.users?.organization_id || 'unknown';
      const orgName = orgMap.get(orgId) || 'Sede Desconocida';
      const periodKey = `${item.period_date}-${item.period_type}`;

      if (!sedeMap.has(orgId)) {
        sedeMap.set(orgId, {
          sedeId: orgId,
          sedeName: orgName,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalCopModelo: 0,
          totalModels: new Set(),
          periods: new Set()
        });
      }

      const sede = sedeMap.get(orgId)!;
      sede.totalUsdBruto += Number(item.value_usd_bruto || 0);
      sede.totalUsdModelo += Number(item.value_usd_modelo || 0);
      sede.totalCopModelo += Number(item.value_cop_modelo || 0);
      sede.totalModels.add(item.model_id);
      sede.periods.add(periodKey);
    });

    // Convertir a array y ordenar por USD Bruto
    const results = Array.from(sedeMap.values()).map(sede => ({
      sedeId: sede.sedeId,
      sedeName: sede.sedeName,
      totalUsdBruto: sede.totalUsdBruto,
      totalUsdModelo: sede.totalUsdModelo,
      totalCopModelo: sede.totalCopModelo,
      totalUsdSede: sede.totalUsdBruto - sede.totalUsdModelo,
      totalModels: sede.totalModels.size,
      totalPeriods: sede.periods.size,
      averageUsdBrutoPerPeriod: sede.totalUsdBruto / (sede.periods.size || 1)
    })).sort((a, b) => b.totalUsdBruto - a.totalUsdBruto);

    return {
      success: true,
      data: results,
      message: `Análisis de productividad por sede para los últimos ${months} meses`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Productividad por grupo
 */
async function getProductivityByGroup(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  try {
    const months = params?.months || 6;
    const startDate = params?.startDate || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = params?.endDate || new Date().toISOString().split('T')[0];

    // Obtener grupos según permisos
    let allowedGroupIds: string[] = [];
    if (userRole === 'admin') {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userId);
      allowedGroupIds = (adminGroups || []).map((ag: any) => ag.group_id);
    }

    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        period_date,
        period_type,
        model_id,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        users!inner(
          id,
          user_groups(
            groups!inner(
              id,
              name
            )
          )
        )
      `)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .neq('model_id', AIM_BOTTY_ID);

    if (historyError) {
      return { success: false, error: 'Error obteniendo datos históricos' };
    }

    // Agrupar por grupo
    const groupMap = new Map<string, {
      groupId: string;
      groupName: string;
      totalUsdBruto: number;
      totalUsdModelo: number;
      totalCopModelo: number;
      totalModels: Set<string>;
    }>();

    historyData?.forEach((item: any) => {
      const groups = item.users?.user_groups || [];
      groups.forEach((ug: any) => {
        const group = ug.groups;
        if (!group) return;
        
        // Filtrar por permisos si es admin
        if (userRole === 'admin' && !allowedGroupIds.includes(group.id)) {
          return;
        }

        const groupId = group.id;
        const groupName = group.name;

        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            groupId,
            groupName,
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalCopModelo: 0,
            totalModels: new Set()
          });
        }

        const groupData = groupMap.get(groupId)!;
        groupData.totalUsdBruto += Number(item.value_usd_bruto || 0);
        groupData.totalUsdModelo += Number(item.value_usd_modelo || 0);
        groupData.totalCopModelo += Number(item.value_cop_modelo || 0);
        groupData.totalModels.add(item.model_id);
      });
    });

    const results = Array.from(groupMap.values()).map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      totalUsdBruto: group.totalUsdBruto,
      totalUsdModelo: group.totalUsdModelo,
      totalCopModelo: group.totalCopModelo,
      totalUsdSede: group.totalUsdBruto - group.totalUsdModelo,
      totalModels: group.totalModels.size
    })).sort((a, b) => b.totalUsdBruto - a.totalUsdBruto);

    return {
      success: true,
      data: results,
      message: `Análisis de productividad por grupo para los últimos ${months} meses`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Top modelos por productividad
 */
async function getTopModels(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  try {
    const limit = params?.limit || 10;
    const months = params?.months || 6;
    const startDate = params?.startDate || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = params?.endDate || new Date().toISOString().split('T')[0];

    // Filtrar por grupos si es admin
    let allowedModelIds: string[] = [];
    if (userRole === 'admin') {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userId);
      const groupIds = (adminGroups || []).map((ag: any) => ag.group_id);
      
      if (groupIds.length > 0) {
        const { data: modelGroups } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds);
        allowedModelIds = (modelGroups || []).map((mg: any) => mg.user_id);
      }
    }

    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        model_id,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        users!inner(
          id,
          email,
          name
        )
      `)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .neq('model_id', AIM_BOTTY_ID);

    if (historyError) {
      return { success: false, error: 'Error obteniendo datos históricos' };
    }

    // Agrupar por modelo
    const modelMap = new Map<string, {
      modelId: string;
      modelName: string;
      modelEmail: string;
      totalUsdBruto: number;
      totalUsdModelo: number;
      totalCopModelo: number;
    }>();

    historyData?.forEach((item: any) => {
      // Filtrar por permisos si es admin
      if (userRole === 'admin' && allowedModelIds.length > 0 && !allowedModelIds.includes(item.model_id)) {
        return;
      }

      if (!modelMap.has(item.model_id)) {
        modelMap.set(item.model_id, {
          modelId: item.model_id,
          modelName: item.users?.name || 'Modelo',
          modelEmail: item.users?.email || '',
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalCopModelo: 0
        });
      }

      const modelData = modelMap.get(item.model_id)!;
      modelData.totalUsdBruto += Number(item.value_usd_bruto || 0);
      modelData.totalUsdModelo += Number(item.value_usd_modelo || 0);
      modelData.totalCopModelo += Number(item.value_cop_modelo || 0);
    });

    const results = Array.from(modelMap.values())
      .sort((a, b) => b.totalUsdBruto - a.totalUsdBruto)
      .slice(0, limit)
      .map((model, index) => ({
        rank: index + 1,
        ...model
      }));

    return {
      success: true,
      data: results,
      message: `Top ${limit} modelos por productividad (USD Bruto) en los últimos ${months} meses`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Tendencia de productividad
 */
async function getProductivityTrend(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  try {
    const months = params?.months || 6;
    const startDate = params?.startDate || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = params?.endDate || new Date().toISOString().split('T')[0];

    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        period_date,
        period_type,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo
      `)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .neq('model_id', AIM_BOTTY_ID);

    if (historyError) {
      return { success: false, error: 'Error obteniendo datos históricos' };
    }

    // Agrupar por mes
    const monthMap = new Map<string, {
      month: string;
      totalUsdBruto: number;
      totalUsdModelo: number;
      totalCopModelo: number;
      periods: number;
    }>();

    historyData?.forEach((item: any) => {
      const month = item.period_date.substring(0, 7); // YYYY-MM

      if (!monthMap.has(month)) {
        monthMap.set(month, {
          month,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalCopModelo: 0,
          periods: 0
        });
      }

      const monthData = monthMap.get(month)!;
      monthData.totalUsdBruto += Number(item.value_usd_bruto || 0);
      monthData.totalUsdModelo += Number(item.value_usd_modelo || 0);
      monthData.totalCopModelo += Number(item.value_cop_modelo || 0);
      monthData.periods += 1;
    });

    const results = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(month => ({
        ...month,
        averageUsdBruto: month.totalUsdBruto / (month.periods || 1)
      }));

    return {
      success: true,
      data: results,
      message: `Tendencia de productividad por mes (últimos ${months} meses)`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Comparación entre períodos
 */
async function getPeriodComparison(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  // Implementación básica - puede expandirse
  return {
    success: false,
    error: 'Función en desarrollo'
  };
}

/**
 * Ranking de grupos
 */
async function getGroupRanking(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  // Similar a productivity_by_group pero solo rankings
  const result = await getProductivityByGroup(supabase, params, userRole, userId);
  if (result.success && result.data) {
    return {
      ...result,
      message: `Ranking de grupos por productividad (${params?.months || 6} meses)`
    };
  }
  return result;
}

/**
 * Ranking de sedes
 */
async function getSedeRanking(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  // Similar a productivity_by_sede pero solo rankings
  const result = await getProductivityBySede(supabase, params, userRole, userId);
  if (result.success && result.data) {
    return {
      ...result,
      message: `Ranking de sedes por productividad (${params?.months || 6} meses)`
    };
  }
  return result;
}

/**
 * Estadísticas de un modelo específico
 */
async function getModelStatistics(
  supabase: any,
  params: AnalyticsQuery['params'],
  userRole: string,
  userId: string
): Promise<AnalyticsResult> {
  try {
    const modelId = params?.modelId || userId; // Por defecto el modelo actual
    const months = params?.months || 6;
    const startDate = params?.startDate || new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = params?.endDate || new Date().toISOString().split('T')[0];

    // Verificar permisos: modelo solo puede ver sus propios datos
    if (userRole === 'modelo' && modelId !== userId) {
      return { success: false, error: 'No tienes permisos para ver estas estadísticas' };
    }

    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select(`
        period_date,
        period_type,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        platform_id
      `)
      .eq('model_id', modelId)
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    if (historyError) {
      return { success: false, error: 'Error obteniendo datos históricos' };
    }

    const totals = historyData?.reduce((acc, item) => ({
      totalUsdBruto: acc.totalUsdBruto + Number(item.value_usd_bruto || 0),
      totalUsdModelo: acc.totalUsdModelo + Number(item.value_usd_modelo || 0),
      totalCopModelo: acc.totalCopModelo + Number(item.value_cop_modelo || 0),
      periods: acc.periods + 1
    }), { totalUsdBruto: 0, totalUsdModelo: 0, totalCopModelo: 0, periods: 0 }) || {
      totalUsdBruto: 0,
      totalUsdModelo: 0,
      totalCopModelo: 0,
      periods: 0
    };

    return {
      success: true,
      data: {
        ...totals,
        averageUsdBrutoPerPeriod: totals.totalUsdBruto / (totals.periods || 1),
        averageUsdModeloPerPeriod: totals.totalUsdModelo / (totals.periods || 1)
      },
      message: `Estadísticas del modelo para los últimos ${months} meses`
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


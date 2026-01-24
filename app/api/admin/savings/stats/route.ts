import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET: Obtener estadísticas de ahorros (para admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'todos';

    // Verificar autenticación y rol
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, affiliate_studio_id')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Construir filtro de fecha según período
    let dateFilter = '';
    if (period !== 'todos') {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'ultimo_mes':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          break;
        case 'ultimos_3_meses':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'ultimos_6_meses':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        case 'este_ano':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      dateFilter = startDate.toISOString().split('T')[0];
    }

    // Obtener todas las solicitudes de ahorro
    let savingsQuery = supabase
      .from('model_savings')
      .select('*');

    if (dateFilter) {
      savingsQuery = savingsQuery.gte('created_at', dateFilter);
    }

    // Si es admin (no super_admin), filtrar por grupos
    if (userData.role === 'admin') {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = adminGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        const { data: groupModels } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds);

        const modelIds = groupModels?.map((gm: any) => gm.user_id).filter((id): id is string => !!id) || [];
        
        if (modelIds.length > 0) {
          savingsQuery = savingsQuery.in('model_id', modelIds);
        } else {
          return NextResponse.json({
            success: true,
            stats: getEmptyStats(),
            monthlyData: [],
            groupStats: []
          });
        }
      } else {
        return NextResponse.json({
          success: true,
          stats: getEmptyStats(),
          monthlyData: [],
          groupStats: []
        });
      }
    }

    const { data: savings, error: savingsError } = await savingsQuery;

    if (savingsError) {
      console.error('❌ [ADMIN-SAVINGS-STATS] Error obteniendo ahorros:', savingsError);
      return NextResponse.json({ success: false, error: savingsError.message }, { status: 500 });
    }

    // Obtener todos los retiros
    let withdrawalsQuery = supabase
      .from('savings_withdrawals')
      .select('*');

    if (dateFilter) {
      withdrawalsQuery = withdrawalsQuery.gte('created_at', dateFilter);
    }

    if (userData.role === 'admin') {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = adminGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        const { data: groupModels } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds);

        const modelIds = groupModels?.map((gm: any) => gm.user_id).filter((id): id is string => !!id) || [];
        
        if (modelIds.length > 0) {
          withdrawalsQuery = withdrawalsQuery.in('model_id', modelIds);
        }
      }
    }

    const { data: withdrawals, error: withdrawalsError } = await withdrawalsQuery;

    if (withdrawalsError) {
      console.error('❌ [ADMIN-SAVINGS-STATS] Error obteniendo retiros:', withdrawalsError);
      return NextResponse.json({ success: false, error: withdrawalsError.message }, { status: 500 });
    }

    // Obtener ajustes
    let adjustmentsQuery = supabase
      .from('savings_adjustments')
      .select('*');

    if (dateFilter) {
      adjustmentsQuery = adjustmentsQuery.gte('created_at', dateFilter);
    }

    if (userData.role === 'admin') {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = adminGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        const { data: groupModels } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds);

        const modelIds = groupModels?.map((gm: any) => gm.user_id).filter((id): id is string => !!id) || [];
        
        if (modelIds.length > 0) {
          adjustmentsQuery = adjustmentsQuery.in('model_id', modelIds);
        }
      }
    }

    const { data: adjustments, error: adjustmentsError } = await adjustmentsQuery;

    // Calcular estadísticas
    const total_ahorrado = (savings || [])
      .filter(s => s.estado === 'aprobado')
      .reduce((sum, s) => sum + parseFloat(String(s.monto_ajustado || s.monto_ahorrado)), 0);

    const total_retirado = (withdrawals || [])
      .filter(w => w.estado === 'realizado')
      .reduce((sum, w) => sum + parseFloat(String(w.monto_solicitado)), 0);

    const saldo_actual = total_ahorrado - total_retirado + 
      (adjustments || []).reduce((sum, a) => sum + parseFloat(String(a.monto)), 0);

    // Obtener modelos únicos con ahorro
    const modelosConAhorro = new Set(
      (savings || [])
        .filter(s => s.estado === 'aprobado')
        .map(s => s.model_id)
    ).size;

    // Estadísticas de solicitudes
    const solicitudesPendientes = (savings || []).filter(s => s.estado === 'pendiente').length;
    const solicitudesAprobadas = (savings || []).filter(s => s.estado === 'aprobado').length;
    const solicitudesRechazadas = (savings || []).filter(s => s.estado === 'rechazado').length;

    // Estadísticas de retiros
    const retirosPendientes = (withdrawals || []).filter(w => w.estado === 'pendiente').length;
    const retirosAprobados = (withdrawals || []).filter(w => w.estado === 'aprobado').length;
    const retirosRealizados = (withdrawals || []).filter(w => w.estado === 'realizado').length;

    // Datos mensuales
    const monthlyDataMap: Record<string, { ingresos: number; retiros: number; solicitudes: number }> = {};
    
    (savings || []).forEach(s => {
      if (s.estado === 'aprobado') {
        const month = new Date(s.approved_at || s.created_at).toISOString().slice(0, 7);
        if (!monthlyDataMap[month]) {
          monthlyDataMap[month] = { ingresos: 0, retiros: 0, solicitudes: 0 };
        }
        monthlyDataMap[month].ingresos += parseFloat(String(s.monto_ajustado || s.monto_ahorrado));
        monthlyDataMap[month].solicitudes += 1;
      }
    });

    (withdrawals || []).forEach(w => {
      if (w.estado === 'realizado') {
        const month = new Date(w.realized_at || w.created_at).toISOString().slice(0, 7);
        if (!monthlyDataMap[month]) {
          monthlyDataMap[month] = { ingresos: 0, retiros: 0, solicitudes: 0 };
        }
        monthlyDataMap[month].retiros += parseFloat(String(w.monto_solicitado));
      }
    });

    const monthlyData = Object.entries(monthlyDataMap)
      .map(([month, data]) => {
        let runningBalance = 0;
        // Calcular saldo acumulado hasta este mes
        Object.entries(monthlyDataMap).forEach(([m, d]) => {
          if (m <= month) {
            runningBalance += d.ingresos - d.retiros;
          }
        });
        return {
          month,
          ingresos: data.ingresos,
          retiros: data.retiros,
          saldo: runningBalance,
          solicitudes: data.solicitudes
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Estadísticas por grupo
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name');

    const groupStatsMap: Record<string, GroupStats> = {};
    
    (groups || []).forEach(g => {
      groupStatsMap[g.id] = {
        group_id: g.id,
        group_name: g.name,
        total_ahorrado: 0,
        total_retirado: 0,
        saldo_actual: 0,
        modelos_con_ahorro: 0
      };
    });

    // Obtener modelos por grupo
    const { data: userGroups } = await supabase
      .from('user_groups')
      .select('user_id, group_id');

    const modelGroups: Record<string, string[]> = {};
    (userGroups || []).forEach(ug => {
      if (!modelGroups[ug.user_id]) {
        modelGroups[ug.user_id] = [];
      }
      modelGroups[ug.user_id].push(ug.group_id);
    });

    // Calcular estadísticas por grupo
    (savings || []).forEach(s => {
      if (s.estado === 'aprobado' && modelGroups[s.model_id]) {
        const monto = parseFloat(String(s.monto_ajustado || s.monto_ahorrado));
        modelGroups[s.model_id].forEach(groupId => {
          if (groupStatsMap[groupId]) {
            groupStatsMap[groupId].total_ahorrado += monto;
            groupStatsMap[groupId].saldo_actual += monto;
          }
        });
      }
    });

    (withdrawals || []).forEach(w => {
      if (w.estado === 'realizado' && modelGroups[w.model_id]) {
        const monto = parseFloat(String(w.monto_solicitado));
        modelGroups[w.model_id].forEach(groupId => {
          if (groupStatsMap[groupId]) {
            groupStatsMap[groupId].total_retirado += monto;
            groupStatsMap[groupId].saldo_actual -= monto;
          }
        });
      }
    });

    // Contar modelos por grupo
    Object.keys(groupStatsMap).forEach(groupId => {
      const modelosEnGrupo = new Set(
        Object.entries(modelGroups)
          .filter(([modelId, groups]) => groups.includes(groupId))
          .map(([modelId]) => modelId)
      );
      groupStatsMap[groupId].modelos_con_ahorro = modelosEnGrupo.size;
    });

    const groupStats = Object.values(groupStatsMap)
      .filter(g => g.total_ahorrado > 0 || g.total_retirado > 0)
      .sort((a, b) => b.saldo_actual - a.saldo_actual);

    const stats: SavingsStats = {
      total_ahorrado,
      total_retirado,
      saldo_actual,
      total_solicitudes: (savings || []).length,
      solicitudes_pendientes,
      solicitudes_aprobadas,
      solicitudes_rechazadas,
      total_retiros: (withdrawals || []).length,
      retiros_pendientes,
      retiros_aprobados,
      retiros_realizados,
      total_ajustes: (adjustments || []).length,
      modelos_con_ahorro: modelosConAhorro,
      promedio_ahorro_por_modelo: modelosConAhorro > 0 ? total_ahorrado / modelosConAhorro : 0
    };

    return NextResponse.json({
      success: true,
      stats,
      monthlyData,
      groupStats
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-SAVINGS-STATS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

interface GroupStats {
  group_id: string;
  group_name: string;
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
  modelos_con_ahorro: number;
}

interface SavingsStats {
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
  total_solicitudes: number;
  solicitudes_pendientes: number;
  solicitudes_aprobadas: number;
  solicitudes_rechazadas: number;
  total_retiros: number;
  retiros_pendientes: number;
  retiros_aprobados: number;
  retiros_realizados: number;
  total_ajustes: number;
  modelos_con_ahorro: number;
  promedio_ahorro_por_modelo: number;
}

function getEmptyStats(): SavingsStats {
  return {
    total_ahorrado: 0,
    total_retirado: 0,
    saldo_actual: 0,
    total_solicitudes: 0,
    solicitudes_pendientes: 0,
    solicitudes_aprobadas: 0,
    solicitudes_rechazadas: 0,
    total_retiros: 0,
    retiros_pendientes: 0,
    retiros_aprobados: 0,
    retiros_realizados: 0,
    total_ajustes: 0,
    modelos_con_ahorro: 0,
    promedio_ahorro_por_modelo: 0
  };
}

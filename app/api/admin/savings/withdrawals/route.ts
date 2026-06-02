import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTotalSavingsBalance } from '@/lib/savings/savings-utils';


export const dynamic = 'force-dynamic';

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
 * GET: Obtener todos los retiros (para admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const modelId = searchParams.get('modelId');

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

    // Construir query
    let query = supabase
      .from('savings_withdrawals')
      .select(`
        *,
        model:users!savings_withdrawals_model_id_fkey(
          id, 
          name, 
          email,
          user_groups(
            group_id,
            groups(id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (estado) {
      const estados = estado.split(',');
      if (estados.length > 1) {
        query = query.in('estado', estados);
      } else {
        query = query.eq('estado', estado);
      }
    }

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    // Si es admin (no super_admin), filtrar por grupos
    if (userData.role === 'admin') {
      // Obtener grupos del admin
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = adminGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        // Obtener modelos de esos grupos
        const { data: groupModels } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds)
          .eq('users.role', 'modelo');

        const modelIds = groupModels?.map((gm: any) => gm.user_id).filter((id): id is string => !!id) || [];
        
        if (modelIds.length > 0) {
          query = query.in('model_id', modelIds);
        } else {
          // Si no hay modelos en sus grupos, retornar vacío
          return NextResponse.json({ success: true, withdrawals: [] });
        }
      } else {
        // Si no tiene grupos, retornar vacío
        return NextResponse.json({ success: true, withdrawals: [] });
      }
    }

    const { data: withdrawals, error: withdrawalsError } = await query;

    if (withdrawalsError) {
      console.error('❌ [ADMIN-WITHDRAWALS] Error obteniendo retiros:', withdrawalsError);
      return NextResponse.json({ success: false, error: withdrawalsError.message }, { status: 500 });
    }

    // Obtener los saldos y metas asociadas a cada retiro de forma concurrente
    const withdrawalsWithAudit = await Promise.all((withdrawals || []).map(async (w: any) => {
      const modelId = w.model_id;
      
      // 1. Obtener saldo actual
      const balanceData = await getTotalSavingsBalance(modelId);
      const saldoActual = balanceData.success ? balanceData.saldo_actual : 0;
      
      // 2. Obtener meta activa
      const { data: activeGoal } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('model_id', modelId)
        .eq('estado', 'activa')
        .maybeSingle();
        
      // 3. Obtener meta cancelada recientemente (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: canceledGoals } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('model_id', modelId)
        .eq('estado', 'cancelada')
        .gte('updated_at', thirtyDaysAgo.toISOString())
        .order('updated_at', { ascending: false })
        .limit(1);
        
      const recentCanceledGoal = canceledGoals && canceledGoals.length > 0 ? canceledGoals[0] : null;
      
      // 4. Calcular desglose de auditoría
      let metaAuditoria = null;
      if (activeGoal) {
        const montoMeta = parseFloat(String(activeGoal.monto_meta || 0));
        const montoActual = parseFloat(String(activeGoal.monto_actual || 0));
        const porcentaje = montoMeta > 0 ? (montoActual / montoMeta) * 100 : 0;
        const faltante = Math.max(0, montoMeta - montoActual);
        
        // Saldo comprometido = Lo que ya se ha ahorrado para la meta, topado al monto de la meta
        // Saldo libre = Saldo disponible total menos lo que ya está acumulado/comprometido por la meta
        const saldoComprometido = Math.min(saldoActual, montoMeta);
        const saldoLibre = Math.max(0, saldoActual - montoMeta);
        const canibaliza = w.monto_solicitado > saldoLibre;
        
        // Verificar si la fecha límite aún no se ha cumplido
        let plazoIncumplido = false;
        if (activeGoal.fecha_limite) {
          const limite = new Date(activeGoal.fecha_limite);
          plazoIncumplido = limite.getTime() > Date.now();
        }
        
        metaAuditoria = {
          tiene_meta_activa: true,
          nombre_meta: activeGoal.nombre_meta,
          monto_meta: montoMeta,
          monto_actual: montoActual,
          porcentaje_progreso: Math.min(100, porcentaje),
          faltante,
          fecha_limite: activeGoal.fecha_limite,
          saldo_actual: saldoActual,
          saldo_comprometido: saldoComprometido,
          saldo_libre: saldoLibre,
          canibaliza,
          plazo_incumplido: plazoIncumplido
        };
      }
      
      let cancelacionAuditoria = null;
      if (recentCanceledGoal) {
        cancelacionAuditoria = {
          tiene_meta_cancelada: true,
          nombre_meta: recentCanceledGoal.nombre_meta,
          monto_meta: parseFloat(String(recentCanceledGoal.monto_meta || 0)),
          cancelada_el: recentCanceledGoal.updated_at
        };
      }
      
      return {
        ...w,
        meta_auditoria: metaAuditoria,
        cancelacion_auditoria: cancelacionAuditoria
      };
    }));

    return NextResponse.json({
      success: true,
      withdrawals: withdrawalsWithAudit
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-WITHDRAWALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

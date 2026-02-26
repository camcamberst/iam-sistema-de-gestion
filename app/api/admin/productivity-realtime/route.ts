import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate } from '@/utils/calculator-dates';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

export interface ProductivityModel {
  modelId: string;
  name: string;
  email: string;
  groupId: string | null;
  groupName: string | null;
  usdBruto: number;
  cuotaMinima: number;
  porcentaje: number;
  estaPorDebajo: boolean;
  lastUpdated: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    // 1. Verificar rol del admin y sus grupos
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select(`
        role,
        affiliate_studio_id,
        user_groups(groups!inner(id, name))
      `)
      .eq('id', adminId)
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';
    const isSuperadminAff = adminUser.role === 'superadmin_aff';

    if (!isSuperAdmin && !isAdmin && !isSuperadminAff) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const adminGroups: string[] = (isSuperAdmin || isSuperadminAff)
      ? []
      : (adminUser.user_groups?.map((ug: any) => ug.groups.id) || []);

    // 2. Obtener modelos según jerarquía
    let modelsQuery = supabase
      .from('users')
      .select('id, email, name, affiliate_studio_id')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .neq('id', AIM_BOTTY_ID)
      .neq('email', AIM_BOTTY_EMAIL);

    if (isSuperadminAff && adminUser.affiliate_studio_id) {
      modelsQuery = modelsQuery.eq('affiliate_studio_id', adminUser.affiliate_studio_id);
    } else if (isAdmin && adminGroups.length > 0) {
      const { data: groupMembers } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', adminGroups);
      const memberIds = groupMembers?.map(g => g.user_id) || [];
      if (memberIds.length === 0) {
        return NextResponse.json({ success: true, models: [], summary: emptySummary(), periodLabel: '' });
      }
      modelsQuery = modelsQuery.in('id', memberIds);
    }

    const { data: models, error: modelsError } = await modelsQuery;
    if (modelsError || !models?.length) {
      return NextResponse.json({ success: true, models: [], summary: emptySummary(), periodLabel: '' });
    }

    const modelIds = models.map(m => m.id);

    // 3. Grupos de cada modelo
    const { data: userGroupsData } = await supabase
      .from('user_groups')
      .select('user_id, groups!inner(id, name)')
      .in('user_id', modelIds);

    const modelGroupMap = new Map<string, { id: string; name: string }>();
    userGroupsData?.forEach((ug: any) => {
      if (ug.groups) modelGroupMap.set(ug.user_id, ug.groups);
    });

    // 4. Período actual (quincena)
    const today = getColombiaDate();
    const [y, m, d] = today.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const startStr = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : `${y}-${String(m).padStart(2, '0')}-16`;
    const endStr = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-15`
      : `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const periodLabel = `${d <= 15 ? 'P1' : 'P2'} ${monthNames[m - 1]} ${y}  (${startStr} – ${endStr})`;

    // 5. Totales actuales desde calculator_totals
    const { data: totalsData } = await supabase
      .from('calculator_totals')
      .select('model_id, total_usd_bruto, updated_at')
      .in('model_id', modelIds)
      .gte('period_date', startStr)
      .lte('period_date', endStr)
      .order('updated_at', { ascending: false });

    // Tomar el más reciente por modelo
    const totalsMap = new Map<string, { usdBruto: number; updatedAt: string }>();
    totalsData?.forEach(t => {
      const existing = totalsMap.get(t.model_id);
      if (!existing || t.updated_at > existing.updatedAt) {
        totalsMap.set(t.model_id, {
          usdBruto: Number(t.total_usd_bruto) || 0,
          updatedAt: t.updated_at
        });
      }
    });

    // 6. Cuota mínima (objetivo básico) de calculator_config
    const { data: configsData } = await supabase
      .from('calculator_config')
      .select('model_id, min_quota_override, group_min_quota')
      .in('model_id', modelIds)
      .eq('active', true);

    const configMap = new Map<string, { min_quota_override: number | null; group_min_quota: number | null }>();
    configsData?.forEach(c => configMap.set(c.model_id, c));

    // 7. Construir respuesta
    const productivityModels: ProductivityModel[] = models.map(model => {
      const totals = totalsMap.get(model.id);
      const config = configMap.get(model.id);
      const group = modelGroupMap.get(model.id);

      const usdBruto = totals?.usdBruto ?? 0;
      const cuotaMinima = config?.min_quota_override || config?.group_min_quota || 470;
      const porcentaje = (usdBruto / cuotaMinima) * 100;

      return {
        modelId: model.id,
        name: model.name?.trim() || model.email.split('@')[0],
        email: model.email.split('@')[0],
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
        usdBruto,
        cuotaMinima,
        porcentaje: Math.round(porcentaje * 10) / 10,
        estaPorDebajo: usdBruto < cuotaMinima,
        lastUpdated: totals?.updatedAt ?? null
      };
    });

    // Ordenar: primero los que están por debajo, luego por porcentaje ascendente
    productivityModels.sort((a, b) => {
      if (a.estaPorDebajo !== b.estaPorDebajo) return a.estaPorDebajo ? -1 : 1;
      return a.porcentaje - b.porcentaje;
    });

    const porEncima = productivityModels.filter(m => !m.estaPorDebajo).length;
    const avgPorcentaje = productivityModels.length > 0
      ? Math.round(productivityModels.reduce((s, m) => s + m.porcentaje, 0) / productivityModels.length * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      models: productivityModels,
      summary: {
        totalModels: productivityModels.length,
        modelsPorEncima: porEncima,
        modelsPorDebajo: productivityModels.length - porEncima,
        avgPorcentaje
      },
      periodLabel,
      periodRange: { start: startStr, end: endStr }
    });

  } catch (error: any) {
    console.error('❌ [PRODUCTIVITY-REALTIME] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}

function emptySummary() {
  return { totalModels: 0, modelsPorEncima: 0, modelsPorDebajo: 0, avgPorcentaje: 0 };
}

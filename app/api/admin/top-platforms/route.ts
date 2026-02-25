import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate } from '@/utils/calculator-dates';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

export interface TopPlatformEntry {
  platformId: string;
  name: string;
  totalUsd: number;
  modelCount: number;
  rank: number;
}

export interface SedeTopPlatforms {
  sedeId: string;
  sedeName: string;
  top3: TopPlatformEntry[];
}

/** Convierte el valor crudo de una plataforma a USD usando las mismas fórmulas que Mi Calculadora */
function toUsd(value: number, platformId: string, currency: string, rates: { eur_usd: number; gbp_usd: number }): number {
  if (value <= 0) return 0;
  if (currency === 'EUR') {
    if (platformId === 'big7')  return value * rates.eur_usd * 0.84;
    if (platformId === 'mondo') return value * rates.eur_usd * 0.78;
    return value * rates.eur_usd;
  }
  if (currency === 'GBP') {
    if (platformId === 'aw') return value * rates.gbp_usd * 0.677;
    return value * rates.gbp_usd;
  }
  // USD
  if (platformId === 'cmd' || platformId === 'camlust' || platformId === 'skypvt') return value * 0.75;
  if (platformId === 'chaturbate' || platformId === 'myfreecams' || platformId === 'stripchat') return value * 0.05;
  if (platformId === 'dxlive')         return value * 0.60;
  if (platformId === 'secretfriends')  return value * 0.50;
  return value;
}

function buildTop3(platformTotals: Map<string, { name: string; usd: number; models: Set<string> }>): TopPlatformEntry[] {
  return [...platformTotals.entries()]
    .map(([id, data]) => ({ platformId: id, name: data.name, totalUsd: Math.round(data.usd * 100) / 100, modelCount: data.models.size, rank: 0 }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 3)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    // ── 1. Verificar rol y grupos del admin ──────────────────────────────────
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role, affiliate_studio_id, user_groups(groups!inner(id, name))')
      .eq('id', adminId)
      .single();

    if (adminError || !adminUser) {
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin    = adminUser.role === 'super_admin';
    const isAdmin         = adminUser.role === 'admin';
    const isSuperadminAff = adminUser.role === 'superadmin_aff';

    if (!isSuperAdmin && !isAdmin && !isSuperadminAff) {
      return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 });
    }

    const adminGroupIds: string[] = (isSuperAdmin || isSuperadminAff)
      ? []
      : (adminUser.user_groups?.map((ug: any) => ug.groups.id) || []);

    // ── 2. Período actual ────────────────────────────────────────────────────
    const today = getColombiaDate();
    const [y, m, d] = today.split('-').map(Number);
    const lastDay  = new Date(y, m, 0).getDate();
    const startStr = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : `${y}-${String(m).padStart(2, '0')}-16`;
    const endStr   = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-15`
      : `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const periodLabel = `${d <= 15 ? 'P1' : 'P2'} ${monthNames[m - 1]} ${y}`;

    // ── 3a. Todos los modelos de la agencia (para global) ───────────────────
    const baseQuery = () => supabase
      .from('users')
      .select('id')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .neq('id', AIM_BOTTY_ID)
      .neq('email', AIM_BOTTY_EMAIL);

    // Global: todos los modelos (superadmin_aff acotado a su estudio; admin ve toda la agencia)
    let globalModelsQuery = baseQuery();
    if (isSuperadminAff && adminUser.affiliate_studio_id) {
      globalModelsQuery = globalModelsQuery.eq('affiliate_studio_id', adminUser.affiliate_studio_id);
    }
    const { data: allAgencyModels } = await globalModelsQuery;
    const allAgencyModelIds = allAgencyModels?.map(m => m.id) ?? [];

    // ── 3b. Modelos del admin (para bySede) ──────────────────────────────────
    let adminModelIds: string[] = allAgencyModelIds; // super_admin y superadmin_aff ven todo
    if (isAdmin && adminGroupIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', adminGroupIds);
      adminModelIds = groupMembers?.map(g => g.user_id) ?? [];
    }

    if (allAgencyModelIds.length === 0) {
      return NextResponse.json({ success: true, global: [], bySede: [], periodLabel });
    }

    // Conjunto unión para una sola consulta de valores
    const allModelIds = [...new Set([...allAgencyModelIds, ...adminModelIds])];

    // ── 4. Grupo de cada modelo ──────────────────────────────────────────────
    const { data: userGroupsData } = await supabase
      .from('user_groups')
      .select('user_id, groups!inner(id, name)')
      .in('user_id', allModelIds);

    const modelGroupMap = new Map<string, { id: string; name: string }>();
    userGroupsData?.forEach((ug: any) => {
      if (ug.groups) modelGroupMap.set(ug.user_id, ug.groups);
    });

    // ── 5. Tasas activas ─────────────────────────────────────────────────────
    const { data: ratesData } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    const rates = {
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
    };

    // ── 6. Definición de plataformas (id, name, currency) ───────────────────
    const { data: platformDefs } = await supabase
      .from('calculator_platforms')
      .select('id, name, currency')
      .eq('active', true);

    const platformMap = new Map<string, { name: string; currency: string }>();
    platformDefs?.forEach((p: any) => platformMap.set(p.id, { name: p.name, currency: p.currency }));

    // ── 7. Valores del período (todos los modelos de la agencia) ────────────
    const { data: allValues } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, updated_at')
      .in('model_id', allModelIds)
      .gte('period_date', startStr)
      .lte('period_date', endStr)
      .order('updated_at', { ascending: false });

    // Para cada modelo, tomar el valor más reciente por plataforma
    const modelPlatformMap = new Map<string, Map<string, number>>();
    allValues?.forEach((v: any) => {
      if (!modelPlatformMap.has(v.model_id)) {
        modelPlatformMap.set(v.model_id, new Map());
      }
      const mMap = modelPlatformMap.get(v.model_id)!;
      if (!mMap.has(v.platform_id)) {
        // primer valor = más reciente (ya está ordenado desc)
        mMap.set(v.platform_id, Number(v.value) || 0);
      }
    });

    // ── 8. Agregación: global (toda la agencia) y bySede (solo grupos del admin) ──
    const globalTotals = new Map<string, { name: string; usd: number; models: Set<string> }>();
    const sedeTotals   = new Map<string, { sedeName: string; platforms: Map<string, { name: string; usd: number; models: Set<string> }> }>();

    const adminModelSet = new Set(adminModelIds);

    allModelIds.forEach(modelId => {
      const platformValues = modelPlatformMap.get(modelId);
      if (!platformValues) return;

      const group    = modelGroupMap.get(modelId);
      const sedeKey  = group?.id   ?? 'sin-sede';
      const sedeName = group?.name ?? 'Sin Sede';

      platformValues.forEach((rawValue, platformId) => {
        const pDef = platformMap.get(platformId);
        if (!pDef) return;
        const usd = toUsd(rawValue, platformId, pDef.currency, rates);
        if (usd <= 0) return;

        // Global: todos los modelos de la agencia
        if (allAgencyModelIds.includes(modelId)) {
          if (!globalTotals.has(platformId)) {
            globalTotals.set(platformId, { name: pDef.name, usd: 0, models: new Set() });
          }
          const g = globalTotals.get(platformId)!;
          g.usd += usd;
          g.models.add(modelId);
        }

        // Por sede: solo modelos a cargo del admin
        if (adminModelSet.has(modelId)) {
          if (!sedeTotals.has(sedeKey)) {
            sedeTotals.set(sedeKey, { sedeName, platforms: new Map() });
          }
          const sedeData = sedeTotals.get(sedeKey)!;
          if (!sedeData.platforms.has(platformId)) {
            sedeData.platforms.set(platformId, { name: pDef.name, usd: 0, models: new Set() });
          }
          const s = sedeData.platforms.get(platformId)!;
          s.usd += usd;
          s.models.add(modelId);
        }
      });
    });

    // ── 9. Construir respuesta ────────────────────────────────────────────────
    const globalTop3 = buildTop3(globalTotals);

    const bySede: SedeTopPlatforms[] = [...sedeTotals.entries()]
      .map(([sedeId, { sedeName, platforms }]) => ({
        sedeId,
        sedeName,
        top3: buildTop3(platforms),
      }))
      .filter(s => s.top3.length > 0)
      .sort((a, b) => (b.top3[0]?.totalUsd ?? 0) - (a.top3[0]?.totalUsd ?? 0));

    return NextResponse.json({
      success: true,
      periodLabel,
      global: globalTop3,
      bySede,
    });

  } catch (error: any) {
    console.error('❌ [TOP-PLATFORMS] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate, getColombiaDateTime, getPeriodDetails } from '@/utils/calculator-dates';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

/**
 * GET /api/admin/dashboard-ticker
 * 
 * Endpoint agregador que retorna TODOS los datos reales necesarios
 * para la barra dinámica (ticker) del Dashboard de Sedes.
 * Ejecuta consultas directas con service role (sin auth de usuario).
 */
export async function GET(request: NextRequest) {
  try {
    const today = getColombiaDate();
    const dateTime = getColombiaDateTime();
    const [y, m, d] = today.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const startStr = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : `${y}-${String(m).padStart(2, '0')}-16`;
    const endStr = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-15`
      : `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    const periodDetails = getPeriodDetails(today);
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(endStr + 'T23:59:59').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
    ));

    // ══════════════════════════════════════════════════════════════════════
    // 1. TASAS ACTIVAS
    // ══════════════════════════════════════════════════════════════════════
    const { data: ratesData } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    const rates = {
      usd_cop: ratesData?.find(r => r.kind === 'USD→COP')?.value || 0,
      eur_usd: ratesData?.find(r => r.kind === 'EUR→USD')?.value || 0,
      gbp_usd: ratesData?.find(r => r.kind === 'GBP→USD')?.value || 0,
    };

    // ══════════════════════════════════════════════════════════════════════
    // 2. MODELOS ACTIVAS
    // ══════════════════════════════════════════════════════════════════════
    const { data: activeModels } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .neq('id', AIM_BOTTY_ID)
      .neq('email', AIM_BOTTY_EMAIL);

    const modelIds = activeModels?.map(m => m.id) || [];
    const modelEmailMap = new Map<string, string>();
    activeModels?.forEach(m => {
      modelEmailMap.set(m.id, m.email?.split('@')[0] || 'modelo');
    });

    // ══════════════════════════════════════════════════════════════════════
    // 3. CALCULATOR CONFIGS (modelos configuradas)
    // ══════════════════════════════════════════════════════════════════════
    let configuredModelsCount = 0;
    const configMap = new Map<string, { minQuota: number }>();

    if (modelIds.length > 0) {
      const { data: configs } = await supabase
        .from('calculator_config')
        .select('model_id, min_quota_override, group_min_quota')
        .in('model_id', modelIds)
        .eq('active', true);

      configuredModelsCount = configs?.length || 0;
      configs?.forEach(c => {
        configMap.set(c.model_id, {
          minQuota: c.min_quota_override || c.group_min_quota || 470,
        });
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 4. CALCULATOR TOTALS (período actual) — productividad
    // ══════════════════════════════════════════════════════════════════════
    let topModel: { prefix: string; usdBruto: number; porcentaje: number } | null = null;
    let bottomModel: { prefix: string; usdBruto: number; porcentaje: number } | null = null;
    let modelsPorEncima = 0;
    let modelsPorDebajo = 0;
    let avgPorcentaje = 0;
    let modelsWithData = 0;

    if (modelIds.length > 0) {
      const { data: totalsData } = await supabase
        .from('calculator_totals')
        .select('model_id, total_usd_bruto, updated_at')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .order('updated_at', { ascending: false });

      // De-duplicate: tomar el más reciente por model_id
      const totalsMap = new Map<string, number>();
      totalsData?.forEach(t => {
        if (!totalsMap.has(t.model_id)) {
          totalsMap.set(t.model_id, Number(t.total_usd_bruto) || 0);
        }
      });

      // Calcular productividad
      let totalPorcentaje = 0;
      let highestUsd = -1;
      let lowestUsd = Infinity;
      let highestModelId = '';
      let lowestModelId = '';

      totalsMap.forEach((usdBruto, modelId) => {
        const config = configMap.get(modelId);
        const cuota = config?.minQuota || 470;
        const pct = (usdBruto / cuota) * 100;

        if (usdBruto >= cuota) modelsPorEncima++;
        else modelsPorDebajo++;

        totalPorcentaje += pct;
        modelsWithData++;

        if (usdBruto > highestUsd) {
          highestUsd = usdBruto;
          highestModelId = modelId;
        }
        if (usdBruto < lowestUsd && usdBruto > 0) {
          lowestUsd = usdBruto;
          lowestModelId = modelId;
        }
      });

      avgPorcentaje = modelsWithData > 0
        ? Math.round((totalPorcentaje / modelsWithData) * 10) / 10
        : 0;

      if (highestModelId) {
        const cuota = configMap.get(highestModelId)?.minQuota || 470;
        topModel = {
          prefix: modelEmailMap.get(highestModelId) || 'modelo',
          usdBruto: Math.round(highestUsd * 100) / 100,
          porcentaje: Math.round((highestUsd / cuota) * 1000) / 10,
        };
      }

      if (lowestModelId && lowestModelId !== highestModelId) {
        const cuota = configMap.get(lowestModelId)?.minQuota || 470;
        bottomModel = {
          prefix: modelEmailMap.get(lowestModelId) || 'modelo',
          usdBruto: Math.round(lowestUsd * 100) / 100,
          porcentaje: Math.round((lowestUsd / cuota) * 1000) / 10,
        };
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 5. TOP PLATAFORMAS (período actual)
    // ══════════════════════════════════════════════════════════════════════
    let top3Platforms: Array<{ name: string; totalUsd: number; modelCount: number }> = [];
    let topBySede: { sedeName: string; platformName: string; totalUsd: number } | null = null;

    if (modelIds.length > 0) {
      // Obtener plataformas
      const { data: platformDefs } = await supabase
        .from('calculator_platforms')
        .select('id, name, currency')
        .eq('active', true);

      const platformMap = new Map<string, { name: string; currency: string }>();
      platformDefs?.forEach(p => platformMap.set(p.id, { name: p.name, currency: p.currency }));

      // Obtener valores del período
      const { data: allValues } = await supabase
        .from('model_values')
        .select('model_id, platform_id, value, updated_at')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .order('updated_at', { ascending: false });

      // De-duplicate per model per platform (take most recent)
      const modelPlatformMap = new Map<string, Map<string, number>>();
      allValues?.forEach(v => {
        if (!modelPlatformMap.has(v.model_id)) {
          modelPlatformMap.set(v.model_id, new Map());
        }
        const mMap = modelPlatformMap.get(v.model_id)!;
        if (!mMap.has(v.platform_id)) {
          mMap.set(v.platform_id, Number(v.value) || 0);
        }
      });

      // Aggregate per platform
      const platformTotals = new Map<string, { name: string; usd: number; models: Set<string> }>();

      modelPlatformMap.forEach((platformValues, modelId) => {
        platformValues.forEach((rawValue, platformId) => {
          const pDef = platformMap.get(platformId);
          if (!pDef || rawValue <= 0) return;

          const usd = toUsd(rawValue, platformId, pDef.currency, rates);
          if (usd <= 0) return;

          if (!platformTotals.has(platformId)) {
            platformTotals.set(platformId, { name: pDef.name, usd: 0, models: new Set() });
          }
          const entry = platformTotals.get(platformId)!;
          entry.usd += usd;
          entry.models.add(modelId);
        });
      });

      top3Platforms = [...platformTotals.entries()]
        .map(([, data]) => ({
          name: data.name,
          totalUsd: Math.round(data.usd * 100) / 100,
          modelCount: data.models.size,
        }))
        .sort((a, b) => b.totalUsd - a.totalUsd)
        .slice(0, 3);

      // Top by sede (get model groups)
      const { data: userGroupsData } = await supabase
        .from('user_groups')
        .select('user_id, groups!inner(id, name)')
        .in('user_id', modelIds);

      const modelGroupMap = new Map<string, { id: string; name: string }>();
      userGroupsData?.forEach((ug: any) => {
        if (ug.groups) modelGroupMap.set(ug.user_id, ug.groups);
      });

      // Aggregate per sede per platform
      const sedePlatformTotals = new Map<string, { sedeName: string; platforms: Map<string, { name: string; usd: number }> }>();

      modelPlatformMap.forEach((platformValues, modelId) => {
        const group = modelGroupMap.get(modelId);
        if (!group) return;

        platformValues.forEach((rawValue, platformId) => {
          const pDef = platformMap.get(platformId);
          if (!pDef || rawValue <= 0) return;
          const usd = toUsd(rawValue, platformId, pDef.currency, rates);
          if (usd <= 0) return;

          if (!sedePlatformTotals.has(group.id)) {
            sedePlatformTotals.set(group.id, { sedeName: group.name, platforms: new Map() });
          }
          const sedeData = sedePlatformTotals.get(group.id)!;
          if (!sedeData.platforms.has(platformId)) {
            sedeData.platforms.set(platformId, { name: pDef.name, usd: 0 });
          }
          sedeData.platforms.get(platformId)!.usd += usd;
        });
      });

      // Find top sede+platform combo
      let maxSedeUsd = 0;
      sedePlatformTotals.forEach(({ sedeName, platforms }) => {
        platforms.forEach(({ name, usd }) => {
          if (usd > maxSedeUsd) {
            maxSedeUsd = usd;
            topBySede = {
              sedeName,
              platformName: name,
              totalUsd: Math.round(usd * 100) / 100,
            };
          }
        });
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // 6. DISPONIBILIDAD (sedes operativas)
    // ══════════════════════════════════════════════════════════════════════
    let highOccupancy: { name: string; pct: number; freeSlots: number; totalSlots: number } | null = null;
    let mostFree: { name: string; freeCount: number; shift: string } | null = null;

    // Get operative sedes (groups)
    const { data: allGroups } = await supabase
      .from('groups')
      .select('id, name')
      .eq('is_manager', false);

    const operativeSedes = (allGroups || []).filter(
      g => g.name !== 'Otros' && g.name !== 'Satélites'
    );

    if (operativeSedes.length > 0) {
      const sedeIds = operativeSedes.map(s => s.id);

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_disponibilidad_por_sedes', {
        p_sede_ids: sedeIds,
      });

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        // Aggregate by sede
        const sedeStats = new Map<string, { name: string; total: number; free: number; shifts: { manana: number; tarde: number; noche: number } }>();

        rpcData.forEach((row: any) => {
          const key = row.sede_id;
          if (!sedeStats.has(key)) {
            sedeStats.set(key, {
              name: row.sede_nombre,
              total: 0,
              free: 0,
              shifts: { manana: 0, tarde: 0, noche: 0 },
            });
          }
          const stat = sedeStats.get(key)!;
          stat.total++;

          if (row.disponible) {
            stat.free++;
            if (row.jornada === 'MAÑANA') stat.shifts.manana++;
            else if (row.jornada === 'TARDE') stat.shifts.tarde++;
            else if (row.jornada === 'NOCHE') stat.shifts.noche++;
          }
        });

        // Find highest occupancy (lowest free %)
        let highestOccPct = 0;
        let mostFreeCount = 0;

        sedeStats.forEach((stat) => {
          const occPct = stat.total > 0 ? Math.round(((stat.total - stat.free) / stat.total) * 100) : 0;
          if (occPct > highestOccPct) {
            highestOccPct = occPct;
            highOccupancy = {
              name: stat.name,
              pct: occPct,
              freeSlots: stat.free,
              totalSlots: stat.total,
            };
          }

          // Most free with shift info
          const shiftEntries: [string, number][] = [
            ['mañana', stat.shifts.manana],
            ['tarde', stat.shifts.tarde],
            ['noche', stat.shifts.noche],
          ];
          const topShift = shiftEntries.sort((a, b) => b[1] - a[1])[0];
          if (stat.free > mostFreeCount && topShift[1] > 0) {
            mostFreeCount = stat.free;
            mostFree = {
              name: stat.name,
              freeCount: topShift[1],
              shift: topShift[0],
            };
          }
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 7. ANUNCIOS (más recientes publicados)
    // ══════════════════════════════════════════════════════════════════════
    let latestAnnouncement: { title: string; publishedAt: string } | null = null;
    let activeAnnouncementsCount = 0;

    const { data: announcements } = await supabase
      .from('announcements')
      .select('title, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(5);

    if (announcements && announcements.length > 0) {
      latestAnnouncement = {
        title: announcements[0].title,
        publishedAt: announcements[0].published_at,
      };
      activeAnnouncementsCount = announcements.length;

      // Get total count
      const { count } = await supabase
        .from('announcements')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true);

      if (count !== null) activeAnnouncementsCount = count;
    }

    // ══════════════════════════════════════════════════════════════════════
    // 8. ASSIGNMENTS + ROOMS count
    // ══════════════════════════════════════════════════════════════════════
    let totalAssignments = 0;
    let totalRooms = 0;
    let sedesConRooms = 0;

    const { count: assignCount } = await supabase
      .from('room_assignments')
      .select('id', { count: 'exact', head: true });
    totalAssignments = assignCount || 0;

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, group_id')
      .eq('is_active', true);
    totalRooms = rooms?.length || 0;

    // Count sedes with rooms
    const sedesWithRooms = new Set(rooms?.map(r => r.group_id) || []);
    sedesConRooms = sedesWithRooms.size;

    // ══════════════════════════════════════════════════════════════════════
    // RESPONSE
    // ══════════════════════════════════════════════════════════════════════
    return NextResponse.json({
      success: true,
      ticker: {
        rates,
        productivity: {
          totalModels: modelIds.length,
          modelsWithData,
          modelsPorEncima,
          modelsPorDebajo,
          avgPorcentaje,
          topModel,
          bottomModel,
        },
        platforms: {
          top3: top3Platforms,
          topBySede,
        },
        availability: {
          totalAssignments,
          totalRooms,
          sedesConRooms,
          highOccupancy,
          mostFree,
        },
        announcements: {
          latest: latestAnnouncement,
          activeCount: activeAnnouncementsCount,
        },
        period: {
          type: d <= 15 ? 'P1' : 'P2',
          label: periodDetails.name,
          daysRemaining,
          dateStr: today,
          timeStr: dateTime,
        },
        configuredModels: configuredModelsCount,
      },
    });
  } catch (error: any) {
    console.error('❌ [DASHBOARD-TICKER] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/** Convierte el valor crudo de una plataforma a USD (misma lógica que Mi Calculadora) */
function toUsd(
  value: number,
  platformId: string,
  currency: string,
  rates: { eur_usd: number; gbp_usd: number }
): number {
  if (value <= 0) return 0;
  if (currency === 'EUR') {
    if (platformId === 'big7') return value * rates.eur_usd * 0.84;
    if (platformId === 'mondo') return value * rates.eur_usd * 0.78;
    return value * rates.eur_usd;
  }
  if (currency === 'GBP') {
    if (platformId === 'aw') return value * rates.gbp_usd * 0.677;
    return value * rates.gbp_usd;
  }
  // USD
  if (['cmd', 'camlust', 'skypvt'].includes(platformId)) return value * 0.75;
  if (['chaturbate', 'myfreecams', 'stripchat'].includes(platformId)) return value * 0.05;
  if (platformId === 'dxlive') return value * 0.60;
  if (platformId === 'secretfriends') return value * 0.50;
  return value;
}

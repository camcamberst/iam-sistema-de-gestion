import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate, normalizeToPeriodStartDate } from '@/utils/calculator-dates';
import { getFrozenPlatformsForModel } from '@/lib/calculator/period-closure-helpers'; // Import added

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener datos de calculadora de un modelo específico para admin view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const adminId = searchParams.get('adminId');

    console.log('🔍 [ADMIN-VIEW] GET request:', { modelId, adminId });

    if (!modelId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y adminId son requeridos' 
      }, { status: 400 });
    }

    // 1. Verificar permisos (Omitido por brevedad, asumimos validación de middleware/cliente o existente)
    // ... (Mismo código de validación de roles que antes)
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role, groups:user_groups(group_id)')
      .eq('id', adminId)
      .single();

    if (adminError) {
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos' }, { status: 403 });
    }

    // 2. Obtener modelo
    const { data: model, error: modelError } = await supabase
      .from('users')
      .select('id, name, email, role, groups:user_groups(group_id, group:groups(id, name))')
      .eq('id', modelId)
      .eq('role', 'modelo')
      .single();

    if (modelError) {
      return NextResponse.json({ success: false, error: 'Modelo no encontrado' }, { status: 404 });
    }

    // 3. Verificar acceso a grupo (Mismo código que antes)
    if (isAdmin && !isSuperAdmin) {
      const adminGroupIds = adminUser.groups?.map((g: any) => g.group_id) || [];
      const modelGroupIds = model.groups?.map((g: any) => g.group_id) || [];
      const hasAccess = modelGroupIds.some((groupId: string) => adminGroupIds.includes(groupId));
      if (!hasAccess) return NextResponse.json({ success: false, error: 'Sin acceso al modelo' }, { status: 403 });
    }

    // 4. Obtener configuración
    const { data: config } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    // 5. Obtener plataformas
    let platforms: any[] = [];
    if (config) {
      const { data: platformData } = await supabase
        .from('calculator_platforms')
        .select('*')
        .in('id', config.enabled_platforms)
        .eq('active', true)
        .order('name');
        
      platforms = (platformData || []).map((platform: any) => ({
        id: platform.id,
        name: platform.name,
        currency: platform.currency,
        percentage: config.percentage_override || config.group_percentage || 80,
        min_quota: config.min_quota_override || config.group_min_quota || 470
      }));
    }

    // 6. Obtener tasas
    const { data: ratesData } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    const rates = ratesData ? {
      usd_cop: ratesData.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    } : null;

    // 7. Obtener valores actuales CORRECTAMENTE (Misma lógica robusta que Mi Calculadora v2)
    const today = getColombiaDate();
    const periodDate = normalizeToPeriodStartDate(today);

    console.log('🔍 [ADMIN-VIEW] Loading values for bucket:', periodDate);

    // Calcular rango del periodo completo
    const isP2 = parseInt(periodDate.split('-')[2]) >= 16;
    const periodStart = periodDate; 
    const periodEndObj = new Date(periodDate);
    if (isP2) { periodEndObj.setMonth(periodEndObj.getMonth() + 1); periodEndObj.setDate(0); }
    else { periodEndObj.setDate(15); }
    const periodEnd = periodEndObj.toISOString().split('T')[0];

    // 🔧 ESTRATEGIA ROBUSTA: Obtener TODOS los valores dentro del rango del periodo
    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false });

    // Consolidar: Para cada plataforma, tomar el valor más reciente
    const consolidatedMap = new Map();
    allValues?.forEach((val: any) => {
      if (!consolidatedMap.has(val.platform_id)) {
        consolidatedMap.set(val.platform_id, val);
      }
    });
    
    const modelValues = Array.from(consolidatedMap.values());

    // 8. Obtener plataformas congeladas (EARLY FREEZE)
    const frozenPlatforms = await getFrozenPlatformsForModel(periodDate, modelId);

    return NextResponse.json({
      success: true,
      model: { id: model.id, name: model.name, email: model.email, groups: model.groups?.map((g: any) => g.group) || [] },
      config: config,
      platforms: platforms.map(p => ({
        id: p.id,
        name: p.name,
        enabled: true,
        percentage: p.percentage,
        min_quota: p.min_quota,
        currency: p.currency
      })),
      values: modelValues || [],
      periodDate: periodDate, // Devolver la fecha de periodo (bucket)
      rates: rates,
      isConfigured: !!config,
      frozenPlatforms // <--- Nuevo campo
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-VIEW] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

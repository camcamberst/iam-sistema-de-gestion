import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener resumen de facturación por sede
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sedeId = searchParams.get('sedeId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [BILLING-SUMMARY] Obteniendo resumen:', { sedeId, periodDate, adminId });

    // 1. Verificar permisos del admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    const isSuperAdmin = adminUser.role === 'super_admin';
    const isAdmin = adminUser.role === 'admin';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para ver este resumen' }, { status: 403 });
    }

    // 2. Obtener modelos según permisos
    let modelsQuery = supabase
      .from('users')
      .select(`
        id, 
        email, 
        name, 
        organization_id
      `)
      .eq('role', 'modelo')
      .eq('is_active', true);

    // Si es admin (no super_admin), filtrar por su organización
    if (isAdmin && !isSuperAdmin) {
      modelsQuery = modelsQuery.eq('organization_id', adminUser.organization_id);
    }

    // Si se especifica una sede específica, filtrar por ella
    if (sedeId) {
      modelsQuery = modelsQuery.eq('organization_id', sedeId);
    }

    const { data: models, error: modelsError } = await modelsQuery;

    if (modelsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener modelos:', modelsError);
      return NextResponse.json({ success: false, error: 'Error al obtener modelos' }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: [],
        summary: {
          totalModels: 0,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalUsdSede: 0,
          totalCopModelo: 0,
          totalCopSede: 0
        },
        periodDate
      });
    }

    const modelIds = models.map(m => m.id);

    // 2.1. Obtener grupos de los modelos
    const { data: userGroups, error: groupsError } = await supabase
      .from('user_groups')
      .select(`
        user_id,
        groups!inner(
          id,
          name,
          organization_id
        )
      `)
      .in('user_id', modelIds);

    if (groupsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener grupos:', groupsError);
      // Continuar sin grupos si hay error
    }

    // Crear mapa de grupos por modelo
    const modelGroupsMap = new Map();
    userGroups?.forEach(ug => {
      if (ug.groups) {
        modelGroupsMap.set(ug.user_id, ug.groups);
      }
    });

    // 3. Obtener totales de calculadora para la QUINCENA del periodDate
    const d = new Date(periodDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const firstHalf = day >= 1 && day <= 15;
    const startStr = `${y}-${String(m + 1).padStart(2,'0')}-${firstHalf ? '01' : '16'}`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const endStr = `${y}-${String(m + 1).padStart(2,'0')}-${firstHalf ? '15' : String(lastDay).padStart(2,'0')}`;

    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .in('model_id', modelIds)
      .gte('period_date', startStr)
      .lte('period_date', endStr);

    if (totalsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener totales:', totalsError);
      return NextResponse.json({ success: false, error: 'Error al obtener totales' }, { status: 500 });
    }

    // 4. Obtener tasa USD/COP actual (más reciente)
    const { data: usdCopRate, error: ratesError } = await supabase
      .from('rates')
      .select('value')
      .eq('active', true)
      .eq('kind', 'USD→COP')
      .order('valid_from', { ascending: false })
      .limit(1)
      .single();

    if (ratesError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas de cambio' }, { status: 500 });
    }

    const usdCopRateValue = usdCopRate?.value || 3900;

    // 5. Consolidar datos por modelo (sumatoria dentro de la quincena)
    const billingData = models.map(model => {
      const totalsForModel = (totals || []).filter(t => t.model_id === model.id);
      const modelGroup = modelGroupsMap.get(model.id);
      
      if (!totalsForModel || totalsForModel.length === 0) {
        // Si no hay totales, retornar ceros
        return {
          modelId: model.id,
          email: model.email.split('@')[0], // Solo parte antes del '@'
          name: model.name,
          organizationId: model.organization_id,
          groupId: modelGroup?.id,
          groupName: modelGroup?.name,
          usdBruto: 0,
          usdModelo: 0,
          usdSede: 0,
          copModelo: 0,
          copSede: 0
        };
      }

      const usdBruto = totalsForModel.reduce((s, t) => s + (t.total_usd_bruto || 0), 0);
      const usdModelo = totalsForModel.reduce((s, t) => s + (t.total_usd_modelo || 0), 0);
      const usdSede = usdBruto - usdModelo; // USD Sede = USD Bruto - USD Modelo
      const copModelo = usdModelo * usdCopRateValue;
      const copSede = usdSede * usdCopRateValue;

      return {
        modelId: model.id,
        email: model.email.split('@')[0], // Solo parte antes del '@'
        name: model.name,
        organizationId: model.organization_id,
        groupId: modelGroup?.id,
        groupName: modelGroup?.name,
        usdBruto,
        usdModelo,
        usdSede,
        copModelo,
        copSede
      };
    });

    // 6. Calcular totales generales
    const summary = billingData.reduce((acc, model) => ({
      totalModels: acc.totalModels + 1,
      totalUsdBruto: acc.totalUsdBruto + model.usdBruto,
      totalUsdModelo: acc.totalUsdModelo + model.usdModelo,
      totalUsdSede: acc.totalUsdSede + model.usdSede,
      totalCopModelo: acc.totalCopModelo + model.copModelo,
      totalCopSede: acc.totalCopSede + model.copSede
    }), {
      totalModels: 0,
      totalUsdBruto: 0,
      totalUsdModelo: 0,
      totalUsdSede: 0,
      totalCopModelo: 0,
      totalCopSede: 0
    });

    // 7. Para Super Admin: Agrupar por sedes y grupos
    let groupedData = null;
    if (isSuperAdmin) {
      // Obtener información de sedes
      const uniqueOrgIds = Array.from(new Set(billingData.map(m => m.organizationId).filter(Boolean)));
      const { data: sedes, error: sedesError } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', uniqueOrgIds);

      if (sedesError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener sedes:', sedesError);
      }

      // Agrupar por sede
      const sedeGroups = new Map();
      billingData.forEach(model => {
        const sedeId = model.organizationId;
        if (!sedeGroups.has(sedeId)) {
          sedeGroups.set(sedeId, {
            sedeId,
            sedeName: sedes?.find(s => s.id === sedeId)?.name || 'Sede Desconocida',
            groups: new Map(),
            totalModels: 0,
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalUsdSede: 0,
            totalCopModelo: 0,
            totalCopSede: 0
          });
        }

        const sede = sedeGroups.get(sedeId);
        sede.totalModels += 1;
        sede.totalUsdBruto += model.usdBruto;
        sede.totalUsdModelo += model.usdModelo;
        sede.totalUsdSede += model.usdSede;
        sede.totalCopModelo += model.copModelo;
        sede.totalCopSede += model.copSede;

        // Agrupar por grupo dentro de la sede
        const groupId = model.groupId;
        if (!sede.groups.has(groupId)) {
          sede.groups.set(groupId, {
            groupId,
            groupName: model.groupName || 'Sin Grupo',
            models: [],
            totalModels: 0,
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalUsdSede: 0,
            totalCopModelo: 0,
            totalCopSede: 0
          });
        }

        const group = sede.groups.get(groupId);
        group.models.push(model);
        group.totalModels += 1;
        group.totalUsdBruto += model.usdBruto;
        group.totalUsdModelo += model.usdModelo;
        group.totalUsdSede += model.usdSede;
        group.totalCopModelo += model.copModelo;
        group.totalCopSede += model.copSede;
      });

      // Convertir Map a Array
      groupedData = Array.from(sedeGroups.values()).map(sede => ({
        ...sede,
        groups: Array.from(sede.groups.values())
      }));
    }

    console.log('✅ [BILLING-SUMMARY] Resumen generado:', { 
      models: billingData.length, 
      summary,
      groupedData: groupedData?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: billingData,
      summary,
      groupedData, // Solo para Super Admin
      periodDate,
      sedeId: sedeId || 'all',
      adminRole: adminUser.role
    });

  } catch (error: any) {
    console.error('❌ [BILLING-SUMMARY] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

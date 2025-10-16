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

    // 3. Determinar si el período está cerrado o activo
    const d = new Date(periodDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    const day = d.getDate();
    const firstHalf = day >= 1 && day <= 15;
    const startStr = `${y}-${String(m + 1).padStart(2,'0')}-${firstHalf ? '01' : '16'}`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const endStr = `${y}-${String(m + 1).padStart(2,'0')}-${firstHalf ? '15' : String(lastDay).padStart(2,'0')}`;
    const periodType = firstHalf ? '1-15' : '16-31';

    console.log('🔍 [BILLING-SUMMARY] Rango de búsqueda:', { startStr, endStr, periodType });

    // 3.1. Verificar si el período está cerrado (datos en calculator_history)
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id, value, period_date, period_type')
      .in('model_id', modelIds)
      .gte('period_date', startStr)
      .lte('period_date', endStr)
      .eq('period_type', periodType);

    if (historyError) {
      console.error('❌ [BILLING-SUMMARY] Error al verificar historial:', historyError);
    }

    const isPeriodClosed = historyData && historyData.length > 0;
    console.log('🔍 [BILLING-SUMMARY] Período cerrado:', isPeriodClosed, 'Registros en historial:', historyData?.length || 0);

    let totals: any[] = [];

    if (isPeriodClosed) {
      // 3.2. Si el período está cerrado, obtener datos de calculator_history
      console.log('📚 [BILLING-SUMMARY] Obteniendo datos de calculator_history (período cerrado)');
      
      // Agrupar datos del historial por modelo y calcular totales
      const historyMap = new Map();
      historyData?.forEach(item => {
        if (!historyMap.has(item.model_id)) {
          historyMap.set(item.model_id, {
            model_id: item.model_id,
            total_usd_bruto: 0,
            total_usd_modelo: 0,
            total_cop_modelo: 0,
            period_date: item.period_date
          });
        }
        
        const modelData = historyMap.get(item.model_id);
        
        // Si es el total USD modelo, usar ese valor
        if (item.platform_id === '_total_usd_modelo') {
          modelData.total_usd_modelo = item.value || 0;
        } else {
          // Sumar valores de plataformas individuales para USD bruto
          modelData.total_usd_bruto += item.value || 0;
        }
      });

      // Convertir mapa a array
      totals = Array.from(historyMap.values());
      
      // Calcular USD bruto si no está disponible (sumar plataformas individuales)
      totals.forEach(total => {
        if (total.total_usd_bruto === 0 && total.total_usd_modelo > 0) {
          // Si no hay USD bruto calculado, estimar basado en USD modelo
          total.total_usd_bruto = total.total_usd_modelo * 1.4; // Estimación conservadora
        }
        total.total_cop_modelo = total.total_usd_modelo * 3900; // Tasa estimada
      });

      console.log('📚 [BILLING-SUMMARY] Datos procesados del historial:', totals.length, 'modelos');
    } else {
      // 3.3. Si el período está activo, obtener datos de calculator_totals
      console.log('📊 [BILLING-SUMMARY] Obteniendo datos de calculator_totals (período activo)');
      
      const { data: totalsData, error: totalsError } = await supabase
        .from('calculator_totals')
        .select('*')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr);

      if (totalsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener totales:', totalsError);
        return NextResponse.json({ success: false, error: 'Error al obtener totales' }, { status: 500 });
      }

      totals = totalsData || [];
      console.log('📊 [BILLING-SUMMARY] Datos obtenidos de calculator_totals:', totals.length, 'modelos');
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

    // 5. Consolidar datos por modelo
    const billingData = models.map(model => {
      const totalsForModel = (totals || []).filter(t => t.model_id === model.id);
      const modelGroup = modelGroupsMap.get(model.id);
      
      // 🔧 CORRECCIÓN: Si el modelo no tiene organization_id, usar el del grupo
      const effectiveOrganizationId = model.organization_id || modelGroup?.organization_id || null;
      
      // Log cuando se aplique la corrección
      if (!model.organization_id && modelGroup?.organization_id) {
        console.log(`🔧 [BILLING-SUMMARY] Corrigiendo organizationId para modelo ${model.email}: null → ${modelGroup.organization_id} (grupo: ${modelGroup.name})`);
      }
      
      if (!totalsForModel || totalsForModel.length === 0) {
        // Si no hay totales, retornar ceros
        return {
          modelId: model.id,
          email: model.email.split('@')[0], // Solo parte antes del '@'
          name: model.name,
          organizationId: effectiveOrganizationId,
          groupId: modelGroup?.id,
          groupName: modelGroup?.name,
          usdBruto: 0,
          usdModelo: 0,
          usdSede: 0,
          copModelo: 0,
          copSede: 0
        };
      }

      // Para períodos cerrados, ya tenemos los totales calculados
      // Para períodos activos, sumar múltiples registros si existen
      const usdBruto = totalsForModel.reduce((s, t) => s + (t.total_usd_bruto || 0), 0);
      const usdModelo = totalsForModel.reduce((s, t) => s + (t.total_usd_modelo || 0), 0);
      const usdSede = usdBruto - usdModelo; // USD Sede = USD Bruto - USD Modelo
      const copModelo = usdModelo * usdCopRateValue;
      const copSede = usdSede * usdCopRateValue;

      console.log(`📊 [BILLING-SUMMARY] Modelo ${model.email}: USD Bruto=${usdBruto}, USD Modelo=${usdModelo}, Fuente=${isPeriodClosed ? 'calculator_history' : 'calculator_totals'}`);

      return {
        modelId: model.id,
        email: model.email.split('@')[0], // Solo parte antes del '@'
        name: model.name,
        organizationId: effectiveOrganizationId,
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
      groupedData: groupedData?.length || 0,
      dataSource: isPeriodClosed ? 'calculator_history (período cerrado)' : 'calculator_totals (período activo)',
      periodType,
      periodRange: `${startStr} - ${endStr}`
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

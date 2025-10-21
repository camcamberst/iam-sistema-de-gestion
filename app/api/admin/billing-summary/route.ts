import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = supabaseServer;

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

    // 1. Verificar permisos del admin y obtener sus grupos
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select(`
        role,
        user_groups(
          groups!inner(
            id,
            name
          )
        )
      `)
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

    // Obtener grupos del admin
    const adminGroups = adminUser.user_groups?.map((ug: any) => ug.groups.id) || [];
    console.log('🔍 [BILLING-SUMMARY] Admin groups:', adminGroups);
    console.log('🔍 [BILLING-SUMMARY] User role:', adminUser.role);
    console.log('🔍 [BILLING-SUMMARY] Is Super Admin:', isSuperAdmin);
    console.log('🔍 [BILLING-SUMMARY] Is Admin:', isAdmin);

    // 2. Obtener modelos según permisos
    let modelsQuery = supabase
      .from('users')
      .select(`
        id, 
        email, 
        name
      `)
      .eq('role', 'modelo')
      .eq('is_active', true);

    // Si es admin (no super_admin), filtrar por sus grupos asignados
    if (isAdmin && !isSuperAdmin && adminGroups.length > 0) {
      console.log('🔍 [BILLING-SUMMARY] Aplicando filtros de admin para grupos:', adminGroups);
      // Obtener modelos que pertenecen a los grupos del admin
      const { data: modelGroups, error: modelGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', adminGroups);

      if (modelGroupsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener grupos de modelos:', modelGroupsError);
        return NextResponse.json({ success: false, error: 'Error al obtener modelos' }, { status: 500 });
      }

      const modelIds = modelGroups?.map(mg => mg.user_id) || [];
      if (modelIds.length === 0) {
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

      modelsQuery = modelsQuery.in('id', modelIds);
    }

    // Si se especifica una sede específica, filtrar por ella (usando grupos)
    if (sedeId) {
      const { data: sedeGroups, error: sedeGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', sedeId);

      if (sedeGroupsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener grupos de sede:', sedeGroupsError);
        return NextResponse.json({ success: false, error: 'Error al obtener grupos de sede' }, { status: 500 });
      }

      const sedeModelIds = sedeGroups?.map(sg => sg.user_id) || [];
      if (sedeModelIds.length === 0) {
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

      modelsQuery = modelsQuery.in('id', sedeModelIds);
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

    // 3.1. Obtener datos de calculator_history (período cerrado)
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

    // 3.2. Obtener datos de calculator_totals (período activo) - buscar en rango más amplio
    const { data: totalsData, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .in('model_id', modelIds)
      .gte('period_date', startStr)
      .lte('period_date', endStr)
      .order('period_date', { ascending: false });

    if (totalsError) {
      console.error('❌ [BILLING-SUMMARY] Error al obtener totales:', totalsError);
    }

    console.log('🔍 [BILLING-SUMMARY] Datos encontrados:', {
      historyRecords: historyData?.length || 0,
      totalsRecords: totalsData?.length || 0,
      historyModels: historyData ? Array.from(new Set(historyData.map(h => h.model_id))) : [],
      totalsModels: totalsData ? Array.from(new Set(totalsData.map(t => t.model_id))) : [],
      timestamp: new Date().toISOString()
    });

    // 3.3. Procesar datos del historial (período cerrado)
    const historyMap = new Map();
    if (historyData && historyData.length > 0) {
      console.log('📚 [BILLING-SUMMARY] Procesando datos de calculator_history');
      
      historyData.forEach(item => {
        if (!historyMap.has(item.model_id)) {
          historyMap.set(item.model_id, {
            model_id: item.model_id,
            total_usd_bruto: 0,
            total_usd_modelo: 0,
            total_cop_modelo: 0,
            period_date: item.period_date,
            dataSource: 'calculator_history'
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

      // Calcular USD bruto si no está disponible
      historyMap.forEach((modelData, modelId) => {
        if (modelData.total_usd_bruto === 0 && modelData.total_usd_modelo > 0) {
          modelData.total_usd_bruto = modelData.total_usd_modelo * 1.4; // Estimación conservadora
        }
        modelData.total_cop_modelo = modelData.total_usd_modelo * 3900; // Tasa estimada
      });
    }

    // 3.4. Procesar datos de calculator_totals (período activo) para modelos sin datos en historial
    const totalsMap = new Map();
    if (totalsData && totalsData.length > 0) {
      console.log('📊 [BILLING-SUMMARY] Procesando datos de calculator_totals');
      
      totalsData.forEach(item => {
        // Solo agregar si no tiene datos en historial
        if (!historyMap.has(item.model_id)) {
          totalsMap.set(item.model_id, {
            model_id: item.model_id,
            total_usd_bruto: item.total_usd_bruto || 0,
            total_usd_modelo: item.total_usd_modelo || 0,
            total_cop_modelo: item.total_cop_modelo || 0,
            period_date: item.period_date,
            dataSource: 'calculator_totals'
          });
        }
      });
    }

    // 3.5. Combinar ambos mapas - Fixed TypeScript compatibility
    const allTotalsMap = new Map();
    historyMap.forEach((value, key) => allTotalsMap.set(key, value));
    totalsMap.forEach((value, key) => allTotalsMap.set(key, value));
    const totals = Array.from(allTotalsMap.values());

    console.log('📊 [BILLING-SUMMARY] Datos finales:', {
      totalModels: totals.length,
      fromHistory: Array.from(historyMap.keys()).length,
      fromTotals: Array.from(totalsMap.keys()).length
    });

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
      
      if (!totalsForModel || totalsForModel.length === 0) {
        // Si no hay totales, retornar ceros
        return {
          modelId: model.id,
          email: model.email.split('@')[0], // Solo parte antes del '@'
          name: model.name,
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

      const dataSource = totalsForModel[0]?.dataSource || 'unknown';
      console.log(`📊 [BILLING-SUMMARY] Modelo ${model.email}: USD Bruto=${usdBruto}, USD Modelo=${usdModelo}, Fuente=${dataSource}`);

      return {
        modelId: model.id,
        email: model.email.split('@')[0], // Solo parte antes del '@'
        name: model.name,
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

    // 7. Para Super Admin: Agrupar por grupos (sedes)
    let groupedData = null;
    if (isSuperAdmin) {
      // Obtener información de grupos
      const uniqueGroupIds = Array.from(new Set(billingData.map(m => m.groupId).filter(Boolean)));
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', uniqueGroupIds);

      if (groupsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener grupos:', groupsError);
      }

      // Agrupar por grupo (sede)
      const groupMap = new Map();
      billingData.forEach(model => {
        const groupId = model.groupId;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            groupId,
            groupName: groups?.find(g => g.id === groupId)?.name || 'Grupo Desconocido',
            models: [],
            totalModels: 0,
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalUsdSede: 0,
            totalCopModelo: 0,
            totalCopSede: 0
          });
        }

        const group = groupMap.get(groupId);
        group.models.push(model);
        group.totalModels += 1;
        group.totalUsdBruto += model.usdBruto;
        group.totalUsdModelo += model.usdModelo;
        group.totalUsdSede += model.usdSede;
        group.totalCopModelo += model.copModelo;
        group.totalCopSede += model.copSede;
      });

      // Convertir Map a Array
      groupedData = Array.from(groupMap.values());
    }

    console.log('✅ [BILLING-SUMMARY] Resumen generado:', { 
      models: billingData.length, 
      summary,
      groupedData: groupedData?.length || 0,
      dataSource: 'mixed (calculator_history + calculator_totals)',
      periodType,
      periodRange: `${startStr} - ${endStr}`,
      historyModels: Array.from(historyMap.keys()).length,
      totalsModels: Array.from(totalsMap.keys()).length
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

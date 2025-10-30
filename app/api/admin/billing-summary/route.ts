import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';

// Usar service role key para bypass RLS
const supabase = supabaseServer;

// GET: Obtener resumen de facturación por sede
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sedeId = searchParams.get('sedeId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();
  const adminId = searchParams.get('adminId');
  const emailsParam = searchParams.get('emails'); // opcional: depurar modelos por email

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [BILLING-SUMMARY] Obteniendo resumen:', { sedeId, periodDate, adminId, emailsParam });

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

    // Obtener grupos del admin (solo para admin, no para super_admin)
    const adminGroups = isSuperAdmin ? [] : (adminUser.user_groups?.map((ug: any) => ug.groups.id) || []);
    console.log('🔍 [BILLING-SUMMARY] Admin groups:', adminGroups);
    console.log('🔍 [BILLING-SUMMARY] User role:', adminUser.role);
    console.log('🔍 [BILLING-SUMMARY] Is Super Admin:', isSuperAdmin);
    console.log('🔍 [BILLING-SUMMARY] Is Admin:', isAdmin);

    // 2. Obtener modelos según permisos (sin filtrar por is_active para no excluir datos válidos)
    let modelsQuery = supabase
      .from('users')
      .select(`
        id, 
        email, 
        name
      `)
      .eq('role', 'modelo');

    // Depuración opcional: limitar por emails especificados
    if (emailsParam) {
      const emailList = emailsParam.split(',').map(e => e.trim().toLowerCase());
      if (emailList.length > 0) {
        modelsQuery = modelsQuery.in('email', emailList);
        console.log('🔎 [BILLING-SUMMARY] Filtrando por emails:', emailList);
      }
    }

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

    // Si se especifica una sede (o varias separadas por coma), aceptar IDs o nombres
    if (sedeId) {
      const rawTokens = sedeId.split(',').map(s => s.trim()).filter(Boolean);
      // 1) Buscar grupos por ID exacto (para tokens con formato UUID o id válido)
      let groupsById: any[] = [];
      try {
        const { data: gById } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', rawTokens);
        groupsById = gById || [];
      } catch {}

      // 2) Buscar por nombre (ilike con comodines), uno por uno para soportar coincidencia flexible
      const groupsByName: any[] = [];
      for (const token of rawTokens) {
        try {
          const { data: gByName } = await supabase
            .from('groups')
            .select('id, name')
            .ilike('name', `%${token}%`);
          if (gByName && gByName.length > 0) groupsByName.push(...gByName);
        } catch {}
      }

      const uniqueGroupIds = Array.from(new Set([...groupsById, ...groupsByName].map(g => g.id)));
      console.log('🔎 [BILLING-SUMMARY] Sedes solicitadas:', rawTokens, '→ groupIds:', uniqueGroupIds);

      if (uniqueGroupIds.length === 0) {
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

      const { data: sedeGroups, error: sedeGroupsError } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', uniqueGroupIds);

      if (sedeGroupsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener grupos de sede:', sedeGroupsError);
        return NextResponse.json({ success: false, error: 'Error al obtener grupos de sede' }, { status: 500 });
      }

      const sedeModelIds = sedeGroups?.map(sg => sg.user_id) || [];
      console.log('🔎 [BILLING-SUMMARY] Modelos en sedes:', sedeModelIds.length);
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

    // 3. Calcular rango de quincena basado en periodDate (1-15 ó 16-fin de mes)
    const baseDate = new Date(periodDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-based
    const day = baseDate.getDate();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const quinStartStr = day <= 15
      ? `${year}-${String(month + 1).padStart(2, '0')}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-16`;
    const quinEndStr = day <= 15
      ? `${year}-${String(month + 1).padStart(2, '0')}-15`
      : `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Determinar si el período está activo según hoy dentro del rango
    const todayStr = new Date().toISOString().split('T')[0];
    const isActivePeriod = todayStr >= quinStartStr && todayStr <= quinEndStr;
    const startStr = quinStartStr;
    const endStr = quinEndStr;

    const periodType = isActivePeriod ? 'active' : 'closed';

    console.log('🔍 [BILLING-SUMMARY] Rango de búsqueda:', { 
      originalStart: startStr, 
      originalEnd: endStr, 
      extendedStart: extendedStartStr, 
      extendedEnd: finalEndStr, 
      periodType, 
      isActivePeriod,
      today: todayStr 
    });

    // 3.4. Obtener datos según el estado del período (igual que Mi Calculadora)
    let historyData = null;
    let totalsData = null;
    
    if (isActivePeriod) {
      // Período activo: usar EXCLUSIVAMENTE calculator_totals dentro del rango exacto de quincena
      console.log('🔍 [BILLING-SUMMARY] Período activo - consultando calculator_totals (rango exacto quincena)');
      const { data: totals, error: totalsError } = await supabase
        .from('calculator_totals')
        .select('*')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .order('period_date', { ascending: false });

      if (totalsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener totales:', totalsError);
      } else {
        totalsData = totals;
      }
      historyData = [];
    } else {
      // Período cerrado: usar calculator_history
      console.log('🔍 [BILLING-SUMMARY] Período cerrado - consultando calculator_history (rango exacto quincena)');
      // Determinar period_type esperado según quincena
      const expectedType = endStr.endsWith('-15') ? 'period-1' : 'period-2';
      const { data: history, error: historyError } = await supabase
        .from('calculator_history')
        .select('model_id, platform_id, value, period_date, period_type')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .eq('period_type', expectedType);

      if (historyError) {
        console.error('❌ [BILLING-SUMMARY] Error al verificar historial:', historyError);
      } else {
        historyData = history;
      }
    }

    // Combinar datos (en activo: solo totals; en cerrado: solo history)
    const allTotalsData = [...(totalsData || [])];
    const uniqueTotalsData = allTotalsData.reduce((acc: any[], current: any) => {
      const existing = acc.find((item: any) => item.model_id === current.model_id);
      if (!existing || new Date(current.updated_at) > new Date(existing.updated_at)) {
        return acc.filter((item: any) => item.model_id !== current.model_id).concat([current]);
      }
      return acc;
    }, []);

    console.log('🔍 [BILLING-SUMMARY] Datos encontrados:', {
      historyRecords: historyData?.length || 0,
      totalsRecords: uniqueTotalsData?.length || 0,
      exactTotalsRecords: exactTotalsData?.length || 0,
      historyModels: historyData ? Array.from(new Set(historyData.map(h => h.model_id))) : [],
      totalsModels: uniqueTotalsData ? Array.from(new Set(uniqueTotalsData.map(t => t.model_id))) : [],
      timestamp: new Date().toISOString()
    });

    // Log dirigido por emails (si aplica)
    if (emailsParam) {
      try {
        const emailList = emailsParam.split(',').map(e => e.trim().toLowerCase());
        // Mapear email -> id
        const emailToId = new Map(models.map(m => [m.email.toLowerCase(), m.id]));
        const ids = emailList.map(e => emailToId.get(e)).filter(Boolean);
        const historyIds = new Set((historyData || []).map((h: any) => h.model_id));
        const totalsIds = new Set((uniqueTotalsData || []).map((t: any) => t.model_id));
        console.log('🔎 [BILLING-SUMMARY] Debug por emails:', {
          emails: emailList,
          ids,
          inHistory: ids.map(id => ({ id, has: historyIds.has(id) })),
          inTotals: ids.map(id => ({ id, has: totalsIds.has(id) })),
        });
      } catch (e) {
        console.log('⚠️ [BILLING-SUMMARY] Error en debug por emails:', e);
      }
    }

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
    if (uniqueTotalsData && uniqueTotalsData.length > 0) {
      console.log('📊 [BILLING-SUMMARY] Procesando datos de calculator_totals');
      
      uniqueTotalsData.forEach(item => {
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
    let totals = Array.from(allTotalsMap.values());

    // 3.6. Construir mapa de usuarios (todas las modelos filtradas arriba), para incluir también quienes tengan 0 en rango
    const userById = new Map(models.map((u: any) => [u.id, u]));

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

    // 5. Consolidar datos por modelo: incluir todas las modelos del set (cero si no hay datos en rango)
    const billingData = models.map(model => {
      const totalsForModel = (totals || []).filter(t => t.model_id === model.id);
      const modelGroup = modelGroupsMap.get(model.id);

      const usdBruto = totalsForModel.reduce((s, t) => s + (t.total_usd_bruto || 0), 0);
      const usdModelo = totalsForModel.reduce((s, t) => s + (t.total_usd_modelo || 0), 0);
      const usdSede = usdBruto - usdModelo;
      const copModelo = usdModelo * usdCopRateValue;
      const copSede = usdSede * usdCopRateValue;

      const dataSource = totalsForModel[0]?.dataSource || 'none';
      console.log(`📊 [BILLING-SUMMARY] Modelo ${model.email}: USD Bruto=${usdBruto}, USD Modelo=${usdModelo}, Fuente=${dataSource}`);

      return {
        modelId: model.id,
        email: model.email.split('@')[0],
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

    // 7. Agrupar datos por sedes/grupos
    let groupedData = null;
    console.log('🔍 [BILLING-SUMMARY] Condiciones para groupedData:', {
      isSuperAdmin,
      isAdmin,
      adminGroupsLength: adminGroups.length,
      shouldCreateGroupedData: isSuperAdmin || (isAdmin && adminGroups.length > 0)
    });
    
    if (isSuperAdmin || (isAdmin && adminGroups.length > 0)) {
      // Obtener información de grupos
      const uniqueGroupIds = Array.from(new Set(billingData.map(m => m.groupId).filter(Boolean)));
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', uniqueGroupIds);

      if (groupsError) {
        console.error('❌ [BILLING-SUMMARY] Error al obtener grupos:', groupsError);
      }

      if (isSuperAdmin) {
        // Para Super Admin: Agrupar todo bajo "Agencia Innova"
        const agenciaInnova: any = {
          sedeId: 'agencia-innova',
          sedeName: 'Agencia Innova',
          groups: [],
          models: [],
          totalModels: 0,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalUsdSede: 0,
          totalCopModelo: 0,
          totalCopSede: 0
        };

        // Agrupar modelos por grupo dentro de Agencia Innova
        const groupMap = new Map();
        billingData.forEach(model => {
          const groupId = model.groupId;
          
          // Crear o actualizar grupo dentro de Agencia Innova
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              groupId: groupId,
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

          // Acumular en Agencia Innova
          agenciaInnova.models.push(model);
          agenciaInnova.totalModels += 1;
          agenciaInnova.totalUsdBruto += model.usdBruto;
          agenciaInnova.totalUsdModelo += model.usdModelo;
          agenciaInnova.totalUsdSede += model.usdSede;
          agenciaInnova.totalCopModelo += model.copModelo;
          agenciaInnova.totalCopSede += model.copSede;
        });

        // Agregar todos los grupos a Agencia Innova
        agenciaInnova.groups = Array.from(groupMap.values());

        // Retornar solo Agencia Innova como sede principal
        groupedData = [agenciaInnova];
      } else if (isAdmin && adminGroups.length > 0) {
        // Para Admin: Crear sedes individuales solo para las asignadas
        console.log('🔍 [BILLING-SUMMARY] Creando sedes individuales para admin');
        console.log('🔍 [BILLING-SUMMARY] Admin groups:', adminGroups);
        console.log('🔍 [BILLING-SUMMARY] Billing data models:', billingData.length);
        
        const sedeMap = new Map();
        
        billingData.forEach(model => {
          const groupId = model.groupId;
          console.log('🔍 [BILLING-SUMMARY] Procesando modelo:', model.email, 'grupo:', groupId);
          
          // Solo procesar si el grupo está asignado al admin
          if (adminGroups.includes(groupId)) {
            console.log('🔍 [BILLING-SUMMARY] Grupo asignado al admin, agregando modelo');
            if (!sedeMap.has(groupId)) {
              sedeMap.set(groupId, {
                sedeId: groupId,
                sedeName: groups?.find(g => g.id === groupId)?.name || 'Grupo Desconocido',
                groups: [],
                models: [],
                totalModels: 0,
                totalUsdBruto: 0,
                totalUsdModelo: 0,
                totalUsdSede: 0,
                totalCopModelo: 0,
                totalCopSede: 0
              });
            }

            const sede = sedeMap.get(groupId);
            sede.models.push(model);
            sede.totalModels += 1;
            sede.totalUsdBruto += model.usdBruto;
            sede.totalUsdModelo += model.usdModelo;
            sede.totalUsdSede += model.usdSede;
            sede.totalCopModelo += model.copModelo;
            sede.totalCopSede += model.copSede;
          }
        });

        // Convertir Map a Array
        groupedData = Array.from(sedeMap.values());
        console.log('🔍 [BILLING-SUMMARY] Sedes creadas para admin:', groupedData.length);
        console.log('🔍 [BILLING-SUMMARY] Sedes:', groupedData.map(s => ({ id: s.sedeId, name: s.sedeName, models: s.totalModels })));
      }
    }

    console.log('✅ [BILLING-SUMMARY] Resumen generado:', { 
      models: billingData.length, 
      summary,
      groupedData: groupedData?.length || 0,
      isSuperAdmin,
      isAdmin,
      adminGroups,
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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';
import { calculateAffiliateBilling } from '@/lib/affiliates/billing';
import { addAffiliateFilter, type AuthUser } from '@/lib/affiliates/filters';

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
        affiliate_studio_id,
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
    const isSuperadminAff = adminUser.role === 'superadmin_aff';

    if (!isSuperAdmin && !isAdmin && !isSuperadminAff) {
      return NextResponse.json({ success: false, error: 'No tienes permisos para ver este resumen' }, { status: 403 });
    }

    // Obtener grupos del admin (solo para admin, no para super_admin ni superadmin_aff)
    const adminGroups = (isSuperAdmin || isSuperadminAff) ? [] : (adminUser.user_groups?.map((ug: any) => ug.groups.id) || []);
    console.log('🔍 [BILLING-SUMMARY] Admin groups:', adminGroups);
    console.log('🔍 [BILLING-SUMMARY] User role:', adminUser.role);
    console.log('🔍 [BILLING-SUMMARY] Affiliate Studio ID:', adminUser.affiliate_studio_id);
    console.log('🔍 [BILLING-SUMMARY] Is Super Admin:', isSuperAdmin);
    console.log('🔍 [BILLING-SUMMARY] Is Admin:', isAdmin);
    console.log('🔍 [BILLING-SUMMARY] Is Superadmin AFF:', isSuperadminAff);

    // 2. Obtener modelos según permisos (solo modelos activos)
    let modelsQuery = supabase
      .from('users')
      .select(`
        id, 
        email, 
        name,
        affiliate_studio_id
      `)
      .eq('role', 'modelo')
      .eq('is_active', true);

    // Excluir AIM Botty explícitamente
    modelsQuery = modelsQuery.neq('id', AIM_BOTTY_ID).neq('email', AIM_BOTTY_EMAIL);

    // Aplicar filtro de afiliado si es superadmin_aff o admin de afiliado
    if (isSuperadminAff || (isAdmin && adminUser.affiliate_studio_id)) {
      const currentUser: AuthUser = {
        id: adminId,
        role: adminUser.role,
        affiliate_studio_id: adminUser.affiliate_studio_id
      };
      modelsQuery = addAffiliateFilter(modelsQuery, currentUser);
      console.log('🔍 [BILLING-SUMMARY] Aplicando filtro de afiliado para affiliate_studio_id:', adminUser.affiliate_studio_id);
    }

    // Depuración opcional: limitar por emails especificados
    if (emailsParam) {
      const emailList = emailsParam.split(',').map(e => e.trim().toLowerCase());
      if (emailList.length > 0) {
        modelsQuery = modelsQuery.in('email', emailList);
        console.log('🔎 [BILLING-SUMMARY] Filtrando por emails:', emailList);
      }
    }

    // Si es admin (no super_admin ni superadmin_aff), filtrar por sus grupos asignados
    if (isAdmin && !isSuperAdmin && !isSuperadminAff && adminGroups.length > 0) {
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

    // Determinar si el período está activo según hoy dentro del rango (usar hora Colombia)
    const todayStr = getColombiaDate();
    const isActivePeriod = todayStr >= quinStartStr && todayStr <= quinEndStr;
    const startStr = quinStartStr;
    const endStr = quinEndStr;

    const periodType = isActivePeriod ? 'active' : 'closed';

    console.log('🔍 [BILLING-SUMMARY] Rango de búsqueda:', { 
      originalStart: startStr, 
      originalEnd: endStr, 
      periodType, 
      isActivePeriod,
      today: todayStr 
    });

    // 3.4. Obtener datos según el estado del período (igual que Mi Calculadora)
    let historyData: any[] = [];
    let totalsData: any[] = [];
    
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
        // Agrupar totales por modelo_id, tomando el más reciente si hay múltiples
        const totalsByModel = new Map();
        if (totals && totals.length > 0) {
          totals.forEach(t => {
            const existing = totalsByModel.get(t.model_id);
            if (!existing || new Date(t.updated_at) > new Date(existing.updated_at)) {
              totalsByModel.set(t.model_id, t);
            }
          });
          totalsData = Array.from(totalsByModel.values());
        }
      }

      // 🔧 FIX: Si hay modelos con valores pero sin totales, intentar sincronizar
      const modelsWithValues = new Set<string>();
      const modelsWithTotals = new Set(totalsData?.map(t => t.model_id) || []);
      
      // Verificar qué modelos tienen valores pero no totales
      // Buscar valores en un rango más amplio para capturar todos los casos
      const { data: valuesCheck, error: valuesCheckError } = await supabase
        .from('model_values')
        .select('model_id, period_date, value, updated_at')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .gt('value', 0); // Solo valores mayores a 0

      if (!valuesCheckError && valuesCheck && valuesCheck.length > 0) {
        // Agrupar por modelo y verificar si tienen valores válidos
        const valuesByModel = new Map<string, any[]>();
        valuesCheck.forEach(v => {
          if (!valuesByModel.has(v.model_id)) {
            valuesByModel.set(v.model_id, []);
          }
          valuesByModel.get(v.model_id)!.push(v);
        });

        // Verificar modelos con valores pero sin totales
        valuesByModel.forEach((values, modelId) => {
          if (!modelsWithTotals.has(modelId) && values.some(v => v.value > 0)) {
            modelsWithValues.add(modelId);
          }
        });

        // Si hay modelos con valores pero sin totales, calcular totales directamente desde model_values
        if (modelsWithValues.size > 0) {
          console.log('⚠️ [BILLING-SUMMARY] Detectados modelos con valores pero sin totales:', Array.from(modelsWithValues));
          
          // Obtener valores de modelos faltantes y calcular totales
          const { data: missingValues, error: missingValuesError } = await supabase
            .from('model_values')
            .select(`
              *,
              platforms!inner(id, name, currency, percentage)
            `)
            .in('model_id', Array.from(modelsWithValues))
            .gte('period_date', startStr)
            .lte('period_date', endStr)
            .order('updated_at', { ascending: false });

          if (!missingValuesError && missingValues && missingValues.length > 0) {
            // Obtener tasas y configuraciones necesarias
            const { data: ratesData } = await supabase
              .from('rates')
              .select('kind, value')
              .eq('active', true)
              .is('valid_to', null)
              .order('valid_from', { ascending: false });

            let rates = { usd_cop: 3900, eur_usd: 1.01, gbp_usd: 1.20 };
            if (ratesData) {
              ratesData.forEach(rate => {
                if (rate.kind === 'USD→COP') rates.usd_cop = rate.value;
                if (rate.kind === 'EUR→USD') rates.eur_usd = rate.value;
                if (rate.kind === 'GBP→USD') rates.gbp_usd = rate.value;
              });
            }

            // Agrupar valores por modelo y calcular totales
            const totalsToInsert: any[] = [];
            const valuesByModel = new Map<string, any[]>();
            
            missingValues.forEach(mv => {
              if (!valuesByModel.has(mv.model_id)) {
                valuesByModel.set(mv.model_id, []);
              }
              valuesByModel.get(mv.model_id)!.push(mv);
            });

            // Calcular totales para cada modelo (lógica simplificada - usar la misma que Mi Calculadora)
            const modelIds = Array.from(valuesByModel.keys());
            for (let i = 0; i < modelIds.length; i++) {
              const modelId = modelIds[i];
              const modelValues = valuesByModel.get(modelId) || [];
              
              // Obtener configuración del modelo
              const { data: config } = await supabase
                .from('calculator_config')
                .select('percentage_override, group_percentage')
                .eq('model_id', modelId)
                .eq('active', true)
                .single();

              // Calcular totales (lógica simplificada - similar a Mi Calculadora)
              let totalUsdBruto = 0;
              const valuesByPlatform = new Map();
              
              modelValues.forEach(mv => {
                const platformId = mv.platform_id;
                if (!valuesByPlatform.has(platformId) || 
                    new Date(mv.updated_at) > new Date(valuesByPlatform.get(platformId)?.updated_at || 0)) {
                  valuesByPlatform.set(platformId, mv);
                }
              });

              const platformIds = Array.from(valuesByPlatform.keys());
              for (let j = 0; j < platformIds.length; j++) {
                const platformId = platformIds[j];
                const mv = valuesByPlatform.get(platformId);
                if (!mv) continue;
                
                const platform = mv.platforms;
                if (!platform || !mv.value || mv.value <= 0) continue;

                let usdBruto = 0;
                if (platform.currency === 'EUR') {
                  if (platformId === 'big7') usdBruto = (mv.value * rates.eur_usd) * 0.84;
                  else if (platformId === 'mondo') usdBruto = (mv.value * rates.eur_usd) * 0.78;
                  else usdBruto = mv.value * rates.eur_usd;
                } else if (platform.currency === 'GBP') {
                  if (platformId === 'aw') usdBruto = (mv.value * rates.gbp_usd) * 0.677;
                  else usdBruto = mv.value * rates.gbp_usd;
                } else if (platform.currency === 'USD') {
                  if (['cmd', 'camlust', 'skypvt'].includes(platformId)) usdBruto = mv.value * 0.75;
                  else if (['chaturbate', 'myfreecams', 'stripchat'].includes(platformId)) usdBruto = mv.value * 0.05;
                  else if (platformId === 'dxlive') usdBruto = mv.value * 0.60;
                  else if (platformId === 'secretfriends') usdBruto = mv.value * 0.5;
                  else usdBruto = mv.value;
                }
                totalUsdBruto += usdBruto;
              }

              const modelPercentage = config?.percentage_override || config?.group_percentage || 70;
              const totalUsdModelo = totalUsdBruto * (modelPercentage / 100);
              const totalCopModelo = totalUsdModelo * rates.usd_cop;

              totalsToInsert.push({
                model_id: modelId,
                period_date: todayStr,
                total_usd_bruto: Math.round(totalUsdBruto * 100) / 100,
                total_usd_modelo: Math.round(totalUsdModelo * 100) / 100,
                total_cop_modelo: Math.round(totalCopModelo),
                updated_at: new Date().toISOString()
              });
            }

            // Insertar totales calculados
            if (totalsToInsert.length > 0) {
              const { data: insertedTotals, error: insertError } = await supabase
                .from('calculator_totals')
                .upsert(totalsToInsert, { onConflict: 'model_id,period_date' })
                .select();

              if (!insertError && insertedTotals) {
                // Agregar los nuevos totales a totalsData
                totalsData = [...(totalsData || []), ...insertedTotals];
                console.log(`✅ [BILLING-SUMMARY] Sincronizados ${insertedTotals.length} totales faltantes`);
              } else if (insertError) {
                console.error('❌ [BILLING-SUMMARY] Error insertando totales:', insertError);
              }
            }
          }
        }
      }

      historyData = [];
    } else {
      // Período cerrado: usar calculator_history
      console.log('🔍 [BILLING-SUMMARY] Período cerrado - consultando calculator_history (rango exacto quincena)');
      // Determinar period_type esperado según quincena (usar formato '1-15' o '16-31' como se guarda en BD)
      const expectedType = endStr.endsWith('-15') ? '1-15' : '16-31';
      console.log('🔍 [BILLING-SUMMARY] Buscando period_type:', expectedType, 'para rango:', { startStr, endStr });
      const { data: history, error: historyError } = await supabase
        .from('calculator_history')
        .select('model_id, platform_id, value, value_usd_bruto, value_usd_modelo, value_cop_modelo, period_date, period_type')
        .in('model_id', modelIds)
        .gte('period_date', startStr)
        .lte('period_date', endStr)
        .eq('period_type', expectedType);

      if (historyError) {
        console.error('❌ [BILLING-SUMMARY] Error al verificar historial:', historyError);
      } else {
        historyData = history;
      }

      // ⚠️ RECONSTRUCCIÓN DE EMERGENCIA: Si calculator_history está vacío, intentar reconstruir desde calculator_totals
      // NOTA: Esta es SOLO una medida de contingencia. El sistema debe generar el archivo completo en calculator_history
      // durante el cierre normal. La reconstrucción desde calculator_totals solo proporciona totales consolidados,
      // sin el detalle por plataforma que debería estar en calculator_history.
      // Si esto se activa, indica que el proceso de cierre falló y debe investigarse.
      if (!historyData || historyData.length === 0) {
        console.log('⚠️ [BILLING-SUMMARY] calculator_history vacío para período cerrado. Intentando reconstruir desde calculator_totals...');
        
        // Buscar en calculator_totals para el rango del período (también buscar en 2024 por si hubo error de año)
        const { data: totals2025, error: totalsError2025 } = await supabase
          .from('calculator_totals')
          .select('model_id, period_date, total_usd_bruto, total_usd_modelo, total_cop_modelo, updated_at')
          .in('model_id', modelIds)
          .gte('period_date', startStr)
          .lte('period_date', endStr)
          .order('period_date', { ascending: false });

        // También buscar en 2024 por si hubo error de año (como ocurrió en el pasado)
        const [yearStr, monthStr] = startStr.split('-');
        const year2024 = parseInt(yearStr) - 1;
        const startStr2024 = `${year2024}-${monthStr}-${startStr.split('-')[2]}`;
        const endStr2024 = `${year2024}-${monthStr}-${endStr.split('-')[2]}`;
        
        const { data: totals2024, error: totalsError2024 } = await supabase
          .from('calculator_totals')
          .select('model_id, period_date, total_usd_bruto, total_usd_modelo, total_cop_modelo, updated_at')
          .in('model_id', modelIds)
          .gte('period_date', startStr2024)
          .lte('period_date', endStr2024)
          .order('period_date', { ascending: false });

        if (totalsError2025) {
          console.error('❌ [BILLING-SUMMARY] Error buscando totals 2025:', totalsError2025);
        }
        if (totalsError2024) {
          console.error('❌ [BILLING-SUMMARY] Error buscando totals 2024:', totalsError2024);
        }

        // Combinar resultados (priorizar 2025, pero incluir 2024 si existe)
        const allTotals = [...(totals2025 || []), ...(totals2024 || [])];
        
        if (allTotals && allTotals.length > 0) {
          console.warn(`⚠️ [BILLING-SUMMARY] RECONSTRUCCIÓN DE EMERGENCIA ACTIVADA`);
          console.warn(`   El período ${expectedType} (${startStr} a ${endStr}) no tiene datos en calculator_history`);
          console.warn(`   Esto indica que el proceso de cierre falló. Reconstruyendo desde calculator_totals...`);
          console.warn(`   NOTA: Los datos reconstruidos solo incluyen totales consolidados, sin detalle por plataforma`);
          console.log(`✅ [BILLING-SUMMARY] Reconstruyendo desde calculator_totals: ${allTotals.length} registros encontrados`);
          
          // Agrupar por model_id y tomar el más reciente (por updated_at)
          const totalsByModel = new Map();
          for (const total of allTotals) {
            const existing = totalsByModel.get(total.model_id);
            if (!existing || new Date(total.updated_at) > new Date(existing.updated_at)) {
              // Si es de 2024, corregir el año a 2025
              const correctedPeriodDate = total.period_date.startsWith(year2024.toString()) 
                ? total.period_date.replace(year2024.toString(), yearStr)
                : total.period_date;
              
              totalsByModel.set(total.model_id, {
                ...total,
                period_date: correctedPeriodDate
              });
            }
          }

          // Convertir totals a formato compatible con historyData (solo para totales, sin detalle por plataforma)
          // Crear registros sintéticos que representen los totales consolidados
          const syntheticHistory: any[] = [];
          for (const [modelId, total] of Array.from(totalsByModel.entries())) {
            // Crear un registro sintético que represente el total consolidado
            // Nota: No tenemos detalle por plataforma, solo totales
            syntheticHistory.push({
              model_id: modelId,
              platform_id: '_consolidated', // Marcador especial para indicar que es consolidado
              value: 0, // No tenemos el valor original por plataforma
              value_usd_bruto: total.total_usd_bruto || 0,
              value_usd_modelo: total.total_usd_modelo || 0,
              value_cop_modelo: total.total_cop_modelo || 0,
              period_date: total.period_date,
              period_type: expectedType,
              _is_synthetic: true // Flag para identificar registros reconstruidos
            });
          }

          historyData = syntheticHistory;
          console.log(`✅ [BILLING-SUMMARY] Reconstrucción completada: ${syntheticHistory.length} modelos con totales consolidados`);
        } else {
          console.log('⚠️ [BILLING-SUMMARY] No se encontraron datos en calculator_totals para reconstruir');
        }
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

    // 3.2.5. Obtener tasa USD/COP actual (más reciente) - necesaria para cálculos de historial
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
      // No es crítico, usamos 3900 por defecto
    }

    const usdCopRateValue = usdCopRate?.value || 3900;

    // 3.3. Procesar datos del historial (período cerrado)
    // IMPORTANTE: Seguir la misma lógica que "Mi Historial" de "Mi Calculadora"
    // USD Bruto: Suma de todos los value_usd_bruto de todas las plataformas (sin repartición)
    // USD Modelo: USD Bruto × porcentaje de la modelo
    // USD Agencia: USD Bruto - USD Modelo
    const historyMap = new Map();
    if (historyData && historyData.length > 0) {
      // Verificar si hay registros sintéticos (reconstruidos desde calculator_totals)
      const hasSyntheticRecords = historyData.some((item: any) => item._is_synthetic);
      
      if (hasSyntheticRecords) {
        console.log('📚 [BILLING-SUMMARY] Procesando datos sintéticos reconstruidos desde calculator_totals');
        // Los registros sintéticos ya vienen con los totales consolidados, no necesitan sumarse por plataforma
        historyData.forEach((item: any) => {
          if (item._is_synthetic) {
            historyMap.set(item.model_id, {
              model_id: item.model_id,
              total_usd_bruto: item.value_usd_bruto || 0,
              total_usd_modelo: item.value_usd_modelo || 0,
              total_cop_modelo: item.value_cop_modelo || 0,
              period_date: item.period_date,
              dataSource: 'calculator_totals_reconstructed'
            });
          }
        });
      } else {
        console.log('📚 [BILLING-SUMMARY] Procesando datos de calculator_history (misma lógica que Mi Historial)');
        // Procesamiento normal: sumar por plataforma
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
          
          // USD Bruto: Sumar todos los value_usd_bruto de todas las plataformas (sin repartición)
          if (item.value_usd_bruto !== null && item.value_usd_bruto !== undefined) {
            modelData.total_usd_bruto += Number(item.value_usd_bruto) || 0;
          } else {
            // Fallback: Si no hay value_usd_bruto, usar el valor original (datos antiguos)
            // NOTA: Esto debería ser raro ya que los registros nuevos siempre tienen value_usd_bruto
            modelData.total_usd_bruto += Number(item.value) || 0;
          }
          
          // USD Modelo y COP Modelo: Sumar de los registros individuales
          if (item.value_usd_modelo !== null && item.value_usd_modelo !== undefined) {
            modelData.total_usd_modelo += Number(item.value_usd_modelo) || 0;
          }
          if (item.value_cop_modelo !== null && item.value_cop_modelo !== undefined) {
            modelData.total_cop_modelo += Number(item.value_cop_modelo) || 0;
          }
        });
        
        // Para registros normales, si no tienen value_usd_modelo calculado, calcularlo ahora
        // Obtener configuraciones de porcentaje por modelo (calculator_config)
        const modelIds = Array.from(historyMap.keys());
        const { data: modelConfigs, error: configError } = await supabase
          .from('calculator_config')
          .select('model_id, percentage_override, group_percentage')
          .in('model_id', modelIds);

        if (configError) {
          console.warn('⚠️ [BILLING-SUMMARY] Error obteniendo configuraciones de modelos:', configError);
        }

        const configMap = new Map((modelConfigs || []).map((c: any) => [c.model_id, c]));

        // Calcular USD Modelo y USD Agencia para cada modelo (solo si no están ya calculados)
        historyMap.forEach((modelData: any, modelId) => {
          // Si los totales ya están calculados (registros sintéticos o con value_usd_modelo), no recalcular
          if (modelData.total_usd_modelo > 0 || modelData.total_cop_modelo > 0) {
            console.log(`📊 [BILLING-SUMMARY] Modelo ${modelId}: Usando totales ya calculados (USD Modelo=${modelData.total_usd_modelo.toFixed(2)})`);
            return;
          }
          
          // Obtener porcentaje de la modelo (prioridad: percentage_override > group_percentage > 80% por defecto)
          const config = configMap.get(modelId);
          const modelPercentage = config?.percentage_override || config?.group_percentage || 80;
          
          // USD Modelo: USD Bruto × porcentaje de la modelo
          modelData.total_usd_modelo = modelData.total_usd_bruto * (modelPercentage / 100);
          
          // COP Modelo: USD Modelo × tasa USD_COP (obtener tasa del período si está disponible)
          // Por ahora usamos la tasa actual, pero idealmente deberíamos usar la tasa del período
          modelData.total_cop_modelo = modelData.total_usd_modelo * (usdCopRateValue || 3900);
          
          console.log(`📊 [BILLING-SUMMARY] Modelo ${modelId}: USD Bruto=${modelData.total_usd_bruto.toFixed(2)}, Porcentaje=${modelPercentage}%, USD Modelo=${modelData.total_usd_modelo.toFixed(2)}`);
        });
      }
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

        // Calcular facturación de afiliados (solo para super_admin)
        const affiliateBillingData: any[] = [];
        const { data: affiliateStudios } = await supabase
          .from('affiliate_studios')
          .select('id, name, commission_percentage')
          .eq('is_active', true);

        if (affiliateStudios && affiliateStudios.length > 0) {
          // Determinar período (P1 o P2)
          const periodType = day <= 15 ? 'P1' : 'P2';
          
          // Obtener tasa USD_COP actual
          const { data: rate } = await supabase
            .from('rates')
            .select('value')
            .eq('kind', 'USD→COP')
            .eq('active', true)
            .is('valid_to', null)
            .order('valid_from', { ascending: false })
            .limit(1)
            .single();

          const usdCopRate = rate?.value ? parseFloat(rate.value) : 3900;

          // Calcular facturación para cada afiliado
          for (const studio of affiliateStudios) {
            // Obtener modelos del afiliado
            const { data: affiliateModels, error: modelsError } = await supabase
              .from('users')
              .select('id, email, name')
              .eq('affiliate_studio_id', studio.id)
              .eq('role', 'modelo')
              .eq('is_active', true);

            if (modelsError || !affiliateModels || affiliateModels.length === 0) {
              continue;
            }

            const affiliateModelIds = affiliateModels.map(m => m.id);

            // Obtener grupos de los modelos del afiliado
            const { data: affiliateUserGroups, error: groupsError } = await supabase
              .from('user_groups')
              .select(`
                user_id,
                groups!inner(
                  id,
                  name
                )
              `)
              .in('user_id', affiliateModelIds);

            if (groupsError) {
              console.error('❌ [BILLING-SUMMARY] Error obteniendo grupos de afiliado:', groupsError);
            }

            // Crear mapa de grupos por modelo
            const affiliateModelGroupsMap = new Map();
            affiliateUserGroups?.forEach(ug => {
              if (ug.groups) {
                affiliateModelGroupsMap.set(ug.user_id, ug.groups);
              }
            });

            // Obtener datos de facturación de los modelos del afiliado (similar a billingData)
            let affiliateModelsBillingData: any[] = [];
            
            if (isActivePeriod) {
              // Período activo: usar calculator_totals
              // NOTA: No filtramos por affiliate_studio_id porque los registros de calculator_totals
              // no tienen ese campo asignado. Ya filtramos por los model_id del afiliado.
              const { data: affiliateTotals, error: totalsError } = await supabase
                .from('calculator_totals')
                .select('*')
                .in('model_id', affiliateModelIds)
                .gte('period_date', startStr)
                .lte('period_date', endStr)
                .order('period_date', { ascending: false });

              if (totalsError) {
                console.error('❌ [BILLING-SUMMARY] Error obteniendo totales de afiliado:', totalsError);
              } else {
                console.log('🔍 [BILLING-SUMMARY] Totales de afiliado encontrados:', affiliateTotals?.length || 0, 'para', affiliateModelIds.length, 'modelos');
              }

              // Agrupar totales por modelo_id, tomando el más reciente
              const totalsByModel = new Map();
              if (affiliateTotals && affiliateTotals.length > 0) {
                affiliateTotals.forEach(t => {
                  const existing = totalsByModel.get(t.model_id);
                  if (!existing || new Date(t.updated_at) > new Date(existing.updated_at)) {
                    totalsByModel.set(t.model_id, t);
                  }
                });
              }

              // Crear datos de facturación para todos los modelos del afiliado (incluso si no tienen totales)
              // LÓGICA AFILIADOS: Modelo 60%, Agencia Innova 10%, Estudio Afiliado 30%
              affiliateModelsBillingData = affiliateModels.map(model => {
                const modelTotal = totalsByModel.get(model.id);
                const modelGroup = affiliateModelGroupsMap.get(model.id);
                
                const usdBruto = parseFloat(modelTotal?.total_usd_bruto || 0);
                // Modelo recibe 60% del bruto (independiente de la comisión de Innova)
                const usdModelo = usdBruto * 0.60;
                // Estudio afiliado recibe 30% del bruto (diferencia después de modelo e Innova)
                const usdSede = usdBruto * 0.30;
                // Comisión para Innova: 10% del bruto (se calcula por separado)
                const commissionUsd = usdBruto * 0.10;
                
                const copModelo = usdModelo * usdCopRate;
                const copSede = usdSede * usdCopRate;
                const commissionCop = commissionUsd * usdCopRate;

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
                  copSede,
                  // Comisión para Innova (10%)
                  commissionUsd,
                  commissionCop
                };
              });
            } else {
              // Período cerrado: usar calculator_history
              // NOTA: No filtramos por affiliate_studio_id porque los registros de calculator_history
              // pueden no tener ese campo asignado. Ya filtramos por los model_id del afiliado.
              const expectedType = day <= 15 ? '1-15' : '16-31';
              const { data: affiliateHistory, error: historyError } = await supabase
                .from('calculator_history')
                .select('model_id, value_usd_bruto, value_usd_modelo')
                .in('model_id', affiliateModelIds)
                .gte('period_date', startStr)
                .lte('period_date', endStr)
                .eq('period_type', expectedType);

              if (historyError) {
                console.error('❌ [BILLING-SUMMARY] Error obteniendo historial de afiliado:', historyError);
              } else {
                console.log('🔍 [BILLING-SUMMARY] Historial de afiliado encontrado:', affiliateHistory?.length || 0, 'registros para', affiliateModelIds.length, 'modelos');
              }

              // Agrupar por modelo y sumar
              const historyByModel = new Map<string, { usd_bruto: number; usd_modelo: number }>();
              
              if (affiliateHistory && affiliateHistory.length > 0) {
                affiliateHistory.forEach(h => {
                  const existing = historyByModel.get(h.model_id);
                  if (existing) {
                    existing.usd_bruto += parseFloat(h.value_usd_bruto || 0);
                    existing.usd_modelo += parseFloat(h.value_usd_modelo || 0);
                  } else {
                    historyByModel.set(h.model_id, {
                      usd_bruto: parseFloat(h.value_usd_bruto || 0),
                      usd_modelo: parseFloat(h.value_usd_modelo || 0)
                    });
                  }
                });
              }

              // Crear datos de facturación para todos los modelos del afiliado (incluso si no tienen historial)
              // LÓGICA AFILIADOS: Modelo 60%, Agencia Innova 10%, Estudio Afiliado 30%
              affiliateModelsBillingData = affiliateModels.map(model => {
                const modelHistory = historyByModel.get(model.id) || { usd_bruto: 0, usd_modelo: 0 };
                const modelGroup = affiliateModelGroupsMap.get(model.id);
                
                const usdBruto = modelHistory.usd_bruto;
                // Modelo recibe 60% del bruto (independiente de la comisión de Innova)
                const usdModelo = usdBruto * 0.60;
                // Estudio afiliado recibe 30% del bruto (diferencia después de modelo e Innova)
                const usdSede = usdBruto * 0.30;
                // Comisión para Innova: 10% del bruto (se calcula por separado)
                const commissionUsd = usdBruto * 0.10;
                
                const copModelo = usdModelo * usdCopRate;
                const copSede = usdSede * usdCopRate;
                const commissionCop = commissionUsd * usdCopRate;

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
                  copSede,
                  // Comisión para Innova (10%)
                  commissionUsd,
                  commissionCop
                };
              });
            }

            // Calcular totales del afiliado según la lógica: Modelo 60%, Innova 10%, Estudio 30%
            const affiliateTotalUsdBruto = affiliateModelsBillingData.reduce((acc, m) => acc + m.usdBruto, 0);
            // Suma de lo que reciben las modelos (60% del bruto)
            const affiliateTotalUsdModelo = affiliateModelsBillingData.reduce((acc, m) => acc + m.usdModelo, 0);
            // Suma de lo que recibe el estudio afiliado (30% del bruto)
            const affiliateTotalUsdSede = affiliateModelsBillingData.reduce((acc, m) => acc + m.usdSede, 0);
            // Comisión total para Innova (10% del bruto)
            const totalCommissionUsd = affiliateModelsBillingData.reduce((acc, m) => acc + (m.commissionUsd || 0), 0);
            
            const affiliateTotalCopModelo = affiliateModelsBillingData.reduce((acc, m) => acc + m.copModelo, 0);
            const affiliateTotalCopSede = affiliateModelsBillingData.reduce((acc, m) => acc + m.copSede, 0);
            const totalCommissionCop = affiliateModelsBillingData.reduce((acc, m) => acc + (m.commissionCop || 0), 0);

            console.log('💰 [BILLING-SUMMARY] Totales del afiliado (60% modelo, 10% Innova, 30% estudio):', {
              studio: studio.name,
              totalUsdBruto: affiliateTotalUsdBruto,
              totalUsdModelo: affiliateTotalUsdModelo, // 60% para modelos
              totalUsdSede: affiliateTotalUsdSede, // 30% para estudio afiliado
              totalCommissionUsd: totalCommissionUsd, // 10% para Innova
              modelsCount: affiliateModelsBillingData.length
            });

            // Agrupar modelos por grupos dentro del afiliado
            const affiliateGroupMap = new Map();
            affiliateModelsBillingData.forEach(model => {
              const groupId = model.groupId;
              
              if (!affiliateGroupMap.has(groupId)) {
                affiliateGroupMap.set(groupId, {
                  groupId: groupId,
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

              const group = affiliateGroupMap.get(groupId);
              group.models.push(model);
              group.totalModels += 1;
              group.totalUsdBruto += model.usdBruto;
              group.totalUsdModelo += model.usdModelo;
              group.totalUsdSede += model.usdSede;
              group.totalCopModelo += model.copModelo;
              group.totalCopSede += model.copSede;
            });

            // Crear entrada de afiliado con grupos y modelos
            // LÓGICA: totalUsdModelo = 60% (para modelos), totalUsdSede = 10% (comisión Innova), 
            // totalUsdEstudio = 30% (para estudio afiliado)
            affiliateBillingData.push({
              sedeId: `affiliate-${studio.id}`,
              sedeName: `${studio.name} - Afiliado`,
              isAffiliate: true,
              affiliate_studio_id: studio.id,
              groups: Array.from(affiliateGroupMap.values()),
              models: affiliateModelsBillingData,
              totalModels: affiliateModelsBillingData.length,
              totalUsdBruto: affiliateTotalUsdBruto,
              totalUsdModelo: affiliateTotalUsdModelo, // 60% para modelos
              totalUsdSede: totalCommissionUsd, // 10% comisión para Innova
              totalUsdEstudio: affiliateTotalUsdSede, // 30% para estudio afiliado
              totalCopModelo: affiliateTotalCopModelo,
              totalCopSede: totalCommissionCop, // 10% comisión para Innova (COP)
              totalCopEstudio: affiliateTotalCopSede, // 30% para estudio afiliado (COP)
              commission_percentage: 10, // Fijo 10% para Innova
              sedes_count: affiliateGroupMap.size
            });
          }
        }

        // Actualizar summary y agenciaInnova para incluir comisiones de afiliados (10% del bruto de cada afiliado)
        const totalAffiliateCommissions = affiliateBillingData.reduce((acc, aff) => acc + aff.totalUsdSede, 0);
        const totalAffiliateCommissionsCop = affiliateBillingData.reduce((acc, aff) => acc + aff.totalCopSede, 0);
        
        console.log('📊 [BILLING-SUMMARY] Resumen de comisiones de afiliados:', {
          affiliateBillingDataCount: affiliateBillingData.length,
          totalAffiliateCommissions,
          totalAffiliateCommissionsCop,
          summaryBefore: {
            totalUsdSede: summary.totalUsdSede,
            totalCopSede: summary.totalCopSede
          },
          agenciaInnovaBefore: {
            totalUsdSede: agenciaInnova.totalUsdSede,
            totalCopSede: agenciaInnova.totalCopSede
          }
        });
        
        // Agregar comisiones al summary general
        summary.totalUsdSede += totalAffiliateCommissions;
        summary.totalCopSede += totalAffiliateCommissionsCop;
        
        // Agregar comisiones a Agencia Innova
        agenciaInnova.totalUsdSede += totalAffiliateCommissions;
        agenciaInnova.totalCopSede += totalAffiliateCommissionsCop;

        console.log('✅ [BILLING-SUMMARY] Comisiones agregadas a resumen:', {
          summaryAfter: {
            totalUsdSede: summary.totalUsdSede,
            totalCopSede: summary.totalCopSede
          },
          agenciaInnovaAfter: {
            totalUsdSede: agenciaInnova.totalUsdSede,
            totalCopSede: agenciaInnova.totalCopSede
          }
        });

        // Retornar Agencia Innova + Afiliados
        groupedData = [agenciaInnova, ...affiliateBillingData];
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

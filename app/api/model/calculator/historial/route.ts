import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente con service role para consultas a BD
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

/**
 * GET: Obtener historial de calculadora de un modelo
 * Consulta los períodos archivados desde calculator_history
 * VERIFICA AUTORIZACIÓN: Solo permite consultar datos propios
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'modelId es requerido'
      }, { status: 400 });
    }

    // 🔒 SEGURIDAD: Verificar que el usuario autenticado coincida con el modelId solicitado
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;
    let token: string | null = null;

    // Intentar obtener token del header Authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Verificar usuario autenticado si tenemos token
    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [CALCULATOR-HISTORIAL] Error verificando autenticación:', error);
      }
    }

    // 🔒 VERIFICACIÓN DE AUTORIZACIÓN ESTRICTA:
    // Las modelos SOLO pueden consultar sus propios datos
    // NO pueden ver datos de otras cuentas, incluso si modifican el modelId en la URL
    
    if (!authenticatedUserId) {
      // REQUERIR autenticación - sin token, denegar acceso
      return NextResponse.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Verificar el rol del usuario para aplicar reglas específicas
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isModel = userRole === 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // 🔒 REGLA ESTRICTA: Si es modelo, DEBE coincidir con el modelId solicitado
    if (isModel && authenticatedUserId !== modelId) {
      console.warn(`🚫 [CALCULATOR-HISTORIAL] Intento de acceso no autorizado: Usuario ${authenticatedUserId} intentó acceder a datos de ${modelId}`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo puedes consultar tu propio historial'
      }, { status: 403 });
    }

    // Admins y super_admins pueden ver cualquier historial (para soporte administrativo)
    // Pero si el usuario autenticado no es admin y no coincide con modelId, denegar
    if (!isAdmin && authenticatedUserId !== modelId) {
      console.warn(`🚫 [CALCULATOR-HISTORIAL] Intento de acceso no autorizado: Usuario ${authenticatedUserId} intentó acceder a datos de ${modelId}`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado para consultar este historial'
      }, { status: 403 });
    }

    // PASO 1: Obtener datos completos de calculator_history (incluyendo cálculos y tasas)
    // Buscar tanto en 2025 como en 2024 (por si hubo error de año)
    const { data: history2025, error: historyError2025 } = await supabase
      .from('calculator_history')
      .select('id, platform_id, value, period_date, period_type, archived_at, rate_eur_usd, rate_gbp_usd, rate_usd_cop, platform_percentage, value_usd_bruto, value_usd_modelo, value_cop_modelo')
      .eq('model_id', modelId)
      .gte('period_date', '2025-01-01')
      .order('period_date', { ascending: false });

    const { data: history2024Dec, error: historyError2024 } = await supabase
      .from('calculator_history')
      .select('id, platform_id, value, period_date, period_type, archived_at, rate_eur_usd, rate_gbp_usd, rate_usd_cop, platform_percentage, value_usd_bruto, value_usd_modelo, value_cop_modelo')
      .eq('model_id', modelId)
      .gte('period_date', '2024-12-01')
      .lte('period_date', '2024-12-15')
      .eq('period_type', '1-15')
      .order('period_date', { ascending: false });

    // Combinar y corregir años si es necesario
    const history2024Corrected = (history2024Dec || []).map((item: any) => ({
      ...item,
      period_date: item.period_date.replace('2024-', '2025-') // Corregir año a 2025
    }));

    const history = [
      ...(history2025 || []),
      ...history2024Corrected
    ];
    const historyError = historyError2025 || historyError2024;

    if (historyError) {
      console.error('❌ [CALCULATOR-HISTORIAL] Error obteniendo historial:', historyError);
      return NextResponse.json({
        success: false,
        error: 'Error al obtener historial'
      }, { status: 500 });
    }

    if (!history || history.length === 0) {
      return NextResponse.json({
        success: true,
        periods: [],
        total_periods: 0
      });
    }

    // PASO 2: Obtener información de plataformas por separado (consulta opcional, con fallback)
    const platformIds = Array.from(new Set((history || []).map((h: any) => h.platform_id).filter(Boolean)));
    let platformsMap: Map<string, { name: string; currency: string }> = new Map();
    
    if (platformIds.length > 0) {
      const { data: platformsData } = await supabase
        .from('calculator_platforms')
        .select('id, name, currency')
        .in('id', platformIds);
      
      // Crear mapa de plataformas para acceso rápido (fallback si falla la consulta)
      if (platformsData) {
        platformsData.forEach((p: any) => {
          platformsMap.set(p.id, {
            name: p.name || p.id,
            currency: p.currency || 'USD'
          });
        });
      }
    }

    // PASO 2.5: Obtener configuración del modelo (una sola vez) para porcentaje por defecto y cuota mínima
    let defaultModelPercentage = 80;
    let cuotaMinima = 470; // Valor por defecto
    const { data: modelConfig } = await supabase
      .from('calculator_config')
      .select('percentage_override, group_percentage, min_quota_override, group_min_quota')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();
    
    if (modelConfig) {
      defaultModelPercentage = modelConfig.percentage_override || modelConfig.group_percentage || 80;
      cuotaMinima = modelConfig.min_quota_override || modelConfig.group_min_quota || 470;
    }

    // Agrupar por período (period_date + period_type)
    const periodsMap = new Map<string, {
      period_date: string;
      period_type: string;
      archived_at: string;
      platforms: Array<{
        platform_id: string;
        platform_name: string;
        platform_currency: string;
        value: number;
      }>;
      total_value: number;
      total_usd_bruto: number;
      total_usd_modelo: number;
      total_cop_modelo: number;
      total_anticipos: number; 
      total_deducciones: number; // 🔧 NUEVO
      neto_pagar: number | null; // 🔧 Changed to null for initialization
      deducciones: Array<any>;   // 🔧 NUEVO
      rates: any;
    }>();

    // PASO 3: Procesar y agrupar datos con validaciones
    history.forEach((item: any) => {
      // Validar datos antes de procesar
      if (!item.period_date || !item.period_type || !item.platform_id) {
        console.warn('⚠️ [CALCULATOR-HISTORIAL] Registro con datos incompletos:', item);
        return; // Saltar este registro
      }

      const periodKey = `${item.period_date}-${item.period_type}`;
      const platformInfo = platformsMap.get(item.platform_id);
      
      // Convertir value de forma segura (manejar DECIMAL y null)
      const numValue = item.value != null ? Number(item.value) : 0;
      const safeValue = isNaN(numValue) ? 0 : numValue;
      
      if (!periodsMap.has(periodKey)) {
        periodsMap.set(periodKey, {
          period_date: item.period_date,
          period_type: item.period_type,
          archived_at: item.archived_at || new Date().toISOString(),
          platforms: [],
          total_value: 0,
          total_usd_bruto: 0,
          total_usd_modelo: 0,
          total_cop_modelo: 0,
          total_anticipos: 0, // Inicializar
          total_deducciones: 0, // 🔧 Inicializar
          neto_pagar: null,   // 🔧 Inicializar a null para indicar que aún no se ha calculado
          deducciones: [],    // 🔧 Inicializar
          // Tasas aplicadas al período (todos los items del período tienen las mismas tasas)
          rates: {
            eur_usd: item.rate_eur_usd || null,
            gbp_usd: item.rate_gbp_usd || null,
            usd_cop: item.rate_usd_cop || null
          }
        } as any); // Type assertion needed because TypeScript infers the type from the first set()
      }

      const period = periodsMap.get(periodKey)! as any; // Type assertion needed for new fields
      
      // IMPORTANTE: Actualizar las tasas del período si el item actual tiene tasas no-null
      // Esto asegura que si algún registro del período fue actualizado, las tasas del período se actualicen
      if (item.rate_eur_usd != null || item.rate_gbp_usd != null || item.rate_usd_cop != null) {
        period.rates = {
          eur_usd: item.rate_eur_usd ?? period.rates?.eur_usd ?? null,
          gbp_usd: item.rate_gbp_usd ?? period.rates?.gbp_usd ?? null,
          usd_cop: item.rate_usd_cop ?? period.rates?.usd_cop ?? null
        };
      }
      
      // Obtener tasas del período (priorizar las del item actual, luego las del período, luego valores por defecto)
      const rates = {
        eur_usd: item.rate_eur_usd ?? period.rates?.eur_usd ?? 1.01,
        gbp_usd: item.rate_gbp_usd ?? period.rates?.gbp_usd ?? 1.20,
        usd_cop: item.rate_usd_cop ?? period.rates?.usd_cop ?? 3900
      };
      
      // Función para calcular USD bruto (misma lógica que en period-closure-helpers y Mi Calculadora)
      const calculateUsdBruto = (value: number, platformId: string, currency: string, rates: any): number => {
        const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (currency === 'EUR') {
          if (normalizedId === 'big7') return (value * rates.eur_usd) * 0.84;
          else if (normalizedId === 'mondo') return (value * rates.eur_usd) * 0.78;
          else if (normalizedId === 'superfoon') return value * rates.eur_usd;
          else return value * rates.eur_usd;
        } else if (currency === 'GBP') {
          if (normalizedId === 'aw') return (value * rates.gbp_usd) * 0.677;
          else return value * rates.gbp_usd;
        } else if (currency === 'USD') {
          if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') return value * 0.75;
          else if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') return value * 0.05;
          else if (normalizedId === 'dxlive') return value * 0.60;
          else if (normalizedId === 'secretfriends') return value * 0.5;
          else return value;
        }
        return 0;
      };
      
      const isSuperfoon = String(item.platform_id || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'superfoon';
      const modelPercentage = isSuperfoon ? 100 : defaultModelPercentage;
      
      let usdBruto = item.value_usd_bruto != null ? Number(item.value_usd_bruto) : null;
      let usdModelo: number | null = null;
      let copModelo: number | null = null;
      
      if (usdBruto === null) {
        const currency = platformInfo?.currency || 'USD';
        usdBruto = calculateUsdBruto(safeValue, item.platform_id, currency, rates);
      }
      
      usdModelo = usdBruto * (modelPercentage / 100);
      copModelo = usdModelo * rates.usd_cop;
      
      const finalUsdBruto = usdBruto ?? 0;
      const finalUsdModelo = usdModelo ?? 0;
      const finalCopModelo = copModelo ?? 0;
      
      period.platforms.push({
        platform_id: item.platform_id,
        platform_name: platformInfo?.name || item.platform_id,
        platform_currency: platformInfo?.currency || 'USD',
        value: safeValue,
        value_usd_bruto: finalUsdBruto,
        value_usd_modelo: finalUsdModelo,
        value_cop_modelo: finalCopModelo,
        platform_percentage: modelPercentage,
        rates: {
          eur_usd: rates.eur_usd,
          gbp_usd: rates.gbp_usd,
          usd_cop: rates.usd_cop
        }
      } as any);
      
      period.total_value += safeValue;
      period.total_usd_bruto += finalUsdBruto;
      period.total_usd_modelo += finalUsdModelo;
      period.total_cop_modelo += finalCopModelo;
    });

    // 🔧 PASO 3.5 (NUEVO): Completar períodos faltantes desde calculator_totals
    // Buscar períodos que deberían existir pero no están en calculator_history
    // Específicamente para P1 de diciembre 2025 que no se archivó correctamente
    // También busca en 2024 por si hubo error de año (como ocurrió en el pasado)
    
    // Primero buscar en 2025
    const { data: missingTotals2025, error: totalsError2025 } = await supabase
      .from('calculator_totals')
      .select('period_date, total_usd_bruto, total_usd_modelo, total_cop_modelo, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', '2025-12-01')
      .lte('period_date', '2025-12-15')
      .order('period_date', { ascending: false });

    // También buscar en 2024 (por si hubo error de año)
    const { data: missingTotals2024, error: totalsError2024 } = await supabase
      .from('calculator_totals')
      .select('period_date, total_usd_bruto, total_usd_modelo, total_cop_modelo, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', '2024-12-01')
      .lte('period_date', '2024-12-15')
      .order('period_date', { ascending: false });

    // Combinar resultados (priorizar 2025, pero incluir 2024 si existe)
    const missingTotals = [
      ...(missingTotals2025 || []),
      ...(missingTotals2024 || []).map((t: any) => ({
        ...t,
        period_date: t.period_date.replace('2024-', '2025-') // Corregir año a 2025
      }))
    ];
    const totalsError = totalsError2025 || totalsError2024;

    if (!totalsError && missingTotals && missingTotals.length > 0) {
      console.log(`🔧 [CALCULATOR-HISTORIAL] Encontrados ${missingTotals.length} totales en calculator_totals para períodos faltantes`);
      
      // Obtener tasas activas para el período
      const { data: activeRates } = await supabase
        .from('rates')
        .select('kind, value')
        .eq('active', true)
        .is('valid_to', null)
        .order('valid_from', { ascending: false });

      const rates = {
        eur_usd: activeRates?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
        gbp_usd: activeRates?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
        usd_cop: activeRates?.find((r: any) => r.kind === 'USD→COP')?.value || 3900
      };

      // Crear UN SOLO período sintético consolidado usando el último total disponible
      // missingTotals ya viene ordenado por period_date DESC, así que tomamos el primero
      const bestTotal = missingTotals[0];
      if (bestTotal) {
        const periodDate = bestTotal.period_date;
        const periodType = '1-15'; // P1 de diciembre
        const periodKey = `${periodDate}-${periodType}`;

        // Solo crear si no existe ya en periodsMap
        if (!periodsMap.has(periodKey)) {
          console.log(`🔧 [CALCULATOR-HISTORIAL] Creando período sintético consolidado para ${periodKey} desde calculator_totals`);
          
          periodsMap.set(periodKey, {
            period_date: periodDate,
            period_type: periodType,
            archived_at: bestTotal.updated_at || new Date().toISOString(),
            platforms: [], // Sin desglose por plataforma
            total_value: 0, // No tenemos el valor original
            total_usd_bruto: Number(bestTotal.total_usd_bruto) || 0,
            total_usd_modelo: Number(bestTotal.total_usd_modelo) || 0,
            total_cop_modelo: Number(bestTotal.total_cop_modelo) || 0,
            total_anticipos: 0,
            total_deducciones: 0,
            neto_pagar: null,
            deducciones: [],
            rates: {
              eur_usd: rates.eur_usd,
              gbp_usd: rates.gbp_usd,
              usd_cop: rates.usd_cop
            },
            // Flag para indicar que es un período sintético (sin desglose)
            is_synthetic: true,
            synthetic_note: 'Período reconstruido desde totales (sin desglose por plataforma)'
          } as any);
        }
      }
    }

    // PASO 4: Obtener alertas y notificaciones
    const periodsArray = Array.from(periodsMap.values());
    const periodDates = periodsArray.map(p => p.period_date);
    
    if (periodDates.length > 0) {
      const { data: notifications, error: notificationsError } = await supabase
        .from('calculator_notifications')
        .select('id, notification_type, notification_data, period_date, created_at, read_at')
        .eq('model_id', modelId)
        .in('period_date', periodDates);
      
      if (!notificationsError && notifications) {
        const notificationsByPeriod = new Map<string, any[]>();
        notifications.forEach((notif: any) => {
          const periodKey = notif.period_date;
          if (!notificationsByPeriod.has(periodKey)) {
            notificationsByPeriod.set(periodKey, []);
          }
          notificationsByPeriod.get(periodKey)!.push(notif);
        });
        
        periodsArray.forEach(period => {
          const periodKey = period.period_date;
          const periodNotifications = notificationsByPeriod.get(periodKey) || [];
          (period as any).alerts = periodNotifications
            .filter((n: any) => {
              const type = n.notification_type;
              return type === 'periodo_cerrado' || 
                     type === 'calculator_cleared' || 
                     type === 'period_closed' ||
                     type === 'value_correction' ||
                     type === 'quota_alert';
            })
            .map((n: any) => ({
              id: n.id,
              type: n.notification_type,
              message: n.notification_data?.message || n.notification_data?.body || 'Notificación del período',
              created_at: n.created_at,
              read_at: n.read_at,
              data: n.notification_data
            }))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          const totalUsdBruto = (period as any).total_usd_bruto || 0;
          const porcentajeAlcanzado = cuotaMinima > 0 ? (totalUsdBruto / cuotaMinima) * 100 : 0;
          (period as any).cuota_minima = cuotaMinima;
          (period as any).porcentaje_alcanzado = Math.round(porcentajeAlcanzado * 100) / 100;
          (period as any).esta_por_debajo = totalUsdBruto < cuotaMinima;
        });
      }
    }

    // PASO 5: Completar tasas faltantes
    const periodsWithMissingRates = periodsArray.filter((p: any) => 
      !p.rates?.eur_usd && !p.rates?.gbp_usd && !p.rates?.usd_cop
    );

    if (periodsWithMissingRates.length > 0) {
      const { data: activeRates, error: ratesError } = await supabase
        .from('rates')
        .select('kind, value')
        .eq('active', true)
        .is('valid_to', null)
        .order('valid_from', { ascending: false });

      if (!ratesError && activeRates) {
        const defaultRates = {
          eur_usd: activeRates.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
          gbp_usd: activeRates.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20,
          usd_cop: activeRates.find((r: any) => r.kind === 'USD→COP')?.value || 3900
        };

        periodsWithMissingRates.forEach((period: any) => {
          period.rates = {
            eur_usd: defaultRates.eur_usd,
            gbp_usd: defaultRates.gbp_usd,
            usd_cop: defaultRates.usd_cop
          };
        });
      }
    }

    // 🔧 PASO 6 (NUEVO): Calcular y restar Anticipos Aprobados/Realizados
    if (periodDates.length > 0) {
      // 1. Obtener IDs de períodos correspondientes a las fechas del historial
      //    period_date en history (bucket) = start_date en tabla periods
      const { data: periodsRef, error: periodsRefError } = await supabase
        .from('periods')
        .select('id, start_date')
        .in('start_date', periodDates);

      if (!periodsRefError && periodsRef && periodsRef.length > 0) {
        const periodIdMap = new Map(periodsRef.map((p: any) => [p.start_date, p.id]));
        const relevantPeriodIds = periodsRef.map((p: any) => p.id);

        // 2. Obtener anticipos aprobados/realizados para este modelo en estos períodos
        const { data: anticipos, error: anticiposError } = await supabase
          .from('anticipos')
          .select('period_id, monto_solicitado')
          .eq('model_id', modelId)
          .in('period_id', relevantPeriodIds)
          .in('estado', ['aprobado', 'realizado', 'confirmado']); // Incluir confirmado por si acaso

        if (!anticiposError && anticipos) {
          // 3. Agrupar anticipos por period_id
          const anticiposByPeriodId = new Map<string, number>();
          anticipos.forEach((a: any) => {
            const current = anticiposByPeriodId.get(a.period_id) || 0;
            anticiposByPeriodId.set(a.period_id, current + Number(a.monto_solicitado));
          });

          // 4. Asignar a los períodos del historial
          periodsArray.forEach((period: any) => {
            const pId = periodIdMap.get(period.period_date);
            if (pId) {
              const totalAnticipos = anticiposByPeriodId.get(pId) || 0;
              period.total_anticipos = totalAnticipos;
              // No calculamos neto aquí porque faltan deducciones
            }
          });
        }
      }
    }

    // 🔧 PASO 7 (NUEVO): Obtener y restar Deducciones Manuales
    if (periodDates.length > 0) {
      try {
        // Intentar consultar la tabla de deducciones (puede que no exista aún)
        const { data: deductions, error: deductionsError } = await supabase
          .from('calculator_deductions')
          .select('*')
          .eq('model_id', modelId)
          .in('period_date', periodDates);

        if (!deductionsError && deductions) {
          // Agrupar deducciones por periodo (usando key compuesta: date-type)
          const deductionsByPeriod = new Map<string, any[]>();
          deductions.forEach((d: any) => {
            const key = `${d.period_date}-${d.period_type}`;
            if (!deductionsByPeriod.has(key)) {
              deductionsByPeriod.set(key, []);
            }
            deductionsByPeriod.get(key)!.push(d);
          });

          // Asignar a períodos
          periodsArray.forEach((period: any) => {
            const key = `${period.period_date}-${period.period_type}`;
            const periodDeductions = deductionsByPeriod.get(key) || [];
            
            period.deducciones = periodDeductions;
            period.total_deducciones = periodDeductions.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
          });
        }
      } catch (e) {
        // Si falla (ej: tabla no existe), simplemente ignoramos las deducciones
        console.warn('⚠️ [CALCULATOR-HISTORIAL] No se pudieron cargar deducciones manuales:', e);
      }
    }

    // 🔧 PASO FINAL: Asegurar que neto_pagar tenga valor y restar todo
    periodsArray.forEach((period: any) => {
      // Inicializar si no existen
      if (period.total_anticipos === undefined) period.total_anticipos = 0;
      if (period.total_deducciones === undefined) period.total_deducciones = 0;
      
      // CALCULO FINAL DEL NETO:
      // Neto = Generado - Anticipos - Deducciones Manuales
      const neto = period.total_cop_modelo - period.total_anticipos - period.total_deducciones;
      
      // El neto no debería ser negativo (aunque podría si hay multas altas, pero visualmente mostramos 0)
      // Pero para el registro, guardamos el valor real, y en frontend decidimos si mostrar 0 o negativo
      // Por consistencia con anticipos, usaremos Math.max(0, ...)
      period.neto_pagar = Math.max(0, neto);
    });

    // Convertir a array y ordenar por fecha descendente
    const periods = periodsArray.sort((a, b) => {
      const dateA = new Date(a.period_date);
      const dateB = new Date(b.period_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return a.period_type === '1-15' ? -1 : 1;
    });

    return NextResponse.json({
      success: true,
      periods,
      total_periods: periods.length
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-HISTORIAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

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
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('id, platform_id, value, period_date, period_type, archived_at, rate_eur_usd, rate_gbp_usd, rate_usd_cop, platform_percentage, value_usd_bruto, value_usd_modelo, value_cop_modelo')
      .eq('model_id', modelId)
      .order('period_date', { ascending: false });

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
      // IMPORTANTE: Todas las reglas especiales deben coincidir exactamente con "Mi Calculadora"
      const calculateUsdBruto = (value: number, platformId: string, currency: string, rates: any): number => {
        // Normalizar platformId para comparación (case-insensitive, sin caracteres especiales)
        const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (currency === 'EUR') {
          if (normalizedId === 'big7') {
            return (value * rates.eur_usd) * 0.84; // 16% impuesto
          } else if (normalizedId === 'mondo') {
            return (value * rates.eur_usd) * 0.78; // 22% descuento
          } else if (normalizedId === 'superfoon') {
            // CORRECCIÓN: SUPERFOON es EUR, no USD. Convertir EUR a USD directo
            return value * rates.eur_usd;
          } else {
            // Otras plataformas EUR (modelka, xmodels, 777, vx, livecreator, mow, etc.)
            return value * rates.eur_usd;
          }
        } else if (currency === 'GBP') {
          if (normalizedId === 'aw') {
            return (value * rates.gbp_usd) * 0.677; // 32.3% descuento
          } else {
            // Otras plataformas GBP (babestation, etc.)
            return value * rates.gbp_usd;
          }
        } else if (currency === 'USD') {
          if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') {
            return value * 0.75; // 25% descuento
          } else if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') {
            return value * 0.05; // 100 tokens = 5 USD
          } else if (normalizedId === 'dxlive') {
            return value * 0.60; // 100 pts = 60 USD
          } else if (normalizedId === 'secretfriends') {
            return value * 0.5; // 50% descuento
          } else {
            // Otras plataformas USD (mdh, livejasmin, imlive, hegre, dirtyfans, camcontacts, etc.)
            return value;
          }
        }
        return 0;
      };
      
      // IMPORTANTE: SIEMPRE usar el porcentaje actual del modelo/grupo desde calculator_config
      // NO usar el porcentaje guardado en calculator_history porque puede estar desactualizado
      // El porcentaje correcto siempre viene de calculator_config (percentage_override o group_percentage)
      // Regla especial: SUPERFOON paga directo 100% a la modelo
      const isSuperfoon = String(item.platform_id || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') === 'superfoon';
      const modelPercentage = isSuperfoon ? 100 : defaultModelPercentage;
      
      // Calcular valores usando el porcentaje correcto del modelo
      let usdBruto = item.value_usd_bruto != null ? Number(item.value_usd_bruto) : null;
      let usdModelo: number | null = null;
      let copModelo: number | null = null;
      
      // Si falta USD Bruto, calcularlo ahora
      if (usdBruto === null) {
        const currency = platformInfo?.currency || 'USD';
        usdBruto = calculateUsdBruto(safeValue, item.platform_id, currency, rates);
      }
      
      // SIEMPRE recalcular USD Modelo y COP Modelo con el porcentaje actual del modelo
      // Esto asegura que se use el porcentaje correcto aunque los valores ya estén guardados
      usdModelo = usdBruto * (modelPercentage / 100);
      copModelo = usdModelo * rates.usd_cop;
      
      // Asegurar que todos los valores sean números
      const finalUsdBruto = usdBruto ?? 0;
      const finalUsdModelo = usdModelo ?? 0;
      const finalCopModelo = copModelo ?? 0;
      
      period.platforms.push({
        platform_id: item.platform_id,
        platform_name: platformInfo?.name || item.platform_id,
        platform_currency: platformInfo?.currency || 'USD',
        value: safeValue,
        // Nuevos campos de cálculos (SIEMPRE recalculados con porcentaje actual)
        value_usd_bruto: finalUsdBruto,
        value_usd_modelo: finalUsdModelo,
        value_cop_modelo: finalCopModelo,
        // Guardar el porcentaje aplicado (100% para superfoon)
        platform_percentage: modelPercentage,
        // Tasas aplicadas (guardadas en el historial o calculadas)
        rates: {
          eur_usd: rates.eur_usd,
          gbp_usd: rates.gbp_usd,
          usd_cop: rates.usd_cop
        }
      } as any); // Type assertion needed because TypeScript infers the type from the first push()
      
      // Actualizar totales del período
      period.total_value += safeValue;
      period.total_usd_bruto += finalUsdBruto;
      period.total_usd_modelo += finalUsdModelo;
      period.total_cop_modelo += finalCopModelo;
    });

    // PASO 4: Obtener alertas/notificaciones del período cerrado para cada período
    const periodsArray = Array.from(periodsMap.values());
    const periodDates = periodsArray.map(p => p.period_date);
    
    if (periodDates.length > 0) {
      const { data: notifications, error: notificationsError } = await supabase
        .from('calculator_notifications')
        .select('id, notification_type, notification_data, period_date, created_at, read_at')
        .eq('model_id', modelId)
        .in('period_date', periodDates);
      
      if (!notificationsError && notifications) {
        // Agrupar notificaciones por período
        const notificationsByPeriod = new Map<string, any[]>();
        notifications.forEach((notif: any) => {
          const periodKey = notif.period_date;
          if (!notificationsByPeriod.has(periodKey)) {
            notificationsByPeriod.set(periodKey, []);
          }
          notificationsByPeriod.get(periodKey)!.push(notif);
        });
        
        // Agregar notificaciones a cada período y calcular porcentaje alcanzado
        periodsArray.forEach(period => {
          const periodKey = period.period_date;
          const periodNotifications = notificationsByPeriod.get(periodKey) || [];
          (period as any).alerts = periodNotifications
            .filter((n: any) => {
              // Filtrar por tipo de notificación relevante al período
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
          
          // Calcular porcentaje alcanzado basado en USD Bruto y cuota mínima
          const totalUsdBruto = (period as any).total_usd_bruto || 0;
          const porcentajeAlcanzado = cuotaMinima > 0 ? (totalUsdBruto / cuotaMinima) * 100 : 0;
          (period as any).cuota_minima = cuotaMinima;
          (period as any).porcentaje_alcanzado = Math.round(porcentajeAlcanzado * 100) / 100;
          (period as any).esta_por_debajo = totalUsdBruto < cuotaMinima;
        });
      }
    }

    // PASO 5: Si algún período no tiene tasas, obtener tasas activas actuales y completarlas
    const periodsWithMissingRates = periodsArray.filter((p: any) => 
      !p.rates?.eur_usd && !p.rates?.gbp_usd && !p.rates?.usd_cop
    );

    if (periodsWithMissingRates.length > 0) {
      console.log(`⚠️ [CALCULATOR-HISTORIAL] ${periodsWithMissingRates.length} períodos sin tasas guardadas, obteniendo tasas activas actuales...`);
      
      // Obtener tasas activas actuales como fallback
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

        // Completar tasas para períodos que no las tienen
        periodsWithMissingRates.forEach((period: any) => {
          period.rates = {
            eur_usd: defaultRates.eur_usd,
            gbp_usd: defaultRates.gbp_usd,
            usd_cop: defaultRates.usd_cop
          };
          console.log(`✅ [CALCULATOR-HISTORIAL] Tasas completadas para período ${period.period_date} (${period.period_type})`);
        });
      }
    }

    // Convertir a array y ordenar por fecha descendente
    const periods = periodsArray.sort((a, b) => {
      const dateA = new Date(a.period_date);
      const dateB = new Date(b.period_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      // Si la fecha es igual, ordenar por period_type (1-15 primero, luego 16-31)
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


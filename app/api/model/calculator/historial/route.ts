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

      const period = periodsMap.get(periodKey)!;
      
      const usdBruto = item.value_usd_bruto != null ? Number(item.value_usd_bruto) : 0;
      const usdModelo = item.value_usd_modelo != null ? Number(item.value_usd_modelo) : 0;
      const copModelo = item.value_cop_modelo != null ? Number(item.value_cop_modelo) : 0;
      const percentage = item.platform_percentage != null ? Number(item.platform_percentage) : null;
      
      period.platforms.push({
        platform_id: item.platform_id,
        platform_name: platformInfo?.name || item.platform_id,
        platform_currency: platformInfo?.currency || 'USD',
        value: safeValue,
        // Nuevos campos de cálculos
        value_usd_bruto: usdBruto,
        value_usd_modelo: usdModelo,
        value_cop_modelo: copModelo,
        platform_percentage: percentage,
        // Tasas aplicadas (guardadas en el historial)
        rates: {
          eur_usd: item.rate_eur_usd || null,
          gbp_usd: item.rate_gbp_usd || null,
          usd_cop: item.rate_usd_cop || null
        }
      });
      
      // Actualizar totales del período
      period.total_value += safeValue;
      period.total_usd_bruto += usdBruto;
      period.total_usd_modelo += usdModelo;
      period.total_cop_modelo += copModelo;
    });

    // Convertir a array y ordenar por fecha descendente
    const periods = Array.from(periodsMap.values()).sort((a, b) => {
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


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente con service role para tener permisos de administrador
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, period_date, period_type, rates, platforms } = body;

    // Validar requeridos
    if (!modelId || !period_date || !period_type || !rates || !platforms) {
      return NextResponse.json({
        success: false,
        error: 'modelId, period_date, period_type, rates y platforms son requeridos'
      }, { status: 400 });
    }

    // 🔒 VERIFICAR AUTENTICACIÓN Y PERMISOS
    const authHeader = request.headers.get('authorization');
    let authenticatedUserId: string | null = null;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
        }
      } catch (error) {
        console.warn('⚠️ [RECREATE-HISTORY] Error verificando autenticación:', error);
      }
    }

    if (!authenticatedUserId) {
      return NextResponse.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Verificar rol del usuario (Admins de Innova y Super Admins Afiliados permitidos)
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', authenticatedUserId)
      .single();

    const userRole = userData?.role || 'modelo';
    const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff';

    if (!isAdmin) {
      console.warn(`🚫 [RECREATE-HISTORY] Usuario ${authenticatedUserId} sin permisos de administración`);
      return NextResponse.json({
        success: false,
        error: 'No autorizado: Solo administradores pueden recrear historial'
      }, { status: 403 });
    }

    // Normalizar period_date a YYYY-MM-DD para coincidir con la BD
    const periodDateNorm = typeof period_date === 'string' ? period_date.slice(0, 10) : String(period_date).slice(0, 10);

    // 1. Obtener plataformas del catálogo para saber la divisa de cada una
    const { data: platformsCatalog, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('id, name, currency')
      .eq('active', true);

    if (platformsError || !platformsCatalog) {
      return NextResponse.json({
        success: false,
        error: 'Error al obtener catálogo de plataformas'
      }, { status: 500 });
    }

    const catalogMap = new Map(platformsCatalog.map(p => [p.id, p]));

    // 2. Obtener la configuración de calculadora de la modelo para saber sus porcentajes
    let defaultModelPercentage = 80;
    const { data: modelConfig } = await supabase
      .from('calculator_config')
      .select('percentage_override, group_percentage')
      .eq('model_id', modelId)
      .eq('active', true)
      .maybeSingle();

    if (modelConfig) {
      defaultModelPercentage = modelConfig.percentage_override || modelConfig.group_percentage || 80;
    }

    // 3. Preparar tasas
    const parsedRates = {
      eur_usd: Number(rates.eur_usd) || 1.01,
      gbp_usd: Number(rates.gbp_usd) || 1.20,
      usd_cop: Number(rates.usd_cop) || 3900
    };

    // Helper para calcular el USD Bruto de forma idéntica al sistema
    const calculateUsdBruto = (value: number, platformId: string, currency: string, r: typeof parsedRates): number => {
      const normalizedId = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (currency === 'EUR') {
        if (normalizedId === 'big7') return (value * r.eur_usd) * 0.84;
        if (normalizedId === 'mondo') return (value * r.eur_usd) * 0.78;
        return value * r.eur_usd;
      } else if (currency === 'GBP') {
        if (normalizedId === 'aw') return (value * r.gbp_usd) * 0.677;
        return value * r.gbp_usd;
      } else if (currency === 'USD') {
        if (normalizedId === 'cmd' || normalizedId === 'camlust' || normalizedId === 'skypvt') return value * 0.75;
        if (normalizedId === 'chaturbate' || normalizedId === 'myfreecams' || normalizedId === 'stripchat') return value * 0.05;
        if (normalizedId === 'dxlive') return value * 0.60;
        if (normalizedId === 'secretfriends') return value * 0.5;
        return value;
      }
      return value;
    };

    // 4. Procesar valores ingresados
    const historyRowsToInsert = [];
    let sumValue = 0;
    let sumUsdBruto = 0;
    let sumUsdModelo = 0;
    let sumCopModelo = 0;

    const platformEntries = Object.entries(platforms);

    for (const [platformId, rawVal] of platformEntries) {
      const value = Number(rawVal) || 0;
      if (value <= 0) continue; // No registrar plataformas vacías o en cero

      const platformInfo = catalogMap.get(platformId);
      const currency = platformInfo?.currency || 'USD';

      // Calcular valores
      const usdBruto = calculateUsdBruto(value, platformId, currency, parsedRates);
      const isSuperfoon = platformId.toLowerCase().replace(/[^a-z0-9]/g, '') === 'superfoon';
      const pct = isSuperfoon ? 100 : defaultModelPercentage;
      const usdModelo = usdBruto * (pct / 100);
      const copModelo = usdModelo * parsedRates.usd_cop;

      historyRowsToInsert.push({
        model_id: modelId,
        platform_id: platformId,
        value: value,
        period_date: periodDateNorm,
        period_type: period_type,
        rate_eur_usd: parsedRates.eur_usd,
        rate_gbp_usd: parsedRates.gbp_usd,
        rate_usd_cop: parsedRates.usd_cop,
        platform_percentage: pct,
        value_usd_bruto: parseFloat(usdBruto.toFixed(2)),
        value_usd_modelo: parseFloat(usdModelo.toFixed(2)),
        value_cop_modelo: parseFloat(copModelo.toFixed(2)),
        archived_at: new Date().toISOString()
      });

      sumValue += value;
      sumUsdBruto += usdBruto;
      sumUsdModelo += usdModelo;
      sumCopModelo += copModelo;
    }

    if (historyRowsToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debes ingresar al menos un valor mayor a cero para recrear el período'
      }, { status: 400 });
    }

    // Fila del total consolidado obligatoria para el funcionamiento de facturación
    const consolidatedRow = {
      model_id: modelId,
      platform_id: '__CONSOLIDATED_TOTAL__',
      value: sumValue,
      period_date: periodDateNorm,
      period_type: period_type,
      rate_eur_usd: parsedRates.eur_usd,
      rate_gbp_usd: parsedRates.gbp_usd,
      rate_usd_cop: parsedRates.usd_cop,
      platform_percentage: 0,
      value_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
      value_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
      value_cop_modelo: parseFloat(sumCopModelo.toFixed(2)),
      archived_at: new Date().toISOString()
    };

    historyRowsToInsert.push(consolidatedRow);

    // 5. INICIAR TRANSACCIÓN EN BD (Borrar histórico existente del mismo período para evitar duplicación)
    const { error: deleteHistoryError } = await supabase
      .from('calculator_history')
      .delete()
      .eq('model_id', modelId)
      .eq('period_date', periodDateNorm)
      .eq('period_type', period_type);

    if (deleteHistoryError) {
      console.error('❌ [RECREATE-HISTORY] Error borrando historial previo:', deleteHistoryError);
      return NextResponse.json({
        success: false,
        error: 'Error al limpiar el historial previo de este período'
      }, { status: 500 });
    }

    // 6. Insertar los nuevos registros en calculator_history
    const { data: insertedHistory, error: insertHistoryError } = await supabase
      .from('calculator_history')
      .insert(historyRowsToInsert)
      .select();

    if (insertHistoryError) {
      console.error('❌ [RECREATE-HISTORY] Error insertando historial:', insertHistoryError);
      return NextResponse.json({
        success: false,
        error: 'Error al guardar los registros en el historial'
      }, { status: 500 });
    }

    // 7. Upsert en calculator_totals para que impacte en la facturación consolidada de administración
    const { error: totalsError } = await supabase
      .from('calculator_totals')
      .upsert({
        model_id: modelId,
        period_date: periodDateNorm,
        total_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
        total_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
        total_cop_modelo: parseFloat(sumCopModelo.toFixed(2)),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'model_id,period_date'
      });

    if (totalsError) {
      console.error('❌ [RECREATE-HISTORY] Error al guardar totales:', totalsError);
      // Rollback manual eliminando lo recién insertado para consistencia de datos
      await supabase
        .from('calculator_history')
        .delete()
        .eq('model_id', modelId)
        .eq('period_date', periodDateNorm)
        .eq('period_type', period_type);

      return NextResponse.json({
        success: false,
        error: 'Error al actualizar los totales consolidados de facturación'
      }, { status: 500 });
    }

    console.log(`✅ [RECREATE-HISTORY] Período ${periodDateNorm} (${period_type}) recreado exitosamente por admin ${authenticatedUserId}. Registros insertados: ${historyRowsToInsert.length}`);

    return NextResponse.json({
      success: true,
      message: 'Período recreado exitosamente',
      inserted_rows: historyRowsToInsert.length,
      totals: {
        total_usd_bruto: parseFloat(sumUsdBruto.toFixed(2)),
        total_usd_modelo: parseFloat(sumUsdModelo.toFixed(2)),
        total_cop_modelo: parseFloat(sumCopModelo.toFixed(2))
      }
    });

  } catch (error: any) {
    console.error('❌ [RECREATE-HISTORY] Error crítico:', error);
    return NextResponse.json({
      success: false,
      error: 'Error crítico interno del servidor'
    }, { status: 500 });
  }
}

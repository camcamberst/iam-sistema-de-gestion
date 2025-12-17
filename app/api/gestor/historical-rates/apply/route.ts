// =====================================================
// 🔄 API: APLICAR RATES HISTÓRICAS
// =====================================================
// Endpoint para aplicar rates históricas y recalcular
// calculator_history para un período específico
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

// =====================================================
// 🔄 POST - Aplicar rates históricas y recalcular
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // Autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    // Verificar rol (solo gestor, admin, super_admin)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'Error verificando usuario' }, { status: 500 });
    }

    const allowedRoles = ['gestor', 'admin', 'super_admin'];
    if (!allowedRoles.includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Solo gestores, admins y super_admins pueden aplicar rates históricas' }, { status: 403 });
    }

    const body = await request.json();
    const { groupId, periodDate, periodType } = body;

    // Validaciones
    if (!groupId || !periodDate || !periodType) {
      return NextResponse.json({
        success: false,
        error: 'Faltan parámetros requeridos: groupId, periodDate, periodType'
      }, { status: 400 });
    }

    if (!['1-15', '16-31'].includes(periodType)) {
      return NextResponse.json({
        success: false,
        error: 'periodType debe ser "1-15" o "16-31"'
      }, { status: 400 });
    }

    // 1. Obtener rates históricas configuradas
    const { data: historicalRates, error: ratesError } = await supabase
      .from('gestor_historical_rates')
      .select('*')
      .eq('group_id', groupId)
      .eq('period_date', periodDate)
      .eq('period_type', periodType)
      .single();

    if (ratesError || !historicalRates) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron rates históricas configuradas para este período'
      }, { status: 404 });
    }

    // 2. Obtener todos los registros de calculator_history para este período y grupo
    const { data: historyRecords, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('period_date', periodDate)
      .eq('period_type', periodType)
      .eq('group_id', groupId);

    if (historyError) {
      console.error('❌ [APPLY RATES] Error obteniendo historial:', historyError);
      return NextResponse.json({ success: false, error: historyError.message }, { status: 500 });
    }

    if (!historyRecords || historyRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron registros históricos para este período'
      }, { status: 404 });
    }

    // 3. Obtener plataformas y configuraciones necesarias para el cálculo
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [APPLY RATES] Error obteniendo plataformas:', platformsError);
      return NextResponse.json({ success: false, error: platformsError.message }, { status: 500 });
    }

    // 4. Obtener configuraciones de modelos (porcentajes)
    const modelIds = Array.from(new Set(historyRecords.map((r: any) => r.model_id)));
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('model_id, percentage_override, group_percentage')
      .in('model_id', modelIds)
      .eq('active', true);

    if (configsError) {
      console.error('❌ [APPLY RATES] Error obteniendo configuraciones:', configsError);
    }

    const configMap = new Map((configs || []).map((c: any) => [c.model_id, c]));

    // 5. Recalcular cada registro con las rates históricas
    const rates = {
      USD_COP: parseFloat(historicalRates.rate_usd_cop),
      EUR_USD: parseFloat(historicalRates.rate_eur_usd),
      GBP_USD: parseFloat(historicalRates.rate_gbp_usd)
    };

    const updates: any[] = [];
    let updatedCount = 0;
    let errorCount = 0;

    for (const record of historyRecords) {
      try {
        const platform = platforms?.find((p: any) => p.id === record.platform_id);
        if (!platform) {
          console.warn(`⚠️ [APPLY RATES] Plataforma no encontrada: ${record.platform_id}`);
          errorCount++;
          continue;
        }

        const config = configMap.get(record.model_id);
        const percentage = config?.percentage_override || config?.group_percentage || 80;

        // Calcular USD bruto usando la misma lógica que Mi Calculadora
        let usdBruto = 0;
        const value = parseFloat(record.value) || 0;

        if (platform.currency === 'EUR') {
          if (platform.id === 'big7') {
            usdBruto = (value * rates.EUR_USD) * 0.84; // 16% impuesto
          } else if (platform.id === 'mondo') {
            usdBruto = (value * rates.EUR_USD) * 0.78; // 22% descuento
          } else {
            usdBruto = value * rates.EUR_USD;
          }
        } else if (platform.currency === 'GBP') {
          if (platform.id === 'aw') {
            usdBruto = (value * rates.GBP_USD) * 0.677;
          } else {
            usdBruto = value * rates.GBP_USD;
          }
        } else if (platform.currency === 'USD') {
          if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
            usdBruto = value * 0.75;
          } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
            usdBruto = value * 0.05; // token rate
          } else if (platform.id === 'dxlive') {
            usdBruto = value * 0.60;
          } else if (platform.id === 'secretfriends') {
            usdBruto = value * 0.5;
          } else if (platform.id === 'superfoon') {
            usdBruto = value; // 100% directo
          } else {
            usdBruto = value;
          }
        }

        // Aplicar porcentaje (excepto superfoon que es 100%)
        let usdModelo = usdBruto;
        if (platform.id !== 'superfoon') {
          usdModelo = usdBruto * (percentage / 100);
        }

        const copModelo = Math.round(usdModelo * rates.USD_COP);

        updates.push({
          id: record.id,
          rate_eur_usd: rates.EUR_USD,
          rate_gbp_usd: rates.GBP_USD,
          rate_usd_cop: rates.USD_COP,
          platform_percentage: percentage,
          value_usd_bruto: Math.round(usdBruto * 100) / 100,
          value_usd_modelo: Math.round(usdModelo * 100) / 100,
          value_cop_modelo: copModelo
        });

        updatedCount++;
      } catch (err: any) {
        console.error(`❌ [APPLY RATES] Error calculando registro ${record.id}:`, err);
        errorCount++;
      }
    }

    // 6. Actualizar registros en batch
    if (updates.length > 0) {
      // Actualizar en lotes de 100
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        for (const update of batch) {
          const { id, ...updateData } = update;
          const { error: updateError } = await supabase
            .from('calculator_history')
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            console.error(`❌ [APPLY RATES] Error actualizando registro ${id}:`, updateError);
            errorCount++;
          }
        }
      }
    }

    // 7. Marcar rates como aplicadas
    const { error: markAppliedError } = await supabase
      .from('gestor_historical_rates')
      .update({
        aplicado_at: new Date().toISOString(),
        aplicado_por: user.id
      })
      .eq('id', historicalRates.id);

    if (markAppliedError) {
      console.error('❌ [APPLY RATES] Error marcando rates como aplicadas:', markAppliedError);
    }

    console.log(`✅ [APPLY RATES] Rates aplicadas: ${updatedCount} actualizados, ${errorCount} errores`);

    return NextResponse.json({
      success: true,
      data: {
        updatedCount,
        errorCount,
        totalRecords: historyRecords.length
      },
      message: `Rates históricas aplicadas correctamente. ${updatedCount} registros actualizados.`
    });

  } catch (error: any) {
    console.error('❌ [APPLY RATES] Error inesperado:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error inesperado' },
      { status: 500 }
    );
  }
}


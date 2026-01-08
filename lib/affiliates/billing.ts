// =====================================================
// 💰 CÁLCULO DE FACTURACIÓN PARA ESTUDIOS AFILIADOS
// =====================================================
// Calcula la facturación de afiliados y la comisión para Agencia Innova
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface AffiliateBillingData {
  affiliate_studio_id: string;
  affiliate_name: string;
  commission_percentage: number;
  period_date: string;
  period_type: 'P1' | 'P2';
  total_usd_bruto: number;
  total_usd_affiliate: number; // Monto para el afiliado
  total_usd_innova: number; // Comisión para Agencia Innova
  total_cop_affiliate: number;
  total_cop_innova: number;
  models_count: number;
  sedes_count: number;
  usd_cop_rate: number; // Tasa de cambio usada
}

/**
 * Calcular facturación de un estudio afiliado para un período específico
 */
export async function calculateAffiliateBilling(
  affiliateStudioId: string,
  periodDate: string,
  periodType: 'P1' | 'P2',
  usdCopRate?: number
): Promise<AffiliateBillingData | null> {
  try {
    // 1. Obtener información del estudio afiliado
    const { data: studio, error: studioError } = await supabase
      .from('affiliate_studios')
      .select('id, name, commission_percentage')
      .eq('id', affiliateStudioId)
      .single();

    if (studioError || !studio) {
      console.error('❌ [AFFILIATE-BILLING] Error obteniendo estudio:', studioError);
      return null;
    }

    // 2. Calcular rango de fechas del período
    const baseDate = new Date(periodDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const startDate = periodType === 'P1'
      ? `${year}-${String(month + 1).padStart(2, '0')}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-16`;
    
    const endDate = periodType === 'P1'
      ? `${year}-${String(month + 1).padStart(2, '0')}-15`
      : `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // 3. Obtener modelos del afiliado
    const { data: affiliateModels, error: modelsError } = await supabase
      .from('users')
      .select('id')
      .eq('affiliate_studio_id', affiliateStudioId)
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ [AFFILIATE-BILLING] Error obteniendo modelos:', modelsError);
      return null;
    }

    const modelIds = affiliateModels?.map(m => m.id) || [];
    
    if (modelIds.length === 0) {
      // No hay modelos, retornar datos vacíos
      return {
        affiliate_studio_id: affiliateStudioId,
        affiliate_name: studio.name,
        commission_percentage: studio.commission_percentage,
        period_date: periodDate,
        period_type: periodType,
        total_usd_bruto: 0,
        total_usd_affiliate: 0,
        total_usd_innova: 0,
        total_cop_affiliate: 0,
        total_cop_innova: 0,
        models_count: 0,
        sedes_count: 0,
        usd_cop_rate: usdCopRate || 3900
      };
    }

    // 4. Verificar si el período está cerrado o activo
    const todayStr = new Date().toISOString().split('T')[0];
    const isActivePeriod = todayStr >= startDate && todayStr <= endDate;

    let totalUsdBruto = 0;
    let totalUsdModelo = 0;

    if (isActivePeriod) {
      // Período activo: usar calculator_totals
      const { data: totals, error: totalsError } = await supabase
        .from('calculator_totals')
        .select('model_id, total_usd_bruto, total_usd_modelo, updated_at')
        .in('model_id', modelIds)
        .eq('affiliate_studio_id', affiliateStudioId)
        .gte('period_date', startDate)
        .lte('period_date', endDate);

      if (totalsError) {
        console.error('❌ [AFFILIATE-BILLING] Error obteniendo totales:', totalsError);
      } else if (totals && totals.length > 0) {
        // Agrupar por modelo (tomar el más reciente si hay múltiples)
        const totalsByModel = new Map<string, any>();
        totals.forEach(t => {
          const existing = totalsByModel.get(t.model_id);
          if (!existing || new Date(t.updated_at) > new Date(existing.updated_at)) {
            totalsByModel.set(t.model_id, t);
          }
        });

        totalsByModel.forEach(t => {
          totalUsdBruto += parseFloat(t.total_usd_bruto || 0);
          totalUsdModelo += parseFloat(t.total_usd_modelo || 0);
        });
      }
    } else {
      // Período cerrado: usar calculator_history
      const { data: history, error: historyError } = await supabase
        .from('calculator_history')
        .select('model_id, value_usd_bruto, value_usd_modelo')
        .in('model_id', modelIds)
        .eq('affiliate_studio_id', affiliateStudioId)
        .eq('period_date', periodDate)
        .eq('period_type', periodType === 'P1' ? '1-15' : '16-31');

      if (historyError) {
        console.error('❌ [AFFILIATE-BILLING] Error obteniendo historial:', historyError);
      } else if (history && history.length > 0) {
        // Agrupar por modelo y sumar
        const historyByModel = new Map<string, { usd_bruto: number; usd_modelo: number }>();
        
        history.forEach(h => {
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

        historyByModel.forEach(h => {
          totalUsdBruto += h.usd_bruto;
          totalUsdModelo += h.usd_modelo;
        });
      }
    }

    // 5. Obtener tasa USD_COP (usar la proporcionada o buscar la actual)
    let usdCopRateValue = usdCopRate;
    if (!usdCopRateValue) {
      const { data: rate } = await supabase
        .from('rates')
        .select('value')
        .eq('kind', 'USD→COP')
        .eq('active', true)
        .is('valid_to', null)
        .order('valid_from', { ascending: false })
        .limit(1)
        .single();

      usdCopRateValue = rate?.value ? parseFloat(rate.value) : 3900;
    }

    // 6. Calcular comisión
    const commissionPercentage = parseFloat(studio.commission_percentage) || 10;
    const totalUsdInnova = totalUsdBruto * (commissionPercentage / 100);
    const totalUsdAffiliate = totalUsdBruto - totalUsdInnova;

    const totalCopInnova = Math.round(totalUsdInnova * usdCopRateValue);
    const totalCopAffiliate = Math.round(totalUsdAffiliate * usdCopRateValue);

    // 7. Contar sedes del afiliado
    const { count: sedesCount } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', affiliateStudioId);

    return {
      affiliate_studio_id: affiliateStudioId,
      affiliate_name: studio.name,
      commission_percentage: commissionPercentage,
      period_date: periodDate,
      period_type: periodType,
      total_usd_bruto: Math.round(totalUsdBruto * 100) / 100,
      total_usd_affiliate: Math.round(totalUsdAffiliate * 100) / 100,
      total_usd_innova: Math.round(totalUsdInnova * 100) / 100,
      total_cop_affiliate: totalCopAffiliate,
      total_cop_innova: totalCopInnova,
      models_count: modelIds.length,
      sedes_count: sedesCount || 0,
      usd_cop_rate: usdCopRateValue
    };

  } catch (error: any) {
    console.error('❌ [AFFILIATE-BILLING] Error calculando facturación:', error);
    return null;
  }
}

/**
 * Guardar resumen de facturación en affiliate_billing_summary
 */
export async function saveAffiliateBillingSummary(
  billingData: AffiliateBillingData
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('affiliate_billing_summary')
      .upsert({
        affiliate_studio_id: billingData.affiliate_studio_id,
        period_date: billingData.period_date,
        period_type: billingData.period_type,
        total_usd_bruto: billingData.total_usd_bruto,
        total_usd_affiliate: billingData.total_usd_affiliate,
        total_usd_innova: billingData.total_usd_innova,
        total_cop_affiliate: billingData.total_cop_affiliate,
        total_cop_innova: billingData.total_cop_innova,
        models_count: billingData.models_count,
        sedes_count: billingData.sedes_count
      }, {
        onConflict: 'affiliate_studio_id,period_date,period_type'
      });

    if (error) {
      console.error('❌ [AFFILIATE-BILLING] Error guardando resumen:', error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('❌ [AFFILIATE-BILLING] Error:', error);
    return false;
  }
}

/**
 * Calcular y guardar facturación de todos los afiliados activos para un período
 */
export async function calculateAndSaveAllAffiliatesBilling(
  periodDate: string,
  periodType: 'P1' | 'P2',
  usdCopRate?: number
): Promise<{ success: number; errors: number }> {
  try {
    // Obtener todos los estudios afiliados activos
    const { data: studios, error: studiosError } = await supabase
      .from('affiliate_studios')
      .select('id')
      .eq('is_active', true);

    if (studiosError || !studios || studios.length === 0) {
      console.log('ℹ️ [AFFILIATE-BILLING] No hay estudios afiliados activos');
      return { success: 0, errors: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    // Calcular facturación para cada afiliado
    for (const studio of studios) {
      const billingData = await calculateAffiliateBilling(
        studio.id,
        periodDate,
        periodType,
        usdCopRate
      );

      if (billingData) {
        const saved = await saveAffiliateBillingSummary(billingData);
        if (saved) {
          successCount++;
          console.log(`✅ [AFFILIATE-BILLING] Facturación calculada para ${billingData.affiliate_name}`);
        } else {
          errorCount++;
          console.error(`❌ [AFFILIATE-BILLING] Error guardando facturación para ${studio.id}`);
        }
      } else {
        errorCount++;
        console.error(`❌ [AFFILIATE-BILLING] Error calculando facturación para ${studio.id}`);
      }
    }

    return { success: successCount, errors: errorCount };
  } catch (error: any) {
    console.error('❌ [AFFILIATE-BILLING] Error:', error);
    return { success: 0, errors: 1 };
  }
}


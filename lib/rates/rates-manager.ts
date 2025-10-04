import { createClient } from '@supabase/supabase-js';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface RatesEffective {
  usd_cop: number;
  eur_usd: number;
  gbp_usd: number;
}

export interface RateData {
  id: string;
  kind: string;
  value: number;
  scope: string;
  scope_id?: string;
  valid_from: string;
  valid_to?: string;
  active: boolean;
}

/**
 * Obtener tasas efectivas para la calculadora
 * Prioridad: 1. Grupo específico, 2. Global más reciente
 */
export async function getEffectiveRates(groupId?: string): Promise<RatesEffective> {
  try {
    console.log('🔍 [RATES-MANAGER] Obteniendo tasas efectivas para grupo:', groupId);

    // 1. Obtener todas las tasas activas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('*')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ [RATES-MANAGER] Error al obtener tasas:', ratesError);
      throw new Error('Error al obtener tasas');
    }

    // 2. Filtrar por tipo
    const usdCopRates = ratesData?.filter((r: RateData) => r.kind === 'USD→COP') || [];
    const eurUsdRates = ratesData?.filter((r: RateData) => r.kind === 'EUR→USD') || [];
    const gbpUsdRates = ratesData?.filter((r: RateData) => r.kind === 'GBP→USD') || [];

    // 3. Función para seleccionar la mejor tasa
    const selectBestRate = (rates: RateData[], groupId?: string) => {
      if (!rates || rates.length === 0) return null;

      // Prioridad 1: Tasa específica del grupo (si se proporciona)
      if (groupId) {
        const groupRate = rates.find(r => 
          r.scope === `group:${groupId}` || 
          (r.scope === 'group' && r.scope_id === groupId)
        );
        if (groupRate) {
          console.log('✅ [RATES-MANAGER] Usando tasa específica del grupo:', groupRate);
          return groupRate;
        }
      }

      // Prioridad 2: Tasa global más reciente
      const globalRate = rates.find(r => r.scope === 'global');
      if (globalRate) {
        console.log('✅ [RATES-MANAGER] Usando tasa global más reciente:', globalRate);
        return globalRate;
      }

      // Fallback: Primera tasa disponible
      const fallbackRate = rates[0];
      console.log('⚠️ [RATES-MANAGER] Usando tasa de fallback:', fallbackRate);
      return fallbackRate;
    };

    // 4. Seleccionar tasas efectivas
    const effectiveUsdCop = selectBestRate(usdCopRates, groupId);
    const effectiveEurUsd = selectBestRate(eurUsdRates, groupId);
    const effectiveGbpUsd = selectBestRate(gbpUsdRates, groupId);

    const rates: RatesEffective = {
      usd_cop: effectiveUsdCop?.value || 3900,
      eur_usd: effectiveEurUsd?.value || 1.01,
      gbp_usd: effectiveGbpUsd?.value || 1.20
    };

    console.log('✅ [RATES-MANAGER] Tasas efectivas seleccionadas:', rates);

    return rates;

  } catch (error: any) {
    console.error('❌ [RATES-MANAGER] Error general:', error);
    
    // Fallback a tasas por defecto
    return {
      usd_cop: 3900,
      eur_usd: 1.01,
      gbp_usd: 1.20
    };
  }
}

/**
 * Obtener tasas para un modelo específico
 * Usa el grupo de la modelo para seleccionar tasas
 */
export async function getRatesForModel(modelId: string): Promise<RatesEffective> {
  try {
    // 1. Obtener el grupo de la modelo
    const { data: userGroup, error: userGroupError } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', modelId)
      .single();

    if (userGroupError) {
      console.log('⚠️ [RATES-MANAGER] No se encontró grupo para modelo:', modelId);
      return await getEffectiveRates(); // Usar tasas globales
    }

    // 2. Obtener tasas para el grupo específico
    return await getEffectiveRates(userGroup.group_id);

  } catch (error: any) {
    console.error('❌ [RATES-MANAGER] Error al obtener tasas para modelo:', error);
    return await getEffectiveRates(); // Fallback a tasas globales
  }
}

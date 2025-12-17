// =====================================================
// 📊 HELPERS PARA CÁLCULOS EN GESTOR STATS
// =====================================================
// Funciones para calcular PROFIT MODELO y PROFIT AGENCIA
// usando rates históricas y valores brutos
// =====================================================

export interface HistoricalRates {
  rate_usd_cop: number;
  rate_eur_usd: number;
  rate_gbp_usd: number;
}

export interface Platform {
  id: string;
  currency: string;
  discount_factor?: number;
  tax_rate?: number;
  token_rate?: number;
  direct_payout?: boolean;
}

export interface ModelConfig {
  percentage_override?: number;
  group_percentage?: number;
}

/**
 * Calcula USD bruto desde valor en bruto de la plataforma
 */
export function calculateUsdBruto(
  value: number,
  platform: Platform,
  rates: HistoricalRates
): number {
  if (!value || value <= 0) return 0;

  let usdBruto = 0;

  if (platform.currency === 'EUR') {
    if (platform.id === 'big7') {
      // EUR → USD con 16% impuesto (0.84)
      usdBruto = (value * rates.rate_eur_usd) * 0.84;
    } else if (platform.id === 'mondo') {
      // EUR → USD con 22% descuento (0.78)
      usdBruto = (value * rates.rate_eur_usd) * 0.78;
    } else {
      // EUR → USD directo
      usdBruto = value * rates.rate_eur_usd;
    }
  } else if (platform.currency === 'GBP') {
    if (platform.id === 'aw') {
      // GBP → USD con factor 0.677
      usdBruto = (value * rates.rate_gbp_usd) * 0.677;
    } else {
      // GBP → USD directo
      usdBruto = value * rates.rate_gbp_usd;
    }
  } else if (platform.currency === 'USD') {
    if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
      // USD con 25% descuento (0.75)
      usdBruto = value * 0.75;
    } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
      // Tokens a USD (0.05 por token)
      usdBruto = value * 0.05;
    } else if (platform.id === 'dxlive') {
      // Puntos a USD (0.60 por 100 pts)
      usdBruto = value * 0.60;
    } else if (platform.id === 'secretfriends') {
      // Créditos con 50% descuento (0.5)
      usdBruto = value * 0.5;
    } else if (platform.id === 'superfoon') {
      // 100% directo
      usdBruto = value;
    } else {
      // USD directo
      usdBruto = value;
    }
  }

  return Math.max(0, usdBruto); // No negativo
}

/**
 * Calcula PROFIT MODELO y PROFIT AGENCIA desde valor bruto
 */
export function calculateProfits(
  value: number,
  platform: Platform,
  rates: HistoricalRates,
  modelConfig: ModelConfig
): {
  usdBruto: number;
  usdModelo: number;
  copModelo: number;
  usdAgencia: number;
  copAgencia: number;
} {
  const usdBruto = calculateUsdBruto(value, platform, rates);

  // Porcentaje para modelo (default 80%)
  let percentage = modelConfig.percentage_override || modelConfig.group_percentage || 80;

  // SUPERFOON: 100% para modelo
  if (platform.id === 'superfoon') {
    percentage = 100;
  }

  const usdModelo = usdBruto * (percentage / 100);
  const copModelo = Math.round(usdModelo * rates.rate_usd_cop);

  const usdAgencia = usdBruto - usdModelo;
  const copAgencia = Math.round(usdAgencia * rates.rate_usd_cop);

  return {
    usdBruto: Math.round(usdBruto * 100) / 100,
    usdModelo: Math.round(usdModelo * 100) / 100,
    copModelo,
    usdAgencia: Math.round(usdAgencia * 100) / 100,
    copAgencia
  };
}

/**
 * Calcula totales por período (P1 o P2) para un modelo
 */
export function calculatePeriodTotals(
  values: Record<string, number>, // platformId -> value
  platforms: Platform[],
  rates: HistoricalRates,
  modelConfig: ModelConfig
): {
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalCopModelo: number;
  totalUsdAgencia: number;
  totalCopAgencia: number;
} {
  let totalUsdBruto = 0;
  let totalUsdModelo = 0;
  let totalUsdAgencia = 0;

  platforms.forEach(platform => {
    const value = values[platform.id] || 0;
    if (value <= 0) return;

    const profits = calculateProfits(value, platform, rates, modelConfig);
    totalUsdBruto += profits.usdBruto;
    totalUsdModelo += profits.usdModelo;
    totalUsdAgencia += profits.usdAgencia;
  });

  const totalCopModelo = Math.round(totalUsdModelo * rates.rate_usd_cop);
  const totalCopAgencia = Math.round(totalUsdAgencia * rates.rate_usd_cop);

  return {
    totalUsdBruto: Math.round(totalUsdBruto * 100) / 100,
    totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
    totalCopModelo,
    totalUsdAgencia: Math.round(totalUsdAgencia * 100) / 100,
    totalCopAgencia
  };
}


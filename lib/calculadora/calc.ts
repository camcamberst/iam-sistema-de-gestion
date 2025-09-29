// Utilidades puras de cálculo para la Calculadora (no dependencias de runtime)

export type RateKind = 'USD_COP' | 'EUR_USD' | 'GBP_USD';

export interface RatesEffective {
  USD_COP: number; // ya ajustada por periodo: (api - 200), no negativa
  EUR_USD: number;
  GBP_USD: number;
}

export type ConversionType = 'usd_cop' | 'eur_usd_cop' | 'gbp_usd_cop' | 'tokens';

export interface PlatformRule {
  id: string;
  code: string;
  name: string;
  conversionType: ConversionType;
  tokenRateUsd?: number; // USD por 1 token/pt (ej. 0.6 para 1 pt = 0.6 USD)
  discountFactor?: number; // multiplicador, ej. 0.75
  taxFactor?: number; // multiplicador, ej. 0.84 (16% impuesto)
  specialFlags?: { superfoon_100_model?: boolean };
}

export interface ValueInputItem {
  platformId: string;
  valueInput: number; // "VALORES" ingresado por la modelo (tokens/creditos/USD segun plataforma)
}

export interface PercentageRule {
  // porcentaje de reparto para la modelo (ej. 80 => 80%)
  percentageModel: number;
}

export interface CalculatorConfigEffective {
  enabledPlatformIds: string[];
  percentageRule: PercentageRule; // ya resuelto por jerarquía (modelo/grupo/global)
  cuotaMinimaUsd?: number; // ya resuelto por jerarquía
}

export interface PlatformTotals {
  platformId: string;
  usdBruto: number;     // USD antes de reparto
  usdModelo: number;    // USD para la modelo despues de reparto
  copModelo: number;    // COP para la modelo
}

export interface CalcResult {
  perPlatform: PlatformTotals[];
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalCopModelo: number; // redondeado sin decimales
  cuotaMinimaAlert?: { below: boolean; percentToReach: number };
  anticipoMaxCop: number; // 90% de COP MODELO, sin decimales
}

export function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

export function toFixedNumber(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function roundCop(value: number): number {
  return Math.round(value);
}

function computeUsdBrutoForPlatform(
  rule: PlatformRule,
  valueInput: number,
  rates: RatesEffective
): number {
  // Aplica reglas específicas por plataforma según conversionType y factores
  switch (rule.conversionType) {
    case 'usd_cop': {
      // valueInput ya viene en USD bruto
      let usd = valueInput;
      // Descuentos/Impuestos si aplica
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    }
    case 'eur_usd_cop': {
      // valueInput en EUR bruto → USD
      let usd = valueInput * rates.EUR_USD;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    }
    case 'gbp_usd_cop': {
      // valueInput en GBP bruto → USD
      let usd = valueInput * rates.GBP_USD;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    }
    case 'tokens': {
      // valueInput en tokens/pts → USD usando tokenRateUsd
      const tokenRate = rule.tokenRateUsd ?? 0;
      let usd = valueInput * tokenRate;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    }
    default:
      return 0;
  }
}

export function computeTotals(
  platforms: PlatformRule[],
  values: ValueInputItem[],
  rates: RatesEffective,
  config: CalculatorConfigEffective
): CalcResult {
  const enabled = new Set(config.enabledPlatformIds);
  const valueByPlatform = new Map<string, number>(values.map(v => [v.platformId, v.valueInput]));

  const perPlatform: PlatformTotals[] = [];
  let totalUsdBruto = 0;
  let totalUsdModelo = 0;

  for (const p of platforms) {
    if (!enabled.has(p.id)) continue;
    const valueInput = valueByPlatform.get(p.id) ?? 0;
    let usdBruto = computeUsdBrutoForPlatform(p, valueInput, rates);
    usdBruto = clampNonNegative(usdBruto);

    // Reglas especiales
    let percentageModel = config.percentageRule.percentageModel;
    if (p.specialFlags?.superfoon_100_model) {
      percentageModel = 100; // SUPERFOON: 100% para la modelo
    }

    const usdModelo = usdBruto * (percentageModel / 100);
    const copModelo = usdModelo * rates.USD_COP;

    perPlatform.push({
      platformId: p.id,
      usdBruto: toFixedNumber(usdBruto, 2),
      usdModelo: toFixedNumber(usdModelo, 2),
      copModelo: roundCop(copModelo),
    });

    totalUsdBruto += usdBruto;
    totalUsdModelo += usdModelo;
  }

  const totalCopModelo = roundCop(totalUsdModelo * rates.USD_COP);

  // Alerta de cuota mínima (medida en USD TOTAL "DÓLARES")
  let cuotaMinimaAlert: CalcResult['cuotaMinimaAlert'];
  if (config.cuotaMinimaUsd !== undefined && config.cuotaMinimaUsd > 0) {
    const below = totalUsdBruto < config.cuotaMinimaUsd;
    const percentToReach = below
      ? clampNonNegative(((config.cuotaMinimaUsd - totalUsdBruto) / config.cuotaMinimaUsd) * 100)
      : 0;
    cuotaMinimaAlert = { below, percentToReach: toFixedNumber(percentToReach, 2) };
  }

  // Anticipo máximo: 90% de COP MODELO
  const anticipoMaxCop = roundCop(totalCopModelo * 0.90);

  return {
    perPlatform,
    totalUsdBruto: toFixedNumber(totalUsdBruto, 2),
    totalUsdModelo: toFixedNumber(totalUsdModelo, 2),
    totalCopModelo,
    cuotaMinimaAlert,
    anticipoMaxCop,
  };
}



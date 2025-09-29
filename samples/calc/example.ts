import { computeTotals, PlatformRule, RatesEffective, CalculatorConfigEffective, ValueInputItem } from '../../lib/calculadora/calc';

const rates: RatesEffective = {
  USD_COP: 3894, // ejemplo ya ajustado (4094 - 200)
  EUR_USD: 1.01,
  GBP_USD: 1.2,
};

const platforms: PlatformRule[] = [
  { id: 'p1', code: 'BIG7', name: 'Big7', conversionType: 'eur_usd_cop', taxFactor: 0.84 },
  { id: 'p2', code: 'AW', name: 'AW', conversionType: 'gbp_usd_cop', discountFactor: 0.677 },
  { id: 'p3', code: 'DXLIVE', name: 'DX Live', conversionType: 'tokens', tokenRateUsd: 0.6 },
  { id: 'p4', code: 'CH', name: 'Chaturbate', conversionType: 'tokens', tokenRateUsd: 0.05 },
  { id: 'p5', code: 'SUPERFOON', name: 'SUPERFOON', conversionType: 'usd_cop', specialFlags: { superfoon_100_model: true } },
];

const values: ValueInputItem[] = [
  { platformId: 'p1', valueInput: 100 }, // 100 EUR
  { platformId: 'p2', valueInput: 100 }, // 100 GBP
  { platformId: 'p3', valueInput: 100 }, // 100 pts => 60 USD
  { platformId: 'p4', valueInput: 100 }, // 100 tokens => 5 USD
  { platformId: 'p5', valueInput: 100 }, // 100 USD
];

const config: CalculatorConfigEffective = {
  enabledPlatformIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
  percentageRule: { percentageModel: 80 },
  cuotaMinimaUsd: 470,
};

const result = computeTotals(platforms, values, rates, config);
console.log(JSON.stringify(result, null, 2));



import { computeTotals } from '../../../../lib/calculadora/calc';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const demo = searchParams.get('demo');

    // Modo demo seguro para validar el endpoint sin BD
    if (demo === '1') {
      const rates = { USD_COP: 3894, EUR_USD: 1.01, GBP_USD: 1.2 };
      const platforms = [
        { id: 'p1', code: 'BIG7', name: 'Big7', conversionType: 'eur_usd_cop', taxFactor: 0.84 },
        { id: 'p2', code: 'AW', name: 'AW', conversionType: 'gbp_usd_cop', discountFactor: 0.677 },
        { id: 'p3', code: 'DXLIVE', name: 'DX Live', conversionType: 'tokens', tokenRateUsd: 0.6 },
        { id: 'p4', code: 'CH', name: 'Chaturbate', conversionType: 'tokens', tokenRateUsd: 0.05 },
        { id: 'p5', code: 'SUPERFOON', name: 'SUPERFOON', conversionType: 'usd_cop', specialFlags: { superfoon_100_model: true } },
      ];
      const values = [
        { platformId: 'p1', valueInput: 100 },
        { platformId: 'p2', valueInput: 100 },
        { platformId: 'p3', valueInput: 100 },
        { platformId: 'p4', valueInput: 100 },
        { platformId: 'p5', valueInput: 100 },
      ];
      const config = {
        enabledPlatformIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        percentageRule: { percentageModel: 80 },
        cuotaMinimaUsd: 470,
      };

      const result = computeTotals(platforms as any, values as any, rates as any, config as any);
      return new Response(JSON.stringify({ success: true, mode: 'demo', result }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Integración real con BD (rates efectivas por período, config del modelo, valores del período)
    return new Response(
      JSON.stringify({ success: false, error: 'Preview real no implementado aún. Usa ?demo=1 para ejemplo.' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'Error inesperado' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}



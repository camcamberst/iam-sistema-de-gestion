/**
 * 🌐 FUENTES EXTERNAS PARA TASAS DE REFERENCIA
 * 
 * Este módulo maneja múltiples fuentes de tasas de cambio con fallback automático:
 * 1. Fuentes oficiales colombianas (TRM)
 * 2. APIs internacionales como fallback
 */

export interface RateSource {
  name: string;
  priority: number;
  url: string;
  parser: (data: any) => { usd_cop?: number; eur_usd?: number; gbp_usd?: number };
  timeout?: number;
}

export interface RateResult {
  usd_cop?: number;
  eur_usd?: number;
  gbp_usd?: number;
  source: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

// Configuración de fuentes con prioridad
const RATE_SOURCES: RateSource[] = [
  // 1. Fuente oficial colombiana (máxima prioridad)
  {
    name: 'Datos Abiertos Colombia',
    priority: 1,
    url: 'https://www.datos.gov.co/api/views/dit9-nnvp/rows.json?$limit=1&$order=:id',
    parser: (data) => {
      try {
        const row = data?.data?.[0];
        if (row && row.length >= 2) {
          return { usd_cop: parseFloat(row[1]) };
        }
      } catch (error) {
        console.warn('⚠️ [RATE-SOURCES] Error parsing Datos Abiertos Colombia:', error);
      }
      return {};
    },
    timeout: 10000
  },
  
  // 2. ExchangeRate-API (fallback internacional)
  {
    name: 'ExchangeRate-API',
    priority: 2,
    url: 'https://api.exchangerate-api.com/v4/latest/USD',
    parser: (data) => {
      try {
        return {
          usd_cop: data?.rates?.COP,
          eur_usd: 1 / (data?.rates?.EUR || 1),
          gbp_usd: 1 / (data?.rates?.GBP || 1)
        };
      } catch (error) {
        console.warn('⚠️ [RATE-SOURCES] Error parsing ExchangeRate-API:', error);
      }
      return {};
    },
    timeout: 8000
  },
  
  // 3. Fixer.io (fallback adicional)
  {
    name: 'Fixer.io',
    priority: 3,
    url: 'https://api.fixer.io/latest?base=USD',
    parser: (data) => {
      try {
        return {
          usd_cop: data?.rates?.COP,
          eur_usd: 1 / (data?.rates?.EUR || 1),
          gbp_usd: 1 / (data?.rates?.GBP || 1)
        };
      } catch (error) {
        console.warn('⚠️ [RATE-SOURCES] Error parsing Fixer.io:', error);
      }
      return {};
    },
    timeout: 8000
  }
];

/**
 * Obtener tasas desde una fuente específica
 */
async function fetchFromSource(source: RateSource): Promise<RateResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), source.timeout || 10000);
  
  try {
    console.log(`🔍 [RATE-SOURCES] Fetching from ${source.name}...`);
    
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'IAM-Sistema-Gestion/1.0',
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const rates = source.parser(data);
    
    console.log(`✅ [RATE-SOURCES] ${source.name} success:`, rates);
    
    return {
      ...rates,
      source: source.name,
      timestamp: new Date().toISOString(),
      success: true
    };
    
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`❌ [RATE-SOURCES] ${source.name} failed:`, error.message);
    
    return {
      source: source.name,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtener tasas con fallback automático
 */
export async function getExternalRates(): Promise<RateResult[]> {
  console.log('🌐 [RATE-SOURCES] Starting external rates fetch...');
  
  const results: RateResult[] = [];
  const sources = [...RATE_SOURCES].sort((a, b) => a.priority - b.priority);
  
  // Intentar cada fuente en orden de prioridad
  for (const source of sources) {
    try {
      const result = await fetchFromSource(source);
      results.push(result);
      
      // Si obtenemos al menos USD→COP, podemos continuar con otras fuentes
      if (result.success && result.usd_cop) {
        console.log(`✅ [RATE-SOURCES] Got USD→COP from ${source.name}: ${result.usd_cop}`);
      }
      
    } catch (error: any) {
      console.error(`❌ [RATE-SOURCES] Source ${source.name} failed:`, error.message);
      results.push({
        source: source.name,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });
    }
  }
  
  console.log(`🔍 [RATE-SOURCES] Completed. ${results.filter(r => r.success).length}/${results.length} sources successful`);
  
  return results;
}

/**
 * Combinar resultados de múltiples fuentes
 */
export function combineRateResults(results: RateResult[]): {
  usd_cop?: number;
  eur_usd?: number;
  gbp_usd?: number;
  sources: string[];
  errors: string[];
} {
  const combined = {
    usd_cop: undefined as number | undefined,
    eur_usd: undefined as number | undefined,
    gbp_usd: undefined as number | undefined,
    sources: [] as string[],
    errors: [] as string[]
  };
  
  // Priorizar fuentes exitosas
  const successfulResults = results.filter(r => r.success);
  
  for (const result of successfulResults) {
    if (result.usd_cop && !combined.usd_cop) {
      combined.usd_cop = result.usd_cop;
      combined.sources.push(`${result.source} (USD→COP)`);
    }
    if (result.eur_usd && !combined.eur_usd) {
      combined.eur_usd = result.eur_usd;
      combined.sources.push(`${result.source} (EUR→USD)`);
    }
    if (result.gbp_usd && !combined.gbp_usd) {
      combined.gbp_usd = result.gbp_usd;
      combined.sources.push(`${result.source} (GBP→USD)`);
    }
  }
  
  // Recopilar errores
  results.forEach(result => {
    if (!result.success && result.error) {
      combined.errors.push(`${result.source}: ${result.error}`);
    }
  });
  
  return combined;
}

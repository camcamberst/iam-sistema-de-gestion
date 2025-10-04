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
  // 1. Superintendencia Financiera de Colombia (TRM oficial - máxima prioridad)
  {
    name: 'Superintendencia Financiera Colombia',
    priority: 1,
    url: 'https://www.superfinanciera.gov.co/inicio/60819',
    parser: (data) => {
      try {
        // La Superintendencia Financiera publica la TRM en su sitio web
        // Buscamos patrones comunes de TRM en el HTML
        if (typeof data === 'string') {
          // Patrones múltiples para encontrar la TRM
          const patterns = [
            /TRM[:\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
            /Tasa Representativa del Mercado[:\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*pesos?\s*por\s*dólar/i,
            /USD[:\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
            /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*COP/i
          ];
          
          for (const pattern of patterns) {
            const match = data.match(pattern);
            if (match) {
              const trmValue = parseFloat(match[1].replace(/,/g, ''));
              if (trmValue > 1000 && trmValue < 10000) { // Validación básica para TRM
                console.log(`✅ [RATE-SOURCES] TRM found via pattern: ${trmValue}`);
                return { usd_cop: trmValue };
              }
            }
          }
          
          console.warn('⚠️ [RATE-SOURCES] No valid TRM pattern found in Superintendencia HTML');
        }
      } catch (error) {
        console.warn('⚠️ [RATE-SOURCES] Error parsing Superintendencia Financiera:', error);
      }
      return {};
    },
    timeout: 15000
  },
  
  // 2. Datos Abiertos Colombia (fallback oficial)
  {
    name: 'Datos Abiertos Colombia',
    priority: 2,
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
  
  // 3. ExchangeRate-API (fallback internacional)
  {
    name: 'ExchangeRate-API',
    priority: 3,
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
  
  // 4. Fixer.io (fallback adicional)
  {
    name: 'Fixer.io',
    priority: 4,
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': source.name.includes('Superintendencia') ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'application/json'
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

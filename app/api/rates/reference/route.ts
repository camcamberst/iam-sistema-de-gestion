import { NextRequest, NextResponse } from 'next/server';

// GET /api/rates/reference - Obtener tasas de referencia desde fuentes externas
export async function GET() {
  try {
    // ===========================================
    // 🌐 TASAS DE REFERENCIA DESDE INTERNET
    // ===========================================
    
    const referenceRates = [];

    // 1. USD → COP desde dolar.wilkinsonpc.com.co
    try {
      const usdCopResponse = await fetch('https://dolar.wilkinsonpc.com.co/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (usdCopResponse.ok) {
        const html = await usdCopResponse.text();
        
        // Extraer TRM del día (formato: $3,908.12) - múltiples patrones
        const trmPatterns = [
          /TRM \$([0-9,]+\.?[0-9]*)/,
          /\$([0-9,]+\.?[0-9]*)\s*COP/,
          /([0-9,]+\.?[0-9]*)\s*pesos/,
          /USD\s*=\s*\$([0-9,]+\.?[0-9]*)/i
        ];
        
        let trmValue = null;
        for (const pattern of trmPatterns) {
          const match = html.match(pattern);
          if (match) {
            trmValue = parseFloat(match[1].replace(/,/g, ''));
            break;
          }
        }
        
        if (trmValue) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'TRM Colombia',
            value: trmValue,
            url: 'https://dolar.wilkinsonpc.com.co/',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa Representativa del Mercado - Banco de la República'
          });
        }

        // Extraer Dólar SPOT - múltiples patrones
        const spotPatterns = [
          /SPOT \$([0-9,]+\.?[0-9]*)/,
          /Dólar SPOT.*?\$([0-9,]+\.?[0-9]*)/,
          /SPOT.*?([0-9,]+\.?[0-9]*)/i
        ];
        
        let spotValue = null;
        for (const pattern of spotPatterns) {
          const match = html.match(pattern);
          if (match) {
            spotValue = parseFloat(match[1].replace(/,/g, ''));
            break;
          }
        }
        
        if (spotValue) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'Dólar SPOT',
            value: spotValue,
            url: 'https://dolar.wilkinsonpc.com.co/',
            lastUpdated: new Date().toISOString(),
            description: 'Dólar SPOT - Mercado interbancario'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching USD→COP rates:', error);
      // Agregar tasa de fallback para USD→COP
      referenceRates.push({
        kind: 'USD_COP',
        source: 'Fallback',
        value: 3800,
        url: 'https://dolar.wilkinsonpc.com.co/',
        lastUpdated: new Date().toISOString(),
        description: 'Tasa de referencia (fallback)'
      });
    }

    // 2. EUR → USD desde ECB (European Central Bank)
    try {
      const eurUsdResponse = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (eurUsdResponse.ok) {
        const data = await eurUsdResponse.json();
        if (data.rates && data.rates.USD) {
          referenceRates.push({
            kind: 'EUR_USD',
            source: 'ExchangeRate-API',
            value: data.rates.USD,
            url: 'https://api.exchangerate-api.com/v4/latest/EUR',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa EUR→USD desde ExchangeRate-API'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching EUR→USD rates:', error);
    }

    // 3. GBP → USD desde ExchangeRate-API
    try {
      const gbpUsdResponse = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
      if (gbpUsdResponse.ok) {
        const data = await gbpUsdResponse.json();
        if (data.rates && data.rates.USD) {
          referenceRates.push({
            kind: 'GBP_USD',
            source: 'ExchangeRate-API',
            value: data.rates.USD,
            url: 'https://api.exchangerate-api.com/v4/latest/GBP',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa GBP→USD desde ExchangeRate-API'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching GBP→USD rates:', error);
    }

    return NextResponse.json({
      success: true,
      data: referenceRates,
      message: 'Tasas de referencia obtenidas correctamente',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching reference rates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener tasas de referencia',
        data: []
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

// GET /api/rates/reference - Obtener tasas de referencia desde fuentes externas
export async function GET() {
  try {
    // ===========================================
    // 🌐 TASAS DE REFERENCIA DESDE INTERNET
    // ===========================================
    
    const referenceRates = [];

    // 1. USD → COP desde ExchangeRate-API (más confiable)
    try {
      const usdCopResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (usdCopResponse.ok) {
        const data = await usdCopResponse.json();
        if (data.rates && data.rates.COP) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'ExchangeRate-API',
            value: data.rates.COP,
            url: 'https://api.exchangerate-api.com/v4/latest/USD',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa USD→COP desde ExchangeRate-API'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching USD→COP from ExchangeRate-API:', error);
    }

    // 2. USD → COP desde Fixer.io como respaldo
    try {
      const fixerResponse = await fetch('https://api.fixer.io/latest?base=USD&symbols=COP');
      if (fixerResponse.ok) {
        const data = await fixerResponse.json();
        if (data.rates && data.rates.COP) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'Fixer.io',
            value: data.rates.COP,
            url: 'https://api.fixer.io/latest?base=USD&symbols=COP',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa USD→COP desde Fixer.io'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching USD→COP from Fixer.io:', error);
    }

    // 3. USD → COP desde dolar.wilkinsonpc.com.co como último recurso
    try {
      const usdCopResponse = await fetch('https://dolar.wilkinsonpc.com.co/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (usdCopResponse.ok) {
        const html = await usdCopResponse.text();
        
        // Buscar TRM con múltiples patrones y validación
        const trmPatterns = [
          /TRM.*?\$([0-9,]+\.?[0-9]*)/,
          /([0-9,]+\.?[0-9]*)\s*pesos/,
          /USD.*?\$([0-9,]+\.?[0-9]*)/
        ];
        
        let trmValue = null;
        for (const pattern of trmPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (value > 1000 && value < 10000) { // Validar que sea un valor razonable
              trmValue = value;
              break;
            }
          }
        }
        
        if (trmValue) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'TRM Colombia',
            value: trmValue,
            url: 'https://dolar.wilkinsonpc.com.co/',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa Representativa del Mercado (TRM)'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching USD→COP from dolar.wilkinsonpc.com.co:', error);
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

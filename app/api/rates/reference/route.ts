import { NextRequest, NextResponse } from 'next/server';

// GET /api/rates/reference - Obtener tasas de referencia desde fuentes externas
export async function GET() {
  try {
    // ===========================================
    // 🌐 TASAS DE REFERENCIA DESDE INTERNET
    // ===========================================
    
    const referenceRates = [];

    // 1. USD → COP desde ExchangeRate-API (única fuente)
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

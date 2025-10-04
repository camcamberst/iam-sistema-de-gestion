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
      console.log('🔍 [RATES-REFERENCE] Fetching USD→COP from ExchangeRate-API...');
      const usdCopResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      console.log('🔍 [RATES-REFERENCE] USD→COP response status:', usdCopResponse.status);
      
      if (usdCopResponse.ok) {
        const data = await usdCopResponse.json();
        console.log('🔍 [RATES-REFERENCE] USD→COP data received:', data.rates?.COP);
        
        if (data.rates && data.rates.COP) {
          referenceRates.push({
            kind: 'USD_COP',
            source: 'ExchangeRate-API',
            value: data.rates.COP,
            url: 'https://api.exchangerate-api.com/v4/latest/USD',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa USD→COP desde ExchangeRate-API'
          });
          console.log('✅ [RATES-REFERENCE] USD→COP added successfully');
        } else {
          console.warn('⚠️ [RATES-REFERENCE] USD→COP data not found in response');
        }
      } else {
        console.error('❌ [RATES-REFERENCE] USD→COP API error:', usdCopResponse.status, usdCopResponse.statusText);
      }
    } catch (error) {
      console.error('❌ [RATES-REFERENCE] Error fetching USD→COP from ExchangeRate-API:', error);
    }

    // 2. EUR → USD desde ExchangeRate-API
    try {
      console.log('🔍 [RATES-REFERENCE] Fetching EUR→USD from ExchangeRate-API...');
      const eurUsdResponse = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      console.log('🔍 [RATES-REFERENCE] EUR→USD response status:', eurUsdResponse.status);
      
      if (eurUsdResponse.ok) {
        const data = await eurUsdResponse.json();
        console.log('🔍 [RATES-REFERENCE] EUR→USD data received:', data.rates?.USD);
        
        if (data.rates && data.rates.USD) {
          referenceRates.push({
            kind: 'EUR_USD',
            source: 'ExchangeRate-API',
            value: data.rates.USD,
            url: 'https://api.exchangerate-api.com/v4/latest/EUR',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa EUR→USD desde ExchangeRate-API'
          });
          console.log('✅ [RATES-REFERENCE] EUR→USD added successfully');
        } else {
          console.warn('⚠️ [RATES-REFERENCE] EUR→USD data not found in response');
        }
      } else {
        console.error('❌ [RATES-REFERENCE] EUR→USD API error:', eurUsdResponse.status, eurUsdResponse.statusText);
      }
    } catch (error) {
      console.error('❌ [RATES-REFERENCE] Error fetching EUR→USD rates:', error);
    }

    // 3. GBP → USD desde ExchangeRate-API
    try {
      console.log('🔍 [RATES-REFERENCE] Fetching GBP→USD from ExchangeRate-API...');
      const gbpUsdResponse = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
      console.log('🔍 [RATES-REFERENCE] GBP→USD response status:', gbpUsdResponse.status);
      
      if (gbpUsdResponse.ok) {
        const data = await gbpUsdResponse.json();
        console.log('🔍 [RATES-REFERENCE] GBP→USD data received:', data.rates?.USD);
        
        if (data.rates && data.rates.USD) {
          referenceRates.push({
            kind: 'GBP_USD',
            source: 'ExchangeRate-API',
            value: data.rates.USD,
            url: 'https://api.exchangerate-api.com/v4/latest/GBP',
            lastUpdated: new Date().toISOString(),
            description: 'Tasa GBP→USD desde ExchangeRate-API'
          });
          console.log('✅ [RATES-REFERENCE] GBP→USD added successfully');
        } else {
          console.warn('⚠️ [RATES-REFERENCE] GBP→USD data not found in response');
        }
      } else {
        console.error('❌ [RATES-REFERENCE] GBP→USD API error:', gbpUsdResponse.status, gbpUsdResponse.statusText);
      }
    } catch (error) {
      console.error('❌ [RATES-REFERENCE] Error fetching GBP→USD rates:', error);
    }

    console.log('🔍 [RATES-REFERENCE] Total rates obtained:', referenceRates.length);
    console.log('🔍 [RATES-REFERENCE] Rates:', referenceRates.map(r => ({ kind: r.kind, value: r.value })));

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

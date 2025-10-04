import { NextRequest, NextResponse } from 'next/server';
import { getExternalRates, combineRateResults } from '@/lib/rates/external-sources';

// GET /api/rates/reference - Obtener tasas de referencia desde fuentes externas
export async function GET() {
  try {
    console.log('🌐 [RATES-REFERENCE] Starting external rates fetch with multiple sources...');
    
    // Obtener tasas desde múltiples fuentes con fallback automático
    const results = await getExternalRates();
    const combined = combineRateResults(results);
    
    // Formatear respuesta para compatibilidad con el frontend existente
    const referenceRates = [];
    
    if (combined.usd_cop) {
      referenceRates.push({
        kind: 'USD_COP',
        source: 'Múltiples fuentes',
        value: combined.usd_cop,
        url: 'https://www.datos.gov.co/api/views/dit9-nnvp/rows.json',
        lastUpdated: new Date().toISOString(),
        description: 'Tasa USD→COP desde fuentes oficiales colombianas e internacionales'
      });
    }
    
    if (combined.eur_usd) {
      referenceRates.push({
        kind: 'EUR_USD',
        source: 'Múltiples fuentes',
        value: combined.eur_usd,
        url: 'https://api.exchangerate-api.com/v4/latest/EUR',
        lastUpdated: new Date().toISOString(),
        description: 'Tasa EUR→USD desde fuentes internacionales'
      });
    }
    
    if (combined.gbp_usd) {
      referenceRates.push({
        kind: 'GBP_USD',
        source: 'Múltiples fuentes',
        value: combined.gbp_usd,
        url: 'https://api.exchangerate-api.com/v4/latest/GBP',
        lastUpdated: new Date().toISOString(),
        description: 'Tasa GBP→USD desde fuentes internacionales'
      });
    }
    
    console.log('🔍 [RATES-REFERENCE] Final results:', {
      totalRates: referenceRates.length,
      sources: combined.sources,
      errors: combined.errors.length
    });

    return NextResponse.json({
      success: true,
      data: referenceRates,
      message: 'Tasas de referencia obtenidas correctamente',
      timestamp: new Date().toISOString(),
      sources: combined.sources,
      errors: combined.errors
    });

  } catch (error: any) {
    console.error('❌ [RATES-REFERENCE] Error fetching reference rates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener tasas de referencia',
        data: [],
        sources: [],
        errors: [error.message]
      },
      { status: 500 }
    );
  }
}

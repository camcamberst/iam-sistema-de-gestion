import { NextRequest, NextResponse } from 'next/server';

// GET: Prueba simple de conversión
export async function GET(request: NextRequest) {
  try {
    // Pruebas manuales de conversión
    const testCases = [
      {
        name: 'modelka (EUR)',
        value: 3,
        currency: 'EUR',
        rate: 1.01,
        expected: 3 * 1.01
      },
      {
        name: 'livecreator (EUR)',
        value: 5,
        currency: 'EUR',
        rate: 1.01,
        expected: 5 * 1.01
      },
      {
        name: 'skypvt (USD)',
        value: 20,
        currency: 'USD',
        discountFactor: 0.75,
        expected: 20 * 0.75
      },
      {
        name: 'mdh (USD)',
        value: 4,
        currency: 'USD',
        expected: 4
      },
      {
        name: 'dirtyfans (USD)',
        value: 76,
        currency: 'USD',
        expected: 76
      },
      {
        name: 'babestation (GBP)',
        value: 135,
        currency: 'GBP',
        rate: 1.2,
        expected: 135 * 1.2
      }
    ];

    const results = testCases.map(test => {
      let usdBruto = 0;
      
      if (test.currency === 'EUR') {
        usdBruto = test.value * test.rate;
      } else if (test.currency === 'GBP') {
        usdBruto = test.value * test.rate;
      } else if (test.currency === 'USD') {
        usdBruto = test.value;
        if (test.discountFactor) {
          usdBruto *= test.discountFactor;
        }
      }
      
      return {
        ...test,
        calculated: Math.round(usdBruto * 100) / 100,
        correct: Math.abs(usdBruto - test.expected) < 0.01
      };
    });

    return NextResponse.json({
      success: true,
      testResults: results,
      summary: {
        totalTests: results.length,
        correctTests: results.filter(r => r.correct).length,
        totalUsdBruto: results.reduce((sum, r) => sum + r.calculated, 0)
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

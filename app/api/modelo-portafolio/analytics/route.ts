import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Inicializar Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);

// POST: Generar análisis con IA de los datos del portafolio
export async function POST(request: NextRequest) {
  try {
    const { modelId, analysisType = 'comprehensive' } = await request.json();

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    // Obtener datos históricos de la calculadora (últimos 4 períodos quincenales)
    const { data: calculatorData, error: calculatorError } = await supabase
      .from('calculator_history')
      .select(`
        platform_id,
        value,
        usd_bruto,
        usd_modelo,
        cop_modelo,
        period_date,
        period_type
      `)
      .eq('model_id', modelId)
      .order('period_date', { ascending: true })
      .order('period_type', { ascending: true });

    // Obtener información de plataformas por separado
    const { data: platformsData } = await supabase
      .from('calculator_platforms')
      .select('id, name');

    if (calculatorError) {
      console.error('Error obteniendo datos de calculadora:', calculatorError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener datos históricos' 
      }, { status: 500 });
    }

    if (!calculatorData || calculatorData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          analysis: 'No hay suficientes datos históricos para generar un análisis. Continúa trabajando para obtener insights valiosos.',
          recommendations: [
            'Mantén un registro consistente de tus ingresos',
            'Diversifica tus plataformas para maximizar ganancias',
            'Establece objetivos claros y medibles'
          ],
          trends: [],
          summary: {
            totalPeriods: 0,
            totalEarnings: 0,
            avgPeriodEarnings: 0,
            bestPlatform: null,
            growthRate: 0
          }
        }
      });
    }

    // Procesar datos para análisis por períodos quincenales
    const platformStats = new Map();
    const periodEarnings = new Map();
    let totalEarnings = 0;
    let totalPeriods = 0;

    // Crear mapa de plataformas para lookup rápido
    const platformMap = new Map();
    platformsData?.forEach(platform => {
      platformMap.set(platform.id, platform.name);
    });

    calculatorData.forEach(record => {
      const periodKey = `${record.period_date}-${record.period_type}`;
      const platformName = platformMap.get(record.platform_id);
      
      // Saltar si no hay datos de plataforma
      if (!platformName) {
        return;
      }
      
      // Estadísticas por plataforma
      if (!platformStats.has(platformName)) {
        platformStats.set(platformName, {
          name: platformName,
          code: record.platform_id,
          totalEarnings: 0,
          totalPeriods: 0,
          avgEarnings: 0,
          maxEarnings: 0,
          minEarnings: Infinity,
          periods: new Set()
        });
      }
      
      const platform = platformStats.get(platformName);
      platform.totalEarnings += record.usd_modelo || 0;
      platform.periods.add(periodKey);
      platform.maxEarnings = Math.max(platform.maxEarnings, record.usd_modelo || 0);
      platform.minEarnings = Math.min(platform.minEarnings, record.usd_modelo || 0);
      
      // Estadísticas por período
      if (!periodEarnings.has(periodKey)) {
        periodEarnings.set(periodKey, {
          period_date: record.period_date,
          period_type: record.period_type,
          totalEarnings: 0,
          platformCount: 0
        });
        totalPeriods++;
      }
      
      const period = periodEarnings.get(periodKey);
      period.totalEarnings += record.usd_modelo || 0;
      period.platformCount += 1;
      totalEarnings += record.usd_modelo || 0;
    });

    // Calcular promedios
    platformStats.forEach(platform => {
      platform.totalPeriods = platform.periods.size;
      platform.avgEarnings = platform.totalPeriods > 0 ? platform.totalEarnings / platform.totalPeriods : 0;
      if (platform.minEarnings === Infinity) platform.minEarnings = 0;
      // Convertir Set a Array para serialización
      platform.periods = Array.from(platform.periods);
    });

    // Encontrar la mejor plataforma
    let bestPlatform: any = null;
    let maxAvgEarnings = 0;
    platformStats.forEach(platform => {
      if (platform.avgEarnings > maxAvgEarnings) {
        maxAvgEarnings = platform.avgEarnings;
        bestPlatform = platform;
      }
    });

    // Calcular tendencia de crecimiento por períodos
    const periodEarningsArray = Array.from(periodEarnings.values());
    let growthRate = 0;
    if (periodEarningsArray.length >= 2) {
      const firstPeriod = periodEarningsArray[0].totalEarnings;
      const lastPeriod = periodEarningsArray[periodEarningsArray.length - 1].totalEarnings;
      growthRate = firstPeriod > 0 ? ((lastPeriod - firstPeriod) / firstPeriod) * 100 : 0;
    }

    // Generar análisis con Google Gemini
    const analysisData = {
      totalEarnings,
      totalPeriods,
      avgPeriodEarnings: totalPeriods > 0 ? totalEarnings / totalPeriods : 0,
      bestPlatform,
      growthRate,
      platformStats: Array.from(platformStats.values()),
      periodEarnings: Array.from(periodEarnings.values())
    };

    const { analysis, recommendations, trends } = await generateAIAnalysis(analysisData);

    return NextResponse.json({ 
      success: true, 
      data: {
        analysis,
        recommendations,
        trends,
        summary: {
          totalPeriods,
          totalEarnings,
          avgPeriodEarnings: totalPeriods > 0 ? totalEarnings / totalPeriods : 0,
          bestPlatform: bestPlatform?.name || null,
          growthRate: Math.round(growthRate * 100) / 100
        },
        platformStats: Array.from(platformStats.values()),
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error en análisis de portafolio:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Función para generar análisis con Google Gemini
async function generateAIAnalysis(data: any) {
  // Lista de modelos para intentar (más recientes primero)
  const modelNames = [
    'gemini-2.0-flash-exp',           // Gemini 2.0 Flash Experimental
    'gemini-1.5-flash-latest',        // Gemini 1.5 Flash Latest
    'gemini-1.5-pro-latest',         // Gemini 1.5 Pro Latest
    'gemini-1.5-flash',              // Gemini 1.5 Flash (estable)
    'gemini-1.5-pro'                  // Gemini 1.5 Pro (estable)
  ];
  
  let lastError: any = null;
  
  const prompt = `
Eres un asistente especializado en análisis de rendimiento para modelos de webcam. 
Analiza los siguientes datos y proporciona insights valiosos con un tono casual y amigable, pero profesional.

DATOS DEL MODELO:
- Ganancias totales: $${data.totalEarnings.toFixed(2)} USD
- Períodos analizados: ${data.totalPeriods} períodos quincenales
- Promedio por período: $${data.avgPeriodEarnings.toFixed(2)} USD
- Tasa de crecimiento: ${data.growthRate > 0 ? '+' : ''}${data.growthRate.toFixed(1)}%
- Mejor plataforma: ${data.bestPlatform?.name || 'N/A'}

PLATAFORMAS:
${data.platformStats.map((p: any) => `- ${p.name}: $${p.totalEarnings.toFixed(2)} total, $${p.avgEarnings.toFixed(2)} promedio por período`).join('\n')}

PERÍODOS:
${data.periodEarnings.map((p: any) => `- ${p.period_date} (${p.period_type}): $${p.totalEarnings.toFixed(2)}`).join('\n')}

INSTRUCCIONES:
1. Genera un análisis detallado del rendimiento
2. Proporciona 3-5 recomendaciones específicas y accionables
3. Identifica 2-3 tendencias importantes
4. Usa un tono casual y amigable, como si fueras un mentor experimentado
5. Incluye emojis apropiados
6. Sé específico pero no menciones datos exactos de ganancias en el análisis
7. Enfócate en estrategias de mejora y optimización

Responde en formato JSON:
{
  "analysis": "análisis detallado aquí",
  "recommendations": ["recomendación 1", "recomendación 2", ...],
  "trends": [
    {
      "type": "tipo de tendencia",
      "label": "etiqueta",
      "value": "valor",
      "change": "cambio",
      "trend": "up/down/stable"
    }
  ]
}
`;

  // Intentar con cada modelo hasta que uno funcione
  for (const modelName of modelNames) {
    try {
      console.log(`🤖 [PORTFOLIO-ANALYTICS] Intentando con modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpiar el texto de markdown si existe
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanText);
        console.log(`✅ [PORTFOLIO-ANALYTICS] Éxito con modelo: ${modelName}`);
        return {
          analysis: parsed.analysis || 'Análisis no disponible',
          recommendations: parsed.recommendations || [],
          trends: parsed.trends || []
        };
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        // Continuar al siguiente modelo si hay error de parsing
        lastError = parseError;
        continue;
      }
      
    } catch (error: any) {
      console.warn(`⚠️ [PORTFOLIO-ANALYTICS] Error con modelo ${modelName}:`, error.message);
      lastError = error;
      // Continuar al siguiente modelo
      continue;
    }
  }
  
  // Si todos los modelos fallaron, usar fallback
  console.error('❌ [PORTFOLIO-ANALYTICS] Todos los modelos fallaron, usando fallback');
  return {
    analysis: 'Análisis no disponible temporalmente',
    recommendations: [
      'Mantén un registro consistente de tus ingresos',
      'Diversifica tus plataformas para maximizar ganancias',
      'Establece objetivos claros y medibles'
    ],
    trends: []
  };
}

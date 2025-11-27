import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withCache, generateCacheKey, queryCache } from '@/lib/cache/query-cache';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Inicializar Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);

// POST: Generar insights de IA para el dashboard
export async function POST(request: NextRequest) {
  try {
    const { userId, userRole, forceRefresh } = await request.json();

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido' 
      }, { status: 400 });
    }

    if (userRole !== 'modelo') {
      return NextResponse.json({ 
        success: false, 
        error: 'Solo disponible para modelos' 
      }, { status: 403 });
    }

    // Cache per-user (TTL 7h). forceRefresh invalida manualmente.
    const cacheKey = generateCacheKey('ai-dashboard', { userId });
    if (forceRefresh) {
      try { queryCache.invalidate(cacheKey); } catch {}
    }

    const payload = await withCache(
      cacheKey,
      async () => {
        const userData = await getUserProductivityData(userId);
        if (!userData) throw new Error('No se encontraron datos del usuario');
        const aiInsights = await generateAIInsights(userData);
        return aiInsights;
      },
      7 * 60 * 60 * 1000 // 7 horas
    );

    if (!payload) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se encontraron datos del usuario' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: payload
    });

  } catch (error: any) {
    console.error('Error en AI Dashboard:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

async function getUserProductivityData(userId: string) {
  try {
    // Obtener datos de productividad del día actual
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Obtener totales acumulados de hoy y ayer
    const { data: todayTotals } = await supabase
      .from('model_values')
      .select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `)
      .eq('model_id', userId)
      .eq('period_date', today);

    const { data: yesterdayTotals } = await supabase
      .from('model_values')
      .select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `)
      .eq('model_id', userId)
      .eq('period_date', yesterday);

    // Calcular ganancias del día (diferencia entre hoy y ayer)
    const todayTotal = (todayTotals || []).reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    const yesterdayTotal = (yesterdayTotals || []).reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    const todayEarnings = todayTotal - yesterdayTotal;

    // Obtener datos históricos de la última semana
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: weeklyData } = await supabase
      .from('model_values')
      .select(`
        platform_id,
        value,
        period_date,
        calculator_platforms (
          name,
          currency
        )
      `)
      .eq('model_id', userId)
      .gte('period_date', weekAgo)
      .order('period_date', { ascending: true });

    // Obtener configuración de objetivos
    const { data: config } = await supabase
      .from('calculator_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Obtener portafolio de plataformas
    const { data: portfolio } = await supabase
      .from('modelo_plataformas')
      .select(`
        platform_id,
        status,
        calculator_platforms (
          name,
          currency
        )
      `)
      .eq('model_id', userId)
      .in('status', ['entregada', 'confirmada']);

    return {
      todayEarnings: todayEarnings, // Ahora es la diferencia, no el total
      todayTotal: todayTotal, // Total acumulado de hoy
      yesterdayTotal: yesterdayTotal, // Total acumulado de ayer
      weeklyData: weeklyData || [],
      config: config || {},
      portfolio: portfolio || [],
      userId
    };

  } catch (error) {
    console.error('Error obteniendo datos de productividad:', error);
    return null;
  }
}

async function generateAIInsights(userData: any) {
  // Lista de modelos para intentar (más recientes primero - Gemini 3.0 2025)
  const modelNames = [
    'gemini-3.0-pro',                 // Gemini 3.0 Pro - Más reciente (Nov 2025)
    'gemini-3-pro-preview',            // Gemini 3.0 Pro Preview
    'gemini-3.0-flash',                // Gemini 3.0 Flash - Más rápido
    'gemini-3-flash-preview',          // Gemini 3.0 Flash Preview
    'gemini-2.5-flash',               // Gemini 2.5 Flash - Fallback estable
    'gemini-2.5-pro',                 // Gemini 2.5 Pro - Fallback estable
    'gemini-1.5-flash-latest',        // Gemini 1.5 Flash Latest
    'gemini-1.5-pro-latest',          // Gemini 1.5 Pro Latest
    'gemini-1.5-flash',               // Gemini 1.5 Flash (estable)
    'gemini-1.5-pro'                  // Gemini 1.5 Pro (estable)
  ];
  
  let lastError: any = null;
  
  // Procesar datos para el análisis
  const todayEarnings = userData.todayEarnings; // Ya es la diferencia calculada
  const weeklyTotal = userData.weeklyData.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
  const avgDaily = weeklyTotal / 7;
  
  // Encontrar mejor plataforma
  const platformStats = new Map();
  userData.weeklyData.forEach((item: any) => {
    const platformName = item.calculator_platforms?.name || 'Unknown';
    if (!platformStats.has(platformName)) {
      platformStats.set(platformName, { total: 0, days: 0 });
    }
    const stats = platformStats.get(platformName);
    stats.total += item.value || 0;
    stats.days += 1;
  });

  let bestPlatform = 'N/A';
  let bestAvg = 0;
  platformStats.forEach((stats, platform) => {
    const avg = stats.total / stats.days;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestPlatform = platform;
    }
  });

  const prompt = `
Eres un asistente especializado en análisis de rendimiento para modelos de webcam. 
Genera insights útiles y motivadores con un tono casual y amigable, pero profesional.

DATOS DEL MODELO:
- Ganancias del día: $${todayEarnings.toFixed(2)} USD (diferencia entre hoy y ayer)
- Total acumulado hoy: $${userData.todayTotal.toFixed(2)} USD
- Total acumulado ayer: $${userData.yesterdayTotal.toFixed(2)} USD
- Promedio diario (última semana): $${avgDaily.toFixed(2)} USD
- Total semanal: $${weeklyTotal.toFixed(2)} USD
- Mejor plataforma: ${bestPlatform}
- Plataformas activas: ${userData.portfolio.length}

INSTRUCCIONES:
1. Genera 3 insights específicos y accionables
2. Proporciona 1 tip del día motivador
3. Da 3 recomendaciones específicas
4. Usa un tono casual y amigable, como un mentor experimentado
5. Incluye emojis apropiados
6. Sé específico pero motivador
7. Enfócate en estrategias de mejora y optimización

Responde en formato JSON:
{
  "insights": [
    {
      "type": "tip|analysis|recommendation|trend",
      "title": "título con emoji",
      "content": "contenido detallado",
      "priority": "high|medium|low",
      "category": "engagement|performance|strategy",
      "actionable": true
    }
  ],
  "dailyTip": "tip motivador del día",
  "recommendations": ["recomendación 1", "recomendación 2", "recomendación 3"],
  "performanceSummary": {
    "todayEarnings": ${todayEarnings},
    "weeklyTrend": ${((todayEarnings - avgDaily) / (avgDaily || 1) * 100).toFixed(1)},
    "bestPlatform": "${bestPlatform}",
    "goalProgress": 75.0
  }
}
`;

  // Intentar con cada modelo hasta que uno funcione
  for (const modelName of modelNames) {
    try {
      console.log(`🤖 [AI-DASHBOARD] Intentando con modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Limpiar el texto de markdown si existe
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanText);
        console.log(`✅ [AI-DASHBOARD] Éxito con modelo: ${modelName}`);
        return {
          ...parsed,
          lastUpdated: new Date().toISOString()
        };
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        // Continuar al siguiente modelo si hay error de parsing
        lastError = parseError;
        continue;
      }
      
    } catch (error: any) {
      console.warn(`⚠️ [AI-DASHBOARD] Error con modelo ${modelName}:`, error.message);
      lastError = error;
      // Continuar al siguiente modelo
      continue;
    }
  }
  
  // Si todos los modelos fallaron, usar fallback
  console.error('❌ [AI-DASHBOARD] Todos los modelos fallaron, usando fallback');
  return getFallbackInsights(userData);
}

function getFallbackInsights(userData: any) {
  const todayEarnings = userData.todayEarnings; // Ya es la diferencia calculada
  
  return {
    insights: [
      {
        type: 'tip',
        title: '💡 Tip de Engagement',
        content: 'Interactúa más con tu audiencia durante las primeras 30 minutos de tu sesión. Los usuarios que reciben atención personalizada tienden a quedarse más tiempo.',
        priority: 'high',
        category: 'engagement',
        actionable: true
      },
      {
        type: 'analysis',
        title: '📊 Análisis de Rendimiento',
        content: 'Mantén un registro consistente de tus ingresos para obtener mejores insights. La consistencia es clave para el crecimiento.',
        priority: 'medium',
        category: 'performance',
        actionable: true
      },
      {
        type: 'recommendation',
        title: '🎯 Recomendación Estratégica',
        content: 'Diversifica tu contenido con temas de conversación variados. Los usuarios valoran la autenticidad y la variedad.',
        priority: 'medium',
        category: 'strategy',
        actionable: true
      }
    ],
    dailyTip: '🌟 Tip del Día: Usa el chat para crear conexiones genuinas. Pregunta sobre sus intereses y comparte experiencias personales apropiadas.',
    recommendations: [
      'Optimiza tu perfil con tags más específicos',
      'Considera horarios de mayor audiencia',
      'Mantén consistencia en tu programación'
    ],
    performanceSummary: {
      todayEarnings: todayEarnings,
      weeklyTrend: 0,
      bestPlatform: 'N/A',
      goalProgress: 0
    },
    lastUpdated: new Date().toISOString()
  };
}

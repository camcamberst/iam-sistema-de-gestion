import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  AIM_BOTTY_ID, 
  getBotPersonalityForRole,
  type UserContext 
} from '@/lib/chat/aim-botty';
import { executeAnalyticsQuery, type AnalyticsQuery } from '@/lib/chat/bot-analytics';
import { 
  hasPermission, 
  requirePermission,
  getAllowedPlatforms,
  canRecommendPlatform,
  filterRecommendationsByRole,
  validatePlatformAccess,
  validateUserDataAccess,
  getPermissionDeniedMessage
} from '@/lib/chat/bot-permissions';
import type { BotCapability } from '@/lib/chat/bot-permissions';
import { executeWithRateLimit } from '@/lib/chat/rate-limiter';
import { 
  extractAndSaveMemory, 
  getMemoryContext 
} from '@/lib/chat/bot-memory';
import { withCache, generateCacheKey } from '@/lib/cache/query-cache';
import { fetchUrlContent, type FetchedContent } from '@/lib/chat/web-fetcher';
import { saveKnowledge, getRelevantKnowledge, formatKnowledgeForPrompt } from '@/lib/chat/bot-knowledge';
import { saveMemory } from '@/lib/chat/bot-memory';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Inicializar Google Gemini (lazy initialization)
let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY no está configurada en las variables de entorno');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

// POST: Procesar mensaje del usuario y generar respuesta del bot
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 [BOTTY-API] Recibida solicitud para generar respuesta');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ [BOTTY-API] Token de autorización no encontrado');
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ [BOTTY-API] Error de autenticación:', authError);
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    console.log('✅ [BOTTY-API] Usuario autenticado:', user.id);

    const body = await request.json();
    const { conversation_id, message_content, conversation_history = [] } = body;

    console.log('🤖 [BOTTY-API] Datos recibidos:', {
      conversation_id,
      message_length: message_content?.length,
      history_count: conversation_history?.length
    });

    if (!conversation_id || !message_content?.trim()) {
      console.error('❌ [BOTTY-API] Datos faltantes');
      return NextResponse.json({ 
        error: 'conversation_id y message_content son requeridos' 
      }, { status: 400 });
    }

    // Verificar que la conversación es con el bot
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('❌ [BOTTY-API] Error obteniendo conversación:', convError);
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    console.log('🤖 [BOTTY-API] Conversación encontrada:', {
      participant_1: conversation.participant_1_id,
      participant_2: conversation.participant_2_id,
      botId: AIM_BOTTY_ID
    });

    // Verificar que el usuario es participante y el otro es el bot
    const isParticipant1 = conversation.participant_1_id === user.id;
    const isParticipant2 = conversation.participant_2_id === user.id;
    const botIsParticipant1 = conversation.participant_1_id === AIM_BOTTY_ID;
    const botIsParticipant2 = conversation.participant_2_id === AIM_BOTTY_ID;

    console.log('🤖 [BOTTY-API] Verificación de participantes:', {
      isParticipant1,
      isParticipant2,
      botIsParticipant1,
      botIsParticipant2
    });

    if ((!isParticipant1 && !isParticipant2) || (!botIsParticipant1 && !botIsParticipant2)) {
      console.error('❌ [BOTTY-API] Esta conversación no es con AIM Botty');
      return NextResponse.json({ 
        error: 'Esta conversación no es con AIM Botty' 
      }, { status: 403 });
    }

    // Obtener contexto del usuario (con cache)
    console.log('🤖 [BOTTY-API] Obteniendo contexto del usuario...');
    const cacheKey = generateCacheKey('user_context', { userId: user.id });
    const userContext = await withCache(
      cacheKey,
      () => getUserContext(user.id, supabase),
      300000 // Cache por 5 minutos
    );

    // Detectar y ejecutar consultas analíticas si es necesario
    let analyticsData: any = null;
    const analyticsQuery = detectAnalyticsQuery(message_content, userContext.role);
    if (analyticsQuery) {
      console.log('📊 [BOTTY-API] Consulta analítica detectada:', analyticsQuery);
      try {
        // Validar permisos antes de ejecutar
        const requiredCapability = getRequiredCapabilityForQuery(analyticsQuery.type);
        if (requiredCapability && !hasPermission(userContext.role, requiredCapability)) {
          const deniedMessage = getPermissionDeniedMessage(requiredCapability, userContext.role);
          return NextResponse.json({ 
            error: deniedMessage 
          }, { status: 403 });
        }
        
        const analyticsResult = await executeAnalyticsQuery(
          analyticsQuery,
          user.id,
          userContext.role
        );
        if (analyticsResult.success) {
          analyticsData = analyticsResult.data;
          console.log('✅ [BOTTY-API] Consulta analítica ejecutada exitosamente');
        }
      } catch (error: any) {
        console.error('❌ [BOTTY-API] Error ejecutando consulta analítica:', error);
        // Si es error de permisos, retornar mensaje amigable
        if (error.message?.includes('permisos') || error.message?.includes('permisos')) {
          return NextResponse.json({ 
            error: error.message || 'No tienes permisos para esta consulta'
          }, { status: 403 });
        }
      }
    }

    // Extraer y guardar información relevante del mensaje
    await extractAndSaveMemory(user.id, conversation_id, message_content, userContext);

    // Generar respuesta con IA (rate limiting se maneja dentro de generateBotResponse)
    console.log('🤖 [BOTTY-API] Generando respuesta con IA...');
    const botResponse = await generateBotResponse(
      message_content,
      userContext,
      conversation_history,
      analyticsData,
      conversation_id
    );

    console.log('✅ [BOTTY-API] Respuesta generada, longitud:', botResponse.length);

    // Crear mensaje del bot en la conversación
    const { data: botMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation_id,
        sender_id: AIM_BOTTY_ID,
        content: botResponse,
        message_type: 'ai_response'
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ [BOTTY-API] Error creando mensaje del bot:', messageError);
      return NextResponse.json({ error: 'Error generando respuesta del bot' }, { status: 500 });
    }

    console.log('✅ [BOTTY-API] Mensaje del bot creado exitosamente:', botMessage.id);

    return NextResponse.json({ 
      success: true, 
      message: botMessage 
    });

  } catch (error) {
    console.error('Error en POST /api/chat/aim-botty:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Obtener contexto del usuario
async function getUserContext(userId: string, supabase: any): Promise<UserContext> {
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single();

  let groups: string[] = [];
  if (user?.role !== 'super_admin') {
    const { data: userGroups } = await supabase
      .from('user_groups')
      .select('groups(name)')
      .eq('user_id', userId);
    groups = (userGroups || []).map((ug: any) => ug.groups?.name).filter(Boolean);
  }

  // Obtener portafolio si es modelo
  let portfolio: any[] = [];
  if (user?.role === 'modelo') {
    const { data: config } = await supabase
      .from('calculator_config')
      .select('platforms')
      .eq('user_id', userId)
      .single();
    
    if (config?.platforms) {
      portfolio = config.platforms.filter((p: any) => p.enabled);
    }
  }

  // Obtener actividad reciente
  const { data: lastAnticipo } = await supabase
    .from('anticipos')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    userId: user?.id || userId,
    role: (user?.role as any) || 'modelo',
    name: user?.name || user?.email?.split('@')[0] || 'Usuario',
    email: user?.email || '',
    groups,
    portfolio,
    recentActivity: {
      lastAnticipo: lastAnticipo?.created_at
    }
  };
}

// Detectar consultas analíticas en el mensaje del usuario
function detectAnalyticsQuery(
  message: string,
  role: 'super_admin' | 'admin' | 'modelo'
): AnalyticsQuery | null {
  const lowerMessage = message.toLowerCase();

  // Patrones para detectar consultas analíticas
  // Super Admin puede hacer todas las consultas
  if (role === 'super_admin') {
    // Productividad por sede
    if (lowerMessage.match(/sede.*productiv|productiv.*sede|sede.*más.*productiv|más.*productiv.*sede/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'productivity_by_sede',
        params: { months }
      };
    }

    // Productividad por grupo
    if (lowerMessage.match(/grupo.*productiv|productiv.*grupo|grupo.*más.*productiv/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'productivity_by_group',
        params: { months }
      };
    }

    // Ranking de sedes
    if (lowerMessage.match(/ranking.*sede|sede.*ranking|ordenar.*sede|sede.*orden|top.*sede/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'sede_ranking',
        params: { months }
      };
    }
  }

  // Admin y Super Admin pueden consultar grupos
  if (role === 'admin' || role === 'super_admin') {
    // Productividad por grupo
    if (lowerMessage.match(/grupo.*productiv|productiv.*grupo|grupo.*más.*productiv/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'productivity_by_group',
        params: { months }
      };
    }

    // Top modelos
    if (lowerMessage.match(/top.*modelo|mejor.*modelo|modelo.*más.*productiv|ranking.*modelo/)) {
      const limit = extractNumber(lowerMessage, /top\s*(\d+)/) || 10;
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'top_models',
        params: { limit, months }
      };
    }

    // Tendencia de productividad
    if (lowerMessage.match(/tendencia|evoluci|crecimiento|dismin|aumento.*productiv/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'productivity_trend',
        params: { months }
      };
    }

    // Ranking de grupos
    if (lowerMessage.match(/ranking.*grupo|grupo.*ranking|ordenar.*grupo/)) {
      const months = extractMonths(lowerMessage) || 6;
      return {
        type: 'group_ranking',
        params: { months }
      };
    }
  }

  // Todos los roles pueden consultar sus propias estadísticas
  if (lowerMessage.match(/mi.*estadística|mi.*productividad|mi.*rendimiento|cuánto.*gan|mis.*datos/)) {
    const months = extractMonths(lowerMessage) || 6;
    return {
      type: 'model_statistics',
      params: { months }
    };
  }

  return null;
}

// Obtener capacidad requerida para un tipo de consulta analítica
function getRequiredCapabilityForQuery(
  queryType: AnalyticsQuery['type']
): BotCapability | null {
  const mapping: Record<AnalyticsQuery['type'], BotCapability> = {
    'productivity_by_sede': 'analytics_sede_stats',
    'productivity_by_group': 'analytics_group_stats',
    'top_models': 'analytics_rankings',
    'productivity_trend': 'analytics_trends',
    'period_comparison': 'analytics_comparison',
    'group_ranking': 'analytics_rankings',
    'sede_ranking': 'analytics_sede_stats',
    'model_statistics': 'analytics_own_stats'
  };
  
  return mapping[queryType] || null;
}

// Extraer número de meses del mensaje
function extractMonths(message: string): number | undefined {
  // Buscar patrones como "último semestre", "6 meses", "últimos 3 meses", etc.
  if (message.match(/último\s*semestre|semestre/)) return 6;
  if (message.match(/último\s*trimestre|trimestre/)) return 3;
  if (message.match(/último\s*mes/)) return 1;
  if (message.match(/último\s*año|año/)) return 12;
  
  const match = message.match(/(\d+)\s*mes/);
  if (match) return parseInt(match[1]);
  
  return undefined;
}

// Extraer número de un patrón específico
function extractNumber(message: string, pattern: RegExp): number | undefined {
  const match = message.match(pattern);
  if (match && match[1]) return parseInt(match[1]);
  return undefined;
}

// Generar respuesta del bot usando IA
async function generateBotResponse(
  userMessage: string,
  userContext: UserContext,
  conversationHistory: any[],
  analyticsData?: any,
  conversationId?: string
): Promise<string> {
  try {
    // Verificar que la API key esté configurada
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ [BOTTY-GEN] GOOGLE_GEMINI_API_KEY no está configurada');
      console.error('❌ [BOTTY-GEN] Variables de entorno disponibles:', {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasGeminiKey: false
      });
      return 'Lo siento, el servicio de IA no está configurado. Por favor, contacta a tu administrador.';
    }
    
    console.log('✅ [BOTTY-GEN] API Key encontrada, longitud:', apiKey.length);

    const personality = getBotPersonalityForRole(userContext.role);
    
    // Construir historial de conversación
    const historyText = conversationHistory
      .slice(-10) // Últimos 10 mensajes
      .map((msg: any) => {
        const isBot = msg.sender_id === AIM_BOTTY_ID;
        return `${isBot ? 'AIM Botty' : userContext.name}: ${msg.content}`;
      })
      .join('\n');

    // Obtener contexto de memoria del usuario
    const memoryContext = await getMemoryContext(userContext.userId);
    
    // Obtener conocimiento del sistema
    const { formatSystemKnowledgeForPrompt } = await import('@/lib/chat/system-knowledge');
    const systemKnowledge = formatSystemKnowledgeForPrompt(userContext.role);
    
    // Obtener recursos útiles relevantes para la consulta (solo URLs, no contenido)
    const { getRelevantResources, formatResourcesForPrompt } = await import('@/lib/chat/bot-resources');
    const relevantResources = await getRelevantResources(userMessage, userContext);
    const resourcesContext = formatResourcesForPrompt(relevantResources);
    
    // Extraer URLs de recursos para function calling
    const resourceUrls = relevantResources.map(r => r.url);
    
    // Obtener conocimiento aprendido (solo para admins/super admins)
    let learnedKnowledgeContext = '';
    if (userContext.role === 'super_admin' || userContext.role === 'admin') {
      const { getRelevantKnowledge, formatKnowledgeForPrompt } = await import('@/lib/chat/bot-knowledge');
      const relevantKnowledge = await getRelevantKnowledge(userMessage, 5);
      learnedKnowledgeContext = formatKnowledgeForPrompt(relevantKnowledge);
    }
    
    // Construir información de contexto
    let contextInfo = '';
    let analyticsContext = '';
    
    if (analyticsData) {
      analyticsContext = `
DATOS ANALÍTICOS DISPONIBLES:
${JSON.stringify(analyticsData, null, 2)}

IMPORTANTE: Usa estos datos analíticos para responder la pregunta del usuario. Presenta la información de manera clara y estructurada, destacando los resultados más importantes. Si hay rankings, menciona los top 3-5. Si hay totales, inclúyelos en tu respuesta. Formatea los números de manera legible (ej: $1,234.56 USD).
`;
    }

    if (userContext.role === 'modelo') {
      const allowedPlatforms = getAllowedPlatforms(userContext);
      contextInfo = `
INFORMACIÓN DEL MODELO:
- Nombre: ${userContext.name}
- Plataformas activas: ${userContext.portfolio?.length || 0}
- Último anticipo: ${userContext.recentActivity?.lastAnticipo ? new Date(userContext.recentActivity.lastAnticipo).toLocaleDateString() : 'N/A'}

PLATAFORMAS EN PORTAFOLIO (SOLO ESTAS):
${userContext.portfolio?.map((p: any) => `- ${p.platform_name || p.platform_id}`).join('\n') || 'Ninguna configurada'}

⚠️ LÍMITES Y RESTRICCIONES IMPORTANTES:
- SOLO puedes consultar tus PROPIOS datos y estadísticas
- SOLO puedes recibir información y tips sobre TUS plataformas del portafolio
- NO puedes acceder a datos de otros modelos
- NO puedes modificar configuraciones (porcentajes, objetivos, etc.)
- NO puedes recibir recomendaciones de plataformas que NO están en tu portafolio
- Para cambios de configuración, debes contactar a tu administrador

CAPACIDADES DISPONIBLES:
- Información sobre TUS plataformas del portafolio únicamente
- Tips de transmisión (make up, ángulos, iluminación) para TUS plataformas
- Consejería emocional y apoyo
- Tips para potenciar transmisiones en TUS plataformas
- Consultas sobre MIS propias estadísticas y productividad
- Solicitud de anticipos
- Escalamiento a admin cuando sea necesario

PLATAFORMAS PERMITIDAS PARA RECOMENDACIONES:
${allowedPlatforms.length > 0 ? allowedPlatforms.map(p => `- ${p}`).join('\n') : 'Ninguna - Solo puedes recibir tips sobre tus plataformas configuradas'}
`;
    } else if (userContext.role === 'admin') {
      contextInfo = `
INFORMACIÓN DEL ADMIN:
- Nombre: ${userContext.name}
- Grupos gestionados: ${userContext.groups?.length || 0}
- Grupos: ${userContext.groups?.join(', ') || 'Ninguno'}

CAPACIDADES ANALÍTICAS DISPONIBLES:
- Análisis de productividad por grupo (grupos que gestionas)
- Top modelos por productividad
- Tendencia de productividad
- Ranking de grupos
- Estadísticas individuales de modelos
`;
    } else {
      contextInfo = `
INFORMACIÓN DEL SUPER ADMIN:
- Nombre: ${userContext.name}
- Acceso completo al sistema

CAPACIDADES ANALÍTICAS DISPONIBLES:
- Análisis de productividad por sede (organización)
- Análisis de productividad por grupo
- Top modelos por productividad
- Tendencia de productividad
- Ranking de sedes y grupos
- Comparación entre períodos
- Estadísticas completas del sistema
`;
    }

    // Construir prompt base (sin recursos, ya que los obtendremos con function calling si es necesario)
    const basePrompt = `
${personality}

${systemKnowledge}

${contextInfo}

${memoryContext ? `\n${memoryContext}\n` : ''}

${analyticsContext}

${learnedKnowledgeContext}

${historyText ? `\nHISTORIAL DE CONVERSACIÓN (últimos 10 mensajes):\n${historyText}\n` : ''}

MENSAJE DEL USUARIO: ${userMessage}

INSTRUCCIONES CRÍTICAS DE SEGURIDAD Y LÍMITES:
${userContext.role === 'modelo' ? `
⚠️ RESTRICCIONES ABSOLUTAS PARA MODELOS:
1. SI el usuario pregunta sobre plataformas que NO están en su portafolio, debes decirle claramente: 
   "Lo siento, solo puedo ayudarte con información sobre tus plataformas configuradas: [lista plataformas]. Si tienes preguntas sobre otras plataformas, contacta a tu administrador."

2. SI el usuario intenta consultar datos de otros usuarios, di: 
   "Solo puedo ayudarte con tus propios datos. No tengo acceso a información de otros usuarios."

3. SI el usuario intenta modificar configuraciones (porcentajes, objetivos, etc.), di: 
   "No puedo modificar configuraciones. Solo los administradores pueden hacer cambios. Si necesitas modificar algo, contacta a tu administrador."

4. SI el usuario pregunta sobre plataformas, SOLO proporciona información de SUS plataformas del portafolio.
` : ''}

INSTRUCCIONES GENERALES:
1. Responde de manera natural y conversacional
2. ${analyticsData ? 'USA los datos analíticos proporcionados para responder con información precisa y específica. Presenta los datos de forma estructurada y legible.' : ''}
3. ${userContext.role === 'modelo' ? 'Si el usuario pregunta sobre plataformas, VERIFICA primero que estén en su portafolio. SOLO proporciona tips de SUS plataformas.' : 'Si el usuario pregunta sobre plataformas, proporciona tips específicos'}
4. Si necesita soporte técnico, ofrece soluciones prácticas primero
5. Si no puedes resolver algo técnico, menciona que puedes escalarlo al admin
6. Si pregunta sobre consejería emocional, sé empático y comprensivo
7. ${userContext.role === 'super_admin' || userContext.role === 'admin' ? 'Si el usuario pregunta sobre productividad, sedes, grupos, rankings o análisis de datos, puedes proporcionar información analítica detallada usando los datos del sistema.' : ''}
8. Mantén las respuestas concisas pero útiles. ${analyticsData ? 'Para consultas analíticas, puedes extender la respuesta para incluir toda la información relevante.' : 'Máximo 3-4 párrafos.'}
9. Usa emojis apropiados pero con moderación
10. Si es una consulta que requiere escalamiento, indica claramente "Puedo escalar esto a tu administrador"
${analyticsData ? '11. Formatea números grandes de manera legible (ej: $1,234.56 USD, $2.5M USD)' : ''}
${userContext.role === 'modelo' ? '12. SIEMPRE verifica que cualquier plataforma mencionada esté en el portafolio del usuario antes de dar información sobre ella.' : ''}
13. IMPORTANTE: Si el usuario pregunta sobre CUALQUIER aspecto del sistema (funcionalidades, cómo funciona algo, arquitectura, módulos, flujos de trabajo, APIs, estructura de datos, permisos, etc.), usa el CONOCIMIENTO DEL SISTEMA proporcionado arriba para dar una respuesta completa y precisa.
14. Para preguntas técnicas sobre el sistema, sé específico y detallado. Explica cómo funcionan las cosas, qué tablas se usan, qué flujos se ejecutan, etc.
15. Si preguntan "¿cómo funciona X?", explica el flujo completo desde el inicio hasta el final usando el conocimiento del sistema.
16. Si necesitas información detallada de alguna URL de los recursos disponibles, usa la función fetch_url_content para obtener el contenido. Solo usa esta función si realmente necesitas información específica de la URL.
17. Si obtienes contenido de una URL, úsalo para responder de manera precisa y detallada al usuario.
18. ${userContext.role === 'super_admin' || userContext.role === 'admin' ? 'IMPORTANTE: Si el usuario te pide que guardes información (ej: "guarda esto", "recuerda esto", "aprende esto"), usa la función save_knowledge para guardar el conocimiento en la base de datos. Asegúrate de extraer un título claro, categoría apropiada, contenido completo y tags relevantes.' : ''}
19. Si el usuario te pide que recuerdes algo sobre él (preferencias, metas, información personal), usa la función save_memory para guardarlo en su memoria personal.
20. Cuando guardes conocimiento o memoria, confirma al usuario que lo has guardado exitosamente.

RESPUESTA:
`;

    // Lista de modelos para intentar (más recientes primero - Gemini 2.5 2025)
    // Modelos actualizados a las versiones más recientes disponibles
    const modelNames = [
      'gemini-2.5-flash',              // Gemini 2.5 Flash - Más rápido (2025)
      'gemini-2.5-pro',                // Gemini 2.5 Pro - Más avanzado (2025)
      'gemini-2.5-flash-lite',         // Gemini 2.5 Flash-Lite - Optimizado (2025)
      'gemini-1.5-flash',              // Fallback: versión estable anterior
      'gemini-1.5-pro',                // Fallback: versión estable anterior
      'gemini-pro'                     // Legacy fallback
    ];
    
    let lastError: any = null;
    
    // Obtener instancia de Gemini
    const geminiInstance = getGenAI();
    
    // Definir schemas de funciones para Gemini
    const fetchUrlContentFunction = {
      name: 'fetch_url_content',
      description: 'Obtiene el contenido de una URL específica. Úsala cuando necesites información detallada de un recurso o enlace web para responder con precisión.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'La URL completa del recurso del cual obtener el contenido'
          }
        },
        required: ['url']
      }
    };

    // Función para guardar conocimiento (solo para admins/super admins)
    const saveKnowledgeFunction = {
      name: 'save_knowledge',
      description: 'Guarda información importante en la base de conocimiento de Botty para que la use en futuras conversaciones. SOLO usa esta función si el usuario (admin/super admin) te pide explícitamente que guardes algo, o si dice "recuerda esto", "guarda esto", "aprende esto", etc.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['system_info', 'tips', 'policies', 'procedures', 'faq', 'custom'],
            description: 'Categoría del conocimiento'
          },
          title: {
            type: 'string',
            description: 'Título breve y descriptivo del conocimiento'
          },
          content: {
            type: 'string',
            description: 'Contenido completo del conocimiento a guardar'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags relevantes para búsqueda (ej: ["makeup", "iluminacion", "anticipos"])'
          }
        },
        required: ['category', 'title', 'content']
      }
    };

    // Función para guardar memoria del usuario
    const saveMemoryFunction = {
      name: 'save_memory',
      description: 'Guarda información importante sobre el usuario actual en su memoria personal. SOLO usa esta función si el usuario te pide que recuerdes algo sobre él, o si menciona información personal relevante (preferencias, metas, problemas, etc.).',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['preference', 'context', 'fact', 'reminder', 'goal', 'issue'],
            description: 'Tipo de memoria'
          },
          key: {
            type: 'string',
            description: 'Clave única para esta memoria (ej: "favorite_platform", "preferred_hours")'
          },
          value: {
            type: 'string',
            description: 'Valor de la memoria (puede ser texto, número, o JSON)'
          }
        },
        required: ['type', 'key', 'value']
      }
    };

    // Construir lista de funciones según el rol
    // Usar 'as any' para evitar problemas de tipado estricto con Gemini API
    const availableFunctions: any[] = [fetchUrlContentFunction];
    
    // Solo admins/super admins pueden guardar conocimiento
    if (userContext.role === 'super_admin' || userContext.role === 'admin') {
      availableFunctions.push(saveKnowledgeFunction);
    }
    
    // Todos pueden guardar memoria personal
    availableFunctions.push(saveMemoryFunction);

    // Construir lista de URLs disponibles para el contexto
    const availableUrlsText = resourceUrls.length > 0 
      ? `\n\nRECURSOS DISPONIBLES (URLs que puedes consultar si necesitas información detallada):\n${resourceUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}\n`
      : '';

    const prompt = basePrompt + availableUrlsText;

    console.log('🤖 [BOTTY-GEN] Generando respuesta con IA...');
    console.log('🤖 [BOTTY-GEN] Prompt length:', prompt.length);

    // Intentar con cada modelo hasta que uno funcione
    for (const modelName of modelNames) {
      try {
        console.log(`🤖 [BOTTY-GEN] Intentando con modelo: ${modelName}`);
        const model = geminiInstance.getGenerativeModel({ 
          model: modelName,
          tools: [{
            functionDeclarations: availableFunctions
          }]
        });
        
        // Ejecutar con rate limiting y manejar function calling
        const result = await executeWithRateLimit(
          async () => {
            let response = await model.generateContent(prompt);
            
            // Verificar si Gemini quiere llamar a una función
            while (response.candidates && response.candidates[0]?.content?.parts?.[0]?.functionCall) {
              const functionCall = response.candidates[0].content.parts[0].functionCall;
              
              console.log(`🔧 [BOTTY-GEN] Gemini quiere usar función: ${functionCall.name}`);
              
              if (functionCall.name === 'fetch_url_content') {
                const url = functionCall.args?.url;
                if (!url) {
                  console.error('❌ [BOTTY-GEN] URL no proporcionada en function call');
                  break;
                }
                
                console.log(`🌐 [BOTTY-GEN] Obteniendo contenido de: ${url}`);
                const fetchedContent = await fetchUrlContent(url);
                
                // Construir respuesta de función para Gemini
                const functionResponse = {
                  functionResponse: {
                    name: 'fetch_url_content',
                    response: fetchedContent.success 
                      ? {
                          success: true,
                          url: fetchedContent.url,
                          title: fetchedContent.title,
                          content: fetchedContent.content
                        }
                      : {
                          success: false,
                          url: fetchedContent.url,
                          error: fetchedContent.error || 'Error desconocido'
                        }
                  }
                };
                
                // Continuar la conversación con el resultado de la función
                response = await model.generateContent([
                  { text: prompt },
                  ...(responseData.candidates[0]?.content?.parts || []),
                  functionResponse
                ]);
                // Actualizar responseData para la siguiente iteración
                const updatedResponseData = (response as any).response || response;
                Object.assign(responseData, updatedResponseData);
              } else if (functionCall.name === 'save_knowledge') {
                // Solo admins/super admins pueden guardar conocimiento
                if (userContext.role !== 'super_admin' && userContext.role !== 'admin') {
                  const functionResponse = {
                    functionResponse: {
                      name: 'save_knowledge',
                      response: {
                        success: false,
                        error: 'No tienes permisos para guardar conocimiento. Solo admins y super admins pueden hacerlo.'
                      }
                    }
                  };
                  response = await model.generateContent([
                    { text: prompt },
                    ...(responseData.candidates[0]?.content?.parts || []),
                    functionResponse
                  ]);
                  // Actualizar responseData para la siguiente iteración
                  const updatedResponseData = (response as any).response || response;
                  Object.assign(responseData, updatedResponseData);
                  continue;
                }

                const { category, title, content, tags } = functionCall.args || {};
                
                if (!category || !title || !content) {
                  console.error('❌ [BOTTY-GEN] Parámetros incompletos para save_knowledge');
                  break;
                }
                
                console.log(`💾 [BOTTY-GEN] Guardando conocimiento: ${title}`);
                const savedKnowledge = await saveKnowledge({
                  category,
                  title,
                  content,
                  tags: tags || [],
                  priority: 0,
                  is_active: true,
                  created_by: userContext.userId
                });
                
                const functionResponse = {
                  functionResponse: {
                    name: 'save_knowledge',
                    response: savedKnowledge
                      ? {
                          success: true,
                          message: `Conocimiento guardado exitosamente: "${title}". Ahora lo usaré en futuras conversaciones.`
                        }
                      : {
                          success: false,
                          error: 'Error al guardar el conocimiento'
                        }
                  }
                };
                
                response = await model.generateContent([
                  { text: prompt },
                  ...(responseData.candidates[0]?.content?.parts || []),
                  functionResponse
                ]);
                // Actualizar responseData para la siguiente iteración
                const updatedResponseData = (response as any).response || response;
                Object.assign(responseData, updatedResponseData);
              } else if (functionCall.name === 'save_memory') {
                const { type, key, value } = functionCall.args || {};
                
                if (!type || !key || !value) {
                  console.error('❌ [BOTTY-GEN] Parámetros incompletos para save_memory');
                  break;
                }
                
                console.log(`💾 [BOTTY-GEN] Guardando memoria: ${key} = ${value}`);
                const saved = await saveMemory({
                  user_id: userContext.userId,
                  type,
                  key,
                  value,
                  metadata: {
                    source_conversation_id: conversationId,
                    mentioned_at: new Date().toISOString()
                  }
                });
                
                const functionResponse = {
                  functionResponse: {
                    name: 'save_memory',
                    response: saved
                      ? {
                          success: true,
                          message: `Información guardada en tu memoria. La recordaré en futuras conversaciones.`
                        }
                      : {
                          success: false,
                          error: 'Error al guardar la memoria'
                        }
                  }
                };
                
                response = await model.generateContent([
                  { text: prompt },
                  ...(responseData.candidates[0]?.content?.parts || []),
                  functionResponse
                ]);
                // Actualizar responseData para la siguiente iteración
                const updatedResponseData = (response as any).response || response;
                Object.assign(responseData, updatedResponseData);
              } else {
                console.warn(`⚠️ [BOTTY-GEN] Función desconocida: ${functionCall.name}`);
                break;
              }
            }
            
            return response;
          }
        );
        
        const response = result;
        let text = response.text().trim();

        // Limpiar markdown si existe
        text = text.replace(/```[\s\S]*?```/g, '').trim();
        
        console.log(`✅ [BOTTY-GEN] Respuesta generada exitosamente con ${modelName}, longitud:`, text.length);
        return text;
        
      } catch (modelError: any) {
        console.error(`❌ [BOTTY-GEN] Error con ${modelName}:`, {
          message: modelError?.message,
          status: modelError?.status,
          statusText: modelError?.statusText
        });
        lastError = modelError;
        
        // Si es error 404 o "not found", intentar siguiente modelo
        if (modelError?.message?.includes('404') || 
            modelError?.message?.includes('not found') ||
            modelError?.status === 404) {
          console.log(`⚠️ [BOTTY-GEN] ${modelName} no disponible, intentando siguiente modelo...`);
          continue; // Intentar siguiente modelo
        }
        
        // Si es error de API key o autenticación, no intentar otros modelos
        if (modelError?.message?.includes('API key') || 
            modelError?.message?.includes('authentication') ||
            modelError?.message?.includes('PERMISSION_DENIED')) {
          console.error('❌ [BOTTY-GEN] Error de autenticación, no intentando más modelos');
          throw modelError;
        }
        
        // Si es otro tipo de error (rate limit, etc), intentar siguiente modelo
        if (modelError?.status === 429 || modelError?.message?.includes('rate limit')) {
          console.log(`⚠️ [BOTTY-GEN] Rate limit en ${modelName}, intentando siguiente modelo...`);
          continue;
        }
        
        // Para otros errores, solo continuar si es un error de modelo
        if (modelError?.message?.includes('model') || modelError?.message?.includes('Model')) {
          continue;
        }
        
        // Si no es error de modelo, lanzar el error
        throw modelError;
      }
    }
    
    // Si llegamos aquí, todos los modelos fallaron
    console.error('❌ [BOTTY-GEN] Todos los modelos fallaron. Último error:', lastError);
    
    // Mensaje más específico según el error
    if (lastError?.message?.includes('API key') || lastError?.message?.includes('authentication')) {
      return 'Lo siento, hay un problema con la configuración del servicio de IA. Por favor, contacta a tu administrador.';
    }
    
    if (lastError?.message?.includes('404') || lastError?.message?.includes('not found')) {
      return 'Lo siento, el modelo de IA no está disponible en este momento. Por favor, intenta más tarde o contacta a tu administrador.';
    }
    
    if (lastError?.status === 429 || lastError?.message?.includes('rate limit')) {
      return 'Lo siento, el servicio está experimentando alta demanda. Por favor, intenta en unos momentos.';
    }
    
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a tu administrador.';

  } catch (error: any) {
    console.error('❌ [BOTTY-GEN] Error generando respuesta del bot:', error);
    console.error('❌ [BOTTY-GEN] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      status: error?.status,
      statusText: error?.statusText,
      code: error?.code,
      response: error?.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
    
    // Log completo del error para debugging
    if (error?.response) {
      console.error('❌ [BOTTY-GEN] Error response completo:', JSON.stringify(error.response, null, 2));
    }
    
    // Mensaje más específico según el error
    if (error?.message?.includes('API key') || 
        error?.message?.includes('authentication') || 
        error?.message?.includes('PERMISSION_DENIED') ||
        error?.message?.includes('no está configurada')) {
      return 'Lo siento, hay un problema con la configuración del servicio de IA. Por favor, contacta a tu administrador.';
    }
    
    // Si el error contiene información de 404 o not found, o si todos los modelos fallaron
    if (error?.message?.includes('404') || 
        error?.message?.includes('not found') ||
        error?.message?.includes('Todos los modelos fallaron') ||
        error?.status === 404 ||
        (error?.response?.status === 404)) {
      console.error('❌ [BOTTY-GEN] Todos los modelos fallaron con 404 - verificando API key...');
      console.error('❌ [BOTTY-GEN] API Key presente:', !!process.env.GOOGLE_GEMINI_API_KEY);
      return 'Lo siento, el modelo de IA no está disponible en este momento. Por favor, intenta más tarde o contacta a tu administrador.';
    }
    
    if (error?.status === 429 || error?.message?.includes('rate limit')) {
      return 'Lo siento, el servicio está experimentando alta demanda. Por favor, intenta en unos momentos.';
    }
    
    // Si hay un error desconocido, intentar dar más información
    console.error('❌ [BOTTY-GEN] Error desconocido, mostrando mensaje genérico');
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a tu administrador.';
  }
}


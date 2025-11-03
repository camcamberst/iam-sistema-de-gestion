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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Inicializar Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);

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

    // Obtener contexto del usuario
    console.log('🤖 [BOTTY-API] Obteniendo contexto del usuario...');
    const userContext = await getUserContext(user.id, supabase);

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

    // Generar respuesta con IA
    console.log('🤖 [BOTTY-API] Generando respuesta con IA...');
    const botResponse = await generateBotResponse(
      message_content,
      userContext,
      conversation_history,
      analyticsData
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
  analyticsData?: any
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const personality = getBotPersonalityForRole(userContext.role);
    
    // Construir historial de conversación
    const historyText = conversationHistory
      .slice(-10) // Últimos 10 mensajes
      .map((msg: any) => {
        const isBot = msg.sender_id === AIM_BOTTY_ID;
        return `${isBot ? 'AIM Botty' : userContext.name}: ${msg.content}`;
      })
      .join('\n');

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

    const prompt = `
${personality}

${contextInfo}

${analyticsContext}

${historyText ? `\nHISTORIAL DE CONVERSACIÓN:\n${historyText}\n` : ''}

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

RESPUESTA:
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Limpiar markdown si existe
    text = text.replace(/```[\s\S]*?```/g, '').trim();
    
    return text;

  } catch (error) {
    console.error('Error generando respuesta del bot:', error);
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a tu administrador.';
  }
}


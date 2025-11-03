// Procesador directo de respuestas del bot (para uso interno)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  AIM_BOTTY_ID, 
  getBotPersonalityForRole,
  type UserContext 
} from './aim-botty';
import { executeWithRateLimit } from './rate-limiter';
import { extractAndSaveMemory, getMemoryContext } from './bot-memory';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Inicializar Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY as string);

// Procesar respuesta del bot directamente (sin fetch interno)
export async function processBotResponse(
  userId: string,
  conversationId: string,
  messageContent: string,
  conversationHistory: any[] = []
): Promise<boolean> {
  try {
    console.log('🤖 [BOTTY-DIRECT] Procesando respuesta del bot...');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar que la conversación es con el bot
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('❌ [BOTTY-DIRECT] Conversación no encontrada:', convError);
      return false;
    }

    // Verificar que es conversación con el bot
    const botIsParticipant1 = conversation.participant_1_id === AIM_BOTTY_ID;
    const botIsParticipant2 = conversation.participant_2_id === AIM_BOTTY_ID;

    if (!botIsParticipant1 && !botIsParticipant2) {
      console.error('❌ [BOTTY-DIRECT] Esta conversación no es con el bot');
      return false;
    }

    // Obtener contexto del usuario
    const userContext = await getUserContext(userId, supabase);

    // Extraer y guardar información relevante del mensaje
    await extractAndSaveMemory(userId, conversationId, messageContent, userContext);

    // Generar respuesta con IA (con rate limiting)
    const botResponse = await executeWithRateLimit(
      () => generateBotResponse(
        messageContent,
        userContext,
        conversationHistory,
        conversationId
      )
    );

    // Crear mensaje del bot
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: AIM_BOTTY_ID,
        content: botResponse,
        message_type: 'ai_response'
      });

    if (messageError) {
      console.error('❌ [BOTTY-DIRECT] Error creando mensaje:', messageError);
      return false;
    }

    console.log('✅ [BOTTY-DIRECT] Respuesta del bot generada exitosamente');
    return true;

  } catch (error) {
    console.error('❌ [BOTTY-DIRECT] Error procesando respuesta:', error);
    return false;
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

// Generar respuesta del bot usando IA
async function generateBotResponse(
  userMessage: string,
  userContext: UserContext,
  conversationHistory: any[],
  conversationId?: string
): Promise<string> {
  try {
    console.log('🤖 [BOTTY-GEN] Iniciando generación de respuesta...');
    
    // Verificar que la API key esté configurada
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('❌ [BOTTY-GEN] GOOGLE_GEMINI_API_KEY no está configurada');
      return 'Lo siento, el servicio de IA no está configurado. Por favor, contacta a tu administrador.';
    }

    console.log('🤖 [BOTTY-GEN] Obteniendo personalidad...');
    const personality = getBotPersonalityForRole(userContext.role);
    
    console.log('🤖 [BOTTY-GEN] Construyendo historial...');
    const historyText = conversationHistory
      .slice(-10)
      .map((msg: any) => {
        const isBot = msg.sender_id === AIM_BOTTY_ID;
        return `${isBot ? 'AIM Botty' : userContext.name}: ${msg.content}`;
      })
      .join('\n');
    
    // Determinar si es el primer mensaje del bot en esta conversación
    const isFirstBotMessage = conversationHistory.length === 0 || 
      !conversationHistory.some((msg: any) => msg.sender_id === AIM_BOTTY_ID);

    // Obtener contexto de memoria del usuario
    const memoryContext = await getMemoryContext(userContext.userId);
    
    console.log('🤖 [BOTTY-GEN] Construyendo contexto...');
    let contextInfo = '';
    if (userContext.role === 'modelo') {
      contextInfo = `
INFORMACIÓN DEL MODELO:
- Nombre: ${userContext.name}
- Plataformas activas: ${userContext.portfolio?.length || 0}
- Último anticipo: ${userContext.recentActivity?.lastAnticipo ? new Date(userContext.recentActivity.lastAnticipo).toLocaleDateString() : 'N/A'}

PLATAFORMAS EN PORTAFOLIO:
${userContext.portfolio?.map((p: any) => `- ${p.platform_name || p.platform_id}`).join('\n') || 'Ninguna configurada'}

CAPACIDADES DISPONIBLES:
- Información sobre plataformas del portafolio
- Tips de transmisión (make up, ángulos, iluminación)
- Consejería emocional y apoyo
- Tips para potenciar transmisiones
- Soporte técnico con búsqueda web
- Escalamiento a admin cuando sea necesario
`;
    } else if (userContext.role === 'admin') {
      contextInfo = `
INFORMACIÓN DEL ADMIN:
- Nombre: ${userContext.name}
- Grupos gestionados: ${userContext.groups?.length || 0}
`;
    } else {
      contextInfo = `
INFORMACIÓN DEL SUPER ADMIN:
- Nombre: ${userContext.name}
- Acceso completo al sistema
`;
    }

    const prompt = `
${personality}

${contextInfo}

${memoryContext ? `\n${memoryContext}\n` : ''}

${historyText ? `\nHISTORIAL DE CONVERSACIÓN (últimos 10 mensajes):\n${historyText}\n` : ''}

MENSAJE DEL USUARIO: ${userMessage}

INSTRUCCIONES:
1. Responde de manera SUPER CERCANA y amigable (como un buen amigo que te ayuda)
2. Sé CONCISO: máximo 2-3 oraciones (las respuestas deben ser cortas y directas)
3. Tono casual y cálido, habla de tú
4. ${isFirstBotMessage ? 'SOLO en este primer mensaje puedes saludar brevemente (ej: "¡Hola!").' : 'NO saludes, NUNCA. Responde directamente al mensaje sin saludos.'}
5. Si pregunta sobre plataformas, da tips breves y prácticos (1-2 oraciones máximo)
6. Para soporte técnico, soluciones rápidas y directas
7. Si no puedes resolver algo, menciona brevemente que puedes escalarlo
8. Consejería emocional: sé empático pero breve
9. Usa emojis con moderación (1-2 máximo por respuesta)
10. NUNCA escribas párrafos largos, siempre respuestas cortas y al punto
11. Mantén el tono cercano, amigable y positivo
${!isFirstBotMessage ? '12. IMPORTANTE: NO uses saludos como "¡Hola!", "Hola!", "¡Buen día!", etc. Responde directamente.' : ''}

RESPUESTA:
`;

    console.log('🤖 [BOTTY-GEN] Generando contenido con Gemini...');
    console.log('🤖 [BOTTY-GEN] Prompt length:', prompt.length);

    // Lista de modelos para intentar (más recientes primero)
    const modelNames = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];
    
    let lastError: any = null;
    
    // Intentar con cada modelo hasta que uno funcione
    for (const modelName of modelNames) {
      try {
        console.log(`🤖 [BOTTY-GEN] Intentando con modelo: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Ejecutar generación de contenido
        const result = await model.generateContent(prompt);
        const response = await result.response;
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
    throw lastError || new Error('Todos los modelos fallaron');

  } catch (error: any) {
    console.error('❌ [BOTTY-GEN] Error generando respuesta del bot:', error);
    console.error('❌ [BOTTY-GEN] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      status: error?.status
    });
    
    // Mensaje más específico según el error
    if (error?.message?.includes('API key') || error?.message?.includes('authentication')) {
      return 'Lo siento, hay un problema con la configuración del servicio de IA. Por favor, contacta a tu administrador.';
    }
    
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      return 'Lo siento, el modelo de IA no está disponible en este momento. Por favor, intenta más tarde o contacta a tu administrador.';
    }
    
    return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o contacta a tu administrador.';
  }
}


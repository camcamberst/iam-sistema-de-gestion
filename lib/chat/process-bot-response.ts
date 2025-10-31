// Procesador directo de respuestas del bot (para uso interno)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  AIM_BOTTY_ID, 
  getBotPersonalityForRole,
  type UserContext 
} from './aim-botty';

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

    // Generar respuesta con IA
    const botResponse = await generateBotResponse(
      messageContent,
      userContext,
      conversationHistory
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
  conversationHistory: any[]
): Promise<string> {
  try {
    console.log('🤖 [BOTTY-GEN] Iniciando generación de respuesta...');
    
    // Verificar que la API key esté configurada
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('❌ [BOTTY-GEN] GOOGLE_GEMINI_API_KEY no está configurada');
      return 'Lo siento, el servicio de IA no está configurado. Por favor, contacta a tu administrador.';
    }

    console.log('🤖 [BOTTY-GEN] Obteniendo modelo...');
    // Intentar con gemini-1.5-pro primero, si falla usar gemini-pro
    let model;
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      console.log('✅ [BOTTY-GEN] Usando modelo gemini-1.5-pro');
    } catch (error) {
      console.log('⚠️ [BOTTY-GEN] gemini-1.5-pro no disponible, usando gemini-pro');
      model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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

${historyText ? `\nHISTORIAL DE CONVERSACIÓN:\n${historyText}\n` : ''}

MENSAJE DEL USUARIO: ${userMessage}

INSTRUCCIONES:
1. Responde de manera natural y conversacional
2. Si el usuario pregunta sobre plataformas, proporciona tips específicos
3. Si necesita soporte técnico, ofrece soluciones prácticas primero
4. Si no puedes resolver algo técnico, menciona que puedes escalarlo al admin
5. Si pregunta sobre consejería emocional, sé empático y comprensivo
6. Mantén las respuestas concisas pero útiles (máximo 3-4 párrafos)
7. Usa emojis apropiados pero con moderación
8. Si es una consulta que requiere escalamiento, indica claramente "Puedo escalar esto a tu administrador"

RESPUESTA:
`;

    console.log('🤖 [BOTTY-GEN] Generando contenido con Gemini...');
    const result = await model.generateContent(prompt);
    
    console.log('🤖 [BOTTY-GEN] Obteniendo respuesta...');
    const response = await result.response;
    let text = response.text().trim();

      console.log('🤖 [BOTTY-GEN] Limpiando respuesta...');
      text = text.replace(/```[\s\S]*?```/g, '').trim();
      
      console.log('✅ [BOTTY-GEN] Respuesta generada exitosamente, longitud:', text.length);
      return text;
    } catch (genError: any) {
      console.error('❌ [BOTTY-GEN] Error en generateContent:', genError);
      // Si gemini-1.5-pro falla, intentar con gemini-pro como fallback
      if (model && genError?.message?.includes('404')) {
        console.log('🔄 [BOTTY-GEN] Intentando con gemini-pro como fallback...');
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
          const fallbackResult = await fallbackModel.generateContent(prompt);
          const fallbackResponse = await fallbackResult.response;
          let fallbackText = fallbackResponse.text().trim();
          fallbackText = fallbackText.replace(/```[\s\S]*?```/g, '').trim();
          console.log('✅ [BOTTY-GEN] Fallback exitoso con gemini-pro');
          return fallbackText;
        } catch (fallbackError) {
          console.error('❌ [BOTTY-GEN] Error en fallback:', fallbackError);
          throw genError; // Lanzar error original
        }
      }
      throw genError;
    }

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


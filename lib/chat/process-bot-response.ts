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

// Inicializar Google Gemini (solo si la API key existe)
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY no está configurada en las variables de entorno');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

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

    // Detección de intención especial: Boost Page
    let actionTag = '';
    
    // 1. Detección explícita con comando (Prioridad ALTA)
    // Ejemplos: /boost holly, /boostpage hollyrogers
    const commandMatch = messageContent.match(/^\/(?:boost|boostpage)\s+(.+)/i);
    
    // 2. Detección de lenguaje natural (Prioridad MEDIA)
    // Ejemplos: boost page a holly, subir fotos para holly
    const naturalMatch = messageContent.match(/(?:boost page|subir fotos?|cargar fotos?|boost)(?:\s+(?:a|para|de))?\s+([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s@._-]+)/i);
    
    const boostMatch = commandMatch || naturalMatch;
    
    if (boostMatch && (userContext.role === 'admin' || userContext.role === 'super_admin')) {
      const modelNameRaw = boostMatch[1].trim();
      // Limpiar un poco el nombre (quitar "la modelo", etc si quedaron)
      const modelName = modelNameRaw.replace(/^(a|la|el|para)\s+/i, '');
      
      console.log(`🔍 [BOTTY-INTENT] Detectado intento de Boost Page para: "${modelName}"`);
      
      // Buscar modelo en la base de datos
      // Buscar por nombre completo O por email (parte antes del @ o email completo)
      // IMPORTANTE: En algunos sistemas el rol es 'modelo' y en otros 'model', buscamos ambos para asegurar
      const { data: models, error: searchError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('role', ['modelo', 'model', 'user']) // Ampliar búsqueda de roles para asegurar
        .or(`name.ilike.%${modelName}%,email.ilike.%${modelName}%`)
        .limit(1);

      if (searchError) {
        console.error('❌ [BOTTY-INTENT] Error buscando modelo:', searchError);
      }

      if (models && models.length > 0) {
        const model = models[0];
        console.log(`✅ [BOTTY-INTENT] Modelo encontrada: ${model.name} (${model.email})`);
        
        // CORTOCIRCUITO: Generar respuesta directa SIN llamar a la IA
        // Esto garantiza que la acción se ejecute y ahorra tokens/latencia
        const directResponse = `¡Entendido! Abriendo herramienta Boost Page para **${model.name}**...`;
        actionTag = `\n\n<<ACTION:OPEN_BOOST_MODAL|${model.id}|${model.name}|${model.email}>>`;
        
        // Guardar mensaje y retornar (skip Gemini)
        const { error: messageError } = await supabase
          .from('chat_messages')
          .insert({
            conversation_id: conversationId,
            sender_id: AIM_BOTTY_ID,
            content: directResponse + actionTag,
            message_type: 'ai_response'
          });

        if (messageError) {
          console.error('❌ [BOTTY-DIRECT] Error guardando respuesta directa:', messageError);
          return false;
        }
        
        console.log('✅ [BOTTY-DIRECT] Respuesta DIRECTA (intención detectada) enviada exitosamente');
        return true;

      } else {
         console.log(`⚠️ [BOTTY-INTENT] No se encontró modelo con nombre/email: "${modelName}"`);
         // Si usó el comando explícito /boost y falló, debemos informarle
         if (commandMatch) {
            const errorResponse = `No pude encontrar a ninguna modelo con el nombre o email "${modelName}". Por favor verifica que esté bien escrito.`;
            await supabase.from('chat_messages').insert({
                conversation_id: conversationId,
                sender_id: AIM_BOTTY_ID,
                content: errorResponse,
                message_type: 'ai_response'
            });
            return true;
         }
         // Si fue lenguaje natural, dejamos que la IA responda
      }
    }

    // Generar respuesta con IA (con rate limiting) - Solo si no hubo cortocircuito
    const botResponseRaw = await executeWithRateLimit(
      () => generateBotResponse(
        messageContent,
        userContext,
        conversationHistory,
        conversationId
      )
    );

    // Detectar si la IA solicitó un escalamiento humano
    const escalateMatch = botResponseRaw.match(/<<ESCALATE:\s*(.+?)>>/i);
    if (escalateMatch) {
      const reason = escalateMatch[1];
      console.log(`⚠️ [BOTTY-DIRECT] Detectado intento de escalamiento: ${reason}`);
      // Ejecutar en background (sin bloquear la respuesta)
      handleEscalation(userId, userContext.name, reason, supabase).catch(err => 
        console.error('Error en escalamiento asíncrono:', err)
      );
    }

    // Crear mensaje del bot (Respuesta IA estándar)
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: AIM_BOTTY_ID,
        content: botResponseRaw, // Usar respuesta cruda de IA
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
    
    // Obtener conocimiento del sistema
    const { formatSystemKnowledgeForPrompt } = await import('./system-knowledge');
    const systemKnowledge = formatSystemKnowledgeForPrompt(userContext.role);
    
    // Obtener recursos útiles relevantes para la consulta
    const { getRelevantResources, formatResourcesForPrompt } = await import('./bot-resources');
    const relevantResources = await getRelevantResources(userMessage, userContext);
    const resourcesContext = formatResourcesForPrompt(relevantResources);
    
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

${systemKnowledge}

${contextInfo}

${memoryContext ? `\n${memoryContext}\n` : ''}

${resourcesContext}

${historyText ? `\nHISTORIAL DE CONVERSACIÓN (últimos 10 mensajes):\n${historyText}\n` : ''}

MENSAJE DEL USUARIO: ${userMessage}

INSTRUCCIONES:
1. Responde de manera SUPER CERCANA y amigable (como un buen amigo que te ayuda)
2. Sé CONCISO: máximo 2-3 oraciones (las respuestas deben ser cortas y directas), EXCEPTO cuando preguntan sobre el sistema - en ese caso puedes ser más detallado
3. Tono casual y cálido, habla de tú
4. ${isFirstBotMessage ? 'SOLO en este primer mensaje puedes saludar brevemente (ej: "¡Hola!").' : 'NO saludes, NUNCA. Responde directamente al mensaje sin saludos.'}
5. Si pregunta sobre plataformas, da tips breves y prácticos (1-2 oraciones máximo)
6. Para soporte técnico, soluciones rápidas y directas
7. Consejería emocional: sé empático pero breve
8. Usa emojis con moderación (1-2 máximo por respuesta)
9. NUNCA escribas párrafos largos, siempre respuestas cortas y al punto, EXCEPTO cuando preguntan específicamente sobre el sistema.
10. Mantén el tono cercano, amigable y positivo, respetando siempre tu personalidad.
${!isFirstBotMessage ? '11. IMPORTANTE: NO uses saludos como "¡Hola!", "Hola!", "¡Buen día!", etc. Responde directamente.' : ''}
12. IMPORTANTE: Si el usuario pregunta sobre CUALQUIER aspecto del sistema, usa el CONOCIMIENTO DEL SISTEMA proporcionado arriba para dar una respuesta completa.
13. ${resourcesContext ? 'RECURSOS IMPORTANTES: Si hay RECURSOS ÚTILES disponibles arriba y la consulta está relacionada, NUNCA uses Markdown normal para el enlace. DEBES usar EXACTAMENTE este formato: \`<<RESOURCE:id|title|url>>\` (ej: \`<<RESOURCE:clx|Guía de Luces|https://...>>\`).' : ''}
14. ESCALAMIENTO INTELIGENTE: Si definitivamente no puedes resolver el problema, o el usuario pide explícitamente hablar con un humano, administrador o soporte, DEBES incluir al final de tu respuesta el tag \`<<ESCALATE:Breve resumen del problema>>\`. Por ejemplo: \`<<ESCALATE:Usuario reporta problemas para acceder a su cuenta de Chaturbate>>\`.

RESPUESTA:
`;

    console.log('🤖 [BOTTY-GEN] Generando contenido con Gemini...');
    console.log('🤖 [BOTTY-GEN] Prompt length:', prompt.length);

    // Modelos estables y rápidos (Gemini 2.5 y 3.0 Flash)
    const modelNames = [
      'gemini-2.5-flash',               // Rápido, ideal para chat
      'gemini-2.0-flash',               // Fallback
      'gemini-flash-latest',            // Alias dinámico
      'gemini-pro-latest',              // Fallback Pro
      'gemini-3-flash-preview'          // Experimental
    ];
    
    let lastError: any = null;
    
    // Obtener instancia de Gemini
    const geminiInstance = getGenAI();
    
    // Intentar con cada modelo hasta que uno funcione
    for (const modelName of modelNames) {
      try {
        console.log(`🤖 [BOTTY-GEN] Intentando con modelo: ${modelName}`);
        const model = geminiInstance.getGenerativeModel({ model: modelName });
        
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
        // Si es error de API key o autenticación, es el único caso donde no intentamos más
        if (modelError?.message?.includes('API key') || 
            modelError?.message?.includes('authentication') ||
            modelError?.message?.includes('PERMISSION_DENIED')) {
          console.error('❌ [BOTTY-GEN] Error de autenticación, no intentando más modelos');
          throw modelError;
        }
        
        // Para CUALQUIER otro error (404, bad request, rate limit, parse error), 
        // continuamos intentando con el siguiente modelo en la lista
        console.log(`⚠️ [BOTTY-GEN] Fallo con ${modelName}, intentando siguiente modelo...`);
        continue;
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

// Función auxiliar para manejar el escalamiento a un administrador
async function handleEscalation(userId: string, userName: string, reason: string, supabase: any) {
  try {
    console.log(`🚀 [BOTTY-ESCALATE] Buscando administrador para el usuario ${userId}...`);
    
    // 1. Encontrar a qué grupos pertenece el usuario
    const { data: userGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', userId);
      
    if (!userGroups || userGroups.length === 0) {
      console.log('⚠️ [BOTTY-ESCALATE] El usuario no pertenece a ningún grupo. No se puede escalar a un admin específico.');
      return;
    }
    
    const groupIds = userGroups.map((ug: any) => ug.group_id);
    
    // 2. Encontrar al administrador de esos grupos
    // Primero, obtener los usuarios que son administradores ('admin')
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin');
      
    if (!admins || admins.length === 0) {
      console.log('⚠️ [BOTTY-ESCALATE] No hay administradores en el sistema.');
      return;
    }
    
    const adminIds = admins.map((a: any) => a.id);
    
    // Luego, buscar cuál de esos administradores está en los mismos grupos que la modelo
    const { data: adminGroups } = await supabase
      .from('user_groups')
      .select('user_id')
      .in('user_id', adminIds)
      .in('group_id', groupIds)
      .limit(1);
      
    let targetAdminId = null;
    
    if (adminGroups && adminGroups.length > 0) {
      targetAdminId = adminGroups[0].user_id;
      console.log(`✅ [BOTTY-ESCALATE] Encontrado administrador directo: ${targetAdminId}`);
    } else {
      // Fallback: Si no hay un admin directo en el grupo, escalar a un superadmin
      console.log('⚠️ [BOTTY-ESCALATE] No se encontró un admin en el mismo grupo. Buscando super_admin...');
      const { data: superAdmins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'super_admin')
        .limit(1);
        
      if (superAdmins && superAdmins.length > 0) {
        targetAdminId = superAdmins[0].id;
        console.log(`✅ [BOTTY-ESCALATE] Encontrado super_admin de respaldo: ${targetAdminId}`);
      }
    }
    
    if (!targetAdminId) {
      console.error('❌ [BOTTY-ESCALATE] No se pudo encontrar ningún administrador al cual escalar.');
      return;
    }
    
    // 3. Obtener o crear conversación entre Botty y el Administrador
    let conversationId = null;
    
    // Buscar conversación existente
    const { data: existingConvs } = await supabase
      .from('chat_conversations')
      .select('id')
      .or(`and(participant_1_id.eq.${AIM_BOTTY_ID},participant_2_id.eq.${targetAdminId}),and(participant_1_id.eq.${targetAdminId},participant_2_id.eq.${AIM_BOTTY_ID})`)
      .limit(1);
      
    if (existingConvs && existingConvs.length > 0) {
      conversationId = existingConvs[0].id;
    } else {
      // Crear nueva conversación
      const { data: newConv } = await supabase
        .from('chat_conversations')
        .insert({
          participant_1_id: AIM_BOTTY_ID,
          participant_2_id: targetAdminId,
          is_active: true
        })
        .select('id')
        .single();
        
      if (newConv) {
        conversationId = newConv.id;
      }
    }
    
    if (!conversationId) {
      console.error('❌ [BOTTY-ESCALATE] No se pudo obtener/crear conversación con el administrador.');
      return;
    }
    
    // 4. Enviar mensaje del bot al administrador
    const escalateMessage = `⚠️ **ESCALAMIENTO DE SOPORTE**\n\nLa modelo **${userName}** ha solicitado ayuda y requiere intervención humana.\n\n**Problema reportado:**\n${reason}\n\nPor favor, contáctate con ella a la brevedad posible.`;
    
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      sender_id: AIM_BOTTY_ID,
      content: escalateMessage,
      message_type: 'system_notification'
    });
    
    console.log('✅ [BOTTY-ESCALATE] Mensaje de escalamiento enviado al administrador.');
    
  } catch (error) {
    console.error('❌ [BOTTY-ESCALATE] Error en el proceso de escalamiento:', error);
  }
}

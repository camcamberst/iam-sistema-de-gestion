import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  AIM_BOTTY_ID, 
  getBotPersonalityForRole,
  type UserContext 
} from '@/lib/chat/aim-botty';

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

    // Generar respuesta con IA
    console.log('🤖 [BOTTY-API] Generando respuesta con IA...');
    const botResponse = await generateBotResponse(
      message_content,
      userContext,
      conversation_history
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

// Generar respuesta del bot usando IA
async function generateBotResponse(
  userMessage: string,
  userContext: UserContext,
  conversationHistory: any[]
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


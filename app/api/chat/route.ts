import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SecurityFilter } from '@/components/SecurityFilter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuración de Google Gemini
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
  groups: string[];
  portfolio?: any[];
  productivity?: any;
}

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId }: ChatRequest = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener datos del usuario
    const userContext = await getUserContext(user.id);
    
    // Crear o obtener sesión de chat
    const session = await getOrCreateChatSession(user.id, sessionId);
    
    // Verificar límites
    const limitCheck = await checkChatLimits(session.id, user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json({ 
        error: limitCheck.reason,
        limitReached: true 
      }, { status: 429 });
    }

    // VERSIÓN ULTRA-SEGURA: Filtrar mensaje antes de procesar
    const sanitizedMessage = SecurityFilter.sanitizeMessage(message);
    
    // Guardar mensaje filtrado del usuario
    await saveMessage(session.id, 'user', user.id, sanitizedMessage);

    // VERSIÓN ULTRA-SEGURA: No escalar automáticamente
    // const shouldEscalate = await checkEscalationConditions(session.id, sanitizedMessage, userContext);
    
    // if (shouldEscalate.should) {
    //   await escalateToAdmin(session.id, user.id, sanitizedMessage, shouldEscalate.reason);
    //   return NextResponse.json({
    //     response: "He escalado tu consulta a un administrador. Te contactarán pronto para ayudarte.",
    //     escalated: true,
    //     sessionId: session.id,
    //     ticketId: shouldEscalate.ticketId
    //   });
    // }

    // VERSIÓN ULTRA-SEGURA: Generar respuesta con contexto seguro
    const botResponse = await generateUltraSafeBotResponse(sanitizedMessage, userContext, session.id);
    
    // Guardar respuesta del bot
    await saveMessage(session.id, 'bot', null, botResponse);

    return NextResponse.json({
      response: botResponse,
      sessionId: session.id,
      escalated: false,
      securityLevel: 'ULTRA_SAFE' // Informar que se usó versión ultra-segura
    });

  } catch (error) {
    console.error('Error en chat API:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

async function getUserContext(userId: string): Promise<UserContext> {
  const { data: userData } = await supabase
    .from('users')
    .select(`
      id, name, email, role,
      user_groups(groups(name))
    `)
    .eq('id', userId)
    .single();

  if (!userData) {
    throw new Error('Usuario no encontrado');
  }

  const groups = userData.user_groups?.map((ug: any) => ug.groups.name) || [];

  // Obtener datos del portafolio si es modelo
  let portfolio = null;
  let productivity = null;
  
  if (userData?.role === 'modelo') {
    const { data: portfolioData } = await supabase
      .from('modelo_plataformas_detailed')
      .select('*')
      .eq('model_id', userId)
      .eq('status', 'entregada');

    portfolio = portfolioData || [];

    // Obtener datos de productividad básicos
    const { data: productivityData } = await supabase
      .from('calculator_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    productivity = productivityData;
  }

  return {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    groups,
    portfolio,
    productivity
  };
}

async function getOrCreateChatSession(userId: string, sessionId?: string) {
  if (sessionId) {
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (existingSession) {
      return existingSession;
    }
  }

  // Crear nueva sesión
  const { data: newSession, error } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return newSession;
}

async function checkChatLimits(sessionId: string, userId: string) {
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('message_count, last_activity')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return { allowed: false, reason: 'Sesión no encontrada' };
  }

  // Verificar límite de mensajes por sesión (20)
  if (session.message_count >= 20) {
    return { allowed: false, reason: 'Has alcanzado el límite de 20 mensajes por sesión' };
  }

  // Verificar timeout de inactividad (10 minutos)
  const lastActivity = new Date(session.last_activity);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  
  if (diffMinutes > 10) {
    return { allowed: false, reason: 'La sesión ha expirado por inactividad (10 minutos)' };
  }

  return { allowed: true };
}

async function checkEscalationConditions(sessionId: string, message: string, userContext: UserContext) {
  const lowerMessage = message.toLowerCase();

  // Palabras clave de escalación
  const urgentKeywords = ['urgente', 'emergencia', 'crítico', 'no funciona', 'error grave'];
  const hasUrgentKeyword = urgentKeywords.some(keyword => lowerMessage.includes(keyword));

  // Contar intentos en esta sesión
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('session_id', sessionId)
    .eq('sender_type', 'user');

  const attemptCount = messages?.length || 0;

  // Verificar solicitud explícita de admin
  const adminRequestKeywords = ['hablar con admin', 'contactar administrador', 'necesito admin', 'escalar'];
  const hasAdminRequest = adminRequestKeywords.some(keyword => lowerMessage.includes(keyword));

  // Condiciones de escalación
  const shouldEscalate = hasUrgentKeyword || attemptCount >= 3 || hasAdminRequest;
  
  let reason = '';
  if (hasUrgentKeyword) reason = 'Palabra clave urgente detectada';
  else if (attemptCount >= 3) reason = 'Máximo de intentos alcanzado';
  else if (hasAdminRequest) reason = 'Solicitud explícita de administrador';

  return {
    should: shouldEscalate,
    reason,
    attemptCount
  };
}

async function escalateToAdmin(sessionId: string, userId: string, message: string, reason: string) {
  // Marcar sesión como escalada
  await supabase
    .from('chat_sessions')
    .update({ 
      escalated: true, 
      escalated_at: new Date().toISOString() 
    })
    .eq('id', sessionId);

  // Crear ticket de soporte
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      session_id: sessionId,
      user_id: userId,
      title: `Escalación automática: ${reason}`,
      description: message,
      priority: message.toLowerCase().includes('urgente') ? 'urgent' : 'high',
      context_data: {
        reason,
        escalated_at: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (ticketError) throw ticketError;

  // Notificar a todos los admins
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'super_admin']);

  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
      ticket_id: ticket.id,
      admin_id: admin.id,
      type: 'escalation',
      title: 'Nueva escalación de chat',
      message: `Usuario ${userId} ha sido escalado automáticamente: ${reason}`
    }));

    await supabase
      .from('admin_notifications')
      .insert(notifications);
  }

  return ticket.id;
}

async function generateUltraSafeBotResponse(message: string, userContext: UserContext, sessionId: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Lo siento, el servicio de chat no está disponible en este momento. Por favor contacta a un administrador.";
  }

  // VERSIÓN ULTRA-SEGURA: Crear contexto seguro sin datos personales
  const safeContext = SecurityFilter.createSafeContext({
    portfolio: userContext.portfolio || [],
    hasCalculator: true
  });

  // VERSIÓN ULTRA-SEGURA: Usar prompt ultra-seguro
  const systemPrompt = SecurityFilter.getUltraSafePrompt(safeContext);
  
  const prompt = `${systemPrompt}

Usuario: ${message}

Asistente:`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    let botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "Lo siento, no pude procesar tu mensaje. ¿Podrías reformular tu pregunta?";

    // VERSIÓN ULTRA-SEGURA: Filtrar también la respuesta del bot
    botResponse = SecurityFilter.sanitizeMessage(botResponse);

    return botResponse.trim();

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "Lo siento, estoy teniendo dificultades técnicas. Por favor intenta de nuevo o contacta a un administrador.";
  }
}

async function generateBotResponse(message: string, userContext: UserContext, sessionId: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Lo siento, el servicio de chat no está disponible en este momento. Por favor contacta a un administrador.";
  }

  // Obtener historial de la conversación
  const { data: chatHistory } = await supabase
    .from('chat_messages')
    .select('sender_type, message, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(10);

  // Construir contexto del sistema
  const systemPrompt = buildSystemPrompt(userContext);
  const conversationHistory = buildConversationHistory(chatHistory || []);
  
  const prompt = `${systemPrompt}

${conversationHistory}

Usuario: ${message}

Asistente:`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "Lo siento, no pude procesar tu mensaje. ¿Podrías reformular tu pregunta?";

    return botResponse.trim();

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "Lo siento, estoy teniendo dificultades técnicas. Por favor intenta de nuevo o contacta a un administrador.";
  }
}

function buildSystemPrompt(userContext: UserContext): string {
  const portfolioInfo = userContext.portfolio?.length > 0 
    ? `Tienes acceso a las siguientes plataformas en tu portafolio: ${userContext.portfolio.map(p => p.platform_name).join(', ')}.`
    : 'No tienes plataformas configuradas en tu portafolio aún.';

  return `Eres un asistente virtual especializado en ayudar a modelos de webcam con el sistema de gestión AIM. 

INFORMACIÓN DEL USUARIO:
- Nombre: ${userContext.name}
- Rol: ${userContext.role}
- Grupos: ${userContext.groups.join(', ') || 'Ninguno'}
- ${portfolioInfo}

LÍMITES ESTRICTOS:
- NO sugieras nuevas plataformas, solo habla de las que tiene configuradas
- NO menciones información de otras modelos
- NO hables de temas financieros sensibles o salarios específicos
- NO resuelvas problemas de plataformas externas (Chaturbate, OnlyFans, etc.)
- NO respondas preguntas fuera del contexto del trabajo

FUNCIONALIDADES PERMITIDAS:
- Tips de engagement con audiencia
- Optimización de ganancias por plataforma (solo las suyas)
- Mejores prácticas de streaming
- Configuración de equipos (cámara, iluminación)
- Gestión del tiempo
- Problemas técnicos del sistema AIM
- Configuración de calculadora y portafolio
- Dudas sobre porcentajes, comisiones y conversiones
- Soporte general del sistema

TONO: Adapta tu tono al de la modelo. Si es formal, sé profesional pero cercano. Si es casual, sé amigable y relajado.

ESCALACIÓN: Si detectas palabras como "urgente", errores técnicos graves, o después de 3 intentos sin resolver, escalar a administrador.`;
}

function buildConversationHistory(history: any[]): string {
  if (history.length === 0) return '';
  
  return history.map(msg => {
    const sender = msg.sender_type === 'user' ? 'Usuario' : 'Asistente';
    return `${sender}: ${msg.message}`;
  }).join('\n') + '\n';
}

async function saveMessage(sessionId: string, senderType: 'user' | 'bot' | 'admin', senderId: string | null, message: string) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      sender_type: senderType,
      sender_id: senderId,
      message: message,
      message_type: 'text'
    });

  if (error) {
    console.error('Error saving message:', error);
  }
}

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

// Flags de configuración (modo Seguro-Ampliado)
const CHATBOT_MODE = process.env.CHATBOT_MODE || 'secure_extended';
const CHATBOT_ENABLE_ESCALATION = (process.env.CHATBOT_ENABLE_ESCALATION || 'true') === 'true';
const CHATBOT_SESSION_MINUTES = parseInt(process.env.CHATBOT_SESSION_MINUTES || '15', 10);
const CHATBOT_MAX_MSGS = parseInt(process.env.CHATBOT_MAX_MSGS || '30', 10);

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
  portfolio: any[];
  productivity: any;
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

    // Filtrar mensaje (modo light en secure_extended, estricto en ultra)
    const sanitizedMessage = CHATBOT_MODE === 'ultra_safe'
      ? SecurityFilter.sanitizeMessage(message)
      : SecurityFilter.sanitizeMessage(message); // mantenemos filtrado básico

    // Guardar mensaje del usuario (filtrado)
    await saveMessage(session.id, 'user', user.id, sanitizedMessage);

    // Escalación automática (opcional por flag)
    if (CHATBOT_ENABLE_ESCALATION) {
      const shouldEscalate = await checkEscalationConditions(session.id, sanitizedMessage, userContext);
      if (shouldEscalate.should) {
        const ticketId = await escalateToAdmin(session.id, user.id, sanitizedMessage, shouldEscalate.reason);
        return NextResponse.json({
          response: "He escalado tu consulta a un administrador. Te contactarán pronto para ayudarte.",
          escalated: true,
          sessionId: session.id,
          ticketId
        });
      }
    }

    // Modo Seguro-Ampliado: intents de solo lectura y respuestas con contexto
    if (CHATBOT_MODE === 'secure_extended') {
      const intentResponse = await handleReadOnlyIntents(sanitizedMessage, userContext);
      if (intentResponse) {
        await saveMessage(session.id, 'bot', null, intentResponse);
        return NextResponse.json({ response: intentResponse, sessionId: session.id, escalated: false });
      }

      const botResponse = await generateBotResponse(sanitizedMessage, userContext, session.id);
      await saveMessage(session.id, 'bot', null, botResponse);
      return NextResponse.json({ response: botResponse, sessionId: session.id, escalated: false });
    }

    // Fallback: Modo ultra-seguro original
    const botResponse = await generateUltraSafeBotResponse(sanitizedMessage, userContext, session.id);
    await saveMessage(session.id, 'bot', null, botResponse);
    return NextResponse.json({ response: botResponse, sessionId: session.id, escalated: false, securityLevel: 'ULTRA_SAFE' });

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
  let portfolio: any[] = [];
  let productivity: any = null;
  
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

  // Verificar límite de mensajes por sesión (configurable)
  if (session.message_count >= CHATBOT_MAX_MSGS) {
    return { allowed: false, reason: `Has alcanzado el límite de ${CHATBOT_MAX_MSGS} mensajes por sesión` };
  }

  // Verificar timeout de inactividad (configurable)
  const lastActivity = new Date(session.last_activity);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
  
  if (diffMinutes > CHATBOT_SESSION_MINUTES) {
    return { allowed: false, reason: `La sesión ha expirado por inactividad (${CHATBOT_SESSION_MINUTES} minutos)` };
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
  // Si no hay API key de Gemini, usar respuestas inteligentes basadas en patrones
  if (!GEMINI_API_KEY) {
    return generateFallbackResponse(message, userContext);
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
  const portfolioInfo = userContext.portfolio.length > 0 
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

// Intents de solo lectura (modo Seguro-Ampliado)
async function handleReadOnlyIntents(message: string, userContext: UserContext): Promise<string | null> {
  const text = message.toLowerCase();

  // Intent: consultar anticipos (modelo)
  if (userContext.role === 'modelo' && /(mi|mis).*anticipos|anticipos|estado de anticipos/.test(text)) {
    const { data: anticipos } = await supabase
      .from('anticipos')
      .select('id, estado, monto, created_at')
      .eq('model_id', userContext.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!anticipos || anticipos.length === 0) {
      return 'No encuentro anticipos recientes en tu cuenta. Puedes abrir Mis Anticipos desde el menú para crear uno.';
    }

    const lines = anticipos.map(a => `• ${new Date(a.created_at).toLocaleDateString('es-CO')}: ${a.estado} - USD ${Number(a.monto || 0).toFixed(2)}`);
    return `Tus últimos anticipos:\n${lines.join('\n')}\n\n¿Quieres abrir la pantalla de Mis Anticipos?`;
  }

  // Intent: consultar calculadora (modelo)
  if (userContext.role === 'modelo' && /(mi|mis).*calculadora|totales|cuánto llevo|quincena/.test(text)) {
    const { data: totals } = await supabase
      .from('calculator_totals')
      .select('usd_bruto, usd_modelo, usd_sede, period_key, updated_at')
      .eq('user_id', userContext.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!totals) {
      return 'Aún no encuentro totales registrados para esta quincena. Abre tu Calculadora para ingresar valores.';
    }

    return `Totales recientes (periodo ${totals.period_key || 'actual'}):\n- USD Bruto: ${Number(totals.usd_bruto || 0).toFixed(2)}\n- USD Modelo: ${Number(totals.usd_modelo || 0).toFixed(2)}\n- USD Sede: ${Number(totals.usd_sede || 0).toFixed(2)}\n\n¿Quieres abrir Mi Calculadora?`;
  }

  // Intent: resumen administrativo (solo admin/super_admin)
  if ((userContext.role === 'admin' || userContext.role === 'super_admin') && /(resumen|facturación|dashboard|sedes)/.test(text)) {
    // Consultar API interna de resumen administrativo
    try {
      const params = new URLSearchParams({ adminId: userContext.id });
      const url = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/admin/billing-summary?${params.toString()}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      const data = await res.json();
      if (!data?.success) return 'No pude obtener el resumen administrativo en este momento.';

      const sum = data.summary || {};
      return `Resumen administrativo (estimado):\n- USD Sede: ${Number(sum.usdSede || 0).toFixed(2)}\n- USD Modelo: ${Number(sum.usdModelo || 0).toFixed(2)}\n\nPuedes abrir el Dashboard de Sedes para ver más detalles.`;
    } catch {
      return 'No pude obtener el resumen administrativo en este momento.';
    }
  }

  // Intent: crear ticket (para todos los roles, con confirmación en UI)
  if (/crear ticket|abrir ticket|soporte|ayuda/.test(text)) {
    return 'Puedo crear un ticket de soporte con tu descripción. Confirma en el botón “Crear ticket” para proceder.';
  }

  return null;
}

function generateFallbackResponse(message: string, userContext: UserContext): string {
  const lowerMessage = message.toLowerCase();
  
  // Saludos
  if (lowerMessage.includes('hola') || lowerMessage.includes('hi') || lowerMessage.includes('buenos días') || lowerMessage.includes('buenas tardes') || lowerMessage.includes('buenas noches')) {
    return `¡Hola ${userContext.name}! 👋 Soy el asistente de AIM. Estoy aquí para ayudarte con consultas sobre el sistema. ¿En qué puedo asistirte hoy?`;
  }
  
  // Preguntas sobre el sistema
  if (lowerMessage.includes('qué es') || lowerMessage.includes('que es') || lowerMessage.includes('qué hace') || lowerMessage.includes('que hace')) {
    return `AIM es el Sistema de Gestión de Agencia Innova. Te permite gestionar usuarios, calculadora, anticipos y sedes. Como ${userContext.role}, tienes acceso a funciones administrativas del sistema.`;
  }
  
  // Preguntas sobre calculadora
  if (lowerMessage.includes('calculadora') || lowerMessage.includes('rates') || lowerMessage.includes('tasas')) {
    return `La calculadora te permite gestionar las tasas de conversión (USD→COP, EUR→USD, GBP→USD). Puedes acceder a ella desde el menú "Gestión Calculadora".`;
  }
  
  // Preguntas sobre anticipos
  if (lowerMessage.includes('anticipo') || lowerMessage.includes('anticipos')) {
    return `Los anticipos son pagos adelantados que se pueden solicitar. Puedes gestionarlos desde "Gestión Anticipos" en el menú principal.`;
  }
  
  // Preguntas sobre usuarios
  if (lowerMessage.includes('usuario') || lowerMessage.includes('usuarios') || lowerMessage.includes('modelo') || lowerMessage.includes('modelos')) {
    return `Puedes gestionar usuarios y modelos desde "Gestión Usuarios". Allí puedes crear, editar y administrar las cuentas del sistema.`;
  }
  
  // Preguntas sobre sedes
  if (lowerMessage.includes('sede') || lowerMessage.includes('sedes')) {
    return `Las sedes son las ubicaciones físicas de la agencia. Puedes gestionarlas desde "Gestión Sedes" en el menú principal.`;
  }
  
  // Preguntas sobre ayuda
  if (lowerMessage.includes('ayuda') || lowerMessage.includes('help') || lowerMessage.includes('cómo') || lowerMessage.includes('como')) {
    return `Puedo ayudarte con información sobre:
    • Gestión de usuarios y modelos
    • Configuración de la calculadora
    • Administración de anticipos
    • Gestión de sedes
    • Funcionalidades del sistema
    
    ¿Hay algo específico en lo que te gustaría que te ayude?`;
  }
  
  // Preguntas sobre el rol
  if (lowerMessage.includes('rol') || lowerMessage.includes('permisos') || lowerMessage.includes('acceso')) {
    return `Tu rol actual es: ${userContext.role}. Esto te da acceso a las funciones administrativas del sistema AIM.`;
  }
  
  // Preguntas sobre productividad
  if (lowerMessage.includes('productividad') || lowerMessage.includes('ganancias') || lowerMessage.includes('ingresos')) {
    return `Puedes ver tu productividad y ganancias en el dashboard principal. Los datos se actualizan en tiempo real basándose en tu actividad.`;
  }
  
  // Respuesta por defecto
  return `Entiendo tu consulta sobre "${message}". Como asistente de AIM, puedo ayudarte con información sobre:
  
  📊 **Dashboard**: Resumen de productividad y ganancias
  👥 **Usuarios**: Gestión de modelos y cuentas
  🧮 **Calculadora**: Configuración de tasas de conversión
  💰 **Anticipos**: Administración de pagos adelantados
  🏢 **Sedes**: Gestión de ubicaciones
  
  ¿Podrías ser más específico sobre lo que necesitas? Estoy aquí para ayudarte.`;
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { SecurityFilter } from './SecurityFilter';

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'admin';
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

interface ChatWidgetProps {
  userId?: string;
  userRole?: string;
}

export default function ChatWidget({ userId, userRole }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTicketConfirm, setShowTicketConfirm] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [resolvedUser, setResolvedUser] = useState<{ id: string; role: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Controles de difusión (solo admin/super_admin)
  const [recipientTarget, setRecipientTarget] = useState<'all' | 'groups' | ''>('');
  const [groupNamesInput, setGroupNamesInput] = useState(''); // nombres de grupos separados por coma
  const [imageUrl, setImageUrl] = useState('');
  const [isBroadcast, setIsBroadcast] = useState(true);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);
  const [showIndividualMessage, setShowIndividualMessage] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [showModelList, setShowModelList] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Notificación sonora vibrante para nuevos mensajes
  const playNotificationSound = () => {
    try {
      // Crear un sonido de notificación vibrante con vibrato sutil
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      
      // Configurar LFO para el vibrato
      lfo.frequency.setValueAtTime(5, audioContext.currentTime);
      lfoGain.gain.setValueAtTime(50, audioContext.currentTime);
      
      // Conectar el LFO al oscilador principal
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Frecuencia base del sonido
      oscillator.frequency.setValueAtTime(900, audioContext.currentTime);
      
      // Configurar volumen con fade out
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      // Iniciar y detener los osciladores
      lfo.start(audioContext.currentTime);
      oscillator.start(audioContext.currentTime);
      lfo.stop(audioContext.currentTime + 0.4);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.log('No se pudo reproducir sonido de notificación');
    }
  };

  // Reproducir sonido cuando llega un mensaje del bot o admin
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'bot' || lastMessage.sender === 'admin') {
        playNotificationSound();
      }
    }
  }, [messages]);

  // Resolver usuario si no viene por props
  useEffect(() => {
    const resolve = async () => {
      try {
        if (userId && userRole) {
          setResolvedUser({ id: userId, role: userRole });
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: row } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', user.id)
          .single();
        if (row) setResolvedUser({ id: row.id, role: row.role });
      } catch (e) {
        console.warn('ChatWidget resolve user error', e);
      }
    };
    resolve();
  }, [userId, userRole]);

  // Cargar modelos disponibles para admin/super_admin
  useEffect(() => {
    const loadModels = async () => {
      const role = (resolvedUser?.role || userRole || '').toString();
      if (role === 'admin' || role === 'super_admin') {
        try {
          const { data: models } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('role', 'modelo')
            .order('name');
          setAvailableModels(models || []);
        } catch (e) {
          console.warn('Error loading models:', e);
        }
      }
    };
    loadModels();
  }, [resolvedUser, userRole]);

  // Load chat history when widget opens
  useEffect(() => {
    if (isOpen && sessionId) {
      loadChatHistory();
    }
  }, [isOpen, sessionId]);

  const loadChatHistory = async () => {
    if (!sessionId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      const formattedMessages: Message[] = chatMessages.map(msg => ({
        id: msg.id,
        sender: msg.sender_type,
        message: msg.message,
        timestamp: new Date(msg.created_at),
        isRead: msg.is_read
      }));

      setMessages(formattedMessages);
      setMessageCount(formattedMessages.filter(m => m.sender === 'user').length);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || limitReached) return;

    // VERSIÓN ULTRA-SEGURA: Filtrar mensaje antes de enviar
    const originalMessage = inputMessage.trim();
    const sanitizedMessage = SecurityFilter.sanitizeMessage(originalMessage);
    
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately (mostrar mensaje filtrado)
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      message: sanitizedMessage, // Mostrar mensaje filtrado
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setMessageCount(prev => prev + 1);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: sanitizedMessage, // Enviar mensaje filtrado
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setLimitReached(true);
          setError(data.error);
          return;
        }
        throw new Error(data.error || 'Error al enviar mensaje');
      }

      // Update session ID if it's new
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        message: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);

      // VERSIÓN ULTRA-SEGURA: No hay escalación automática
      // if (data.escalated) {
      //   setEscalated(true);
      //   const escalationMessage: Message = {
      //     id: (Date.now() + 2).toString(),
      //     sender: 'bot',
      //     message: "✅ Tu consulta ha sido escalada a un administrador. Te contactarán pronto.",
      //     timestamp: new Date()
      //   };
      //   setMessages(prev => [...prev, escalationMessage]);
      // }

      // VERSIÓN ULTRA-SEGURA: Mostrar indicador de seguridad
      if (data.securityLevel === 'ULTRA_SAFE') {
        console.log('Chat usando versión ultra-segura - datos protegidos');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Error al enviar mensaje. Por favor intenta de nuevo.');
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
      setMessageCount(prev => prev - 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Acciones rápidas (opciones en select para ahorrar espacio)
  const quickActions = (() => {
    const role = (resolvedUser?.role || userRole || 'modelo').toString();
    if (role === 'admin' || role === 'super_admin') {
      return [
        { id: 'resumen', label: 'Resumen Administrativo', payload: 'resumen de facturación' },
        { id: 'ticket', label: 'Crear Ticket', payload: 'crear ticket' }
      ];
    }
    // Modelo (por defecto)
    return [
      { id: 'anticipos', label: 'Mis Anticipos', payload: 'mis anticipos' },
      { id: 'calculadora', label: 'Mi Calculadora', payload: 'totales de mi calculadora' },
      { id: 'ticket', label: 'Crear Ticket', payload: 'crear ticket' }
    ];
  })();

  const handleQuickAction = async (actionId: string) => {
    if (actionId === 'ticket') {
      setShowTicketConfirm(true);
      return;
    }
    const qa = quickActions.find(a => a.id === actionId);
    if (!qa) return;
    setInputMessage(qa.payload);
    await sendMessage();
  };

  const createTicket = async () => {
    try {
      setCreatingTicket(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const description = inputMessage.trim() || 'Solicitud de soporte desde el ChatBot';
      const res = await fetch('/api/chat/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: 'Ticket de soporte', description, userId: resolvedUser?.id || userId, sessionId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el ticket');

      setShowTicketConfirm(false);
      setInputMessage('');
      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'bot',
        message: `Listo. He creado el ticket #${data?.ticket?.id || ''}. Un administrador te contactará pronto.`,
        timestamp: new Date()
      } as any;
      setMessages(prev => [...prev, botMessage]);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Inserción de emoji en la posición del cursor
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setInputMessage((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = inputMessage.slice(0, start);
    const after = inputMessage.slice(end);
    const next = `${before}${emoji}${after}`;
    setInputMessage(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + emoji.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  // Picker mínimo (Unicode) — ligero y sin dependencias
  const commonEmojis = [
    '😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🤔','😅','🙏','💪','👏','🙌','🔥','✨','💡','✅','🚀','❤️','💙','💚','💛','💜','🤍','👍','👎','👉','👀'
  ];

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getSenderName = (sender: string) => {
    switch (sender) {
      case 'user': return 'Tú';
      case 'bot': return 'AIM Assistant';
      case 'admin': return 'Administrador';
      default: return sender;
    }
  };

  const getSenderColor = (sender: string) => {
    switch (sender) {
      case 'user': return 'bg-gray-600';
      case 'bot': return 'bg-gray-700';
      case 'admin': return 'bg-gray-800';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      {/* Chat Button - Estilo AIM */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-10 h-10 hover:w-14 hover:h-14 bg-gray-900 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center group"
          aria-label="Abrir chat de soporte"
        >
          <span className="text-xs font-bold opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">AIM</span>
          <span className="absolute text-xs font-bold opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75 transition-all duration-300">A</span>
        </button>
      )}

      {/* Chat Window - Estilo escala de grises */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-[400px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold">AIM</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">AIM Assistant</h3>
                <p className="text-xs text-gray-300">Soporte y tips</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-300 text-sm py-6">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-white">AIM</span>
                </div>
                <p>¡Hola! Soy tu asistente virtual.</p>
                <p className="text-xs mt-1 text-gray-400">Puedo ayudarte con tips, soporte técnico y más.</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`flex items-end space-x-2 ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${getSenderColor(message.sender)}`}>
                      {message.sender === 'user' ? 'T' : message.sender === 'bot' ? 'A' : 'A'}
                    </div>
                    <div className={`rounded-2xl px-3 py-2 ${
                      message.sender === 'user' 
                        ? 'bg-gray-700 text-white' 
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs">
                    A
                  </div>
                  <div className="bg-gray-800 rounded-2xl px-3 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {limitReached && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-yellow-400 text-sm">
                <p className="font-medium">Límite alcanzado</p>
                <p className="text-xs mt-1 text-gray-300">Has alcanzado el límite de mensajes. Tu sesión se reiniciará en unos minutos.</p>
              </div>
            )}

            {escalated && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-green-400 text-sm">
                <p className="font-medium">✅ Escalado a administrador</p>
                <p className="text-xs mt-1 text-gray-300">Un administrador te contactará pronto para ayudarte.</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>


          {/* Panel de herramientas colapsable */}
          {((resolvedUser?.role || userRole) === 'admin' || (resolvedUser?.role || userRole) === 'super_admin') ? (
            /* Panel para admin/super_admin con difusión masiva */
            <div className="border-t border-gray-800 bg-gray-900">
              {/* Botón principal para abrir/cerrar panel */}
              <button
                onClick={() => setShowBroadcastPanel(!showBroadcastPanel)}
                className="w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <span>📢 Difusión masiva</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${showBroadcastPanel ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Panel desplegable con transición */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showBroadcastPanel ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-3 pb-3 space-y-3">
                  {/* Sección: Acciones rápidas y plantillas */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-300">Acciones rápidas</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!val) return;
                          await handleQuickAction(val);
                          e.currentTarget.selectedIndex = 0; // reset
                        }}
                        className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      >
                        <option value="">Acción rápida…</option>
                        {quickActions.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>

                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          setInputMessage(val);
                          e.currentTarget.selectedIndex = 0; // reset
                        }}
                        className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      >
                        <option value="">Plantillas…</option>
                        {((resolvedUser?.role || userRole || 'modelo') === 'modelo') ? (
                          <>
                            <option value="No veo mi último anticipo registrado, por favor revisar.">No veo mis anticipos</option>
                            <option value="Mis totales de la quincena aparecen en 0, aunque ingresé valores.">Totales en 0</option>
                            <option value="Tengo problemas para iniciar sesión o recuperar contraseña.">Problema de acceso</option>
                          </>
                        ) : (
                          <>
                            <option value="Necesito un resumen de facturación del periodo actual.">Resumen del periodo</option>
                            <option value="Solicito revisión de solicitudes de anticipos pendientes.">Revisión de anticipos pendientes</option>
                            <option value="Verificar configuración de RATES y plataformas.">Verificación de RATES</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Separador */}
                  <div className="border-t border-gray-700"></div>

                  {/* Sección: Mensajes individuales */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-300">Mensaje individual</h4>
                    
                    {/* Selector de modelo */}
                    <div className="relative">
                      <button
                        onClick={() => setShowModelList(!showModelList)}
                        className="w-full text-left text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 flex items-center justify-between"
                      >
                        <span>
                          {selectedModelName || 'Seleccionar modelo...'}
                        </span>
                        <svg 
                          className={`w-3 h-3 transition-transform ${showModelList ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Lista desplegable de modelos */}
                      {showModelList && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                          {availableModels.length === 0 ? (
                            <div className="px-2 py-1 text-xs text-gray-400">Cargando modelos...</div>
                          ) : (
                            availableModels.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setSelectedModelId(model.id);
                                  setSelectedModelName(`${model.name} (${model.email})`);
                                  setShowModelList(false);
                                }}
                                className="w-full text-left px-2 py-1 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
                              >
                                {model.name} ({model.email})
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Modelo seleccionado */}
                    {selectedModelId && (
                      <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                        <span className="text-xs text-gray-300">Para: {selectedModelName}</span>
                        <button
                          onClick={() => {
                            setSelectedModelId('');
                            setSelectedModelName('');
                          }}
                          className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    
                    {/* Botón de envío */}
                    {selectedModelId && inputMessage.trim() && (
                      <button
                        onClick={async () => {
                          try {
                            setSendingBroadcast(true);
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) throw new Error('No hay sesión activa');
                            
                            const payload = {
                              target: 'user' as const,
                              userId: selectedModelId,
                              text: inputMessage.trim(),
                              imageUrl: imageUrl || undefined,
                              isBroadcast: false,
                            };
                            
                            const res = await fetch('/api/chat/broadcast', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`
                              },
                              body: JSON.stringify(payload)
                            });
                            
                            const data = await res.json();
                            if (!res.ok) throw new Error(data?.error || 'No se pudo enviar el mensaje');
                            
                            // Confirmación en la conversación
                            const botMessage: Message = {
                              id: (Date.now() + 4).toString(),
                              sender: 'bot',
                              message: `✅ Mensaje enviado a ${selectedModelName}`,
                              timestamp: new Date()
                            } as any;
                            setMessages(prev => [...prev, botMessage]);
                            
                            // Reset
                            setSelectedModelId('');
                            setSelectedModelName('');
                            setInputMessage('');
                            setImageUrl('');
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo enviar el mensaje');
                          } finally {
                            setSendingBroadcast(false);
                          }
                        }}
                        disabled={sendingBroadcast}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingBroadcast ? 'Enviando…' : '💬 Enviar mensaje individual'}
                      </button>
                    )}
                  </div>

                  {/* Separador */}
                  <div className="border-t border-gray-700"></div>

                  {/* Sección: Difusión masiva */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-300">Difusión masiva</h4>
                    
                    {/* Selector de destinatario */}
                    <select
                      value={recipientTarget}
                      onChange={(e) => {
                        const target = e.target.value as 'all' | 'groups' | '';
                        setRecipientTarget(target);
                        if (target === 'groups') {
                          const groupNames = prompt('Grupos (separados por coma):');
                          if (groupNames) setGroupNamesInput(groupNames);
                        }
                      }}
                      className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 w-full"
                    >
                      <option value="">Seleccionar destinatario…</option>
                      <option value="groups">📢 Enviar a Grupo(s)</option>
                      {(resolvedUser?.role === 'super_admin' || userRole === 'super_admin') && (
                        <option value="all">📢 Enviar a Todos</option>
                      )}
                    </select>
                    
                    {/* Campo de imagen */}
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="URL de imagen (opcional)"
                        className="flex-1 text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      />
                      {imageUrl && (
                        <button
                          onClick={() => setImageUrl('')}
                          className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {/* Vista previa de imagen */}
                    {imageUrl && (
                      <div className="flex justify-center">
                        <img src={imageUrl} alt="Vista previa" className="max-h-20 rounded-md border border-gray-700" />
                      </div>
                    )}
                    
                    {/* Botón de envío */}
                    <button
                      onClick={async () => {
                        if (!recipientTarget || !inputMessage.trim()) {
                          setError('Selecciona destinatario y escribe mensaje');
                          return;
                        }
                        // Enviar difusión
                        if (!resolvedUser?.id) return;
                        try {
                          setSendingBroadcast(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) throw new Error('No hay sesión activa');
                          const payload: any = {
                            target: recipientTarget,
                            text: inputMessage.trim(),
                            imageUrl: imageUrl || undefined,
                            isBroadcast: true,
                          };
                          if (recipientTarget === 'groups') {
                            payload.groupNames = groupNamesInput
                              .split(',')
                              .map(s => s.trim())
                              .filter(Boolean);
                          }
                          const res = await fetch('/api/chat/broadcast', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${session.access_token}`
                            },
                            body: JSON.stringify(payload)
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error || 'No se pudo enviar la difusión');
                          // Confirmación en la conversación
                          const botMessage: Message = {
                            id: (Date.now() + 3).toString(),
                            sender: 'bot',
                            message: `✅ Difusión enviada a ${data?.recipients || 0} destinatarios.`,
                            timestamp: new Date()
                          } as any;
                          setMessages(prev => [...prev, botMessage]);
                          // Reset y cerrar panel
                          setImageUrl('');
                          setGroupNamesInput('');
                          setRecipientTarget('');
                          setInputMessage('');
                          setShowBroadcastPanel(false);
                        } catch (e: any) {
                          setError(e?.message || 'No se pudo enviar la difusión');
                        } finally {
                          setSendingBroadcast(false);
                        }
                      }}
                      disabled={sendingBroadcast || !recipientTarget || !inputMessage.trim()}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {sendingBroadcast ? 'Enviando…' : '🚀 Enviar difusión'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Panel para modelos con acciones rápidas y plantillas */
            <div className="border-t border-gray-800 bg-gray-900">
              {/* Botón principal para abrir/cerrar panel */}
              <button
                onClick={() => setShowBroadcastPanel(!showBroadcastPanel)}
                className="w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <span>⚡ Acciones rápidas</span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${showBroadcastPanel ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Panel desplegable con transición */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showBroadcastPanel ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-3 pb-3 space-y-3">
                  {/* Sección: Acciones rápidas y plantillas para modelos */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-300">Herramientas de chat</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (!val) return;
                          await handleQuickAction(val);
                          e.currentTarget.selectedIndex = 0; // reset
                        }}
                        className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      >
                        <option value="">Acción rápida…</option>
                        {quickActions.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>

                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          setInputMessage(val);
                          e.currentTarget.selectedIndex = 0; // reset
                        }}
                        className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      >
                        <option value="">Plantillas…</option>
                        <option value="No veo mi último anticipo registrado, por favor revisar.">No veo mis anticipos</option>
                        <option value="Mis totales de la quincena aparecen en 0, aunque ingresé valores.">Totales en 0</option>
                        <option value="Tengo problemas para iniciar sesión o recuperar contraseña.">Problema de acceso</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* (Se reemplazó la sección de etiquetas por los selects anteriores) */}

          {/* Input */}
          <div className="border-t border-gray-700 p-3 bg-gray-800">
            <div className="flex space-x-2">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                className="flex-1 resize-none border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent placeholder-gray-400"
                rows={2}
                disabled={isLoading || limitReached}
              />
              {/* Botón Emoji (simétrico al de envío) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className="bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors w-10 h-10 flex items-center justify-center"
                  aria-label="Abrir emojis"
                >
                  <span role="img" aria-hidden>😊</span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-10 right-0 w-64 p-2 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl grid grid-cols-8 gap-1 z-[60]">
                    {commonEmojis.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="h-7 w-7 rounded-md hover:bg-gray-800 text-lg"
                        onClick={() => { insertEmoji(e); setShowEmojiPicker(false); }}
                        aria-label={`Insertar emoji ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading || limitReached}
                className="bg-gray-700 text-white rounded-xl hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-10 h-10 flex items-center justify-center"
                aria-label="Enviar mensaje"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Message counter */}
            <div className="text-xs text-gray-400 mt-2 text-center">
              {messageCount}/20 mensajes • Sesión activa
            </div>
          </div>
        </div>
      )}

      {/* Confirmación crear ticket */}
      {showTicketConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-[320px] p-4">
            <h4 className="text-sm font-semibold text-gray-900">Crear ticket de soporte</h4>
            <p className="text-xs text-gray-600 mt-1">¿Confirmas crear un ticket con tu descripción actual?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowTicketConfirm(false)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
              <button onClick={createTicket} disabled={creatingTicket} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
                {creatingTicket ? 'Creando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

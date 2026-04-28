'use client';

import React, { useState, useEffect, useRef, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL, AIM_BOTTY_NAME } from '@/lib/chat/aim-botty';
import { renderElegantAvatar } from '@/lib/chat/user-avatar';
import ReplyPreview from './ReplyPreview';
import QuotedMessage from './QuotedMessage';

interface IndividualChatWindowProps {
  conversationId: string;
  otherUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  onClose: () => void;
  userId?: string;
  userRole?: string;
  session?: any;
  windowIndex?: number; // Nueva prop para el índice de la ventana
  isInChatBar?: boolean; // Nueva prop para indicar si está en la barra de chat
}

export default function IndividualChatWindow({ 
  conversationId, 
  otherUser, 
  onClose, 
  userId, 
  userRole, 
  session,
  windowIndex = 0,
  isInChatBar = false
}: IndividualChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messageReadStatus, setMessageReadStatus] = useState<Record<string, 'sent' | 'delivered' | 'read'>>({});
  const [position, setPosition] = useState<{ x?: number; y?: number; right?: number }>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationIdRef = useRef<string | null>(null); // Para detectar cambios de conversación

  // Añadimos cálculo de emoción de Botty
  const currentBottyEmotion = React.useMemo(() => {
    if (otherUser.id !== AIM_BOTTY_ID && otherUser.email !== AIM_BOTTY_EMAIL) return 'idle';
    if (!messages || messages.length === 0) return 'idle';
    
    const lastMessage = messages[messages.length - 1];
    
    // Si es un mensaje del sistema, Botty no reacciona
    if (lastMessage.sender_id === 'system' || lastMessage.is_system_message) {
      return 'idle';
    }

    const isBotLast = lastMessage.sender_id === AIM_BOTTY_ID;
    
    if (!isBotLast) return 'thinking';

    const content = lastMessage.content;
    const emotionMatch = content.match(/\[EMOTION:\s*(idle|happy|thinking|speaking|worried)\]/i);
    
    if (emotionMatch && emotionMatch[1]) {
      return emotionMatch[1].toLowerCase() as any;
    }

    // Fallback de retrocompatibilidad
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('jaja') || lowerContent.includes('excelente') || lowerContent.includes('genial') || lowerContent.includes('encanta') || lowerContent.includes('feliz') || lowerContent.includes('gracias')) {
      return 'happy';
    }
    
    if (lowerContent.includes('lo siento') || lowerContent.includes('disculpa') || lowerContent.includes('ups') || lowerContent.includes('hubo un error') || lowerContent.includes('no pude')) {
      return 'worried';
    }
    
    return 'idle';
  }, [messages, otherUser]);

  // Calcular posición inicial basada en el índice de la ventana
  const getInitialPosition = () => {
    const windowWidth = 320; // w-80 = 320px
    const margin = 16; // Margen entre ventanas
    const rightOffset = 24; // right-6 = 24px (igual que la ventana principal)
    const mainChatWidth = 320; // w-80 de la ventana principal

    if (isInChatBar) {
      // Embebido dentro del contenedor del AIM Assistant: distribuir de izquierda a derecha
      const finalLeft = 8 + (windowIndex * (windowWidth + margin));
      return { x: finalLeft, y: 0 };
    } else {
      // Modo flotante: ventanas a la izquierda de la ventana principal
      const windowHeight = 500; // h-[500px]
      const marginFloat = 20; // Margen entre ventanas flotantes
      const bottomOffsetFloat = 24; // bottom-6 = 24px
      const rightOffsetFloat = 24; // right-6 = 24px

      // Y: Anclar al bottom igual que la ventana principal
      const finalY = window.innerHeight - windowHeight - bottomOffsetFloat;

      // X: Ventanas de DERECHA A IZQUIERDA con cascading
      const mainChatLeftEdge = window.innerWidth - rightOffsetFloat - mainChatWidth;
      const finalX = mainChatLeftEdge - marginFloat + (windowIndex * (windowWidth + marginFloat));

      // Asegurar que no se vaya fuera de la pantalla
      const minX = 20;
      const adjustedX = Math.max(minX, finalX);

      console.log('🪟 [IndividualChatWindow] Posición flotante (DERECHA A IZQUIERDA):', {
        windowIndex,
        finalX,
        adjustedX,
        finalY,
        mainChatLeftEdge,
        calculation: `${mainChatLeftEdge} - ${marginFloat} + (${windowIndex} * (${windowWidth} + ${marginFloat}))`
      });

      return { x: adjustedX, y: finalY };
    }
  };

  // Inicializar posición
  useEffect(() => {
    const initialPos = getInitialPosition();
    setPosition(initialPos);
  }, [windowIndex, isInChatBar]);

  // Efecto para detectar mensajes nuevos (sin sonido)
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      // Solo detectar mensajes nuevos del otro usuario
      if (latestMessage.sender_id !== userId) {
        const messageTime = new Date(latestMessage.created_at);
        const now = new Date();
        const timeDiff = now.getTime() - messageTime.getTime();
        
        if (timeDiff < 5000) { // 5 segundos
          console.log('🔔 [IndividualChat] Mensaje nuevo detectado');
          // Sin sonido - solo logging
        }
      }
    }
  }, [messages]);

  // Efecto para polling de mensajes en tiempo real
  useEffect(() => {
    if (!conversationId || !session) return;

    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages?conversation_id=${conversationId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('❌ [IndividualChat] Error en polling:', error);
      }
    };

    // Polling inicial
    pollMessages();

    // Polling cada 15s (antes 2s) — reducido para ahorrar API calls, realtime maneja lo urgente
    const interval = setInterval(pollMessages, 15000);

    return () => clearInterval(interval);
  }, [conversationId, session]);

  // Efecto para simular lectura de mensajes (cuando el usuario está activo en la ventana)
  useEffect(() => {
    if (!isMinimized && messages.length > 0) {
      // Simular que los mensajes del otro usuario se marcan como leídos después de 2 segundos
      const timer = setTimeout(() => {
        messages.forEach(message => {
          if (message.sender_id !== userId) {
            setMessageReadStatus(prev => ({
              ...prev,
              [message.id]: 'read'
            }));
          }
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [messages, isMinimized, userId]);

  // Función para obtener nombre de usuario
  const getDisplayName = (user: any) => {
    // Verificar si es AIM Botty
    if (user.id === AIM_BOTTY_ID || user.email === AIM_BOTTY_EMAIL) {
      return AIM_BOTTY_NAME;
    }
    if (user.role === 'modelo') {
      // Para modelos, mostrar solo la parte antes del @ del email
      return user.email.split('@')[0];
    }
    // Para otros roles, mostrar el nombre completo
    return user.name || user.email || 'Usuario';
  };

  // Función para formatear timestamps de manera inteligente
  const formatMessageTime = (timestamp: string) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Ahora';
    } else if (diffInMinutes < 60) {
      return `hace ${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) { // 24 horas
      const hours = Math.floor(diffInMinutes / 60);
      return `hace ${hours}h`;
    } else if (diffInMinutes < 10080) { // 7 días
      const days = Math.floor(diffInMinutes / 1440);
      return `hace ${days}d`;
    } else {
      return messageTime.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };


  // Cargar mensajes
  const loadMessages = async () => {
    if (!conversationId || !session) return;
    
    // 🔧 Limpiar mensajes inmediatamente si cambió la conversación
    // Esto asegura que no se muestren mensajes de la conversación anterior
    if (prevConversationIdRef.current !== null && 
        prevConversationIdRef.current !== conversationId) {
      console.log('🔄 [IndividualChat] Limpiando mensajes previos al cambiar de conversación');
      setMessages([]);
      setNewMessage('');
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/messages?conversation_id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        const newMessages = data.messages || [];
        console.log('📨 [IndividualChat] Mensajes cargados:', { 
          conversationId,
          count: newMessages.length 
        });
        setMessages(newMessages);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    console.log('📤 [IndividualChat] Intentando enviar mensaje:', {
      newMessage: newMessage.trim(),
      conversationId,
      hasSession: !!session,
      sessionToken: session?.access_token ? 'Presente' : 'Ausente'
    });
    
    if (!newMessage.trim() || !conversationId || !session) {
      console.log('❌ [IndividualChat] Validación fallida:', {
        hasMessage: !!newMessage.trim(),
        hasConversationId: !!conversationId,
        hasSession: !!session
      });
      return;
    }
    
    try {
      console.log('🚀 [IndividualChat] Enviando mensaje a API...');
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: newMessage.trim(),
          reply_to_message_id: replyTo ? replyTo.id : undefined
        })
      });
      
      console.log('📡 [IndividualChat] Respuesta de API:', response.status, response.statusText);
      const data = await response.json();
      console.log('📋 [IndividualChat] Datos de respuesta:', data);
      
      if (data.success) {
        console.log('✅ [IndividualChat] Mensaje enviado exitosamente');
        
        // Marcar mensaje como enviado inicialmente
        if (data.message?.id) {
          setMessageReadStatus(prev => ({
            ...prev,
            [data.message.id]: 'sent'
          }));
          
          // Simular entrega después de un breve delay
          setTimeout(() => {
            setMessageReadStatus(prev => ({
              ...prev,
              [data.message.id]: 'delivered'
            }));
          }, 1000);
        }
        
        setNewMessage('');
        setReplyTo(null); // Limpiar reply después de enviar
        await loadMessages(); // Recargar mensajes
      } else {
        console.log('❌ [IndividualChat] Error en respuesta:', data.error);
      }
    } catch (error) {
      console.error('❌ [IndividualChat] Error enviando mensaje:', error);
    }
  };

  // Manejar tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('⌨️ [IndividualChat] Tecla presionada:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('🚀 [IndividualChat] Enter presionado, enviando mensaje...');
      sendMessage();
    }
  };

  // Auto-scroll a mensajes nuevos
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔧 LIMPIAR ESTADO AL CAMBIAR DE CONVERSACIÓN
  useEffect(() => {
    // Limpiar mensajes y input cuando cambia la conversación
    if (prevConversationIdRef.current !== null && 
        prevConversationIdRef.current !== conversationId && 
        conversationId) {
      console.log('🔄 [IndividualChat] Cambio de conversación detectado:', {
        from: prevConversationIdRef.current,
        to: conversationId
      });
      setMessages([]); // Limpiar mensajes inmediatamente
      setNewMessage(''); // Limpiar input de mensaje
      setMessageReadStatus({}); // Limpiar estados de lectura
    }
    prevConversationIdRef.current = conversationId;
  }, [conversationId]);

  // Cargar mensajes iniciales
  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  // Suscripción en tiempo real para mensajes
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`individual-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          console.log('📨 [IndividualChat] Nuevo mensaje recibido:', payload);
          await loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Funciones de drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const minimizedLabel = (otherUser?.email || '').split('@')[0] || getDisplayName(otherUser);

  return (
    <div
      ref={windowRef}
      className={`w-80 backdrop-blur-3xl bg-white/70 dark:bg-[#0a0f1a]/60 border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col z-[9996] overflow-hidden ${isInChatBar ? 'absolute' : 'fixed'}`}
      style={isInChatBar ? {
        left: `${position.x}px`,
        bottom: '0px',
        cursor: 'default',
        height: isMinimized ? '48px' : '500px'
      } : {
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default',
        height: isMinimized ? '48px' : '500px'
      }}
    >
      {/* Header */}
      <div 
        className={`flex items-center justify-between ${isMinimized ? 'px-3 py-2' : 'p-4'} border-b border-black/5 dark:border-white/10 bg-transparent relative ${
          isInChatBar ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={isInChatBar ? undefined : handleMouseDown}
      >
        {isMinimized ? (
          <div className="flex items-center min-w-0 pr-2">
            <span className="text-gray-900 dark:text-white text-sm font-semibold truncate" title={minimizedLabel}>
              {minimizedLabel}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            {renderElegantAvatar(otherUser, 'medium', false, currentBottyEmotion as any)}
            <div className="min-w-0 flex-1">
              <h3 className="text-gray-900 dark:text-white font-semibold text-sm truncate">
                {getDisplayName(otherUser)}
              </h3>
              {/* No mostrar rol si es el bot */}
              {otherUser.id !== AIM_BOTTY_ID && otherUser.email !== AIM_BOTTY_EMAIL && (
                <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                  {otherUser.role}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            aria-label="Minimizar"
            aria-expanded={!isMinimized}
          >
            {isMinimized ? (
              // Icono restaurar (cuadrado)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h12a2 2 0 0 1 2 2v8H6a2 2 0 0 1-2-2V8z" />
              </svg>
            ) : (
              // Icono minimizar (línea)
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {!isMinimized && (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400 font-medium">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 dark:text-gray-400 text-center">
              <p className="font-medium">No hay mensajes aún</p>
              <p className="text-xs mt-1 opacity-70">Envía el primer mensaje</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-3.5 py-2.5 group shadow-sm ${
                  message.sender_id === userId
                    ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-sm'
                }`}
              >
                {/* Chip de Difusión */}
                {message.is_broadcast && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-200 border border-purple-400/30 mr-2">
                    Difusión
                  </span>
                )}
                {/* Mensaje citado si existe */}
                {message.reply_to_message && (
                  <QuotedMessage
                    message={message.reply_to_message}
                    isOwnMessage={message.sender_id === userId}
                  />
                )}
                <p className="text-[15px] leading-snug tracking-tight">
                  {(() => {
                    const content = (message.content || '')
                      .replace(/<<ACTION:[^>]+>>/g, '')
                      .replace(/\[EMOTION:[^\]]+\]/gi, '')
                      .trim();
                    const linkPattern = /\[LINK:([^\|]+)\|([^\]]+)\]/g;
                    const parts: (string | JSX.Element)[] = [];
                    let lastIndex = 0;
                    let match;
                    let key = 0;

                    while ((match = linkPattern.exec(content)) !== null) {
                      if (match.index > lastIndex) {
                        parts.push(content.substring(lastIndex, match.index));
                      }
                      
                      const linkText = match[1];
                      const linkUrl = match[2];
                      const isHashLink = linkUrl === '#';
                      
                      parts.push(
                        <a
                          key={key++}
                          href={linkUrl}
                          onClick={(e) => {
                            if (isHashLink) {
                              e.preventDefault();
                              return;
                            }
                            e.preventDefault();
                            if (typeof window !== 'undefined') {
                              window.location.href = linkUrl;
                            }
                          }}
                          className="underline font-medium hover:opacity-80 transition-opacity text-blue-300"
                          target={linkUrl.startsWith('http') ? '_blank' : undefined}
                          rel={linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          {linkText}
                        </a>
                      );
                      
                      lastIndex = match.index + match[0].length;
                    }
                    
                    if (lastIndex < content.length) {
                      parts.push(content.substring(lastIndex));
                    }
                    
                    return parts.length > 0 ? <>{parts}</> : content;
                  })()}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReplyTo(message)}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md ${
                        message.sender_id === userId
                          ? 'hover:bg-blue-600/50 text-blue-100/70 hover:text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700/50 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                      }`}
                      title="Responder mensaje"
                      aria-label="Responder mensaje"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <p className={`text-[11px] font-medium leading-none ${
                      message.sender_id === userId
                        ? 'text-blue-100/70'
                        : 'text-gray-500 dark:text-gray-400/70'
                    }`}>
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                  {message.sender_id === userId && (
                    <span className="ml-2 flex items-center" title={message.is_read_by_other ? 'Visto' : 'Entregado'}>
                      {message.is_read_by_other ? (
                        // Visto (doble check azul brillante)
                        <span className="inline-flex items-center" style={{ width: '16px' }}>
                          <svg className="w-3.5 h-3.5 text-cyan-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <svg className="w-3.5 h-3.5 text-cyan-300 -ml-1.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        // Entregado (un solo check blanco translúcido)
                        <svg className="w-3.5 h-3.5 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Input de mensaje */}
      {!isMinimized && (
      <div className="p-3 border-t border-white/20 dark:border-white/5 bg-white/30 dark:bg-black/20 backdrop-blur-3xl relative z-10 transition-colors duration-300">
        {/* Preview de reply */}
        {replyTo && (
          <ReplyPreview
            message={replyTo}
            onCancel={() => setReplyTo(null)}
          />
        )}
        <div className="flex items-center space-x-2 pl-1">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2.5 rounded-full bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500/70 dark:placeholder-gray-400/70 border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/90 dark:focus:bg-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-[15px] tracking-tight transition-all"
          />
          <button
            onClick={() => {
              console.log('🖱️ [IndividualChat] Botón enviar clickeado');
              sendMessage();
            }}
            disabled={!newMessage.trim()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#6E1CFF] text-white disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg hover:shadow-[#0A84FF]/30 active:scale-95 transition-all duration-300 border-none outline-none ring-0 overflow-hidden"
            aria-label="Enviar mensaje"
          >
            <svg className="w-[18px] h-[18px] ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messageReadStatus, setMessageReadStatus] = useState<Record<string, 'sent' | 'delivered' | 'read'>>({});
  const [position, setPosition] = useState<{ x?: number; y?: number; right?: number }>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Calcular posición inicial basada en el índice de la ventana
  const getInitialPosition = () => {
    const windowWidth = 320; // w-80 = 320px
    const margin = 16; // Margen entre ventanas
    const rightOffset = 24; // right-6 = 24px (igual que la ventana principal)
    const mainChatWidth = 320; // w-80 de la ventana principal

    if (isInChatBar) {
      // En la barra de chat: ventanas a la izquierda de la ventana principal
      // La ventana principal está en: window.innerWidth - rightOffset - mainChatWidth
      // Las ventanas individuales van a la izquierda con cascading
      const mainChatLeftEdge = window.innerWidth - rightOffset - mainChatWidth;
      
      // Calcular posición de DERECHA A IZQUIERDA (primera ventana más cerca de la principal = MAYOR left)
      const finalLeft = mainChatLeftEdge - margin + (windowIndex * (windowWidth + margin));
      
      console.log('🪟 [IndividualChatWindow] Posición en barra de chat (DERECHA A IZQUIERDA):', {
        windowIndex,
        windowInnerWidth: window.innerWidth,
        mainChatLeftEdge,
        finalLeft,
        isInChatBar,
        calculation: `${mainChatLeftEdge} - ${margin} + (${windowIndex} * (${windowWidth} + ${margin}))`
      });
      
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

    // Polling cada 2 segundos para tiempo real
    const interval = setInterval(pollMessages, 2000);

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


  // Función para obtener el ícono de estado del mensaje (estilo Apple)
  const getMessageStatusIcon = (messageId: string) => {
    const status = messageReadStatus[messageId] || 'sent';
    
    switch (status) {
      case 'sent':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'delivered':
        return (
          <div className="flex -space-x-1">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'read':
        return (
          <div className="flex -space-x-1">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  // Cargar mensajes
  const loadMessages = async () => {
    if (!conversationId || !session) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/messages?conversation_id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
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
          content: newMessage.trim()
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
      className="w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-[9996] fixed"
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
        className={`flex items-center justify-between ${isMinimized ? 'px-3 py-2' : 'p-4'} border-b border-gray-700 bg-gray-900 rounded-t-lg ${
          isInChatBar ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
        onMouseDown={isInChatBar ? undefined : handleMouseDown}
      >
        {isMinimized ? (
          <div className="flex items-center min-w-0 pr-2">
            <span className="text-white text-sm font-medium truncate" title={minimizedLabel}>
              {minimizedLabel}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xs tracking-wider">
                {getDisplayName(otherUser).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold text-sm truncate">
                {getDisplayName(otherUser)}
              </h3>
              <p className="text-gray-400 text-xs truncate">
                {otherUser.role}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
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
            className="p-1 text-gray-400 hover:text-white transition-colors"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-400">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-400 text-center">
              <p>No hay mensajes aún</p>
              <p className="text-xs mt-1">Envía el primer mensaje</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-3 py-2 rounded-lg ${
                  message.sender_id === userId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs opacity-70">
                    {formatMessageTime(message.created_at)}
                  </p>
                  {message.sender_id === userId && (
                    <div className="ml-2 flex items-center">
                      {getMessageStatusIcon(message.id)}
                    </div>
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
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              console.log('🖱️ [IndividualChat] Botón enviar clickeado');
              sendMessage();
            }}
            disabled={!newMessage.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            aria-label="Enviar mensaje"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

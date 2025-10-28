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
}

export default function IndividualChatWindow({ 
  conversationId, 
  otherUser, 
  onClose, 
  userId, 
  userRole,
  session,
  windowIndex = 0
}: IndividualChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Calcular posición inicial basada en el índice de la ventana
  const getInitialPosition = () => {
    const windowWidth = 320; // w-80 = 320px
    const windowHeight = 500; // h-[500px]
    const margin = 20; // Margen entre ventanas
    const rightMargin = 100; // Margen desde el borde derecho
    
    // Posición base: a la izquierda de la ventana principal del chat
    const baseX = window.innerWidth - rightMargin - windowWidth - 400; // 400px es el ancho del chat principal
    const baseY = 100; // Altura base
    
    // Calcular offset basado en el índice
    const offsetX = windowIndex * (windowWidth + margin);
    const offsetY = windowIndex * 50; // Offset vertical pequeño
    
    return {
      x: Math.max(20, baseX - offsetX), // No ir más allá del borde izquierdo
      y: baseY + offsetY
    };
  };

  // Inicializar posición
  useEffect(() => {
    const initialPos = getInitialPosition();
    setPosition(initialPos);
  }, [windowIndex]);

  // Función para obtener nombre de usuario
  const getDisplayName = (user: any) => {
    return user.name || user.email || 'Usuario';
  };

  // Cargar mensajes
  const loadMessages = async () => {
    if (!conversationId || !session) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chat/messages?conversationId=${conversationId}`, {
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
    if (!newMessage.trim() || !conversationId || !session) return;
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversationId,
          content: newMessage.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewMessage('');
        await loadMessages(); // Recargar mensajes
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  // Manejar tecla Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

  return (
    <div
      ref={windowRef}
      className="fixed w-80 h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-[9996]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-xs tracking-wider">
              {getDisplayName(otherUser).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-white font-semibold">
              {getDisplayName(otherUser)}
            </h3>
            <p className="text-gray-400 text-xs">
              {otherUser.role}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              // Minimizar ventana (opcional)
              console.log('Minimizar ventana');
            }}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Minimizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
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
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            className="flex-1 bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
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
    </div>
  );
}

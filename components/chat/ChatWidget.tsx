'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { updateUserHeartbeat, setUserOffline } from '@/lib/chat/status-manager';

interface ChatWidgetProps {
  userId?: string;
  userRole?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_online: boolean;
  last_seen: string;
}

interface Conversation {
  id: string;
  other_participant: User;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  last_message_at: string;
}

export default function ChatWidget({ userId, userRole }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUserList, setShowUserList] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    online: true,
    offline: false
  });
  const [isBlinking, setIsBlinking] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [tempChatUser, setTempChatUser] = useState<User | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<any>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Obtener sesión de Supabase
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  // Sistema de heartbeat y detección de cierre de navegador
  useEffect(() => {
    if (!userId) return;

    // Función para enviar heartbeat
    const sendHeartbeat = async () => {
      try {
        await updateUserHeartbeat(userId);
      } catch (error) {
        console.error('❌ [ChatWidget] Error enviando heartbeat:', error);
      }
    };

    // Enviar heartbeat inicial
    sendHeartbeat();

    // Configurar heartbeat cada 30 segundos
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);

    // Detectar cierre de navegador/pestaña
    const handleBeforeUnload = async () => {
      try {
        await setUserOffline(userId);
      } catch (error) {
        console.error('❌ [ChatWidget] Error marcando usuario offline:', error);
      }
    };

    // Detectar pérdida de foco (usuario cambia de pestaña)
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Usuario cambió de pestaña, enviar heartbeat menos frecuente
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 60000); // 1 minuto
      } else {
        // Usuario volvió a la pestaña, heartbeat normal
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000); // 30 segundos
        sendHeartbeat(); // Enviar inmediatamente
      }
    };

    // Agregar event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Marcar como offline al desmontar el componente
      setUserOffline(userId).catch(error => {
        console.error('❌ [ChatWidget] Error marcando usuario offline en cleanup:', error);
      });
    };
  }, [userId]);

  // Cargar conversaciones
  const loadConversations = async () => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
        // Calcular mensajes no leídos
        const unread = data.conversations.reduce((count: number, conv: any) => {
          if (conv.last_message && conv.last_message.sender_id !== userId) {
            return count + 1;
          }
          return count;
        }, 0);
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    }
  };

  // Cargar usuarios disponibles
  const loadAvailableUsers = async () => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/chat/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setAvailableUsers(data.users);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  // Cargar mensajes de una conversación
  const loadMessages = async (conversationId: string) => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/chat/messages?conversation_id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
        setSelectedConversation(conversationId);
      }
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !session) return;
    
    setIsLoading(true);
    try {
      let conversationId = selectedConversation;
      
      // Si es una conversación temporal, crear la conversación real primero
      if (selectedConversation.startsWith('temp_')) {
        const userId = selectedConversation.replace('temp_', '');
        const newConversationId = await createConversation(userId);
        if (newConversationId) {
          conversationId = newConversationId;
          setSelectedConversation(newConversationId);
          setTempChatUser(null); // Limpiar usuario temporal
        } else {
          console.error('Error creando conversación');
          return;
        }
      }
      
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
      
      const data = await response.json();
      if (data.success) {
        setNewMessage('');
        // Recargar mensajes
        await loadMessages(conversationId);
        // Recargar conversaciones para actualizar último mensaje
        await loadConversations();
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Abrir chat con usuario (sin crear conversación aún)
  const openChatWithUser = async (userId: string) => {
    if (!session) return;
    
    // Buscar si ya existe una conversación con este usuario
    const existingConversation = conversations.find(conv => 
      conv.other_participant.id === userId
    );
    
    if (existingConversation) {
      // Si ya existe conversación, abrirla
      setShowUserList(false);
      setSelectedConversation(existingConversation.id);
      setTempChatUser(null); // Limpiar usuario temporal
      await loadMessages(existingConversation.id);
    } else {
      // Si no existe, solo abrir la ventana de chat sin crear conversación
      const user = availableUsers.find(u => u.id === userId);
      setShowUserList(false);
      setSelectedConversation(`temp_${userId}`); // ID temporal
      setTempChatUser(user || null); // Almacenar usuario temporal
      setMessages([]); // Sin mensajes aún
    }
  };

  // Crear nueva conversación (solo cuando se envía el primer mensaje)
  const createConversation = async (userId: string) => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          participant_2_id: userId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        return data.conversation.id; // Retornar el ID de la conversación
      }
    } catch (error) {
      console.error('Error creando conversación:', error);
    }
    return null;
  };

  // Actualizar estado del usuario (en línea/offline)
  const updateUserStatus = async (isOnline: boolean) => {
    if (!session) return;
    
    try {
      await fetch('/api/chat/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          is_online: isOnline
        })
      });
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  // Toggle de secciones expandidas/contraídas
  const toggleSection = (section: 'online' | 'offline') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Función para reproducir sonido de notificación "N Dinámico"
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      
      // Patrón "N Dinámico": [400, 600, 800, 1000, 1200, 1000, 800, 600, 400, 600, 800, 1000, 1200]
      const frequencies = [400, 600, 800, 1000, 1200, 1000, 800, 600, 400, 600, 800, 1000, 1200];
      const duration = 0.5;
      
      frequencies.forEach((freq, index) => {
        const time = audioContext.currentTime + (index / frequencies.length) * duration;
        oscillator.frequency.setValueAtTime(freq, time);
      });
      
      // Envelope dinámico
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.error('Error reproduciendo sonido de notificación:', error);
    }
  };

  // Función para activar notificaciones (sonido + parpadeo + apertura automática)
  const triggerNotification = () => {
    // Reproducir sonido
    playNotificationSound();
    
    // Activar parpadeo
    setIsBlinking(true);
    setHasNewMessage(true);
    
    // Abrir chat automáticamente si está cerrado
    if (!isOpen) {
      setIsOpen(true);
    }
    
    // Detener parpadeo después de 3 segundos
    setTimeout(() => {
      setIsBlinking(false);
    }, 3000);
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (session) {
      loadConversations();
      loadAvailableUsers();
    }
  }, [session]);

  // Actualizar lista de usuarios cada 10 segundos para ver cambios de estado
  useEffect(() => {
    if (!session) return;

    // Actualizar lista de usuarios cada 10 segundos
    const usersUpdateInterval = setInterval(() => {
      loadAvailableUsers();
    }, 10000);

    // Cleanup
    return () => {
      clearInterval(usersUpdateInterval);
    };
  }, [session]);

  // Auto-scroll a mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suscripción a tiempo real para mensajes nuevos
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Solo activar notificación si el mensaje no es del usuario actual
          if (newMessage.sender_id !== userId) {
            // Verificar si el mensaje pertenece a una conversación del usuario
            const isRelevantMessage = conversations.some(conv => conv.id === newMessage.conversation_id);
            
            if (isRelevantMessage) {
              triggerNotification();
              
              // Recargar conversaciones y mensajes si es la conversación activa
              if (selectedConversation === newMessage.conversation_id && selectedConversation) {
                loadMessages(selectedConversation);
              }
              loadConversations();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, conversations, selectedConversation, userId]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && session) {
      loadConversations();
    }
    
    // Limpiar estado de notificación cuando se abre el chat
    if (!isOpen) {
      setHasNewMessage(false);
      setIsBlinking(false);
    } else {
      // Limpiar usuario temporal al cerrar
      setTempChatUser(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Botón flotante para abrir el chat */}
      <button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 w-10 h-10 bg-gray-900 hover:w-16 hover:h-10 text-white rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center z-50 group overflow-hidden ${
          isBlinking ? 'animate-pulse bg-blue-600' : ''
        }`}
        aria-label="Abrir chat de soporte"
      >
        <div className="flex items-center justify-center">
          {/* Versión miniatura - solo "A" */}
          <span className="text-white font-bold text-sm group-hover:hidden">A</span>
          
          {/* Versión expandida - "AIM" */}
          <span className="text-white font-bold text-xs hidden group-hover:block whitespace-nowrap">AIM</span>
        </div>
        
        {/* Contador de mensajes no leídos */}
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </div>
        )}
      </button>

      {/* Ventana del chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-24 w-80 h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {tempChatUser ? tempChatUser.name.charAt(0).toUpperCase() : 'AIM'}
                </span>
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  {tempChatUser ? tempChatUser.name : 'AIM Assistant'}
                </h3>
                <p className="text-gray-400 text-xs">
                  {tempChatUser ? tempChatUser.role : 'Soporte y tips'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setShowUserList(!showUserList);
                  setSelectedConversation(null);
                  setTempChatUser(null);
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label={showUserList ? "Ver conversaciones" : "Ver usuarios"}
              >
                {showUserList ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </button>
              <button
                onClick={toggleChat}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Cerrar chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

                  {/* Lista de usuarios disponibles para chat */}
                  {showUserList && !selectedConversation && (
                    <div className="flex-1 overflow-y-auto p-4">
                      <h4 className="text-white text-sm font-medium mb-3">Usuarios disponibles</h4>
                      
                      {/* Usuarios en línea */}
                      <div className="mb-4">
                        <button
                          onClick={() => toggleSection('online')}
                          className="flex items-center space-x-2 mb-2 w-full hover:bg-gray-700 rounded-lg p-1 transition-colors"
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-green-400 text-xs font-medium">En línea ({availableUsers.filter(u => u.is_online).length})</span>
                          <svg 
                            className={`w-3 h-3 text-green-400 transition-transform duration-200 ml-auto ${expandedSections.online ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedSections.online && (
                          <div className="space-y-2">
                            {availableUsers
                              .filter(user => user.is_online)
                              .map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => openChatWithUser(user.id)}
                                  className="w-full flex items-center space-x-3 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-medium">
                                      {user.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className="text-white text-sm font-medium">{user.name}</div>
                                    <div className="text-gray-400 text-xs">{user.role}</div>
                                  </div>
                                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Usuarios offline */}
                      <div>
                        <button
                          onClick={() => toggleSection('offline')}
                          className="flex items-center space-x-2 mb-2 w-full hover:bg-gray-700 rounded-lg p-1 transition-colors"
                        >
                          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                          <span className="text-gray-400 text-xs font-medium">Offline ({availableUsers.filter(u => !u.is_online).length})</span>
                          <svg 
                            className={`w-3 h-3 text-gray-400 transition-transform duration-200 ml-auto ${expandedSections.offline ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedSections.offline && (
                          <div className="space-y-2">
                            {availableUsers
                              .filter(user => !user.is_online)
                              .map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => openChatWithUser(user.id)}
                                  className="w-full flex items-center space-x-3 p-2 hover:bg-gray-700 rounded-lg transition-colors opacity-75"
                                >
                                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-medium">
                                      {user.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className="text-white text-sm font-medium">{user.name}</div>
                                    <div className="text-gray-400 text-xs">{user.role}</div>
                                  </div>
                                  <div className="w-2 h-2 bg-gray-500 rounded-full" />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

          {/* Lista de conversaciones */}
          {!showUserList && !selectedConversation && (
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-white text-sm font-medium mb-3">Conversaciones</h4>
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => loadMessages(conversation.id)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {conversation.other_participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white text-sm font-medium">
                        {conversation.other_participant.name}
                      </div>
                      <div className="text-gray-400 text-xs truncate">
                        {conversation.last_message?.content || 'Sin mensajes'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`w-2 h-2 rounded-full ${conversation.other_participant.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div className="text-gray-400 text-xs mt-1">
                        {new Date(conversation.last_message_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Área de mensajes */}
          {selectedConversation && (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.sender_id === userId
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Área de entrada */}
              <div className="p-4 border-t border-gray-700 bg-gray-800">
                <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu mensaje..."
                  className="w-full resize-none border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent placeholder-gray-400"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Abrir emojis"
              >
                <span className="text-lg">😊</span>
              </button>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isLoading}
                    className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    aria-label="Enviar mensaje"
                  >
                    {isLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="hover:text-white transition-colors"
                  >
                    ← Volver a conversaciones
                  </button>
                  <span>• Sesión activa</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [showUserList, setShowUserList] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<any>(null);

  // Obtener sesión de Supabase
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

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
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
          content: newMessage.trim()
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setNewMessage('');
        // Recargar mensajes
        await loadMessages(selectedConversation);
        // Recargar conversaciones para actualizar último mensaje
        await loadConversations();
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Crear nueva conversación
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
        setShowUserList(false);
        await loadConversations();
        await loadMessages(data.conversation.id);
      }
    } catch (error) {
      console.error('Error creando conversación:', error);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (session) {
      loadConversations();
      loadAvailableUsers();
    }
  }, [session]);

  // Auto-scroll a mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && session) {
      loadConversations();
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
        className="fixed bottom-6 right-6 w-10 h-10 bg-gray-900 hover:w-16 hover:h-10 text-white rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center z-50 group overflow-hidden"
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
        <div className="fixed bottom-6 right-16 w-80 h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">AIM</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">AIM Assistant</h3>
                <p className="text-gray-400 text-xs">Soporte y tips</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowUserList(!showUserList)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Nueva conversación"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
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

          {/* Lista de usuarios para nueva conversación */}
          {showUserList && (
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <h4 className="text-white text-sm font-medium mb-3">Iniciar conversación</h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {availableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => createConversation(user.id)}
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
                    <div className={`w-2 h-2 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de conversaciones */}
          {!selectedConversation && (
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

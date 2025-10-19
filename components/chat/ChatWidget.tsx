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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    online: true,
    offline: false
  });
  const [isBlinking, setIsBlinking] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [tempChatUser, setTempChatUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<any>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función helper para obtener el nombre de visualización
  const getDisplayName = (user: User) => {
    if (user.role === 'modelo') {
      // Para modelos, mostrar solo la parte antes del @ del email
      return user.email.split('@')[0];
    }
    // Para otros roles, mostrar el nombre completo
    return user.name;
  };

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
        // Solo actualizar si hay cambios en los mensajes
        setMessages(prev => {
          const newMessages = data.messages;
          const hasChanges = prev.length !== newMessages.length || 
            prev.some((msg, index) => !newMessages[index] || msg.id !== newMessages[index].id);
          
          if (hasChanges) {
            console.log('📨 [ChatWidget] Mensajes actualizados:', { 
              previous: prev.length, 
              new: newMessages.length 
            });
            
            // Verificar si hay mensajes nuevos de otros usuarios
            if (newMessages.length > prev.length) {
              const latestMessage = newMessages[newMessages.length - 1];
              if (latestMessage && latestMessage.sender_id !== userId) {
                console.log('🔔 [ChatWidget] Nuevo mensaje detectado via polling, activando notificación...');
                triggerNotification();
              }
            }
            
            return newMessages;
          }
          return prev;
        });
        setSelectedConversation(conversationId);
      } else {
        console.error('❌ [ChatWidget] Error en respuesta de mensajes:', data);
        
        // Si la conversación no existe (fue eliminada), preparar para nueva conversación
        if (data.error && (data.error.includes('no encontrada') || data.error.includes('no existe'))) {
          console.log('🔄 [ChatWidget] Conversación eliminada durante carga de mensajes, preparando nueva conversación...');
          await handleConversationDeleted(conversationId);
          return; // No hacer diagnóstico si la conversación no existe
        }
        
        // Intentar diagnóstico si hay error
        await diagnosePollingIssue(conversationId);
      }
    } catch (error) {
      console.error('❌ [ChatWidget] Error cargando mensajes:', error);
      // Intentar diagnóstico si hay error
      await diagnosePollingIssue(conversationId);
    }
  };

  // Manejar conversación eliminada - preparar para nueva conversación
  const handleConversationDeleted = async (deletedConversationId: string) => {
    if (!session) return;
    
    console.log('🔄 [ChatWidget] Manejando conversación eliminada:', deletedConversationId);
    
    try {
      // Recargar conversaciones para obtener lista actualizada
      await loadConversations();
      
      // Si la conversación eliminada era una conversación real (no temporal)
      if (!deletedConversationId.startsWith('temp_')) {
        console.log('💡 [ChatWidget] Conversación eliminada, preparando nueva conversación automáticamente');
        
        // Buscar el último mensaje para identificar al otro participante
        // Esto nos ayudará a preparar automáticamente una nueva conversación
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.sender_id !== userId) {
          // Encontrar al usuario con quien se estaba chateando
          const otherUserId = lastMessage.sender_id;
          const otherUser = availableUsers.find(u => u.id === otherUserId);
          
          if (otherUser) {
            console.log('🎯 [ChatWidget] Usuario identificado para nueva conversación:', otherUser.name || otherUser.email);
            
            // Preparar automáticamente una nueva conversación con el mismo usuario
            setTempChatUser(otherUser);
            setSelectedConversation(`temp_${otherUserId}`);
            setMessages([]);
            
            // Mostrar mensaje informativo
            const infoMessage = {
              id: `info_${Date.now()}`,
              content: `💬 Conversación reiniciada con ${getDisplayName(otherUser)}. Puedes continuar chateando.`,
              sender_id: 'system',
              conversation_id: `temp_${otherUserId}`,
              created_at: new Date().toISOString(),
              is_system_message: true
            };
            
            setMessages([infoMessage]);
            return;
          }
        }
        
        // Si no pudimos identificar al usuario, mostrar mensaje genérico
        console.log('⚠️ [ChatWidget] No se pudo identificar al usuario, mostrando mensaje genérico');
        setMessages([]);
        setTempChatUser(null);
        
        const infoMessage = {
          id: `info_${Date.now()}`,
          content: '💬 Esta conversación fue eliminada. Selecciona un usuario para iniciar una nueva conversación.',
          sender_id: 'system',
          conversation_id: deletedConversationId,
          created_at: new Date().toISOString(),
          is_system_message: true
        };
        
        setMessages([infoMessage]);
        // NO cerrar el chat - mantener abierto para que el usuario pueda seleccionar un usuario
        setShowUserList(true); // Mostrar lista de usuarios para selección
        
      } else {
        // Si era una conversación temporal, simplemente limpiar
        console.log('🧹 [ChatWidget] Limpiando conversación temporal eliminada');
        setMessages([]);
        setTempChatUser(null);
        // NO cerrar el chat - mantener abierto y mostrar lista de usuarios
        setShowUserList(true);
      }
      
    } catch (error) {
      console.error('❌ [ChatWidget] Error manejando conversación eliminada:', error);
      // En caso de error, limpiar todo pero mantener el chat abierto
      setMessages([]);
      setTempChatUser(null);
      // NO cerrar el chat - mantener abierto para recuperación y mostrar lista de usuarios
      setShowUserList(true);
    }
  };

  // Función de diagnóstico para problemas de polling
  const diagnosePollingIssue = async (conversationId: string) => {
    if (!session) return;
    
    try {
      console.log('🔍 [ChatWidget] Ejecutando diagnóstico de polling...');
      const response = await fetch(`/api/chat/debug-polling?conversation_id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ [ChatWidget] Diagnóstico exitoso:', data.debug);
      } else {
        console.error('❌ [ChatWidget] Diagnóstico falló:', data);
      }
    } catch (error) {
      console.error('❌ [ChatWidget] Error en diagnóstico:', error);
    }
  };

  // Enviar mensaje
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !session) return;
    
    console.log('📤 [ChatWidget] Enviando mensaje:', { 
      content: newMessage.trim(), 
      conversationId: selectedConversation,
      userId 
    });
    
    setIsLoading(true);
    try {
      let conversationId = selectedConversation;
      
      // Si es una conversación temporal, crear la conversación real primero
      if (selectedConversation.startsWith('temp_')) {
        console.log('🆕 [ChatWidget] Creando conversación temporal...');
        const userId = selectedConversation.replace('temp_', '');
        const newConversationId = await createConversation(userId);
        if (newConversationId) {
          conversationId = newConversationId;
          setSelectedConversation(newConversationId);
          setTempChatUser(null); // Limpiar usuario temporal
          console.log('✅ [ChatWidget] Conversación creada:', newConversationId);
        } else {
          console.error('❌ [ChatWidget] Error creando conversación');
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
      console.log('📨 [ChatWidget] Respuesta del servidor:', data);
      
      if (data.success) {
        console.log('✅ [ChatWidget] Mensaje enviado exitosamente');
        setNewMessage('');
        
        // Como fallback, si la suscripción no funciona, recargar mensajes
        setTimeout(async () => {
          console.log('🔄 [ChatWidget] Recargando mensajes como fallback...');
          await loadMessages(conversationId);
        }, 1000);
        
        // Actualizar conversaciones para mostrar último mensaje
        await loadConversations();
      } else {
        console.error('❌ [ChatWidget] Error en respuesta del servidor:', data);
        
        // Si la conversación no existe (fue eliminada), preparar para nueva conversación
        if (data.error && (data.error.includes('no encontrada') || data.error.includes('no existe'))) {
          console.log('🔄 [ChatWidget] Conversación eliminada durante envío, preparando nueva conversación...');
          await handleConversationDeleted(conversationId);
        }
      }
    } catch (error) {
      console.error('❌ [ChatWidget] Error enviando mensaje:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Abrir chat con usuario (sin crear conversación aún)
  const openChatWithUser = async (userId: string) => {
    if (!session) return;
    
    console.log('💬 [ChatWidget] Abriendo chat con usuario:', userId);
    
    // Buscar si ya existe una conversación con este usuario
    const existingConversation = conversations.find(conv => 
      conv.other_participant.id === userId
    );
    
    if (existingConversation) {
      // Si ya existe conversación, abrirla
      console.log('📂 [ChatWidget] Conversación existente encontrada:', existingConversation.id);
      setShowUserList(false);
      setSelectedConversation(existingConversation.id);
      setTempChatUser(null); // Limpiar usuario temporal
      await loadMessages(existingConversation.id);
    } else {
      // Si no existe, abrir la ventana de chat para nueva conversación
      const user = availableUsers.find(u => u.id === userId);
      console.log('🆕 [ChatWidget] Iniciando nueva conversación con:', user?.name || user?.email);
      setShowUserList(false);
      setSelectedConversation(`temp_${userId}`); // ID temporal
      setTempChatUser(user || null); // Almacenar usuario temporal
      setMessages([]); // Sin mensajes aún
      // Mantener la ventana de chat abierta para permitir escribir el primer mensaje
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

  // Eliminar conversación
  const deleteConversation = async (conversationId: string) => {
    if (!session) return;
    
    try {
      const response = await fetch(`/api/chat/conversations?conversation_id=${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('🗑️ [ChatWidget] Conversación eliminada exitosamente');
        
        // Recargar conversaciones para actualizar la lista
        await loadConversations();
        
        // Si la conversación eliminada estaba seleccionada, limpiar estado
        if (selectedConversation === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
          setTempChatUser(null); // Limpiar usuario temporal también
          console.log('🧹 [ChatWidget] Estado de chat limpiado después de eliminación');
        }
        
        setShowDeleteConfirm(null);
      } else {
        console.error('❌ [ChatWidget] Error eliminando conversación:', data.error);
      }
    } catch (error) {
      console.error('❌ [ChatWidget] Error eliminando conversación:', error);
    }
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
      console.log('🎵 [ChatWidget] Iniciando reproducción de sonido...');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      
      // Patrón "N Dinámico": [400, 600, 800, 1000, 1200, 1000, 800, 600, 400, 600, 800, 1000, 1200]
      const frequencies = [400, 600, 800, 1000, 1200, 1000, 800, 600, 400, 600, 800, 1000, 1200];
      const duration = 0.5; // Duración original
      
      console.log('🎼 [ChatWidget] Configurando frecuencias:', frequencies);
      
      frequencies.forEach((freq, index) => {
        const time = audioContext.currentTime + (index / frequencies.length) * duration;
        oscillator.frequency.setValueAtTime(freq, time);
      });
      
      // Envelope dinámico original
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
      console.log('✅ [ChatWidget] Sonido de notificación reproducido exitosamente');
    } catch (error) {
      console.error('❌ [ChatWidget] Error reproduciendo sonido de notificación:', error);
    }
  };

  // Función para activar notificaciones (sonido + parpadeo + apertura automática)
  const triggerNotification = () => {
    console.log('🔍 [ChatWidget] triggerNotification llamada - isOpen:', isOpen);
    
    // Solo activar notificaciones si la ventana del chat está cerrada
    if (isOpen) {
      console.log('📂 [ChatWidget] Chat abierto - NO activando notificaciones');
      return;
    }
    
    console.log('🔔 [ChatWidget] TRIGGER NOTIFICATION - Activando notificaciones (chat cerrado)...');
    
    // Reproducir sonido
    console.log('🔊 [ChatWidget] Reproduciendo sonido de notificación...');
    playNotificationSound();
    
    // Activar parpadeo
    console.log('💫 [ChatWidget] Activando parpadeo del botón...');
    setIsBlinking(true);
    setHasNewMessage(true);
    
    // Abrir chat automáticamente
    console.log('📂 [ChatWidget] Abriendo chat automáticamente...');
    setIsOpen(true);
    
    // Detener latido de corazón después de 6 segundos (4 ciclos de 1.5s)
    setTimeout(() => {
      console.log('⏹️ [ChatWidget] Deteniendo latido de corazón...');
      setIsBlinking(false);
    }, 6000);
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

  // Polling de mensajes como respaldo al realtime (cada 3 segundos)
  useEffect(() => {
    if (!session || !selectedConversation) return;

    console.log('🔄 [ChatWidget] Iniciando polling de mensajes como respaldo...');
    
    const messagesPollingInterval = setInterval(async () => {
      console.log('🔄 [ChatWidget] Polling: verificando mensajes nuevos...');
      await loadMessages(selectedConversation);
    }, 3000); // Cada 3 segundos

    // Cleanup
    return () => {
      console.log('🧹 [ChatWidget] Deteniendo polling de mensajes...');
      clearInterval(messagesPollingInterval);
    };
  }, [session, selectedConversation]);

  // Polling de conversaciones como respaldo al realtime (cada 5 segundos)
  useEffect(() => {
    if (!session) return;

    console.log('🔄 [ChatWidget] Iniciando polling de conversaciones como respaldo...');
    
    const conversationsPollingInterval = setInterval(async () => {
      console.log('🔄 [ChatWidget] Polling: verificando conversaciones actualizadas...');
      await loadConversations();
    }, 5000); // Cada 5 segundos

    // Cleanup
    return () => {
      console.log('🧹 [ChatWidget] Deteniendo polling de conversaciones...');
      clearInterval(conversationsPollingInterval);
    };
  }, [session]);

  // Auto-scroll a mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suscripción a tiempo real para mensajes nuevos
  useEffect(() => {
    if (!session || !userId) return;

    console.log('🔔 [ChatWidget] Configurando suscripción en tiempo real...');

    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          console.log('📨 [ChatWidget] Nuevo mensaje recibido:', newMessage);
          
          // Verificar si el mensaje pertenece a una conversación del usuario
          const isRelevantMessage = conversations.some(conv => conv.id === newMessage.conversation_id);
          
          if (isRelevantMessage) {
            console.log('✅ [ChatWidget] Mensaje relevante para el usuario');
            
            // Si es la conversación activa, agregar el mensaje directamente
            if (selectedConversation === newMessage.conversation_id) {
              console.log('💬 [ChatWidget] Agregando mensaje a conversación activa');
              setMessages(prev => {
                // Verificar que el mensaje no esté ya en la lista
                const messageExists = prev.some(msg => msg.id === newMessage.id);
                if (messageExists) {
                  console.log('⚠️ [ChatWidget] Mensaje ya existe en la lista, no agregando');
                  return prev;
                }
                console.log('➕ [ChatWidget] Agregando nuevo mensaje a la lista');
                return [...prev, newMessage];
              });
            }
            
            // Actualizar conversaciones para mostrar último mensaje
            console.log('🔄 [ChatWidget] Actualizando lista de conversaciones...');
            loadConversations();
            
            // Solo activar notificación si el mensaje no es del usuario actual
            if (newMessage.sender_id !== userId) {
              console.log('🔔 [ChatWidget] Activando notificación para mensaje de otro usuario');
              triggerNotification();
            } else {
              console.log('👤 [ChatWidget] Mensaje del usuario actual, no notificando');
            }
          } else {
            console.log('❌ [ChatWidget] Mensaje no relevante para el usuario');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations'
        },
        (payload) => {
          const updatedConversation = payload.new as any;
          console.log('🔄 [ChatWidget] Conversación actualizada:', updatedConversation);
          
          // Verificar si la conversación actualizada pertenece al usuario
          const isRelevantConversation = conversations.some(conv => conv.id === updatedConversation.id);
          
          if (isRelevantConversation) {
            console.log('✅ [ChatWidget] Conversación relevante actualizada, recargando lista...');
            loadConversations();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [ChatWidget] Estado de suscripción:', status);
      });

    return () => {
      console.log('🧹 [ChatWidget] Limpiando suscripción en tiempo real');
      supabase.removeChannel(channel);
    };
  }, [session, userId]); // Solo dependencias esenciales

  // Actualizar referencia de conversaciones para la suscripción
  useEffect(() => {
    // Este efecto se ejecuta cuando cambian las conversaciones
    // pero no recrea la suscripción
  }, [conversations, selectedConversation]);

  const toggleChat = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    if (newIsOpen && session) {
      loadConversations();
    }
    
    // Limpiar estado de notificación cuando se abre el chat
    if (newIsOpen) {
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
          isBlinking ? 'animate-heartbeat bg-gradient-to-r from-red-500 via-pink-500 to-red-600' : ''
        }`}
        aria-label="Abrir chat de soporte"
      >
        <div className="flex items-center justify-center">
          {/* Versión miniatura - solo "A" */}
          <span className="text-white font-bold text-sm group-hover:hidden">A</span>
          
          {/* Versión expandida - "AIM" */}
          <span className="text-white font-bold text-xs hidden group-hover:block whitespace-nowrap">AIM</span>
        </div>
        
      </button>

      {/* Ventana del chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-24 w-80 h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                 <span className="text-white font-bold text-sm">
                   {tempChatUser ? getDisplayName(tempChatUser).charAt(0).toUpperCase() : 'AIM'}
                 </span>
              </div>
              <div>
                 <h3 className="text-white font-semibold">
                   {tempChatUser ? getDisplayName(tempChatUser) : 'AIM Assistant'}
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
                                       {getDisplayName(user).charAt(0).toUpperCase()}
                                     </span>
                                  </div>
                                  <div className="flex-1 text-left">
                                     <div className="text-white text-sm font-medium">{getDisplayName(user)}</div>
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
                                       {getDisplayName(user).charAt(0).toUpperCase()}
                                     </span>
                                  </div>
                                  <div className="flex-1 text-left">
                                     <div className="text-white text-sm font-medium">{getDisplayName(user)}</div>
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
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="group flex items-center space-x-2 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <button
                      onClick={() => loadMessages(conversation.id)}
                      className="flex-1 flex items-center space-x-2 min-w-0"
                    >
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                         <span className="text-white text-xs font-medium">
                           {getDisplayName(conversation.other_participant).charAt(0).toUpperCase()}
                         </span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                         <div className="text-white text-sm font-medium truncate">
                           {getDisplayName(conversation.other_participant)}
                         </div>
                        <div className="text-gray-400 text-xs truncate">
                          {conversation.last_message?.content || 'Sin mensajes'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${conversation.other_participant.is_online ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <div className="text-gray-400 text-xs">
                          {new Date(conversation.last_message_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(conversation.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all"
                      title="Eliminar conversación (disponible para todos los participantes)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Área de mensajes */}
          {selectedConversation && (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => {
                    // Mensaje del sistema
                    if (message.is_system_message) {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="max-w-[80%] p-2 rounded-lg bg-yellow-600/20 border border-yellow-600/30 text-yellow-200 text-center">
                            <div className="text-sm">{message.content}</div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Mensaje normal
                    return (
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
                    );
                  })}
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

      {/* Modal de confirmación para eliminar conversación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4">Eliminar conversación</h3>
            <p className="text-gray-300 text-sm mb-6">
              ¿Estás seguro de que quieres eliminar esta conversación? Esta acción eliminará todos los mensajes y no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteConversation(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

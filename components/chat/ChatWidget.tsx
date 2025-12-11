'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { updateUserHeartbeat, setUserOffline } from '@/lib/chat/status-manager';
import IndividualChatWindow from './IndividualChatWindow';
import ChatBar from './ChatBar';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL, AIM_BOTTY_NAME } from '@/lib/chat/aim-botty';
import { playNotificationSound, initAudio } from '@/lib/chat/notification-sound';
import ToastNotification from './ToastNotification';
import Badge from './Badge';

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
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  last_message_at: string;
  unread_count?: number;
}

export default function ChatWidget({ userId, userRole }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mainView, setMainView] = useState<'users' | 'conversations' | 'chat'>('users');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    online: true,
    offline: false
  });
  const [tempChatUser, setTempChatUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  // Nuevo sistema de notificaciones
  const [toasts, setToasts] = useState<Array<{
    id: string;
    conversationId: string;
    senderName: string;
    senderAvatar?: string | null;
    messagePreview: string;
  }>>([]);

  // 🔧 NUEVO: Inicializar audio en la primera interacción del usuario
  useEffect(() => {
    const handleInteraction = () => {
      console.log('🔊 [ChatWidget] Inicializando sistema de audio por interacción del usuario');
      initAudio();
      // Remover listeners una vez inicializado
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // 🔧 MEJORADO: Función helper para inicializar lastUnreadCount desde localStorage
  const getInitialUnreadCount = (): number => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat_last_unread_count');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  };

  // 🔧 MEJORADO: Función helper para inicializar processedMessages desde localStorage
  const getInitialProcessedMessages = (): Set<string> => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat_processed_messages');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  };

  const lastUnreadCountRef = useRef<number>(getInitialUnreadCount());
  const lastSoundTimeRef = useRef<number>(0);
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  // 🔧 NUEVO: Ref para rastrear mensajes ya procesados (para evitar toasts duplicados)
  const processedMessageIdsRef = useRef<Set<string>>(getInitialProcessedMessages());
  // Registro local de último mensaje visto por conversación (usando ref para acceso inmediato)
  const [lastSeenMessageByConv, setLastSeenMessageByConv] = useState<Record<string, string>>({});
  const lastSeenMessageByConvRef = useRef<Record<string, string>>({});
  
  // 🔧 NUEVO: Ref para debouncing de marcado de lectura
  // Eliminadas las declaraciones duplicadas que causaban error de compilación
  
  // 🔧 NUEVO: Ref para controlar la primera carga y evitar notificaciones masivas al inicio
  const isFirstLoadRef = useRef<boolean>(true);

  // Helper para marcar mensaje como visto (solo estado local, no servidor)
  const markMessageAsSeen = (conversationId: string, messageId: string) => {
    setLastSeenMessageByConv(prevSeen => {
      const newSeen = {
        ...prevSeen,
        [conversationId]: messageId
      };
      lastSeenMessageByConvRef.current = newSeen;
      return newSeen;
    });
  };

  // 🔧 FUNCIÓN CENTRALIZADA: Marcar TODOS los mensajes de una conversación como leídos
  // 🔧 NUEVO: Refs para evitar bucles de marcado como leído
  const markingAsReadRef = useRef<Set<string>>(new Set());
  const markAsReadTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastMarkedTimeRef = useRef<Map<string, number>>(new Map());

  // Con debouncing para evitar múltiples llamadas simultáneas
  const markConversationAsRead = async (conversationId: string, immediate = false) => {
    if (!session || !conversationId || conversationId.startsWith('temp_')) return;

    // Si ya se está marcando esta conversación, evitar duplicados
    if (markingAsReadRef.current.has(conversationId)) {
      // console.log('⏭️ [ChatWidget] Ya se está marcando esta conversación como leída');
      return;
    }

    // Rate limiting: evitar marcar la misma conversación más de una vez cada 2 segundos
    // a menos que sea una llamada explícita inmediata
    const lastTime = lastMarkedTimeRef.current.get(conversationId) || 0;
    const now = Date.now();
    if (!immediate && now - lastTime < 2000) {
      return;
    }

    // Si hay un timeout pendiente, cancelarlo
    const existingTimeout = markAsReadTimeoutRef.current.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      markAsReadTimeoutRef.current.delete(conversationId);
    }

    const executeMark = async () => {
      markingAsReadRef.current.add(conversationId);
      // console.log('👁️ [ChatWidget] Marcando conversación como leída:', conversationId);

      try {
        const response = await fetch('/api/chat/messages/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ conversation_id: conversationId })
        });

        // Incluso si falla, actualizamos el tiempo para evitar reintentos inmediatos
        lastMarkedTimeRef.current.set(conversationId, Date.now());

        const data = await response.json();
        if (data.success) {
          // console.log(`✅ [ChatWidget] ${data.updated || 0} mensajes marcados como leídos`);
          
          // Actualizar estado local inmediatamente
          zeroUnreadForConversation(conversationId);
          
          // 🔧 NUEVO: Marcar como leída localmente para preservar el estado
          locallyMarkedAsReadRef.current.add(conversationId);
          
          // Recargar conversaciones después de un breve delay para reflejar cambios del backend
          // Solo si hubo cambios reales
          if (data.updated > 0) {
            setTimeout(() => {
              loadConversations();
            }, 200);
          }
        } else {
          // Si el servidor devuelve error pero no es 500, probablemente sea un error lógico
          // No reintentar agresivamente
          console.warn('⚠️ [ChatWidget] Advertencia al marcar leído:', data.error);
        }
      } catch (error) {
        console.error('❌ [ChatWidget] Error en fetch de marcar como leído:', error);
      } finally {
        markingAsReadRef.current.delete(conversationId);
      }
    };

    if (immediate) {
      // Ejecutar inmediatamente (sin debounce)
      await executeMark();
    } else {
      // Debounce: esperar 500ms antes de ejecutar (aumentado de 300ms)
      const timeout = setTimeout(executeMark, 500);
      markAsReadTimeoutRef.current.set(conversationId, timeout);
    }
  };

  // Helper para poner en 0 el contador local de una conversación
  const zeroUnreadForConversation = (conversationId: string) => {
    setConversations(prev => prev.map((c: any) => 
      c.id === conversationId ? { ...c, unread_count: 0 } : c
    ));
  };
  
  // Mantener ref sincronizado con el estado
  useEffect(() => {
    lastSeenMessageByConvRef.current = lastSeenMessageByConv;
  }, [lastSeenMessageByConv]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<any>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoOpenedBottyRef = useRef<string | null>(null);
  const [isMounted, setIsMounted] = useState(false); // Para portal en document.body
  
  // 🔧 NUEVO: Estado para visibilidad del botón (sin cambiar posición)
  const [isScrolling, setIsScrolling] = useState(false);
  // Posición fija respecto al borde inferior del viewport (safe-area aware)
  
  // 🪟 Estado para ventanas individuales de chat
  const [openChatWindows, setOpenChatWindows] = useState<Array<{
    id: string;
    conversationId: string;
    otherUser: User;
  }>>([]);

  // Debug: Log cuando cambien las ventanas abiertas
  useEffect(() => {
    console.log('🪟 [ChatWidget] Ventanas abiertas actualizadas:', openChatWindows.length, openChatWindows);
  }, [openChatWindows]);

  // Función helper para obtener el nombre de visualización
  const getDisplayName = (user: User) => {
    // Verificar si es AIM Botty
    if (user.id === AIM_BOTTY_ID || user.email === AIM_BOTTY_EMAIL) {
      return AIM_BOTTY_NAME;
    }
    if (user.role === 'modelo') {
      // Para modelos, mostrar solo la parte antes del @ del email
      return user.email.split('@')[0];
    }
    // Para otros roles, mostrar el nombre completo
    return user.name;
  };

  // Función helper para verificar si se puede activar notificación
  // Calcular total de mensajes no leídos
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  // Obtener sesión de Supabase
  useEffect(() => {
    setIsMounted(true);
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  // Botón fijo al viewport: no requiere listeners (queda siempre a bottom fijo)
  useEffect(() => {
    return () => {};
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

  // Detectar pérdida de conexión a internet
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 [ChatWidget] Conexión restaurada');
      if (userId) {
        try {
          await updateUserStatus(true);
          console.log('🟢 [ChatWidget] Usuario marcado como online tras restaurar conexión');
        } catch (error) {
          console.error('❌ [ChatWidget] Error marcando usuario online:', error);
        }
      }
    };

    const handleOffline = async () => {
      console.log('🌐 [ChatWidget] Conexión perdida');
      if (userId) {
        try {
          await updateUserStatus(false);
          console.log('🔴 [ChatWidget] Usuario marcado como offline por pérdida de conexión');
        } catch (error) {
          console.error('❌ [ChatWidget] Error marcando usuario offline:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  // 🔧 NUEVO: Ref para rastrear conversaciones que fueron marcadas como leídas localmente
  const locallyMarkedAsReadRef = useRef<Set<string>>(new Set());

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
        // Si estamos viendo una conversación, marcarla como leída inmediatamente en el servidor
        // y forzar su unread_count a 0 localmente
        const normalized = (data.conversations || []).map((conv: any) => {
          const isCurrentlyOpen = isOpen && mainView === 'chat' && selectedConversation === conv.id;
          const wasLocallyMarkedAsRead = locallyMarkedAsReadRef.current.has(conv.id);
          
          // Si la conversación está abierta O fue marcada como leída localmente, forzar unread_count a 0
          if (isCurrentlyOpen || wasLocallyMarkedAsRead) {
            // Marcar como leída en el servidor si tiene mensajes no leídos y no está ya marcada
            if (conv.unread_count > 0 && isCurrentlyOpen) {
              markConversationAsRead(conv.id, true); // true = inmediato, sin debounce
            }
            // Forzar unread_count a 0 para preservar el estado local
            return { ...conv, unread_count: 0 };
          }
          return conv;
        });
        setConversations(normalized);

        // Calcular total de no leídos basado en unread_count del backend
        const unread = normalized.reduce((acc: number, conv: any) => acc + (conv.unread_count || 0), 0);

        // 🔧 MEJORADO: Detectar mensajes nuevos para mostrar toast (solo si el chat está cerrado)
        // IMPORTANTE: Solo mostrar toast si el mensaje NO ha sido leído Y no ha sido procesado antes
        if (!isOpen) {
          // Si es la primera carga, NO mostrar notificaciones, solo actualizar el estado base
          if (isFirstLoadRef.current) {
            console.log('🔇 [ChatWidget] Primera carga: silenciando notificaciones iniciales');
            // Marcar todos los mensajes actuales como "procesados" para no notificarlos después
            normalized.forEach((conv: any) => {
              if (conv.last_message) {
                processedMessageIdsRef.current.add(conv.last_message.id);
              }
            });
            isFirstLoadRef.current = false;
          } else {
            // Carga subsiguiente (polling o refresh): mostrar notificaciones si corresponde
            // Encontrar conversaciones con nuevos mensajes
            normalized.forEach((conv: any) => {
              if (conv.unread_count > 0 && conv.last_message) {
                const messageId = conv.last_message.id;
                
                // 🔧 CRÍTICO: Verificar si este mensaje ya fue procesado antes (evita toasts al recargar)
                if (processedMessageIdsRef.current.has(messageId)) {
                  // console.log('⏭️ [ChatWidget] Mensaje ya procesado, no mostrar toast:', messageId);
                  return;
                }
                
                // Verificar si esta conversación tenía menos mensajes antes
                const prevConv = conversations.find((c: any) => c.id === conv.id);
                const prevUnread = prevConv?.unread_count || 0;
                
                // Solo mostrar toast si:
                // 1. Hay más mensajes no leídos que antes (mensaje realmente nuevo)
                // 2. El mensaje es de otro usuario (no propio)
                // 3. El mensaje NO ha sido leído (unread_count > 0)
                // 4. El mensaje no ha sido procesado antes
                if (conv.unread_count > prevUnread && conv.last_message.sender_id !== userId) {
                  // Marcar mensaje como procesado antes de mostrar toast
                  processedMessageIdsRef.current.add(messageId);
                  // Persistir en localStorage
                  if (typeof window !== 'undefined') {
                    const processedArray = Array.from(processedMessageIdsRef.current);
                    // Mantener solo los últimos 100 mensajes procesados para evitar que localStorage crezca demasiado
                    const trimmedArray = processedArray.slice(-100);
                    localStorage.setItem('chat_processed_messages', JSON.stringify(trimmedArray));
                    processedMessageIdsRef.current = new Set(trimmedArray);
                  }
                  showToast(conv, conv.last_message);
                }
              }
            });
          }
        } else {
          // Si el chat está abierto, marcar primera carga como completada también
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
        }

        // 🔧 MEJORADO: Actualizar lastUnreadCountRef y persistir en localStorage
        lastUnreadCountRef.current = unread;
        if (typeof window !== 'undefined') {
          localStorage.setItem('chat_last_unread_count', unread.toString());
        }
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
    
    // 🔧 LIMPIAR MENSAJES INMEDIATAMENTE si cambió la conversación
    // Esto asegura que no se muestren mensajes de la conversación anterior
    if (selectedConversation !== conversationId) {
      console.log('🔄 [ChatWidget] Limpiando mensajes previos al cambiar de conversación');
      setMessages([]);
      setNewMessage('');
    }
    
    try {
      const response = await fetch(`/api/chat/messages?conversation_id=${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        // Actualizar mensajes directamente (ya se limpiaron si era necesario)
        const newMessages = data.messages || [];
        console.log('📨 [ChatWidget] Mensajes cargados:', { 
          conversationId,
          count: newMessages.length 
        });
        
        setMessages(newMessages);
        
        // Verificar si hay mensajes nuevos de otros usuarios
        if (newMessages.length > 0) {
          const latestMessage = newMessages[newMessages.length - 1];
          if (latestMessage && 
              latestMessage.sender_id !== userId && 
              latestMessage.id !== lastProcessedMessageIdRef.current &&
              !isOpen) {
            lastProcessedMessageIdRef.current = latestMessage.id;
          }
          
          // Marcar último mensaje como visto localmente (solo estado local)
          markMessageAsSeen(conversationId, latestMessage.id);
        }
        
        // Actualizar selectedConversation solo si no está ya establecida
        if (selectedConversation !== conversationId) {
          setSelectedConversation(conversationId);
        }

        // 🔧 MARCADO CENTRALIZADO: Marcar TODOS los mensajes como leídos en el servidor
        // INMEDIATAMENTE cuando se cargan los mensajes (sin debounce)
        // Esto asegura que al abrir una conversación, se marque como leída antes de cualquier recarga
        await markConversationAsRead(conversationId, true); // true = inmediato (sin debounce)
        
        // Actualizar estado local inmediatamente para evitar mostrar "no leído" durante la recarga
        zeroUnreadForConversation(conversationId);
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
        setMainView('users'); // Mostrar lista de usuarios para selección
        
      } else {
        // Si era una conversación temporal, simplemente limpiar
        console.log('🧹 [ChatWidget] Limpiando conversación temporal eliminada');
        setMessages([]);
        setTempChatUser(null);
        // NO cerrar el chat - mantener abierto y mostrar lista de usuarios
        setMainView('users');
      }
      
    } catch (error) {
      console.error('❌ [ChatWidget] Error manejando conversación eliminada:', error);
      // En caso de error, limpiar todo pero mantener el chat abierto
      setMessages([]);
      setTempChatUser(null);
      // NO cerrar el chat - mantener abierto para recuperación y mostrar lista de usuarios
      setMainView('users');
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

  // Abrir chat con usuario en ventana individual
  const openChatWithUser = async (userId: string) => {
    console.log('🖱️ [ChatWidget] Click detectado en usuario:', userId);
    console.log('🖱️ [ChatWidget] Sesión disponible:', !!session);
    console.log('🖱️ [ChatWidget] Usuarios disponibles:', availableUsers.length);
    
    if (!session) {
      console.log('❌ [ChatWidget] No hay sesión disponible');
      return;
    }
    
    console.log('💬 [ChatWidget] Abriendo chat con usuario:', userId);
    
    // Buscar si ya existe una conversación con este usuario
    const existingConversation = conversations.find(conv => 
      conv.other_participant.id === userId
    );
    
    const user = availableUsers.find(u => u.id === userId);
    console.log('👤 [ChatWidget] Usuario encontrado:', user);
    
    if (!user) {
      console.log('❌ [ChatWidget] Usuario no encontrado en availableUsers');
      return;
    }
    
    // Si la ventana principal (AIM Assistant) está abierta, integrar la conversación allí
    if (isOpen) {
      if (existingConversation) {
        console.log('🪟 [ChatWidget] Integrando conversación existente dentro del AIM Assistant:', existingConversation.id);
        setSelectedConversation(existingConversation.id);
        setMainView('chat');
        await loadMessages(existingConversation.id);
      } else {
        console.log('🆕 [ChatWidget] Creando conversación integrada en AIM Assistant con:', user.name || user.email);
        try {
          const response = await fetch('/api/chat/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ participant_2_id: userId })
          });
          const data = await response.json();
          if (data.success) {
            setSelectedConversation(data.conversation.id);
            setMainView('chat');
            await loadMessages(data.conversation.id);
            await loadConversations();
          } else {
            console.error('❌ [ChatWidget] Error creando conversación:', data.error);
          }
        } catch (error) {
          console.error('❌ [ChatWidget] Error creando conversación:', error);
        }
      }
      return; // No abrir ventana individual
    }

    // Verificar si ya hay una ventana abierta para este usuario (modo flotante)
    const existingWindow = openChatWindows.find(window => window.otherUser.id === userId);
    if (existingWindow) {
      console.log('🪟 [ChatWidget] Ventana ya abierta para este usuario');
      return;
    }
    
    if (existingConversation) {
      // Si ya existe conversación, abrir ventana individual
      console.log('📂 [ChatWidget] Abriendo conversación existente en ventana individual:', existingConversation.id);
      const newWindow = {
        id: `window_${existingConversation.id}`,
        conversationId: existingConversation.id,
        otherUser: user
      };
      setOpenChatWindows(prev => {
        console.log('🪟 [ChatWidget] Agregando ventana:', newWindow);
        return [...prev, newWindow];
      });
    } else {
      // Si no existe, crear nueva conversación y abrir ventana
      console.log('🆕 [ChatWidget] Creando nueva conversación en ventana individual con:', user.name || user.email);
      
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
        console.log('📡 [ChatWidget] Respuesta API crear conversación:', data);
        
        if (data.success) {
          const newWindow = {
            id: `window_${data.conversation.id}`,
            conversationId: data.conversation.id,
            otherUser: user
          };
          setOpenChatWindows(prev => {
            console.log('🪟 [ChatWidget] Agregando nueva ventana:', newWindow);
            return [...prev, newWindow];
          });
          
          // Recargar conversaciones para incluir la nueva
          await loadConversations();
        } else {
          console.error('❌ [ChatWidget] Error creando conversación:', data.error);
        }
      } catch (error) {
        console.error('❌ [ChatWidget] Error creando conversación:', error);
      }
    }
  };

  // Cerrar ventana individual de chat
  const closeChatWindow = (windowId: string) => {
    setOpenChatWindows(prev => prev.filter(window => window.id !== windowId));
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
    console.log('🗑️ [ChatWidget] Solicitud de eliminación para conversación:', conversationId);
    
    if (!session) {
      console.error('❌ [ChatWidget] Error: No hay sesión activa para eliminar conversación');
      return;
    }
    
    try {
      console.log('⏳ [ChatWidget] Enviando petición DELETE a API...');
      const response = await fetch(`/api/chat/conversations?conversation_id=${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ [ChatWidget] Conversación eliminada exitosamente');
        
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
        console.error('❌ [ChatWidget] Error eliminando conversación (API):', data.error);
      }
    } catch (error) {
      console.error('❌ [ChatWidget] Error eliminando conversación (Network/Code):', error);
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
  // Función para mostrar toast notification
  const showToast = (conversation: any, message: any) => {
    // No mostrar toast si:
    // 1. El chat está abierto Y
    // 2. La conversación está activa (siendo vista)
    if (isOpen && mainView === 'chat' && selectedConversation === conversation.id) {
      return;
    }
    
    // 🔧 NUEVO: No mostrar toast si la conversación no tiene mensajes no leídos
    // Esto evita mostrar toasts de mensajes que ya fueron leídos al recargar la página
    if (conversation.unread_count === 0 || !conversation.unread_count) {
      console.log('⏭️ [ChatWidget] No mostrar toast: conversación ya está marcada como leída');
      return;
    }
    
    // 🔧 NUEVO: Verificar si el mensaje ya fue procesado (doble verificación)
    if (processedMessageIdsRef.current.has(message.id)) {
      console.log('⏭️ [ChatWidget] No mostrar toast: mensaje ya procesado:', message.id);
      return;
    }
    
    const toastId = `${conversation.id}-${message.id}-${Date.now()}`;
    const sender = conversation.other_participant;
    
    // Cerrar todos los toasts anteriores antes de mostrar uno nuevo
    // Esto evita que se sobrepongan
    setToasts([]);
    
    // Agregar solo el nuevo toast
    setToasts([{
      id: toastId,
      conversationId: conversation.id,
      senderName: getDisplayName(sender),
      senderAvatar: null,
      messagePreview: message.content || ''
    }]);
    
    // Reproducir sonido (con throttling mínimo de 2 segundos)
    // Usar volumen más alto (0.6) para que sea más audible y con estilo Apple
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 2000) {
      playNotificationSound(0.6); // Volumen aumentado de 0.3 a 0.6 para mejor audibilidad
      lastSoundTimeRef.current = now;
    }
  };

  // Función para cerrar toast
  const closeToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  // Función para abrir conversación desde toast
  const openConversationFromToast = (conversationId: string) => {
    setIsOpen(true);
    setMainView('chat');
    setSelectedConversation(conversationId);
    closeToast(toasts.find(t => t.conversationId === conversationId)?.id || '');
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (session) {
      loadConversations();
      loadAvailableUsers();
      // Marcar usuario como online cuando se carga el chat
      updateUserStatus(true);
    }
  }, [session]);

  // 🔧 NUEVO: Cuando se carga la página y hay una conversación seleccionada, marcarla como leída
  useEffect(() => {
    if (session && selectedConversation && isOpen && mainView === 'chat') {
      // Si hay una conversación abierta al cargar, marcarla como leída inmediatamente
      // Esto asegura que después de recargar la página, no se muestren como "no leídos"
      if (!selectedConversation.startsWith('temp_')) {
        markConversationAsRead(selectedConversation, true); // true = inmediato
      }
    }
  }, [session, selectedConversation, isOpen, mainView]); // Solo cuando cambian estos valores críticos

  // 🔧 NUEVO: Persistir conversación abierta en localStorage para recordarla después de recargar
  useEffect(() => {
    if (selectedConversation && isOpen && mainView === 'chat' && !selectedConversation.startsWith('temp_')) {
      localStorage.setItem('chat_last_open_conversation', selectedConversation);
    } else if (!isOpen || mainView !== 'chat') {
      localStorage.removeItem('chat_last_open_conversation');
    }
  }, [selectedConversation, isOpen, mainView]);

  // 🔧 NUEVO: Al cargar conversaciones, si hay una conversación que estaba abierta antes de recargar, marcarla como leída
  // Esto incluye conversaciones con Botty/notificaciones
  useEffect(() => {
    if (session && conversations.length > 0) {
      const lastOpenConversation = localStorage.getItem('chat_last_open_conversation');
      if (lastOpenConversation && isOpen && mainView === 'chat') {
        // Si la conversación que estaba abierta tiene mensajes no leídos, marcarla como leída
        const conv = conversations.find(c => c.id === lastOpenConversation);
        if (conv && (conv.unread_count ?? 0) > 0) {
          console.log('👁️ [ChatWidget] Marcando conversación como leída al recargar:', lastOpenConversation);
          markConversationAsRead(lastOpenConversation, true);
          // 🔧 NUEVO: Marcar como leída localmente para preservar el estado
          locallyMarkedAsReadRef.current.add(lastOpenConversation);
          // Actualizar estado local inmediatamente
          zeroUnreadForConversation(lastOpenConversation);
        }
      }
    }
  }, [conversations, session, isOpen, mainView]);

  // Actualizar lista de usuarios cada 15 segundos como respaldo (tiempo real es principal)
  // Esto ayuda a detectar usuarios que cerraron sesión más rápidamente
  useEffect(() => {
    if (!session) return;

    // Actualizar lista de usuarios cada 15 segundos como respaldo
    const usersUpdateInterval = setInterval(() => {
      console.log('🔄 [ChatWidget] Polling de respaldo: actualizando lista de usuarios...');
      loadAvailableUsers();
    }, 15000);

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
      // El marcado como leído se maneja automáticamente en loadMessages
      // No necesitamos marcado adicional aquí para evitar duplicados
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

  // 🔧 LIMPIAR ESTADO AL CAMBIAR DE CONVERSACIÓN
  const prevConversationRef = useRef<string | null>(null);
  useEffect(() => {
    // Solo limpiar si cambiamos de una conversación válida a otra
    // Esto evita que los mensajes del modelo A persistan al cambiar al modelo B
    if (prevConversationRef.current !== null && 
        prevConversationRef.current !== selectedConversation && 
        selectedConversation !== null) {
      console.log('🔄 [ChatWidget] Cambio de conversación detectado:', {
        from: prevConversationRef.current,
        to: selectedConversation
      });
      setMessages([]); // Limpiar mensajes inmediatamente
      setNewMessage(''); // Limpiar input de mensaje
      setTempChatUser(null); // Limpiar usuario temporal si existe
    }
    prevConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Auto-scroll a mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔧 OPTIMIZADO: Marcar conversación como leída cuando se abre/visualiza
  // Esto incluye conversaciones con Botty/notificaciones
  useEffect(() => {
    if (!isOpen || mainView !== 'chat' || !selectedConversation) return;
    if (selectedConversation.startsWith('temp_')) return; // No marcar conversaciones temporales
    
    // Cuando el usuario está viendo una conversación (incluyendo Botty), marcarla como leída INMEDIATAMENTE
    // Sin debounce para asegurar que se marque antes de cualquier recarga
    markConversationAsRead(selectedConversation, true); // true = inmediato, sin debounce
    
    // 🔧 NUEVO: Marcar como leída localmente para preservar el estado
    locallyMarkedAsReadRef.current.add(selectedConversation);
    
    // Cerrar toasts relacionados con esta conversación cuando se activa
    setToasts(prev => prev.filter(toast => toast.conversationId !== selectedConversation));
    
    // Actualizar estado local inmediatamente para evitar mostrar notificaciones
    zeroUnreadForConversation(selectedConversation);
    
    // 🔧 NUEVO: Marcar todos los mensajes de esta conversación como procesados
    // Esto evita que aparezcan toasts al recargar si la conversación estaba abierta
    const currentConv = conversations.find(c => c.id === selectedConversation);
    if (currentConv?.last_message?.id) {
      processedMessageIdsRef.current.add(currentConv.last_message.id);
      if (typeof window !== 'undefined') {
        const processedArray = Array.from(processedMessageIdsRef.current);
        const trimmedArray = processedArray.slice(-100);
        localStorage.setItem('chat_processed_messages', JSON.stringify(trimmedArray));
        processedMessageIdsRef.current = new Set(trimmedArray);
      }
    }
  }, [isOpen, mainView, selectedConversation, conversations]);

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
        async (payload) => {
          const newMessage = payload.new as any;
          console.log('📨 [ChatWidget] Nuevo mensaje recibido:', newMessage);
          console.log('📊 [ChatWidget] Estado actual - isOpen:', isOpen, 'selectedConversation:', selectedConversation, 'userId:', userId);
          
          // Verificar si el mensaje es para el usuario actual
          // Hacer una consulta directa para verificar si el usuario es participante de la conversación
          try {
            const { data: conversation, error } = await supabase
              .from('chat_conversations')
              .select('participant_1_id, participant_2_id')
              .eq('id', newMessage.conversation_id)
              .single();
            
            if (error || !conversation) {
              console.log('❌ [ChatWidget] Error verificando conversación:', error);
              return;
            }
            
            const isParticipant = conversation.participant_1_id === userId || conversation.participant_2_id === userId;
            console.log('👤 [ChatWidget] Es participante?', isParticipant, 'sender_id:', newMessage.sender_id, 'userId:', userId);
            
            if (isParticipant) {
              console.log('✅ [ChatWidget] Usuario es participante de la conversación');
              
              // 🔔 CRÍTICO: Abrir chat automáticamente PRIMERO si el mensaje es de otro usuario
              // Esto debe hacerse antes de cualquier otra lógica para asegurar que el chat se abra
              if (newMessage.sender_id !== userId) {
                console.log('🔔 [ChatWidget] Mensaje de otro usuario detectado, verificando si abrir chat...');
                
                // Usar función de estado para obtener el valor más reciente y abrir el chat
                setIsOpen(currentIsOpen => {
                  console.log('📂 [ChatWidget] Estado isOpen actual:', currentIsOpen);
                  
                  // Si el chat está cerrado, abrirlo automáticamente
                  if (!currentIsOpen) {
                    console.log('📂 [ChatWidget] ⚡ ABRIENDO CHAT AUTOMÁTICAMENTE - Chat estaba cerrado');
                    // Actualizar otros estados después de abrir el chat
                    setTimeout(() => {
                      setMainView('chat');
                      setSelectedConversation(newMessage.conversation_id);
                      loadConversations();
                    }, 100);
                    return true; // Abrir el chat
                  }
                  
                  // Si el chat ya está abierto, cambiar a la conversación del mensaje nuevo
                  setSelectedConversation(currentSelected => {
                    if (currentSelected !== newMessage.conversation_id) {
                      console.log('🔄 [ChatWidget] Cambiando a conversación del mensaje nuevo');
                      setMainView('chat');
                      setTimeout(() => {
                        loadConversations();
                      }, 100);
                      return newMessage.conversation_id;
                    }
                    return currentSelected;
                  });
                  
                  return currentIsOpen; // Mantener estado actual
                });
                
                // Reproducir sonido
                const now = Date.now();
                if (now - lastSoundTimeRef.current > 2000) {
                  console.log('🔔 [ChatWidget] Reproduciendo sonido para mensaje nuevo');
                  playNotificationSound(0.6);
                  lastSoundTimeRef.current = now;
                }
              }
              
              // 🔔 CRÍTICO: Abrir chat automáticamente PRIMERO si el mensaje es de otro usuario
              // Esto debe hacerse ANTES de cualquier otra lógica
              if (newMessage.sender_id !== userId) {
                console.log('🔔 [ChatWidget] Mensaje de otro usuario detectado, verificando si abrir chat...');
                
                // Usar función de estado para obtener el valor más reciente
                setIsOpen(currentIsOpen => {
                  console.log('📂 [ChatWidget] Estado isOpen actual:', currentIsOpen);
                  
                  // Si el chat está cerrado, abrirlo automáticamente
                  if (!currentIsOpen) {
                    console.log('📂 [ChatWidget] ⚡ ABRIENDO CHAT AUTOMÁTICAMENTE - Chat estaba cerrado');
                    // Actualizar otros estados después de abrir el chat
                    setTimeout(() => {
                      setMainView('chat');
                      setSelectedConversation(newMessage.conversation_id);
                      loadConversations();
                    }, 100);
                    return true; // Abrir el chat
                  }
                  
                  return currentIsOpen; // Mantener estado actual
                });
                
                // Si el chat ya está abierto pero no estamos viendo esta conversación, cambiar a ella
                setSelectedConversation(currentSelected => {
                  if (currentSelected !== newMessage.conversation_id) {
                    console.log('🔄 [ChatWidget] Cambiando a conversación del mensaje nuevo');
                    setMainView('chat');
                    setTimeout(() => {
                      loadConversations();
                    }, 100);
                    return newMessage.conversation_id;
                  }
                  return currentSelected;
                });
                
                // Reproducir sonido
                const now = Date.now();
                if (now - lastSoundTimeRef.current > 2000) {
                  console.log('🔔 [ChatWidget] Reproduciendo sonido para mensaje nuevo');
                  playNotificationSound(0.6);
                  lastSoundTimeRef.current = now;
                }
              }
              
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
                // Si estamos viendo esta conversación (incluyendo Botty), marcar como leído inmediatamente
                // PERO no bloquear si falla - ejecutar de forma no bloqueante
                markConversationAsRead(newMessage.conversation_id, true).catch(() => {
                  // Error silencioso - no crítico para la funcionalidad
                });
                // 🔧 NUEVO: Marcar como leída localmente para preservar el estado
                locallyMarkedAsReadRef.current.add(newMessage.conversation_id);
                // Actualizar estado local inmediatamente
                zeroUnreadForConversation(newMessage.conversation_id);
              } else {
                // Si NO estamos viendo esta conversación, actualizar lista
                console.log('🔄 [ChatWidget] Nuevo mensaje en conversación no activa, actualizando lista...');
                loadConversations();
              }
              
              // Detectar si el mensaje es de AIM Botty y abrir ventana automáticamente (solo una vez)
              // Esto es adicional a la apertura automática del chat principal
              if (newMessage.sender_id === AIM_BOTTY_ID && 
                  newMessage.id !== autoOpenedBottyRef.current &&
                  newMessage.sender_id !== userId) {
                console.log('🤖 [ChatWidget] Mensaje nuevo de AIM Botty detectado, abriendo ventana automáticamente...');
                autoOpenedBottyRef.current = newMessage.id;
                
                // Verificar si ya hay una ventana abierta para AIM Botty
                const bottyWindowExists = openChatWindows.some(
                  window => window.otherUser.id === AIM_BOTTY_ID || window.otherUser.email === AIM_BOTTY_EMAIL
                );
                
                // Solo abrir automáticamente si el chat principal está abierto y no existe ventana
                if (!bottyWindowExists && isOpen) {
                  console.log('🪟 [ChatWidget] Abriendo ventana de AIM Botty automáticamente...');
                  // Abrir ventana de AIM Botty automáticamente (solo una vez por mensaje)
                  setTimeout(() => {
                    openChatWithUser(AIM_BOTTY_ID);
                  }, 500); // Pequeño delay para mejor UX, no invasivo
                } else if (bottyWindowExists) {
                  console.log('🪟 [ChatWidget] Ventana de AIM Botty ya está abierta');
                }
              }
            } else {
              console.log('❌ [ChatWidget] Usuario no es participante de la conversación');
            }
          } catch (error) {
            console.error('❌ [ChatWidget] Error en verificación de conversación:', error);
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
      
      // Limpiar todos los timeouts de marcado como leído
      markAsReadTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      markAsReadTimeoutRef.current.clear();
      markingAsReadRef.current.clear();
    };
  }, [session, userId]); // Solo dependencias esenciales

  // Suscripción en tiempo real para estados de usuarios (online/offline)
  useEffect(() => {
    if (!session) return;

    console.log('👥 [ChatWidget] Configurando suscripción para estados de usuarios...');

    const userStatusChannel = supabase
      .channel('chat-user-status-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'chat_user_status'
        },
        async (payload) => {
          console.log('👥 [ChatWidget] Estado de usuario actualizado:', payload);
          
          // Recargar lista de usuarios para reflejar cambios inmediatamente
          // Esto detecta cuando un usuario se marca como offline
          await loadAvailableUsers();
          
          // Log adicional para debugging
          if (payload.new) {
            const newStatus = payload.new as any;
            console.log(`📊 [ChatWidget] Usuario ${newStatus.user_id} ahora está ${newStatus.is_online ? 'EN LÍNEA' : 'OFFLINE'}`);
          }
        }
      )
      .subscribe((status) => {
        console.log('👥 [ChatWidget] Estado de suscripción de usuarios:', status);
      });

    return () => {
      console.log('🧹 [ChatWidget] Limpiando suscripción de estados de usuarios');
      supabase.removeChannel(userStatusChannel);
    };
  }, [session]);

  // Actualizar referencia de conversaciones para la suscripción
  useEffect(() => {
    // Este efecto se ejecuta cuando cambian las conversaciones
    // pero no recrea la suscripción
  }, [conversations, selectedConversation]);

  const toggleChat = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // 🔔 CORREGIDO: Inicializar audio cuando el usuario interactúa con el chat por primera vez
    // Esto es necesario porque algunos navegadores requieren interacción del usuario para reproducir audio
    if (newIsOpen) {
      initAudio();
    }
    
    if (newIsOpen && session) {
      loadConversations();
    }
    
    // Cerrar todos los toasts cuando se abre el chat
    if (newIsOpen) {
      setToasts([]);
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
      {/* Botón flotante: independiente del árbol (Portal a document.body) y anclado al viewport */}
      {isMounted && createPortal(
        (
      <div className="relative">
        <button
          onClick={toggleChat}
          style={{
            right: 24,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)'
          }}
          className={`fixed w-10 h-10 hover:w-16 hover:h-10 text-white dark:text-gray-900 rounded-xl shadow-lg border border-white/20 dark:border-gray-700/30 transition-all duration-300 flex items-center justify-center z-[9995] group overflow-visible ${
            totalUnreadCount > 0
              ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 animate-gradient-x shadow-blue-500/30 ring-2 ring-blue-400/30'
              : 'bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300'
          }`}
          aria-label={`Abrir chat de soporte${totalUnreadCount > 0 ? ` (${totalUnreadCount} mensajes no leídos)` : ''}`}
        >
          <div className="flex items-center justify-center relative w-full h-full">
            <span className="text-white dark:text-gray-900 font-bold text-sm group-hover:hidden drop-shadow-sm">A</span>
            <span className="text-white dark:text-gray-900 font-bold text-xs hidden group-hover:block whitespace-nowrap drop-shadow-sm">AIM</span>
            {/* Badge de contador - esquina superior derecha */}
            {totalUnreadCount > 0 && (
              <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-90">
                <Badge count={totalUnreadCount} variant="blue" size="small" />
              </div>
            )}
          </div>
        </button>
      </div>
        ),
        document.body
      )}


      {/* Barra de chat con ventana principal y ventanas individuales */}
      <ChatBar
        openChatWindows={openChatWindows}
        onCloseWindow={closeChatWindow}
        userId={userId}
        userRole={userRole}
        session={session}
        isMainChatOpen={isOpen}
        onCloseMainChat={() => setIsOpen(false)}
        view={mainView}
        setView={setMainView}
        availableUsers={availableUsers}
        expandedSections={expandedSections}
        setExpandedSections={setExpandedSections}
        openChatWithUser={openChatWithUser}
        conversations={conversations}
        selectedConversation={selectedConversation}
        setSelectedConversation={setSelectedConversation}
        messages={messages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        sendMessage={sendMessage}
        handleKeyPress={handleKeyPress}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        deleteConversation={deleteConversation}
        tempChatUser={tempChatUser}
        getDisplayName={getDisplayName}
      />
      
      {/* Renderizar toasts - solo si la conversación NO está activa */}
      {toasts
        .filter(toast => !(isOpen && mainView === 'chat' && selectedConversation === toast.conversationId))
        .map((toast) => (
          <ToastNotification
            key={toast.id}
            id={toast.id}
            senderName={toast.senderName}
            senderAvatar={toast.senderAvatar}
            messagePreview={toast.messagePreview}
            conversationId={toast.conversationId}
            onOpenConversation={openConversationFromToast}
            onClose={closeToast}
            duration={4000}  // 4 segundos, se desvanecen automáticamente
          />
        ))}
    </>
  );
}

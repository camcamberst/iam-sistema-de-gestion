'use client';

import React, { useEffect, useRef, useState } from 'react';
import StandardModal from '@/components/ui/StandardModal';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';
import { renderElegantAvatar } from '@/lib/chat/user-avatar';
import Badge from './Badge';
import BoostPagesModal from '@/components/BoostPagesModal'; // Importar BoostPagesModal
import { playNotificationSound, initAudio } from '@/lib/chat/notification-sound'; // Importar sonido
import ReplyPreview from './ReplyPreview';
import QuotedMessage from './QuotedMessage';

interface MainChatWindowProps {
  onClose: () => void;
  isClosing?: boolean;
  userId?: string;
  userRole?: string;
  session?: any;
  windowIndex?: number;
  // Props para la funcionalidad del chat
  view?: 'users' | 'conversations' | 'chat';
  setView?: (view: 'users' | 'conversations' | 'chat') => void;
  availableUsers?: any[];
  expandedSections?: { online: boolean; offline: boolean };
  setExpandedSections?: (sections: { online: boolean; offline: boolean }) => void;
  openChatWithUser?: (userId: string) => void;
  conversations?: any[];
  selectedConversation?: string | null;
  setSelectedConversation?: (id: string | null) => void;
  messages?: any[];
  newMessage?: string;
  setNewMessage?: (message: string) => void;
  sendMessage?: () => void;
  handleKeyPress?: (e: React.KeyboardEvent) => void;
  showDeleteConfirm?: string | null;
  setShowDeleteConfirm?: (id: string | null) => void;
  deleteConversation?: (id: string) => void;
  tempChatUser?: any;
  getDisplayName?: (user: any) => string;
  replyTo?: any | null;
  setReplyTo?: (reply: any | null) => void;
}

const MainChatWindow: React.FC<MainChatWindowProps> = ({
  onClose,
  isClosing = false,
  userId,
  userRole,
  session,
  windowIndex = 0,
  view = 'users',
  setView,
  availableUsers = [],
  expandedSections = { online: true, offline: false },
  setExpandedSections,
  openChatWithUser,
  conversations = [],
  selectedConversation,
  setSelectedConversation,
  messages = [],
  newMessage = '',
  setNewMessage,
  sendMessage,
  handleKeyPress,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConversation,
  tempChatUser,
  getDisplayName = (user) => user.name || user.email,
  replyTo,
  setReplyTo,
}) => {


  const windowWidth = 320; // w-80 = 320px
  const margin = 8; // Margen entre ventanas en la barra
  const buttonSize = 40; // h-10 del botón flotante
  const buttonMargin = 24; // bottom-6 / right-6
  const gap = 28; // separación visual entre botón y ventana (más a la izquierda)
  
  // Estado para búsqueda en conversación
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  
  // Estado para emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Estado para Boost Page Launcher
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostModelInfo, setBoostModelInfo] = useState<{id: string, name: string, email: string} | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Detectar acciones en los mensajes nuevos del bot
  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Si ya procesamos este mensaje, no hacer nada
      if (processedMessageIdsRef.current.has(lastMessage.id)) {
        return;
      }

      // Verificar si ya fue procesado en localStorage (persistencia entre recargas)
      const processedKey = `botty_action_processed_${lastMessage.id}`;
      if (typeof window !== 'undefined' && localStorage.getItem(processedKey)) {
        processedMessageIdsRef.current.add(lastMessage.id);
        return;
      }
      
      // Verificar antigüedad del mensaje (si tiene más de 60 segundos, ignorar)
      // Esto evita que mensajes antiguos ejecuten acciones al recargar la página
      const messageTime = new Date(lastMessage.created_at).getTime();
      const now = new Date().getTime();
      const isRecent = (now - messageTime) < 60000; // 60 segundos
      
      if (!isRecent) {
        // Si es antiguo pero tiene acción, lo marcamos como procesado para no volver a chequearlo
        if (lastMessage.sender_id === AIM_BOTTY_ID && 
            typeof lastMessage.content === 'string' && 
            lastMessage.content.includes('<<ACTION:')) {
          processedMessageIdsRef.current.add(lastMessage.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem(processedKey, 'true');
          }
        }
        return;
      }
      
      // Solo procesar mensajes del bot que contengan la acción
      if (lastMessage.sender_id === AIM_BOTTY_ID && 
          typeof lastMessage.content === 'string' && 
          lastMessage.content.includes('<<ACTION:OPEN_BOOST_MODAL')) {
        
        // Extraer información de la acción
        const match = lastMessage.content.match(/<<ACTION:OPEN_BOOST_MODAL\|([^|]+)\|([^|]+)\|([^>]+)>>/);
        
        if (match) {
          const [_, modelId, modelName, modelEmail] = match;
          console.log('🚀 [CHAT-LAUNCHER] Ejecutando acción Boost Page:', { modelId, modelName });
          
          // Marcar mensaje como procesado en memoria y localStorage
          processedMessageIdsRef.current.add(lastMessage.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem(processedKey, 'true');
          }
          
          setBoostModelInfo({
            id: modelId,
            name: modelName,
            email: modelEmail
          });
          setShowBoostModal(true);
        }
      }
    }
  }, [messages]);

  // Función para limpiar el contenido del mensaje (quitar tags de acción y emociones de IA)
  const cleanMessageContent = (content: string) => {
    if (!content) return '';
    return content.replace(/<<ACTION:[^>]+>>/g, '').replace(/\[EMOTION:[^\]]+\]/gi, '').trim();
  };

  // Función para convertir marcadores [LINK:texto|url] en enlaces clickeables
  const renderMessageWithLinks = (content: string, isMyMessage: boolean) => {
    if (!content) return null;
    
    const linkPattern = /\[LINK:([^\|]+)\|([^\]]+)\]/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    let hasLinks = false;

    // Reset regex lastIndex para evitar problemas con múltiples llamadas
    linkPattern.lastIndex = 0;

    while ((match = linkPattern.exec(content)) !== null) {
      hasLinks = true;
      // Agregar texto antes del enlace
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      // Crear enlace
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
              // Si es un enlace al chat (#), no hacer nada (ya estamos en el chat)
              return;
            }
            // Para otros enlaces, usar Next.js router
            e.preventDefault();
            if (typeof window !== 'undefined') {
              window.location.href = linkUrl;
            }
          }}
          className={`underline font-medium hover:opacity-80 transition-opacity ${
            isMyMessage 
              ? 'text-blue-100' 
              : 'text-blue-400'
          }`}
          target={linkUrl.startsWith('http') ? '_blank' : undefined}
          rel={linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {linkText}
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Agregar texto restante
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    
    // Si no hay enlaces, devolver el contenido original
    if (!hasLinks) {
      return null;
    }
    
    return parts.length > 0 ? <>{parts}</> : null;
  };
  
  // Emojis más comunes organizados por categorías
  const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
    gestures: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍'],
    hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
    objects: ['🎉', '🎊', '✨', '⭐', '🌟', '💫', '🔥', '💯', '✅', '❌', '⚠️', '💡', '🎯', '🚀', '💎', '🏆', '🥇', '🎖️', '🏅', '🎗️'],
    symbols: ['👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁']
  };

  // Posición calculada respecto al botón (a la izquierda del botón)
  // Solo mostrar conversaciones con actividad (mensajes entrantes o iniciadas)
  const conversationsWithMessages = (conversations || []).filter((c: any) => {
    const content = c?.last_message?.content;
    return typeof content === 'string' && content.trim().length > 0;
  });

  // Usuario activo cuando se está en chat
  const activeUser = view === 'chat' && selectedConversation
    ? (conversations || []).find((c: any) => c.id === selectedConversation)?.other_participant
    : null;

  // Inferir Emoción de Botty según contexto del chat
  const currentBottyEmotion = React.useMemo(() => {
    if (view !== 'chat' || !messages || messages.length === 0) return 'idle';
    
    // Si la conversación no es con Botty, no importa (pero por seguridad devolvemos idle)
    if (activeUser?.id && activeUser.id !== AIM_BOTTY_ID && activeUser.email !== AIM_BOTTY_EMAIL) {
      return 'idle';
    }
    
    const lastMessage = messages[messages.length - 1];
    
    // Si es un mensaje del sistema, Botty no tiene por qué reaccionar, solo observa.
    if (lastMessage.sender_id === 'system' || lastMessage.is_system_message) {
      return 'idle';
    }

    const isBotLast = lastMessage.sender_id === AIM_BOTTY_ID;
    
    // Si estamos esperando respuesta del bot (el usuario acaba de escribir)
    if (!isBotLast) {
      return 'thinking';
    }

    // Analizar la respuesta del Bot buscando la etiqueta [EMOTION: xxx] generada por la IA
    const content = lastMessage.content;
    const emotionMatch = content.match(/\[EMOTION:\s*(idle|happy|thinking|speaking|worried)\]/i);
    
    if (emotionMatch && emotionMatch[1]) {
      return emotionMatch[1].toLowerCase();
    }
    
    // Fallback de retrocompatibilidad si el bot olvidó la etiqueta o es muy viejo
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('jaja') || lowerContent.includes('excelente') || lowerContent.includes('genial') || lowerContent.includes('encanta') || lowerContent.includes('feliz') || lowerContent.includes('gracias')) {
      return 'happy';
    }
    
    if (lowerContent.includes('lo siento') || lowerContent.includes('disculpa') || lowerContent.includes('ups') || lowerContent.includes('hubo un error') || lowerContent.includes('no pude')) {
      return 'worried';
    }
    
    return 'idle';
  }, [messages, view, activeUser]);

  // Helper para renderizar avatar elegante (diferenciado por rol) con estado dinámico para Botty
  const renderAvatar = (user: any, size: 'small' | 'medium' = 'medium', isOffline: boolean = false) => {
    return renderElegantAvatar(user, size, isOffline, currentBottyEmotion as any);
  };

  // Helper para formatear fecha del separador
  const formatDateSeparator = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return 'Hoy';
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return 'Ayer';
    } else {
      return messageDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  // Helper para verificar si dos fechas son de días diferentes
  const isDifferentDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getTime() !== d2.getTime();
  };

  // Helper para verificar si dos mensajes deben agruparse (mismo remitente y < 5 min de diferencia)
  const shouldGroupMessages = (msg1: any, msg2: any): boolean => {
    if (!msg1 || !msg2) return false;
    if (msg1.sender_id !== msg2.sender_id) return false;
    
    const timeDiff = Math.abs(new Date(msg2.created_at).getTime() - new Date(msg1.created_at).getTime());
    const fiveMinutes = 5 * 60 * 1000; // 5 minutos en ms
    return timeDiff < fiveMinutes;
  };

  // Helper para obtener inicial del nombre de usuario
  const getUserInitial = (user: any): string => {
    if (!user) return '?';
    const displayName = getDisplayName(user);
    if (displayName && displayName.length > 0) {
      return displayName.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  // Helper para formatear timestamp relativo o absoluto
  const formatMessageTime = (dateString: string): string => {
    const messageDate = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Si es del mismo día y menos de 1 hora: mostrar relativo
    if (diffMins < 60 && messageDate.toDateString() === now.toDateString()) {
      if (diffMins < 1) return 'hace un momento';
      if (diffMins === 1) return 'hace 1 min';
      return `hace ${diffMins} min`;
    }

    // Si es de hoy pero > 1 hora: mostrar hora
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    // Si es de ayer
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return `Ayer, ${messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Si es de la última semana: día de la semana + hora
    if (diffDays < 7) {
      const dayName = messageDate.toLocaleDateString('es-ES', { weekday: 'short' });
      return `${dayName}, ${messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Más de una semana: fecha completa
    return messageDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Auto-scroll al final para continuidad de conversación
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousMessagesLengthRef = useRef<number>(0);

  // Verificar si el usuario está cerca del final del scroll (dentro de 50px del final)
  const isNearBottom = (): boolean => {
    try {
      if (!messagesContainerRef.current) return true;
      const container = messagesContainerRef.current;
      const threshold = 50; // px desde el final (más estricto)
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      return distanceFromBottom <= threshold;
    } catch {
      return true; // Por defecto, asumir que está cerca del final
    }
  };

  const scrollToBottom = (smooth = true, force = false) => {
    try {
      // Si el usuario está scrolleando manualmente, no hacer auto-scroll
      if (userScrollingRef.current && !force) {
        return;
      }
      
      // Solo hacer scroll si el usuario ya está cerca del final o si se fuerza
      if (!force && !isNearBottom()) {
        return; // Usuario está leyendo arriba, no hacer scroll
      }
      
      const container = messagesContainerRef.current;
      if (!container) return;
      
      // Método 1: Intentar con scrollIntoView del elemento final
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: smooth ? 'smooth' : 'auto', 
          block: 'end',
          inline: 'nearest'
        });
      } 
      
      // Método 2: Fallback - scroll directo del contenedor (más confiable)
      // Usar esto también para asegurar que funcione
      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error('Error en scrollToBottom:', error);
      // Último recurso: intentar scroll directo
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  };

  // Detectar scroll manual del usuario
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    // Limpiar timeout anterior
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Si el usuario está cerca del final, permitir auto-scroll inmediatamente
    if (isNearBottom()) {
      userScrollingRef.current = false;
    } else {
      // Si está scrolleando hacia arriba, marcar como scroll manual
      userScrollingRef.current = true;
      
      // Después de 1.5 segundos sin scroll, verificar si volvió al final
      scrollTimeoutRef.current = setTimeout(() => {
        if (isNearBottom()) {
          userScrollingRef.current = false;
        }
      }, 1500);
    }
  };

  // Scroll al cambiar de conversación - esperar a que los mensajes estén cargados
  useEffect(() => {
    if (view === 'chat' && selectedConversation) {
      // Resetear estado de scroll manual y contador de mensajes
      userScrollingRef.current = false;
      previousMessagesLengthRef.current = 0;
      
      // Si ya hay mensajes, hacer scroll inmediatamente
      if (messages.length > 0) {
        // Usar requestAnimationFrame + timeout para asegurar renderizado completo
        requestAnimationFrame(() => {
          setTimeout(() => {
            scrollToBottom(false, true);
          }, 100);
        });
      }
    }
  }, [view, selectedConversation]);

  // Scroll cuando se cargan mensajes iniciales (después de cambiar conversación)
  useEffect(() => {
    if (view === 'chat' && selectedConversation && messages.length > 0) {
      const isInitialLoad = previousMessagesLengthRef.current === 0;
      previousMessagesLengthRef.current = messages.length;
      
      // Usar requestAnimationFrame para asegurar que el DOM esté listo
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Forzar scroll al cargar mensajes iniciales
          scrollToBottom(false, true);
        }, 150);
      });
    }
  }, [messages.length, selectedConversation]);

  // Scroll inteligente cuando llegan nuevos mensajes (solo si el usuario está cerca del final)
  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      const previousLength = previousMessagesLengthRef.current;
      
      // Solo hacer scroll si hay nuevos mensajes (no en carga inicial)
      if (messages.length > previousLength && previousLength > 0) {
        setTimeout(() => {
          // Si es un mensaje nuevo y el usuario no está scrolleando manualmente, hacer scroll
          if (!userScrollingRef.current || isNearBottom()) {
            scrollToBottom(true, false);
          }
        }, 100);
      }
      
      previousMessagesLengthRef.current = messages.length;
    }
  }, [messages.length]);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Cerrar búsqueda cuando cambia la conversación
  useEffect(() => {
    setSearchTerm('');
    setShowSearchInput(false);
  }, [selectedConversation]);
  
  // Auto-resize textarea solo si hay saltos de línea (Shift+Enter)
  useEffect(() => {
    if (textareaRef.current) {
      const hasLineBreaks = (newMessage || '').includes('\n');
      if (hasLineBreaks) {
        // Solo expandir si hay saltos de línea
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; // Max 120px
        // Mostrar scrollbar solo cuando hay múltiples líneas
        textareaRef.current.style.overflowY = 'auto';
      } else {
        // Mantener altura de una sola línea
        textareaRef.current.style.height = '42px';
        // Ocultar scrollbar cuando es una sola línea
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [newMessage]);
  
  // Cerrar emoji picker al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showEmojiPicker && !target.closest('.emoji-picker-container') && !target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
    };
    
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);
  
  // Función para manejar teclas en textarea (Shift+Enter para nueva línea, Enter para enviar)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage?.trim() && sendMessage) {
        sendMessage();
      }
    }
    // Shift+Enter permite nueva línea (comportamiento por defecto del textarea)
  };
  
  // Función para insertar emoji
  const insertEmoji = (emoji: string) => {
    if (setNewMessage && textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = newMessage || '';
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setNewMessage(newText);
      
      // Restaurar cursor después del emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  return (
    <div
      data-chat-window="true"
      className={`w-[calc(100%-2rem)] sm:w-80 backdrop-blur-3xl bg-white/70 dark:bg-[#0a0f1a]/60 border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col z-[9996] fixed left-4 right-4 sm:left-auto sm:right-[calc(24px+40px+28px)] bottom-[88px] group-[.keyboard-open]/body:bottom-[10px] sm:bottom-[24px] sm:group-[.keyboard-open]/body:bottom-[24px] overflow-hidden ${isClosing ? 'animate-chat-pop-out' : 'animate-chat-pop'} origin-bottom sm:origin-bottom-right`}
      style={{
        // Posicionar la ventana respetando la safe-area en iOS y cancelando el gap de 'bottom' cuando sale el teclado simulado
        marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + max(0px, var(--vh-offset, 0px) - 10px))',
        transition: 'bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), margin-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s',
        cursor: 'default',
        maxHeight: 'calc(100vh - 120px - max(0px, var(--vh-offset, 0px) - 10px))', // Altura máxima dinámica
        height: '500px' // Altura fija ideal
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10 bg-transparent cursor-default relative">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {activeUser ? (
            <>
              {renderAvatar(activeUser, 'medium')}
              <div className="min-w-0 flex-1">
                <p className="text-gray-900 dark:text-white text-sm font-semibold truncate" title={getDisplayName?.(activeUser)}>
                  {getDisplayName?.(activeUser)}
                </p>
                {(activeUser.id !== AIM_BOTTY_ID && activeUser.email !== AIM_BOTTY_EMAIL) && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs truncate">{activeUser.role}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 bg-black text-white dark:bg-white dark:text-gray-900 border-transparent">
                <span className="font-bold text-[10px] tracking-wider">AIM</span>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white text-sm font-semibold">BottyHome</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs">Soporte y tips</p>
              </div>
            </>
          )}
        </div>
        {view === 'chat' && (
          <>
            {showSearchInput ? (
              <div className="flex items-center space-x-2 flex-1 ml-4 transition-all">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                  aria-label="Buscar mensajes"
                />
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSearchInput(false);
                  }}
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                  aria-label="Cerrar búsqueda"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearchInput(true)}
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors ml-2"
                aria-label="Buscar en conversación"
                title="Buscar en conversación"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </>
        )}
        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white ml-2 transition-colors">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* Botón de Test de Sonido (Oculto en producción, útil para debug) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            initAudio(); // Asegurar contexto
            playNotificationSound(0.8); // Reproducir sonido
          }} 
          className="text-gray-400 opacity-0 hover:opacity-100 transition-opacity absolute top-0 right-0 p-1"
          title="Probar sonido (Debug)"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>

      {/* Pestañas de navegación */}
      <div className="flex px-3 pt-3 pb-2 gap-2 bg-transparent">
        <div className="flex-1 flex bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-black/5 dark:border-white/5">
          <button
            onClick={() => setView?.('users')}
            className={`flex-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              view === 'users'
                ? 'text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => {
              setView?.('conversations');
            }}
            className={`flex-1 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
              view === 'conversations'
                ? 'text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/10'
            } ${
              false
                ? 'animate-pulse bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20'
                : ''
            }`}
          >
          Conversaciones ({conversationsWithMessages.length})
        </button>
        </div>
      </div>

      {/* Contenido principal (envoltorio relativo para overlays internos) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {view === 'users' && (
          <>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
                <div className="space-y-1">
                  <button
                    onClick={() => setExpandedSections?.({ ...expandedSections, online: !expandedSections.online })}
                    className="flex items-center justify-between w-full p-2 text-left font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      En línea ({availableUsers.filter(u => u.is_online).length})
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${expandedSections.online ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.online && (
                    <div className="ml-4 space-y-1">
                      {availableUsers.filter(u => u.is_online).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => openChatWithUser?.(user.id)}
                          className="flex items-center w-full p-2 text-left text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <div className="mr-3">
                            {renderAvatar(user, 'small')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{getDisplayName(user)}</p>
                            {/* No mostrar rol si es el bot */}
                            {user.id !== AIM_BOTTY_ID && user.email !== AIM_BOTTY_EMAIL && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  <button
                    onClick={() => setExpandedSections?.({ ...expandedSections, offline: !expandedSections.offline })}
                    className="flex items-center justify-between w-full p-2 text-left font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                      Offline ({availableUsers.filter(u => !u.is_online).length})
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${expandedSections.offline ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.offline && (
                    <div className="ml-4 space-y-1">
                      {availableUsers.filter(u => !u.is_online).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => openChatWithUser?.(user.id)}
                          className="flex items-center w-full p-2 text-left text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <div className="mr-3">
                            {renderAvatar(user, 'small', true)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{getDisplayName(user)}</p>
                            {/* No mostrar rol si es el bot */}
                            {user.id !== AIM_BOTTY_ID && user.email !== AIM_BOTTY_EMAIL && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'conversations' && (
          <>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
                {conversationsWithMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-center font-medium">No hay conversaciones activas</p>
                    <p className="text-xs text-center mt-1 opacity-70">Los mensajes aparecerán aquí cuando inicies una conversación</p>
                  </div>
                ) : (
                  conversationsWithMessages.map((conversation: any) => (
                    <div
                      key={conversation.id}
                      className={`flex items-center w-full p-2 text-left rounded-xl transition-all ${
                        selectedConversation === conversation.id
                          ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 shadow-sm border border-blue-500/20'
                          : 'text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => {
                          // Abrir ventana independiente en la barra usando el otro participante
                          openChatWithUser?.(conversation.other_participant.id);
                        }}
                        className="flex items-center flex-1 min-w-0 text-left"
                      >
                        <div className="mr-3">
                          {renderAvatar(conversation.other_participant, 'medium')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${selectedConversation === conversation.id ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                            {getDisplayName(conversation.other_participant)}
                          </p>
                          <p className={`text-xs truncate ${selectedConversation === conversation.id ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                            {conversation.last_message?.content}
                          </p>
                        </div>
                      </button>
                      {conversation.unread_count > 0 && (
                        <div className="ml-2">
                          {conversation.unread_count <= 3 ? (
                            <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" aria-label={`${conversation.unread_count} mensajes no leídos`} />
                          ) : (
                            <Badge count={conversation.unread_count} variant="blue" size="small" />
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm?.(conversation.id); }}
                        className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors"
                        aria-label="Eliminar conversación"
                        title="Eliminar conversación"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a2 2 0 012-2h4a2 2 0 012 2m-8 0H5" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {view === 'chat' && selectedConversation && (
          <>
            {/* Mensajes */}
            <div 
              ref={messagesContainerRef} 
              className="flex-1 px-1 py-4 overflow-y-auto custom-scrollbar min-h-0"
              onScroll={handleScroll}
            >
              {/* Mostrar contador de resultados si hay búsqueda activa */}
              {searchTerm && (
                <div className="mb-2 text-center">
                  <p className="text-xs text-gray-400">
                    {messages.filter((m: any) => 
                      m.content?.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length} resultado{messages.filter((m: any) => 
                      m.content?.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {(searchTerm 
                ? messages.filter((m: any) => 
                    m.content?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                : messages
              ).map((message, index, filteredMessages) => {
                const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
                const nextMessage = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;
                const showDateSeparator = !prevMessage || isDifferentDay(prevMessage.created_at, message.created_at);
                
                // Detectar mensajes de sistema o broadcast
                const isSystemMessage = (message as any).is_system_message || 
                                       (message as any).message_type === 'system' || 
                                       message.sender_id === 'system';
                const isBroadcastMessage = (message as any).is_broadcast;
                const isSpecialMessage = isSystemMessage || isBroadcastMessage;
                
                // Solo aplicar agrupación si NO es mensaje especial
                const isGrouped = !isSpecialMessage && prevMessage && shouldGroupMessages(prevMessage, message);
                const isLastInGroup = !nextMessage || !shouldGroupMessages(message, nextMessage) || isDifferentDay(message.created_at, nextMessage.created_at);
                const isFirstInGroup = !prevMessage || !shouldGroupMessages(prevMessage, message) || isDifferentDay(prevMessage.created_at, message.created_at);
                const isReceivedMessage = message.sender_id !== userId && !isSpecialMessage;
                
                // Obtener información del remitente para avatar (priorizar activeUser, luego sender del mensaje)
                const senderInfo = isReceivedMessage 
                  ? (activeUser || (message as any).sender || null)
                  : null;
                
                // Renderizado especial para mensajes de sistema/broadcast
                if (isSpecialMessage) {
                return (
                  <React.Fragment key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center mt-2 mb-3">
                        <span className="px-3 py-1 text-[11px] font-medium tracking-wide text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/10 rounded-full">
                          {formatDateSeparator(new Date(message.created_at))}
                        </span>
                      </div>
                    )}
                      <div className="flex justify-center my-3">
                        <div
                          className={`inline-flex items-center max-w-[85%] px-3 py-2 rounded-xl shadow-sm animate-fadeIn ${
                            isBroadcastMessage
                              ? 'bg-purple-500/10 border border-purple-500/30 text-purple-200'
                              : 'bg-gray-800/60 border border-gray-600/50 text-gray-300'
                          }`}
                          role="article"
                          aria-label={isBroadcastMessage ? 'Mensaje de difusión' : 'Mensaje del sistema'}
                        >
                          {/* Badge de difusión o sistema */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mr-2 ${
                            isBroadcastMessage
                              ? 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                              : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
                          }`}>
                            {isBroadcastMessage ? (
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3.14a.5.5 0 01.656.736A3.973 3.973 0 0115 8c0 1.477-.998 2.764-2.5 3.5M12 20a3 3 0 100-6 3 3 0 000 6z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            {isBroadcastMessage ? 'Difusión' : 'Sistema'}
                          </span>
                          <p className="text-xs leading-relaxed">
                            {searchTerm ? (
                              cleanMessageContent(message.content)?.split(new RegExp(`(${searchTerm})`, 'gi')).map((part: string, i: number) => 
                                part.toLowerCase() === searchTerm.toLowerCase() ? (
                                  <mark key={i} className="bg-yellow-500/40 text-yellow-200 rounded px-0.5">
                                    {part}
                                  </mark>
                                ) : (
                                  renderMessageWithLinks(part, false) || part
                                )
                              )
                            ) : (
                              renderMessageWithLinks(cleanMessageContent(message.content), false) || cleanMessageContent(message.content)
                            )}
                          </p>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }
                
                // Renderizado normal para mensajes regulares
                return (
                  <React.Fragment key={message.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center mt-2 mb-3">
                        <span className="px-3 py-1 text-[11px] font-medium tracking-wide text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/10 rounded-full">
                          {formatDateSeparator(new Date(message.created_at))}
                        </span>
                      </div>
                    )}
                    <div
                      className={`group flex items-start ${isGrouped ? 'mb-1' : 'mb-3'} ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                        className={`relative max-w-[85%] animate-fadeIn ${
                          message.sender_id === userId
                            ? 'bg-blue-500 text-white shadow-sm rounded-2xl rounded-br-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm rounded-2xl rounded-bl-sm'
                        }`}
                        role="article"
                        aria-label={`Mensaje de ${message.sender_id === userId ? 'ti' : getDisplayName(senderInfo || {})} enviado ${formatMessageTime(message.created_at)}`}
                      >
                        {/* Contenedor interno con padding balanceado */}
                        <div className="px-3.5 py-2.5">
                          {/* Mensaje citado si existe */}
                          {message.reply_to_message && (
                            <QuotedMessage
                              message={message.reply_to_message}
                              isOwnMessage={message.sender_id === userId}
                            />
                          )}
                          <p className={`text-[15px] leading-snug tracking-tight ${message.sender_id === userId ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                            {searchTerm ? (
                              cleanMessageContent(message.content)?.split(new RegExp(`(${searchTerm})`, 'gi')).map((part: string, i: number) => 
                                part.toLowerCase() === searchTerm.toLowerCase() ? (
                                  <mark key={i} className={`${message.sender_id === userId ? 'bg-blue-400/30 text-blue-100' : 'bg-yellow-500/30 text-yellow-200'} rounded px-0.5`}>
                                    {part}
                                  </mark>
                                ) : (
                                  renderMessageWithLinks(part, message.sender_id === userId) || part
                                )
                              )
                            ) : (
                              renderMessageWithLinks(cleanMessageContent(message.content), message.sender_id === userId) || cleanMessageContent(message.content)
                            )}
                          </p>
                        </div>
                        {/* Footer compacto integrado: timestamp, estado y acciones */}
                        {isLastInGroup && (
                          <div className={`flex items-center justify-between px-3.5 py-1.5 border-t ${
                            message.sender_id === userId 
                              ? 'border-blue-400/20' 
                              : 'border-gray-700/50'
                          }`}>
                            {/* Para mensajes enviados: timestamp izquierda, botones derecha */}
                            {/* Para mensajes recibidos: botones izquierda, timestamp derecha */}
                            {message.sender_id === userId ? (
                              <>
                                {/* Timestamp y estado a la izquierda (mensajes enviados) */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] leading-none text-blue-100/70" title={new Date(message.created_at).toLocaleString('es-ES')}>
                                    {formatMessageTime(message.created_at)}
                                  </span>
                                  {/* Estados de lectura: solo mostrar en mensajes propios */}
                                  <span className="flex items-center" title={message.is_read_by_other ? 'Visto' : 'Entregado'}>
                                    {message.is_read_by_other ? (
                                      // Visto (doble check azul brillante)
                                      <span className="inline-flex items-center" style={{ width: '13px' }}>
                                        <svg className="w-3 h-3 text-cyan-300" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        <svg className="w-3 h-3 text-cyan-300 -ml-1.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    ) : (
                                      // Entregado (un solo check blanco translúcido)
                                      <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </span>
                                </div>
                                {/* Botones de acción a la derecha (mensajes enviados) */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.content);
                                    }}
                                    className="p-1 rounded-md transition-colors hover:bg-blue-500/30 text-blue-100/70 hover:text-white"
                                    title="Copiar mensaje"
                                    aria-label="Copiar mensaje"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (setReplyTo) {
                                        setReplyTo(message);
                                      }
                                    }}
                                    className="p-1 rounded-md transition-colors hover:bg-blue-500/30 text-blue-100/70 hover:text-white"
                                    title="Responder mensaje"
                                    aria-label="Responder mensaje"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Botones de acción a la izquierda (mensajes recibidos) */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(message.content);
                                    }}
                                    className="p-1 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-gray-700/50 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                    title="Copiar mensaje"
                                    aria-label="Copiar mensaje"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (setReplyTo) {
                                        setReplyTo(message);
                                      }
                                    }}
                                    className="p-1 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-gray-700/50 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                    title="Responder mensaje"
                                    aria-label="Responder mensaje"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                  </button>
                                </div>
                                {/* Timestamp a la derecha (mensajes recibidos) */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] leading-none font-medium text-gray-500 dark:text-gray-400/70" title={new Date(message.created_at).toLocaleString('es-ES')}>
                                    {formatMessageTime(message.created_at)}
                    </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensaje con textarea y emoji picker */}
            {/* Input area ultra-glassmorphic */}
            <div className="p-3 border-t border-white/20 dark:border-white/5 flex-shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-3xl relative z-10">
              {/* Emoji picker (se muestra arriba del input) */}
              {showEmojiPicker && (
                <div className="emoji-picker-container mb-3 bg-gray-900/95 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-2xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-300">Emojis</h4>
                    <button
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label="Cerrar emojis"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                    {Object.entries(emojiCategories).map(([category, emojis]) => (
                      <div key={category} className="space-y-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider px-1">
                          {category === 'smileys' ? 'Caras' : 
                           category === 'gestures' ? 'Gestos' :
                           category === 'hearts' ? 'Corazones' :
                           category === 'objects' ? 'Objetos' : 'Símbolos'}
                        </p>
                        <div className="grid grid-cols-10 gap-1">
                          {emojis.map((emoji, index) => (
                            <button
                              key={`${category}-${index}`}
                              onClick={() => {
                                insertEmoji(emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-700/50 transition-colors duration-200 text-base hover:scale-110"
                              title={emoji}
                              aria-label={`Insertar emoji ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                  </div>
                </div>
              ))}
            </div>
                </div>
              )}
              
              {/* Preview de reply */}
              {replyTo && setReplyTo && (
                <ReplyPreview
                  message={replyTo}
                  onCancel={() => setReplyTo(null)}
                />
              )}
              
              <div className="flex space-x-2 items-end">
                {/* Textarea que mantiene una sola línea hasta Shift+Enter */}
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage?.(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500/70 dark:placeholder-gray-400/70 border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/90 dark:focus:bg-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all resize-none h-[42px] max-h-[120px] text-[15px] leading-relaxed tracking-tight"
                  aria-label="Escribe tu mensaje"
                  aria-required="false"
                  rows={1}
                  style={{ 
                    overflowY: 'hidden',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#4B5563 transparent'
                  }}
                />
                
                {/* Botones emoji y enviar juntos */}
                <div className="flex space-x-2 items-center pl-1">
                  {/* Botón emoji */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="emoji-button flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    title="Emojis"
                    aria-label="Abrir selector de emojis"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  
                  {/* Botón enviar */}
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#6E1CFF] text-white disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg hover:shadow-[#0A84FF]/30 active:scale-95 transition-all duration-300 border-none outline-none ring-0 overflow-hidden"
                    title="Enviar mensaje (Enter)"
                    aria-label="Enviar mensaje"
                >
                    <svg className="w-[18px] h-[18px] ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Confirmación embebida dentro del área de contenido sin alterar layout externo */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[5]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm?.(null)} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[300px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">Eliminar conversación</h3>
                <button onClick={() => setShowDeleteConfirm?.(null)} className="text-gray-400 hover:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-gray-300 mb-4">¿Estás seguro de que quieres eliminar esta conversación? Esta acción no se puede deshacer.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm?.(null);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🔴 [MainChatWindow] Click en Eliminar confirmado. ID:', showDeleteConfirm);
                    if (deleteConversation && showDeleteConfirm) {
                      deleteConversation(showDeleteConfirm);
                    } else {
                      console.error('❌ [MainChatWindow] Función deleteConversation no disponible o ID inválido');
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contenedor para ventanas de chat embebidas dentro del AIM Assistant */}
      <div className="relative">
        <div id="aim-embedded-windows" className="absolute bottom-0 left-0 right-0" />
      </div>

      {/* Boost Page Modal Launcher */}
      {showBoostModal && boostModelInfo && userId && (
        <BoostPagesModal
          isOpen={showBoostModal}
          onClose={() => {
            setShowBoostModal(false);
            setBoostModelInfo(null);
          }}
          modelId={boostModelInfo.id}
          modelName={boostModelInfo.name}
          modelEmail={boostModelInfo.email}
          userId={userId}
        />
      )}
    </div>
  );
};

export default MainChatWindow;

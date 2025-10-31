'use client';

import React, { useEffect, useRef, useState } from 'react';
import StandardModal from '@/components/ui/StandardModal';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';

interface MainChatWindowProps {
  onClose: () => void;
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
  conversationsTabBlinking?: boolean;
  onViewConversations?: () => void;
}

const MainChatWindow: React.FC<MainChatWindowProps> = ({
  onClose,
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
  conversationsTabBlinking = false,
  onViewConversations
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

  // Verificar si el usuario está cerca del final del scroll (dentro de 100px del final)
  const isNearBottom = (): boolean => {
    try {
      if (!messagesContainerRef.current) return true;
      const container = messagesContainerRef.current;
      const threshold = 100; // px desde el final
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      return distanceFromBottom <= threshold;
    } catch {
      return true; // Por defecto, asumir que está cerca del final
    }
  };

  const scrollToBottom = (smooth = true, force = false) => {
    try {
      // Solo hacer scroll si el usuario ya está cerca del final o si se fuerza
      if (!force && !isNearBottom()) {
        return; // Usuario está leyendo arriba, no hacer scroll
      }
      
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    } catch {}
  };

  useEffect(() => {
    if (view === 'chat') {
      // Forzar scroll al cambiar de conversación
      scrollToBottom(false, true);
    }
  }, [view, selectedConversation]);

  // Scroll inteligente cuando llegan nuevos mensajes (solo si el usuario está cerca del final)
  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      // Pequeño delay para que el DOM se actualice
      setTimeout(() => {
        scrollToBottom(true, false);
      }, 100);
    }
  }, [messages.length]);

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
      className="w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-[9996] fixed"
      style={{
        // Posicionar la ventana inmediatamente a la izquierda del botón,
        // dejando un pequeño espacio (gap) y alineando el borde inferior
        right: `calc(${buttonMargin}px + ${buttonSize}px + ${gap}px)`,
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${buttonMargin}px)`,
        cursor: 'default',
        maxHeight: 'calc(100vh - 20px)', // Altura máxima respetando márgenes
        height: '500px' // Altura fija
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg cursor-default">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {activeUser ? (
            <>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white font-bold text-xs tracking-wider">
                  {getDisplayName?.(activeUser)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate" title={getDisplayName?.(activeUser)}>
                  {getDisplayName?.(activeUser)}
                </p>
                {(activeUser.id !== AIM_BOTTY_ID && activeUser.email !== AIM_BOTTY_EMAIL) && (
                  <p className="text-gray-400 text-xs truncate">{activeUser.role}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30 flex-shrink-0">
                <span className="text-white dark:text-gray-900 font-bold text-xs tracking-wider">AIM</span>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">AIM Assistant</p>
                <p className="text-gray-400 text-xs">Soporte y tips</p>
              </div>
            </>
          )}
        </div>
        {view === 'chat' && (
          <>
            {showSearchInput ? (
              <div className="flex items-center space-x-2 flex-1 ml-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en conversación..."
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  aria-label="Buscar mensajes"
                />
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSearchInput(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Cerrar búsqueda"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSearchInput(true)}
                className="text-gray-400 hover:text-white transition-colors ml-2"
                aria-label="Buscar en conversación"
                title="Buscar en conversación"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </>
        )}
        <button onClick={onClose} className="text-gray-400 hover:text-white ml-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Pestañas de navegación */}
      <div className="flex border-b border-gray-700 px-2 gap-2">
        <button
          onClick={() => setView?.('users')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
            view === 'users'
              ? 'text-white bg-gray-700/60 ring-1 ring-inset ring-gray-600'
              : 'text-gray-300 hover:text-white hover:bg-gray-700/40'
          }`}
        >
          Usuarios disponibles
        </button>
        <button
          onClick={() => {
            setView?.('conversations');
            if (onViewConversations) {
              onViewConversations(); // Desactivar parpadeo al ver conversaciones
            }
          }}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
            view === 'conversations'
              ? 'text-white bg-gray-700/60 ring-1 ring-inset ring-gray-600'
              : 'text-gray-300 hover:text-white hover:bg-gray-700/40'
          } ${
            conversationsTabBlinking && view !== 'conversations'
              ? 'animate-pulse bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20'
              : ''
          }`}
        >
          Conversaciones ({conversationsWithMessages.length})
        </button>
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
                    className="flex items-center justify-between w-full p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
                          className="flex items-center w-full p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-xs font-bold">
                              {getDisplayName(user).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{getDisplayName(user)}</p>
                            {/* No mostrar rol si es el bot */}
                            {user.id !== AIM_BOTTY_ID && user.email !== AIM_BOTTY_EMAIL && (
                            <p className="text-xs text-gray-400">{user.role}</p>
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
                    className="flex items-center justify-between w-full p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
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
                          className="flex items-center w-full p-2 text-left text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <div className="w-6 h-6 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-xs font-bold">
                              {getDisplayName(user).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{getDisplayName(user)}</p>
                            {/* No mostrar rol si es el bot */}
                            {user.id !== AIM_BOTTY_ID && user.email !== AIM_BOTTY_EMAIL && (
                            <p className="text-xs text-gray-400">{user.role}</p>
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
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-center">No hay conversaciones activas</p>
                    <p className="text-xs text-center mt-1">Los mensajes aparecerán aquí cuando inicies una conversación</p>
                  </div>
                ) : (
                  conversationsWithMessages.map((conversation: any) => (
                    <div
                      key={conversation.id}
                      className={`flex items-center w-full p-2 text-left rounded-lg transition-colors ${
                        selectedConversation === conversation.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <button
                        onClick={() => {
                          // Abrir ventana independiente en la barra usando el otro participante
                          openChatWithUser?.(conversation.other_participant.id);
                        }}
                        className="flex items-center flex-1 min-w-0 text-left"
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3">
                          <span className="text-white text-xs font-bold">
                            {getDisplayName(conversation.other_participant).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getDisplayName(conversation.other_participant)}</p>
                          <p className="text-xs text-gray-400 truncate">{conversation.last_message?.content}</p>
                        </div>
                      </button>
                      {conversation.unread_count > 0 && (
                        <div className="bg-red-500 text-white text-[10px] rounded-full px-2 py-1 min-w-[20px] text-center ml-2">
                          {conversation.unread_count}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm?.(conversation.id); }}
                        className="ml-2 p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-600/50"
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
            <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto custom-scrollbar min-h-0">
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
                const showAvatar = isReceivedMessage && isFirstInGroup && senderInfo;
                
                // Renderizado especial para mensajes de sistema/broadcast
                if (isSpecialMessage) {
                  return (
                    <React.Fragment key={message.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 text-xs text-gray-400 bg-gray-800/50 rounded-full">
                            {formatDateSeparator(new Date(message.created_at))}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-center my-4">
                        <div
                          className={`inline-flex items-center max-w-[85%] px-4 py-2.5 rounded-xl shadow-sm animate-fadeIn ${
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
                              message.content?.split(new RegExp(`(${searchTerm})`, 'gi')).map((part: string, i: number) => 
                                part.toLowerCase() === searchTerm.toLowerCase() ? (
                                  <mark key={i} className="bg-yellow-500/40 text-yellow-200 rounded px-0.5">
                                    {part}
                                  </mark>
                                ) : (
                                  part
                                )
                              )
                            ) : (
                              message.content
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
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 text-xs text-gray-400 bg-gray-800/50 rounded-full">
                          {formatDateSeparator(new Date(message.created_at))}
                        </span>
                      </div>
                    )}
                    <div
                      className={`group flex items-end ${isGrouped ? 'mb-1' : 'mb-4'} ${message.sender_id === userId ? 'justify-end' : 'justify-start'} gap-2`}
                    >
                      {/* Avatar solo en mensajes recibidos, primer mensaje del grupo */}
                      {isReceivedMessage && (
                        showAvatar ? (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mb-1">
                            <span className="text-white text-xs font-bold">
                              {getUserInitial(senderInfo)}
                            </span>
                          </div>
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )
                      )}
                      <div
                        className={`relative max-w-[70%] p-3.5 shadow-sm animate-fadeIn ${
                          message.sender_id === userId
                            ? 'bg-blue-600 text-white rounded-2xl'
                            : 'bg-gray-700 text-gray-100 rounded-2xl'
                        }`}
                        role="article"
                        aria-label={`Mensaje de ${message.sender_id === userId ? 'ti' : getDisplayName(senderInfo || {})} enviado ${formatMessageTime(message.created_at)}`}
                      >
                        {/* Menú contextual (solo visible al hover) */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(message.content);
                              // Feedback visual opcional (podríamos agregar un toast)
                            }}
                            className="p-1.5 rounded-lg hover:bg-black/20 text-gray-300 hover:text-white transition-colors"
                            title="Copiar mensaje"
                            aria-label="Copiar mensaje"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Implementar funcionalidad de responder
                              // Por ahora solo placeholder visual
                            }}
                            className="p-1.5 rounded-lg hover:bg-black/20 text-gray-300 hover:text-white transition-colors"
                            title="Responder mensaje"
                            aria-label="Responder mensaje"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm pr-12">
                          {searchTerm ? (
                            message.content?.split(new RegExp(`(${searchTerm})`, 'gi')).map((part: string, i: number) => 
                              part.toLowerCase() === searchTerm.toLowerCase() ? (
                                <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
                                  {part}
                                </mark>
                              ) : (
                                part
                              )
                            )
                          ) : (
                            message.content
                          )}
                        </p>
                        {/* Solo mostrar timestamp y estado en el último mensaje del grupo */}
                        {isLastInGroup && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-xs text-gray-300" title={new Date(message.created_at).toLocaleString('es-ES')}>
                              {formatMessageTime(message.created_at)}
                            </span>
                            {/* Estados de lectura: solo mostrar en mensajes propios */}
                            {message.sender_id === userId && (
                              <span className="ml-1 flex items-center" title={message.is_read_by_other ? 'Visto' : 'Entregado'}>
                                {message.is_read_by_other ? (
                                  // Visto (doble check azul)
                                  <span className="inline-flex items-center" style={{ width: '16px' }}>
                                    <svg className="w-3.5 h-3.5 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <svg className="w-3.5 h-3.5 text-blue-300 -ml-1.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                ) : (
                                  // Entregado (un solo check gris)
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>
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
            <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-800">
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
                  <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
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
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700/50 transition-colors duration-200 text-lg hover:scale-110"
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
              
              <div className="flex space-x-2 items-end">
                {/* Textarea que mantiene una sola línea hasta Shift+Enter */}
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage?.(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 p-2.5 rounded-lg bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none h-[42px] max-h-[120px] text-sm leading-relaxed"
                  aria-label="Escribe tu mensaje"
                  aria-required="false"
                  rows={1}
                  style={{ 
                    overflowY: 'hidden',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#4B5563 #374151'
                  }}
                />
                
                {/* Botones emoji y enviar juntos */}
                <div className="flex space-x-1.5 items-center">
                  {/* Botón emoji */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="emoji-button flex-shrink-0 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-600/50 hover:border-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Emojis"
                    aria-label="Abrir selector de emojis"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  
                  {/* Botón enviar */}
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                    title="Enviar mensaje (Enter)"
                    aria-label="Enviar mensaje"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
                  onClick={() => setShowDeleteConfirm?.(null)}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteConversation?.(showDeleteConfirm)}
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
    </div>
  );
};

export default MainChatWindow;

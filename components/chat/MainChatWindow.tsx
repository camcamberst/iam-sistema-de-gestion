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
import AuroraPinDisplay from './AuroraPinDisplay';
import AddAuroraContact from './AddAuroraContact';
import ChatSettingsModal from './ChatSettingsModal';
import AddParticipantModal from './AddParticipantModal';
import UnifiedMediaPicker from './UnifiedMediaPicker';
import { supabase } from '@/lib/supabase';
import PillTabs from '@/components/ui/PillTabs';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import VoiceMessagePlayer from './VoiceMessagePlayer';

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
  expandedSections?: { online: boolean; offline: boolean; favorites?: boolean };
  setExpandedSections?: (sections: { online: boolean; offline: boolean; favorites?: boolean }) => void;
  openChatWithUser?: (userId: string) => void;
  conversations?: any[];
  selectedConversation?: string | null;
  setSelectedConversation?: (id: string | null) => void;
  messages?: any[];
  newMessage?: string;
  setNewMessage?: (message: string) => void;
  sendMessage?: (metadata?: any) => void;
  handleKeyPress?: (e: React.KeyboardEvent) => void;
  showDeleteConfirm?: string | null;
  setShowDeleteConfirm?: (id: string | null) => void;
  deleteConversation?: (id: string) => void;
  clearConversation?: (id: string) => void;
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
  expandedSections = { online: true, offline: false, favorites: true },
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
  clearConversation,
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
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Estados para Multimedia, PIN y Efímeros
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [isPinExpanded, setIsPinExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);

  // Reacciones
  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const handleReaction = async (message: any, emoji: string) => {
    // Si el menú está abierto, ciérralo
    setActiveMessageMenu(null);
    
    const currentMetadata = message.metadata || {};
    const currentReactions = currentMetadata.reactions || {};
    const userReactions = currentReactions[emoji] || [];
    
    let newReactions;
    const actualUserId = session?.user?.id || userId || 'anonymous';
    
    if (userReactions.includes(actualUserId)) {
      // Quitar reacción
      newReactions = userReactions.filter((id: string) => id !== actualUserId);
    } else {
      // Añadir reacción
      newReactions = [...userReactions, actualUserId];
    }
    
    const updatedReactions = { ...currentReactions, [emoji]: newReactions };
    
    // Limpiar emojis sin usuarios
    if (updatedReactions[emoji].length === 0) {
      delete updatedReactions[emoji];
    }
  
    const newMetadata = { ...currentMetadata, reactions: updatedReactions };
    
    // Actualización optimista local en memoria (provocará re-render con el nuevo estado al cerrar el menú)
    message.metadata = newMetadata;
    
    // Si está conectado a un DB real, idealmente actualizaríamos a través del padre o haciendo un fetch.
    // Sin embargo, podemos intentar el mismo update aquí con Supabase si está disponible:
    if (actualUserId !== 'anonymous') {
      try {
        await supabase
          .from('chat_messages')
          .update({ metadata: newMetadata })
          .eq('id', message.id);
          
        window.dispatchEvent(new CustomEvent('chat-reload-messages', { detail: { conversationId: selectedConversation } }));
      } catch (err) {
        console.error('Error saving reaction:', err);
      }
    }
  };

  // Estados y ref para notas de voz
  const { isRecording, isPaused, recordingTime, startRecording, pauseRecording, resumeRecording, stopRecording, cancelRecording, clearAudio, audioBlob, audioUrl } = useAudioRecorder();
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Archivos adjuntos y Dropzone
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
      if (file.size > MAX_SIZE) {
        alert('El archivo excede el límite de 5MB');
        return;
      }
      setPendingFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewFileUrl(URL.createObjectURL(file));
      } else {
        setPreviewFileUrl(null);
      }
    }
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    if (previewFileUrl) {
      URL.revokeObjectURL(previewFileUrl);
      setPreviewFileUrl(null);
    }
  };

  const handleSendWithFile = async () => {
    if (!sendMessage || (!newMessage?.trim() && !pendingFile) || !selectedConversation) return;

    if (pendingFile) {
      setIsUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', pendingFile);
        formData.append('bucket', 'chat-attachments');
        
        const uploadRes = await fetch('/api/chat/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token}` },
          body: formData
        });
        
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          const mediaUrl = uploadData.publicUrl;
          const msgType = pendingFile.type.startsWith('image/') ? 'image' : 'file';
          
          await sendMessage({
            content: mediaUrl || newMessage?.trim() || '',
            message_type: msgType,
            media_url: mediaUrl,
            metadata: { original_name: pendingFile.name, caption: newMessage?.trim() || '' },
            is_ephemeral: isEphemeral
          });
          
          clearPendingFile();
        } else {
          alert('Error subiendo archivo');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsUploadingFile(false);
      }
    } else {
      await sendMessage({ is_ephemeral: isEphemeral });
    }
  };

  // Inicializar reproductor de preview
  useEffect(() => {
    if (audioUrl) {
      previewAudioRef.current = new Audio(audioUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, [audioUrl]);

  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handleUploadVoiceNote = async (blob: Blob) => {
    if (!sendMessage) return;
    setIsUploadingAudio(true);
    try {
      const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2)}.webm`;
      
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false });
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);
        
      // Llama a la lógica de envío de mensaje interna
      if (session?.access_token) {
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            conversation_id: selectedConversation,
            content: publicUrl,
            message_type: 'text',
            media_url: publicUrl,
            is_ephemeral: isEphemeral,
            metadata: { is_voice_note: true },
            reply_to_message_id: replyTo ? replyTo.id : undefined
          })
        });
        const respData = await response.json();
        console.log('Voice note fetch response:', respData);
        // Disparar evento para que el ChatWidget recargue
        if (respData.success) {
          window.dispatchEvent(new CustomEvent('chat-reload-messages', { detail: { conversationId: selectedConversation } }));
        } else {
          console.error('Error in voice note response:', respData);
        }
      }
    } catch (err) {
      console.error('Error subiendo nota de voz:', err);
      // Fallback: mostrar un toast o alert
    } finally {
      setIsUploadingAudio(false);
      clearAudio();
    }
  };

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [viewedEphemeralMessages, setViewedEphemeralMessages] = useState<Record<string, boolean>>({});
  const [activeEphemeralMedia, setActiveEphemeralMedia] = useState<string | null>(null);
  const [ephemeralCountdown, setEphemeralCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chat_favorite_users');
      if (saved) setFavoriteIds(JSON.parse(saved));
    }
  }, []);

  const toggleFavorite = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setFavoriteIds(prev => {
      const newFavs = prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId];
      if (typeof window !== 'undefined') {
        localStorage.setItem('chat_favorite_users', JSON.stringify(newFavs));
      }
      return newFavs;
    });
  };

  const handleViewEphemeral = async (messageId: string) => {
    setActiveEphemeralMedia(messageId);
    setEphemeralCountdown(7);
    
    const interval = setInterval(() => {
      setEphemeralCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Autodestrucción después de 7 segundos
    setTimeout(async () => {
      setActiveEphemeralMedia(null);
      setEphemeralCountdown(null);
      setViewedEphemeralMessages(prev => ({ ...prev, [messageId]: true }));
      try {
        // Intentar eliminar del backend (Supabase) al ver
        if (session?.access_token) {
          await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
        }
      } catch (e) {
        console.error('Error al autodestruir mensaje efímero:', e);
      }
    }, 7000);
  };

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMenu) setShowMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [currentUserPin, setCurrentUserPin] = useState<string | null>(null);
  
  // Estado para Boost Page Launcher
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostModelInfo, setBoostModelInfo] = useState<{id: string, name: string, email: string} | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Fetch user PIN
  useEffect(() => {
    if (userId) {
      const fetchPin = async () => {
        try {
          const { data } = await supabase.from('users').select('aurora_pin').eq('id', userId).single();
          if (data && data.aurora_pin) {
            setCurrentUserPin(data.aurora_pin);
          }
        } catch (e) {
          console.error('Error fetching pin', e);
        }
      };
      fetchPin();
    }
  }, [userId]);

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
  
  // Cerrar menú contextual con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeMessageMenu) {
        setActiveMessageMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMessageMenu]);
  
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
  
  // Cerrar media picker al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showMediaPicker && !target.closest('.emoji-picker-container') && !target.closest('.emoji-button')) {
        setShowMediaPicker(false);
      }
    };
    
    if (showMediaPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMediaPicker]);
  
  // Función para manejar teclas en textarea (Shift+Enter para nueva línea, Enter para enviar)
  const handleToggleEphemeral = async () => {
    if (isEphemeral) {
      // Activar animación blip-out en todos los mensajes efímeros del DOM
      const ephemeralElems = document.querySelectorAll('.message-ephemeral');
      ephemeralElems.forEach(el => el.classList.add('animate-blip-out'));
      
      // Esperar brevemente a que inicie la animación antes de borrar
      setTimeout(async () => {
        setIsEphemeral(false);
        if (selectedConversation) {
          try {
            await fetch('/api/chat/messages/ephemeral/clear', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({ conversation_id: selectedConversation })
            });
          } catch (e) {
            console.error('Error clearing ephemeral messages:', e);
          }
        }
      }, 350);
    } else {
      setIsEphemeral(true);
    }
  };

  // Funciones para arrastrar y soltar archivos
  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFileDragging) setIsFileDragging(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragging(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        alert('El archivo excede el límite de 5MB');
        return;
      }
      setPendingFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewFileUrl(URL.createObjectURL(file));
      } else {
        setPreviewFileUrl(null);
      }
    }
  };

  // Función para manejar teclas en textarea (Shift+Enter para nueva línea, Enter para enviar)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((newMessage?.trim() || pendingFile) && sendMessage) {
        handleSendWithFile();
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

  // Función para obtener estilos dinámicos del tema
  const getThemeStyles = () => {
    switch (chatTheme) {
      case 'boreal':
        return 'bg-[#f8f9fc]/95 dark:bg-[#0a0f1a]/95 border-fuchsia-500/20 dark:border-cyan-500/20 shadow-[0_8px_32px_rgba(217,70,239,0.15)]';
      case 'obsidian':
        return 'bg-[#f5f5f7]/95 dark:bg-[#050505]/95 border-gray-300/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.08)]';
      case 'pastel':
        // Tonos pasteles más suaves y no tan rojizos/oscuros (dusty rose para dark mode)
        return 'bg-[#fff5f2]/95 dark:bg-[#433536]/95 border-orange-200/50 dark:border-[#5c494a]/50 shadow-[0_8px_32px_rgba(251,146,60,0.1)]';
      default:
        return 'bg-white/70 dark:bg-[#0a0f1a]/60 border-black/5 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)]';
    }
  };

  // Función para obtener estilos dinámicos de las burbujas
  const getBubbleStyle = (isOwnMessage: boolean) => {
    switch (chatTheme) {
      case 'boreal':
        return isOwnMessage 
          ? 'bg-gradient-to-r from-[#00d2ff] to-[#e100ff] text-white shadow-[0_4px_15px_rgba(217,70,239,0.25)]' 
          : 'bg-white dark:bg-[#111827] text-gray-900 dark:text-gray-100 border border-fuchsia-200 dark:border-fuchsia-900/40 shadow-sm';
      case 'obsidian':
        return isOwnMessage 
          ? 'bg-[#1c1c1e] dark:bg-[#2c2c2e] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]' 
          : 'bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-[#333] shadow-sm';
      case 'pastel':
        return isOwnMessage 
          ? 'bg-rose-400 text-white shadow-[0_4px_12px_rgba(251,113,133,0.2)]' 
          : 'bg-orange-50 dark:bg-[#574546]/90 text-rose-950 dark:text-[#fde8e8] border border-orange-100 dark:border-[#6e5859]/50 shadow-sm';
      default:
        return isOwnMessage 
          ? 'bg-blue-500 text-white shadow-sm' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm';
    }
  };

  return (
    <div
      data-chat-window="true"
      className={`w-[calc(100%-2rem)] sm:w-80 backdrop-blur-3xl border rounded-2xl flex flex-col z-[9996] fixed left-4 right-4 sm:left-auto sm:right-[calc(24px+40px+28px)] bottom-[88px] group-[.keyboard-open]/body:bottom-[10px] sm:bottom-[24px] sm:group-[.keyboard-open]/body:bottom-[24px] overflow-hidden ${isClosing ? 'animate-chat-pop-out' : 'animate-chat-pop'} origin-bottom sm:origin-bottom-right ${getThemeStyles()}`}
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
        <div className="flex items-center min-w-0 flex-1">
          {activeUser ? (
            <>
              {renderAvatar(activeUser, 'medium')}
              <div className="min-w-0 flex-1 ml-3">
                <p className="text-gray-900 dark:text-white text-sm font-semibold truncate" title={getDisplayName?.(activeUser)}>
                  {getDisplayName?.(activeUser)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 bg-black text-white dark:bg-white dark:text-gray-900 border-transparent">
                <span className="font-bold text-[10px] tracking-wider">AIM</span>
              </div>
              <div className={`flex items-center transition-all duration-500 ease-out overflow-hidden flex-shrink-0 ${isPinExpanded ? 'max-w-0 opacity-0 -translate-x-4' : 'max-w-[200px] opacity-100 translate-x-0 ml-3'}`}>
                <p className="text-gray-900 dark:text-white text-[15px] font-semibold truncate leading-none pt-0.5">BottyHome</p>
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
               
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </>
        )}
        <div className="flex items-center space-x-2 ml-2 relative">
          {view === 'chat' ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                aria-label="Menú de chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
              </button>
              
              {showMenu && (
                <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-50 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setShowSettingsModal(true); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cambiar Tema</button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Silenciar usuario</button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Bloquear usuario</button>
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                  <button onClick={() => {
                    if (clearConversation && selectedConversation) {
                      clearConversation(selectedConversation);
                    }
                    setShowMenu(false);
                  }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Limpiar chat</button>
                  <button onClick={() => {
                    if (setShowDeleteConfirm && selectedConversation) {
                      setShowDeleteConfirm(selectedConversation);
                    }
                    setShowMenu(false);
                  }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Eliminar conversación</button>
                  <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Eliminar usuario</button>
                </div>
              )}

              <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <AuroraPinDisplay pin={currentUserPin} onAddContact={() => setShowAddContactModal(true)} onExpandChange={setIsPinExpanded} />
          )}
        </div>
        {/* Botón de Test de Sonido (Oculto en producción, útil para debug) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            initAudio(); // Asegurar contexto
            playNotificationSound(0.8); // Reproducir sonido
          }} 
          className="text-gray-400 opacity-0 hover:opacity-100 transition-opacity absolute top-0 right-0 p-1"
         
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>

      {/* Pestañas de navegación */}
      <div className="flex px-3 pt-3 pb-2 gap-2 bg-transparent justify-center w-full">
        <PillTabs
          variant="guardar"
          fullWidth={true}
          tabs={[
            { id: 'users', label: 'Usuarios' },
            { id: 'conversations', label: `Chats (${conversationsWithMessages.length})` }
          ]}
          activeTab={view || 'users'}
          onTabChange={(tab) => setView?.(tab as 'users' | 'conversations')}
        />
      </div>

      {/* Contenido principal (envoltorio relativo para overlays internos) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {view === 'users' && (
          <>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
                <div className="space-y-1">
                  <button
                    onClick={() => setExpandedSections?.({ ...expandedSections, favorites: !(expandedSections.favorites ?? true) })}
                    className="flex items-center justify-between w-full p-2 text-left font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
                      Favoritos ({availableUsers.filter(u => favoriteIds.includes(u.id)).length})
                    </span>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${(expandedSections.favorites ?? true) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {(expandedSections.favorites ?? true) && (
                    <div className="ml-4 space-y-1">
                      {availableUsers.filter(u => favoriteIds.includes(u.id)).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => openChatWithUser?.(user.id)}
                          className="flex items-center w-full p-2 text-left text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors group"
                        >
                          <div className="mr-3">
                            {renderAvatar(user, 'small', !user.is_online)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{getDisplayName(user)}</p>
                          </div>
                          <div 
                            onClick={(e) => toggleFavorite(e, user.id)}
                            className="p-1 rounded-full text-indigo-500 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                           
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
                          </div>
                          <div 
                            onClick={(e) => toggleFavorite(e, user.id)}
                            className={`p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-opacity ${favoriteIds.includes(user.id) ? 'text-indigo-500 opacity-100' : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100'}`}
                           
                          >
                            <svg className="w-4 h-4" fill={favoriteIds.includes(user.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
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
          <div 
            className="flex-1 flex flex-col min-h-0 relative"
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
            {/* Dropzone Overlay */}
            {isFileDragging && (
              <div className="absolute inset-0 z-[9999] pointer-events-none bg-white/60 dark:bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200 rounded-b-2xl">
                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 animate-bounce border-2 border-blue-500/50">
                  <svg className="w-10 h-10 text-blue-500 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white drop-shadow-md">Suelta tu archivo aquí</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 font-medium">Se adjuntará a la conversación</p>
              </div>
            )}

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
                      className={`group flex flex-col relative w-full ${isGrouped ? 'mb-1' : 'mb-3'} ${message.sender_id === userId ? 'items-end' : 'items-start'}`}
                    >
                      {/* Context Menu Popup & Overlay */}
                      {activeMessageMenu === message.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-[40]" 
                            onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); }}
                            onContextMenu={(e) => { e.preventDefault(); setActiveMessageMenu(null); }}
                          />
                          <div className={`absolute z-50 bottom-full mb-1 ${message.sender_id === userId ? 'right-0' : 'left-0'} bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 px-2 py-1 flex items-center gap-1 animate-in zoom-in-95 duration-200`}>
                            {REACTION_EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => handleReaction(message, emoji)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-transform hover:scale-125 text-base leading-none">
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="relative max-w-[85%] sm:max-w-[75%]">
                        <div
                          onClick={() => setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id)}
                          className={`relative cursor-pointer shadow-sm animate-fadeIn ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'message-ephemeral border-cyan-400 dark:border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : ''} ${
                            message.sender_id === userId
                              ? `rounded-2xl ${isGrouped ? 'rounded-tr-md rounded-br-md' : 'rounded-br-sm'} ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'bg-cyan-600/90 text-white border backdrop-blur' : getBubbleStyle((message.message_type === 'voice' || message.metadata?.is_voice_note) ? false : true)}`
                              : `rounded-2xl ${isGrouped ? 'rounded-tl-md rounded-bl-md' : 'rounded-bl-sm'} ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 border backdrop-blur' : getBubbleStyle(false)}`
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
                          {(message.metadata?.is_ephemeral || message.is_ephemeral) && (message.message_type === 'image' || message.message_type === 'video' || message.message_type === 'voice' || message.metadata?.is_voice_note) ? (
                            message.sender_id === userId || viewedEphemeralMessages[message.id] ? (
                              <div className="flex flex-col relative group/ephemeral">
                                <span className={`text-[12px] font-normal flex items-center ${message.sender_id === userId ? 'text-white/80' : 'text-gray-500'}`}>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                  {message.sender_id === userId ? 'Sin abrir' : 'Abierto'}
                                </span>
                              </div>
                            ) : activeEphemeralMedia === message.id ? (
                              <>
                                <button 
                                  className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-black/10 dark:bg-white/10 transition-colors cursor-default opacity-50"
                                >
                                  <svg className="w-4 h-4 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  <span className={`text-[12px] font-normal ${message.sender_id === userId ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Visualizando...</span>
                                </button>
                                <StandardModal
                                  isOpen={true}
                                  onClose={() => {}}
                                  showCloseButton={false}
                                  closeOnBackdrop={false}
                                  bgClass="bg-black/90 backdrop-blur-3xl"
                                  borderClass="border border-white/10 shadow-[0_0_50px_rgba(34,211,238,0.15)]"
                                  maxWidthClass="max-w-2xl"
                                  paddingClass="p-2 sm:p-4"
                                >
                                  <div className="flex flex-col relative animate-in zoom-in duration-300 w-full items-center justify-center min-h-[40vh]">
                                    {ephemeralCountdown !== null && (
                                      <>
                                        <style>{`
                                          @keyframes ephemeral-deplete {
                                            from { stroke-dashoffset: 0; }
                                            to { stroke-dashoffset: 63; }
                                          }
                                        `}</style>
                                        <div className="absolute top-0 right-0 bg-black/40 backdrop-blur-md rounded-full p-1.5 shadow-sm border border-white/10 z-50">
                                          <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" className="text-white/20" />
                                            <circle 
                                              cx="12" cy="12" r="10" 
                                              stroke="currentColor" 
                                              strokeWidth="3" 
                                              fill="none" 
                                              className="text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]"
                                              strokeDasharray="63" 
                                              strokeDashoffset="0"
                                              style={{ animation: 'ephemeral-deplete 7s linear forwards' }}
                                            />
                                          </svg>
                                        </div>
                                      </>
                                    )}
                                    
                                    {message.message_type === 'image' && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={message.media_url || message.content} alt="Efímera" className="max-w-full max-h-[75vh] rounded-xl object-contain shadow-2xl ring-1 ring-white/10" />
                                    )}
                                    
                                    {(message.message_type === 'voice' || message.metadata?.is_voice_note) && (
                                      <div className="bg-white/5 p-8 rounded-3xl backdrop-blur-xl w-full max-w-sm flex flex-col items-center justify-center ring-1 ring-white/10 shadow-xl">
                                        <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-6 animate-pulse">
                                          <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                        </div>
                                        <audio src={message.media_url || message.content} controls className="w-full" autoPlay />
                                      </div>
                                    )}
                                    
                                    {message.metadata?.caption && (
                                      <p className="text-lg leading-snug tracking-tight mt-6 text-white/90 font-medium text-center px-4 max-w-lg drop-shadow-md">
                                        {message.metadata.caption}
                                      </p>
                                    )}
                                  </div>
                                </StandardModal>
                              </>
                            ) : (
                              <button 
                                onClick={() => handleViewEphemeral(message.id)}
                                className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-cyan-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2V9.5L9.5 10V8.5L12 7.5h1v7.5z" /></svg>
                                <span className={`text-[12px] font-normal ${message.sender_id === userId ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Toca para ver</span>
                              </button>
                            )
                          ) : message.message_type === 'image' && !message.metadata?.is_ephemeral && !message.is_ephemeral ? (
                            <div className={`flex flex-col relative ${message.sender_id === userId ? 'items-end' : 'items-start'}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={message.media_url || message.content} alt={message.metadata?.original_name || 'Imagen'} className="max-w-[200px] sm:max-w-[280px] rounded-xl object-contain shadow-sm cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(message.media_url || message.content, '_blank')} />
                              {message.metadata?.caption && (
                                <p className={`text-[15px] leading-snug tracking-tight mt-2 ${message.sender_id === userId ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                                  {message.metadata.caption}
                                </p>
                              )}
                            </div>
                          ) : message.message_type === 'file' && !message.metadata?.is_ephemeral && !message.is_ephemeral ? (
                            <div className="flex flex-col">
                              <a href={message.media_url || message.content} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${message.sender_id === userId ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-900 dark:text-white'}`}>
                                <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${message.sender_id === userId ? 'bg-white/20' : 'bg-black/10 dark:bg-white/10'}`}>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                </div>
                                <div className="flex flex-col overflow-hidden max-w-[180px]">
                                  <span className="text-sm font-semibold truncate">{message.metadata?.original_name || 'Archivo adjunto'}</span>
                                  <span className="text-[10px] opacity-70 uppercase mt-0.5">Descargar</span>
                                </div>
                              </a>
                              {message.metadata?.caption && (
                                <p className={`text-[15px] leading-snug tracking-tight mt-2 ${message.sender_id === userId ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                                  {message.metadata.caption}
                                </p>
                              )}
                            </div>
                          ) : (message.message_type === 'voice' || message.metadata?.is_voice_note) && !message.metadata?.is_ephemeral && !message.is_ephemeral ? (
                            <VoiceMessagePlayer 
                              src={message.media_url || message.content} 
                              isOwnMessage={false}
                            />
                          ) : (
                            <div className={`${(message.metadata?.is_ephemeral || message.is_ephemeral) ? 'flex flex-col relative group/ephemeral' : ''}`}>
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
                              {(message.metadata?.is_ephemeral || message.is_ephemeral) && (
                                <span className={`text-[9px] font-bold uppercase mt-1 flex items-center ${message.sender_id === userId ? 'text-white/60' : 'text-gray-500'}`}>
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                  Efímero
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        </div>

                        {/* Reaction Pills */}
                        {message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 && (
                          <div className={`absolute -bottom-2.5 ${message.sender_id === userId ? 'right-2' : 'left-2'} flex items-center bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-full px-1.5 py-0.5 z-10 origin-bottom`}>
                            {Object.entries(message.metadata.reactions).map(([emoji, users]: [string, any]) => (
                              <span key={emoji} className="flex items-center text-[11px] ml-1 first:ml-0">
                                {emoji} {users.length > 1 && <span className="ml-1 text-[9px] font-bold text-gray-500">{users.length}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Timestamp and Checks outside */}
                      {isLastInGroup && (
                        <div className={`flex items-center gap-1 mt-1.5 mb-1 ${
                          message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 ? 'mt-3.5' : ''
                        } ${message.sender_id === userId ? 'pr-1 justify-end' : 'pl-1 justify-start'}`}>
                          
                          {/* Action Buttons (Citar, Reenviar) */}
                          {activeMessageMenu === message.id && (
                            <div className="flex items-center gap-1 animate-in fade-in duration-200 relative z-50">
                              <button onClick={(e) => { e.stopPropagation(); if (setReplyTo) setReplyTo(message); setActiveMessageMenu(null); }} className="text-gray-400 hover:text-blue-500 transition-colors flex items-center">
                                <svg className="w-[12px] h-[12px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setActiveMessageMenu(null); /* pending forward */ }} className="text-gray-400 hover:text-blue-500 transition-colors flex items-center">
                                <svg className="w-[12px] h-[12px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                              </button>
                            </div>
                          )}

                          <span className="text-[10px] font-medium leading-none text-gray-400 ml-0.5">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {message.sender_id === userId && (
                            <span className="flex items-center">
                              {message.is_read_by_other ? (
                                <span className="inline-flex items-center" style={{ width: '13px' }}>
                                  <svg className="w-3.5 h-3.5 text-cyan-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                  <svg className="w-3.5 h-3.5 text-cyan-500 -ml-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                </span>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensaje con textarea y emoji picker */}
            {/* Input area ultra-glassmorphic */}
            <div className="px-2 pt-3 pb-1.5 sm:px-4 sm:pt-4 sm:pb-2 border-t border-white/20 dark:border-white/5 flex-shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-3xl relative z-10">
              {/* Pickers ya no están aquí, usan UnifiedMediaPicker */}
              
              {/* Preview de reply */}
              {replyTo && setReplyTo && (
                <ReplyPreview
                  message={replyTo}
                  onCancel={() => setReplyTo(null)}
                />
              )}
              
              <div className="flex space-x-2 items-center">
                {/* Textarea que mantiene una sola línea hasta Shift+Enter */}
                <div className="flex-1 relative">
                  {!isRecording && !audioBlob ? (
                      <>
                        {pendingFile && (
                          <div className="absolute bottom-[calc(100%+12px)] left-0 mb-2 p-2 rounded-2xl bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-20 animate-in slide-in-from-bottom-2 flex flex-col items-center justify-center min-w-[80px]">
                            <button
                              type="button"
                              onClick={clearPendingFile}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors z-30 shadow-md"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            {previewFileUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={previewFileUrl} alt="Preview" className="h-[120px] max-w-[200px] rounded-xl object-contain drop-shadow-md" />
                            ) : (
                              <div className="h-[100px] w-[100px] flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-xl">
                                <svg className="w-10 h-10 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 truncate w-20 text-center px-1">{pendingFile.name}</span>
                              </div>
                            )}
                            {isUploadingFile && (
                              <div className="absolute inset-0 bg-black/20 dark:bg-black/40 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm z-20">
                                <div className="w-6 h-6 border-2 border-white/80 border-t-transparent rounded-full animate-spin shadow-lg"></div>
                              </div>
                            )}
                          </div>
                        )}
                        <textarea
                          ref={textareaRef}
                          value={newMessage}
                          onChange={(e) => setNewMessage?.(e.target.value)}
                          onKeyDown={handleTextareaKeyDown}
                          placeholder="Mensaje"
                          className={`w-full block pl-10 ${pendingFile ? 'pr-[72px]' : 'pr-10'} py-1.5 rounded-full bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500/70 dark:placeholder-gray-400/70 border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/90 dark:focus:bg-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all resize-none min-h-[36px] max-h-[120px] text-[15px] leading-[22px] tracking-tight`}
                          aria-label=""
                          aria-required="false"
                          rows={1}
                          style={{ 
                            overflowY: 'hidden',
                            scrollbarWidth: 'thin',
                            scrollbarColor: '#4B5563 transparent'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowMediaPicker(!showMediaPicker)}
                          className={`emoji-button absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${showMediaPicker ? 'text-blue-500 bg-blue-500/10' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        {pendingFile && (
                          <button
                            type="button"
                            onClick={handleToggleEphemeral}
                            className={`absolute right-[34px] top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none hover:scale-110 active:scale-95 ${
                              isEphemeral 
                                ? 'text-cyan-400 drop-shadow-[0_0_6px_currentColor]' 
                                : 'text-gray-400 dark:text-gray-500 hover:text-cyan-400 hover:drop-shadow-[0_0_6px_currentColor]'
                            }`}
                          >
                            {isEphemeral ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2V9.5L9.5 10V8.5L12 7.5h1v7.5z" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" strokeWidth="2" strokeDasharray="3.5 3.5" />
                                <path d="M11 9.5L13 8.5v7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        )}
                        <label
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
                        >
                          <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
                          <svg className="w-5 h-5 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        </label>
                      </>
                  ) : (
                    // ESTADO AUDIO: Todos los controles en la misma vista
                    <div className="w-full flex items-center justify-between pl-2 pr-3 py-1.5 rounded-full bg-white/60 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] min-h-[36px]">
                      
                      {/* Controles de Audio Estilo Deck */}
                      <div className="flex items-center space-x-0.5">
                        {/* Papelera */}
                        <button
                          onClick={() => {
                            if (isRecording) {
                              cancelRecording();
                            } else {
                              clearAudio();
                              setIsPlayingPreview(false);
                            }
                          }}
                          className="aurora-neon-rose w-7 h-7 flex items-center justify-center bg-transparent text-gray-400 dark:text-gray-500 transition-all duration-300 active:scale-95"
                        >
                          <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        
                        {/* Pause */}
                        <button
                          onClick={() => {
                            if (isRecording && !isPaused) {
                              pauseRecording();
                            } else if (!isRecording && isPlayingPreview) {
                              previewAudioRef.current?.pause();
                              setIsPlayingPreview(false);
                            }
                          }}
                          className={`aurora-neon-amber w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(!isRecording && !isPlayingPreview) || (isRecording && isPaused) ? 'text-gray-500/30 cursor-default !filter-none' : 'text-gray-400 dark:text-gray-500'}`}
                          disabled={(!isRecording && !isPlayingPreview) || (isRecording && isPaused)}
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>

                        {/* Play */}
                        <button
                          onClick={() => {
                            if (isRecording && isPaused) {
                              resumeRecording();
                            } else if (!isRecording && audioBlob) {
                              previewAudioRef.current?.play();
                              setIsPlayingPreview(true);
                            }
                          }}
                          className={`aurora-neon-emerald w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(isRecording && !isPaused) ? 'text-gray-500/30 cursor-default !filter-none' : 'text-gray-400 dark:text-gray-500'}`}
                          disabled={isRecording && !isPaused}
                        >
                          <svg className="w-3.5 h-3.5 ml-[2px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>

                        {/* Stop */}
                        <button
                          onClick={() => {
                            if (isRecording) {
                              stopRecording();
                            } else if (isPlayingPreview && previewAudioRef.current) {
                              previewAudioRef.current.pause();
                              previewAudioRef.current.currentTime = 0;
                              setIsPlayingPreview(false);
                            }
                          }}
                          className={`aurora-neon-indigo w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(!isRecording && !isPlayingPreview) ? 'text-gray-500/30 cursor-default !filter-none' : 'text-gray-400 dark:text-gray-500'}`}
                          disabled={!isRecording && !isPlayingPreview}
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                        </button>
                      </div>
                      
                      <div className="flex flex-1 items-center justify-end space-x-2.5 mr-2">
                        <div className={`transition-all duration-300 rounded-full ${(!isRecording) ? 'w-0 h-0 opacity-0' : isPaused ? 'w-1.5 h-1.5 bg-white/40 shadow-none' : 'w-1.5 h-1.5 bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.7)] animate-pulse'}`}></div>
                        <div className={`px-2 py-[2px] flex items-center justify-center rounded-full transition-all duration-300 ${(isRecording || audioBlob) ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'bg-transparent'}`}>
                          <span className={`text-[12px] font-sans font-semibold tracking-wide tabular-nums leading-none ${(isRecording || audioBlob) ? 'text-black dark:text-black' : 'text-gray-500 dark:text-gray-500'}`}>
                            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Candado Efímero */}
                      {(!isRecording && audioBlob) && (
                        <button
                          type="button"
                          onClick={handleToggleEphemeral}
                          className={`flex-shrink-0 w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 focus:outline-none hover:scale-110 active:scale-95 ${
                            isEphemeral 
                              ? 'text-cyan-400 drop-shadow-[0_0_6px_currentColor]' 
                              : 'text-gray-400 dark:text-gray-500 hover:text-cyan-400 hover:drop-shadow-[0_0_6px_currentColor]'
                          }`}
                        >
                          {isEphemeral ? (
                            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2V9.5L9.5 10V8.5L12 7.5h1v7.5z" /></svg>
                          ) : (
                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" strokeWidth="2" strokeDasharray="3.5 3.5" />
                              <path d="M11 9.5L13 8.5v7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Botón dinámico enviar/micrófono */}
                <div className="flex items-center h-9">
                  {isRecording || audioBlob ? (
                    // El botón enviar se mantiene deshabilitado mientras grabas, hasta que des Stop (generando audioBlob)
                    <button
                      onClick={() => {
                        if (audioBlob && !isRecording) {
                          handleUploadVoiceNote(audioBlob);
                        }
                      }}
                      disabled={isUploadingAudio || isRecording}
                      className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 border-none outline-none ring-0 overflow-hidden ${
                        isRecording 
                          ? 'bg-gray-300 dark:bg-gray-700 text-white opacity-50 cursor-not-allowed' 
                          : 'bg-gradient-to-tr from-[#0A84FF] to-[#6E1CFF] text-white hover:scale-105 hover:shadow-lg hover:shadow-[#0A84FF]/30 active:scale-95'
                      }`}
                    >
                      {isUploadingAudio ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-[18px] h-[18px] -ml-[1px] -mt-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  ) : (newMessage?.trim() || pendingFile) ? (
                    <button
                      onClick={() => {
                        handleSendWithFile();
                      }}
                      disabled={false}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#0A84FF] to-[#6E1CFF] text-white disabled:opacity-40 disabled:scale-95 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg hover:shadow-[#0A84FF]/30 active:scale-95 transition-all duration-300 border-none outline-none ring-0 overflow-hidden"
                    >
                      <svg className="w-[18px] h-[18px] -ml-[1px] -mt-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => startRecording()}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-black/5 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/20 active:scale-95 transition-all duration-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Panel Unificado de Medios (Se despliega abajo y encoge la lista de mensajes) */}
            <div className={`emoji-picker-container flex-shrink-0 w-full bg-white/30 dark:bg-black/20 backdrop-blur-3xl border-white/20 dark:border-white/5 relative z-10 transition-all duration-300 ease-in-out overflow-hidden ${showMediaPicker ? 'h-[240px] border-t opacity-100' : 'h-0 border-t-0 opacity-0 pointer-events-none'}`}>
              <div className="h-[240px] w-full overflow-hidden">
                <UnifiedMediaPicker 
                  onSelectEmoji={(emoji) => {
                    insertEmoji(emoji);
                  }}
                  onSelectSticker={(url) => {
                    console.log('Sending sticker', url);
                    setShowMediaPicker(false);
                  }}
                  onSelectGif={(url) => {
                    console.log('Sending gif', url);
                    setShowMediaPicker(false);
                  }}
                  onClose={() => setShowMediaPicker(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Confirmación embebida dentro del área de contenido sin alterar layout externo */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pb-24">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowDeleteConfirm?.(null)} />
            <div className="relative w-full max-w-[320px] bg-white/70 dark:bg-[#1C1C1E]/60 backdrop-blur-3xl border border-white/50 dark:border-white/[0.08] rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-6 transform transition-all animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight">Eliminar conversación</h3>
                <button 
                  onClick={() => setShowDeleteConfirm?.(null)} 
                  className="p-1.5 -mt-1.5 -mr-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  aria-label="Cerrar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6 font-medium">¿Estás seguro de que quieres eliminar esta conversación?</p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm?.(null);
                  }}
                  className="flex-1 relative overflow-hidden px-4 py-2.5 text-[13px] font-semibold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white border-none shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]"
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
                  className="group flex-1 relative overflow-hidden px-4 py-2.5 text-[13px] font-semibold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none backdrop-blur-md shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)]"
                >
                  <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                  }}></div>
                  <span className="relative z-10 flex items-center justify-center">Eliminar</span>
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

      {/* Modales de Chat */}
      {showAddContactModal && (
        <AddAuroraContact 
          onClose={() => setShowAddContactModal(false)} 
          session={session} 
          onContactAdded={() => { /* Recargar contactos si es necesario */ }} 
        />
      )}
      
      {showSettingsModal && (
        <ChatSettingsModal 
          onClose={() => setShowSettingsModal(false)} 
          currentTheme={chatTheme}
          onThemeSelect={(theme) => setChatTheme(theme)}
        />
      )}
      
      {showGroupModal && (
        <AddParticipantModal
          onClose={() => setShowGroupModal(false)}
          availableUsers={availableUsers}
          currentParticipants={[]}
          onAdd={(userId) => {
            console.log('Crear grupo con', userId);
            setShowGroupModal(false);
          }}
        />
      )}

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

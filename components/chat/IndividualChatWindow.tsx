'use client';

import React, { useState, useEffect, useRef, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL, AIM_BOTTY_NAME } from '@/lib/chat/aim-botty';
import { renderElegantAvatar } from '@/lib/chat/user-avatar';
import ReplyPreview from './ReplyPreview';
import QuotedMessage from './QuotedMessage';
import ChatSettingsModal from './ChatSettingsModal';
import UnifiedMediaPicker from './UnifiedMediaPicker';
import StandardModal from '@/components/ui/StandardModal';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import VoiceMessagePlayer from './VoiceMessagePlayer';

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
  const [isDragging, setIsDragging] = useState(false); // Para mover la ventana
  const [isFileDragging, setIsFileDragging] = useState(false); // Para soltar archivos
  const [isMinimized, setIsMinimized] = useState(false);
  const [messageReadStatus, setMessageReadStatus] = useState<Record<string, 'sent' | 'delivered' | 'read'>>({});
  const [position, setPosition] = useState<{ x?: number; y?: number; right?: number }>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationIdRef = useRef<string | null>(null); // Para detectar cambios de conversación

  // Nuevos estados para Menú, Pickers y Modal
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [viewedEphemeralMessages, setViewedEphemeralMessages] = useState<Record<string, boolean>>({});
  const [activeEphemeralMedia, setActiveEphemeralMedia] = useState<string | null>(null);
  const [ephemeralCountdown, setEphemeralCountdown] = useState<number | null>(null);
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
    const actualUserId = userId || 'anonymous'; // Fallback
    
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
    
    // Actualización optimista local
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, metadata: newMetadata } : m));
    
    // Si es un chat simulado o real, actualizar en BD. Aquí asumimos que si hay Supabase se guarda:
    if (userId) {
      try {
        await supabase
          .from('chat_messages')
          .update({ metadata: newMetadata })
          .eq('id', message.id);
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

  // Archivos adjuntos
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
        
      // Llama a la lógica de envío de mensaje interna (que usa fetch directamente)
      if (session?.access_token && newMessage.trim() === '') {
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            content: publicUrl,
            message_type: 'text',
            media_url: publicUrl,
            is_ephemeral: isEphemeral,
            metadata: { is_voice_note: true },
            reply_to_message_id: replyTo ? replyTo.id : undefined
          })
        });
        const respData = await response.json();
        if (respData.success) {
          // Trigger reload
          setMessages(prev => [...prev, respData.message]);
        }
      }
    } catch (err) {
      console.error('Error subiendo nota de voz:', err);
    } finally {
      setIsUploadingAudio(false);
      clearAudio();
    }
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

  // Vanish Mode: Alternar y borrar
  const handleToggleEphemeral = async () => {
    if (isEphemeral) {
      // Activar animación blip-out
      const ephemeralElems = document.querySelectorAll('.message-ephemeral');
      ephemeralElems.forEach(el => el.classList.add('animate-blip-out'));
      
      setTimeout(async () => {
        setIsEphemeral(false);
        if (conversationId) {
          try {
            await fetch('/api/chat/messages/ephemeral/clear', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({ conversation_id: conversationId })
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

  // Enviar mensaje
  const sendMessage = async () => {
    console.log('📤 [IndividualChat] Intentando enviar mensaje:', {
      newMessage: newMessage.trim(),
      hasFile: !!pendingFile,
      conversationId,
      hasSession: !!session,
      sessionToken: session?.access_token ? 'Presente' : 'Ausente'
    });
    
    if ((!newMessage.trim() && !pendingFile) || !conversationId || !session) {
      console.log('❌ [IndividualChat] Validación fallida:', {
        hasMessage: !!newMessage.trim(),
        hasFile: !!pendingFile,
        hasConversationId: !!conversationId,
        hasSession: !!session
      });
      return;
    }
    
    try {
      console.log('🚀 [IndividualChat] Enviando mensaje a API...');
      setIsUploadingFile(true);
      let mediaUrl = null;
      let msgType = 'text';

      // Subir archivo si hay uno pendiente
      if (pendingFile) {
        const formData = new FormData();
        formData.append('file', pendingFile);
        formData.append('bucket', 'chat-attachments');
        
        const uploadRes = await fetch('/api/chat/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        });
        
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          mediaUrl = uploadData.publicUrl;
          msgType = pendingFile.type.startsWith('image/') ? 'image' : 'file';
        } else {
          throw new Error(uploadData.error || 'Error subiendo archivo');
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
          content: mediaUrl || newMessage.trim(), // Si es imagen, enviamos URL en content
          message_type: msgType,
          media_url: mediaUrl,
          reply_to_message_id: replyTo ? replyTo.id : undefined,
          is_ephemeral: isEphemeral,
          metadata: pendingFile ? { original_name: pendingFile.name, caption: newMessage.trim() } : undefined
        })
      });
      
      console.log('📡 [IndividualChat] Respuesta de API:', response.status, response.statusText);
      const data = await response.json();
      console.log('📋 [IndividualChat] Datos de respuesta:', data);
      
      if (data.success) {
        console.log('✅ [IndividualChat] Mensaje enviado exitosamente');
        
        // Limpiar estados
        setNewMessage('');
        setReplyTo(null);
        clearPendingFile();
        
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
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload: any) => {
          console.log('📨 [IndividualChat] Cambio de mensaje recibido:', payload);
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
      ref={windowRef}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
      className={`w-80 backdrop-blur-3xl border rounded-2xl flex flex-col z-[9996] overflow-hidden ${isInChatBar ? 'absolute' : 'fixed'} ${getThemeStyles()}`}
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
      {/* Dropzone Overlay */}
      {isFileDragging && !isMinimized && (
        <div className="absolute inset-0 z-[9999] pointer-events-none bg-white/60 dark:bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 animate-bounce border-2 border-blue-500/50">
            <svg className="w-10 h-10 text-blue-500 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white drop-shadow-md">Suelta tu archivo aquí</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 font-medium">Se adjuntará a la conversación</p>
        </div>
      )}

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
            </div>
          </div>
        )}
        <div className="flex items-center space-x-2 flex-shrink-0 relative">
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
              <button onClick={async () => {
                if (session && conversationId) {
                  setMessages([]);
                  setShowMenu(false);
                  try {
                    await fetch('/api/chat/conversations/action', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                      body: JSON.stringify({ action: 'clear_history', conversation_id: conversationId })
                    });
                  } catch (e) {
                    console.error('Error limpiando chat:', e);
                  }
                }
              }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Limpiar chat</button>
              <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Eliminar usuario</button>
            </div>
          )}

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
              className={`flex flex-col relative group w-full ${message.sender_id === userId ? 'items-end' : 'items-start'}`}
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

              {/* Main Bubble Container */}
              <div className="relative max-w-[85%] sm:max-w-[75%]">
                <div
                  onClick={() => setActiveMessageMenu(activeMessageMenu === message.id ? null : message.id)}
                  className={`relative cursor-pointer shadow-sm animate-fadeIn ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'message-ephemeral border-cyan-400 dark:border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]' : ''} ${
                    message.sender_id === userId
                      ? `px-3.5 py-2.5 rounded-2xl rounded-br-sm ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'bg-cyan-600/90 text-white border backdrop-blur' : getBubbleStyle((message.message_type === 'voice' || message.metadata?.is_voice_note) ? false : true)}`
                      : `px-3.5 py-2.5 rounded-2xl rounded-bl-sm ${message.metadata?.is_ephemeral || message.is_ephemeral ? 'bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 border backdrop-blur' : getBubbleStyle(false)}`
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
                      <p className="text-[15px] leading-snug tracking-tight mt-2">
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
                      <p className="text-[15px] leading-snug tracking-tight mt-2">
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
                    {(message.metadata?.is_ephemeral || message.is_ephemeral) && (
                      <span className={`text-[9px] font-bold uppercase mt-1 flex items-center ${message.sender_id === userId ? 'text-white/60' : 'text-gray-500'}`}>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        Efímero
                      </span>
                    )}
                  </div>
                )}
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
              <div className={`flex items-center gap-1 mt-1 mb-1 ${
                message.metadata?.reactions && Object.keys(message.metadata.reactions).length > 0 ? 'mt-3.5' : ''
              } ${message.sender_id === userId ? 'pr-1 justify-end' : 'pl-1 justify-start'}`}>
                
                {/* Action Buttons (Citar, Reenviar) */}
                {activeMessageMenu === message.id && (
                  <div className="flex items-center gap-1 animate-in fade-in duration-200 relative z-50">
                    <button onClick={(e) => { e.stopPropagation(); setReplyTo(message); setActiveMessageMenu(null); }} className="text-gray-400 hover:text-blue-500 transition-colors flex items-center">
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
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Input Section */}
      {!isMinimized && (
      <div className="px-2 pt-3 pb-1.5 sm:px-4 sm:pt-4 sm:pb-2 bg-white/40 dark:bg-black/40 backdrop-blur-md border-t border-white/20 dark:border-white/5 relative z-10 flex-shrink-0">
        {replyTo && (
          <ReplyPreview
            message={replyTo}
            onCancel={() => setReplyTo(null)}
          />
        )}

        <div className="flex items-center space-x-2">
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
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Mensaje"
                  className={`w-full block pl-10 ${pendingFile ? 'pr-[72px]' : 'pr-10'} py-1.5 rounded-full bg-white/60 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500/70 dark:placeholder-gray-400/70 border border-white/40 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white/90 dark:focus:bg-white/10 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-[15px] min-h-[36px] leading-[22px] tracking-tight transition-all`}
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
                    className="w-7 h-7 flex items-center justify-center bg-transparent text-gray-400 dark:text-gray-500 hover:text-fuchsia-400 hover:drop-shadow-[0_0_6px_currentColor] transition-all duration-300 active:scale-95"
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
                    className={`w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(!isRecording && !isPlayingPreview) || (isRecording && isPaused) ? 'text-gray-500/30 cursor-default' : 'text-gray-400 dark:text-gray-500 hover:text-cyan-400 hover:drop-shadow-[0_0_6px_currentColor]'}`}
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
                    className={`w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(isRecording && !isPaused) ? 'text-gray-500/30 cursor-default' : 'text-gray-400 dark:text-gray-500 hover:text-cyan-400 hover:drop-shadow-[0_0_6px_currentColor]'}`}
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
                    className={`w-7 h-7 flex items-center justify-center bg-transparent transition-all duration-300 active:scale-95 ${(!isRecording && !isPlayingPreview) ? 'text-gray-500/30 cursor-default' : 'text-gray-400 dark:text-gray-500 hover:text-purple-400 hover:drop-shadow-[0_0_6px_currentColor]'}`}
                    disabled={!isRecording && !isPlayingPreview}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                  </button>
                </div>
                
                <div className="flex flex-1 items-center justify-end space-x-2.5 mr-2">
                  <div className={`transition-all duration-300 rounded-full ${(!isRecording) ? 'w-0 h-0 opacity-0' : isPaused ? 'w-1.5 h-1.5 bg-white/40 shadow-none' : 'w-1.5 h-1.5 bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.7)] animate-pulse'}`}></div>
                  <span className={`text-[13px] font-mono tracking-widest tabular-nums slashed-zero font-semibold ${!isRecording || isPaused ? 'text-gray-500 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]'}`}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
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
            ) : (newMessage.trim() || pendingFile) ? (
              <button
                onClick={() => {
                  sendMessage();
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
      )}

      {/* Panel Unificado de Medios (Se despliega abajo y encoge la lista de mensajes) */}
      <div className={`emoji-picker-container flex-shrink-0 w-full bg-white/30 dark:bg-black/20 backdrop-blur-3xl border-white/20 dark:border-white/5 relative z-10 transition-all duration-300 ease-in-out overflow-hidden ${showMediaPicker ? 'h-[240px] border-t opacity-100' : 'h-0 border-t-0 opacity-0 pointer-events-none'}`}>
        <div className="h-[240px] w-full overflow-hidden">
          <UnifiedMediaPicker 
            onSelectEmoji={(emoji) => {
              setNewMessage(prev => prev + emoji);
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
      
      {showSettingsModal && (
        <ChatSettingsModal 
          onClose={() => setShowSettingsModal(false)} 
          currentTheme={chatTheme}
          onThemeSelect={(theme) => setChatTheme(theme)}
        />
      )}
    </div>
  );
}

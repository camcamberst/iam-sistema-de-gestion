'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ConversationTab from './ConversationTab';

interface Conversation {
  id: string;
  modelId: string;
  modelName: string;
  modelEmail: string;
  isMinimized: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: Date;
  isActive: boolean;
  position: { x: number; y: number };
}

interface ConversationTabsProps {
  userId?: string;
  userRole?: string;
}

export default function ConversationTabs({ userId, userRole }: ConversationTabsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [nextPosition, setNextPosition] = useState({ x: 20, y: 20 });

  const computePositionLeftOfMainChat = (): { x: number; y: number } => {
    try {
      // Dimensiones del Chat principal (w-72 ≈ 288px) y de la pestaña (mismas dimensiones)
      const chatWidth = 288; // px
      const tabWidth = 288; // px (w-72)
      const tabHeight = 500; // px (h-[500px])
      const margin = 16; // separación desde el borde derecho
      const gap = 12; // separación entre pestaña y chat principal

      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

      const x = Math.max(8, viewportWidth - (chatWidth + tabWidth + margin + gap));
      const y = Math.max(8, viewportHeight - (tabHeight + margin));
      return { x, y };
    } catch {
      return { x: 20, y: 20 };
    }
  };

  // Cargar conversaciones desde localStorage al montar
  useEffect(() => {
    const savedConversations = localStorage.getItem('conversation-tabs');
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        setConversations(parsed.map((conv: any) => ({
          ...conv,
          lastMessageTime: new Date(conv.lastMessageTime)
        })));
      } catch (error) {
        console.warn('Error loading saved conversations:', error);
      }
    }
  }, []);

  // Guardar conversaciones en localStorage cuando cambien
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversation-tabs', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Función para abrir nueva conversación
  const openConversation = (modelId: string, modelName: string, modelEmail: string) => {
    // Verificar si ya existe una conversación con este modelo
    const existingConversation = conversations.find(conv => conv.modelId === modelId);
    
    if (existingConversation) {
      // Si existe, activarla y desminimizarla
      setConversations(prev => prev.map(conv => 
        conv.modelId === modelId 
          ? { ...conv, isActive: true, isMinimized: false }
          : { ...conv, isActive: false }
      ));
    } else {
      // Crear nueva conversación
      const initialPosition = computePositionLeftOfMainChat();
      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        modelId,
        modelName,
        modelEmail,
        isMinimized: false,
        unreadCount: 0,
        lastMessage: '',
        lastMessageTime: new Date(),
        isActive: true,
        position: { ...initialPosition }
      };

      setConversations(prev => [
        ...prev.map(conv => ({ ...conv, isActive: false })),
        newConversation
      ]);

      // Mantener siempre al lado del chat (sin cascada)
      setNextPosition(initialPosition);
    }
  };

  // Función para cerrar conversación
  const closeConversation = (conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
  };

  // Función para minimizar/maximizar conversación
  const toggleMinimize = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, isMinimized: !conv.isMinimized }
        : conv
    ));
  };

  // Función para actualizar posición de pestaña
  const updatePosition = (conversationId: string, position: { x: number; y: number }) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, position }
        : conv
    ));
  };

  // Función para activar conversación
  const activateConversation = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, isActive: true, isMinimized: false }
        : { ...conv, isActive: false }
    ));
  };

  // Función para actualizar mensaje
  const updateLastMessage = (conversationId: string, message: string, isFromModel: boolean = false) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          lastMessage: message,
          lastMessageTime: new Date(),
          unreadCount: isFromModel && !conv.isActive ? conv.unreadCount + 1 : conv.unreadCount
        };
      }
      return conv;
    }));
  };

  // Función para limpiar mensajes no leídos
  const clearUnreadCount = (conversationId: string) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, unreadCount: 0 }
        : conv
    ));
  };

  // Exponer funciones globalmente para que el ChatWidget las pueda usar
  useEffect(() => {
    console.log('🔧 [CONVERSATION-TABS] Exponiendo funciones globales...');
    (window as any).openConversation = openConversation;
    (window as any).updateLastMessage = updateLastMessage;
    (window as any).clearUnreadCount = clearUnreadCount;
    console.log('✅ [CONVERSATION-TABS] Funciones expuestas:', {
      openConversation: typeof (window as any).openConversation,
      updateLastMessage: typeof (window as any).updateLastMessage,
      clearUnreadCount: typeof (window as any).clearUnreadCount
    });
  }, [openConversation, updateLastMessage, clearUnreadCount]);

  // Mostrar para admin, super_admin y modelos
  const role = userRole?.toString();
  if (role !== 'admin' && role !== 'super_admin' && role !== 'modelo') {
    return null;
  }

  return (
    <>
      {conversations.map((conversation) => (
        <ConversationTab
          key={conversation.id}
          conversation={conversation}
          userId={userId}
          userRole={userRole}
          onClose={() => closeConversation(conversation.id)}
          onMinimize={() => toggleMinimize(conversation.id)}
          onActivate={() => activateConversation(conversation.id)}
          onUpdatePosition={(position) => updatePosition(conversation.id, position)}
          onClearUnread={() => clearUnreadCount(conversation.id)}
        />
      ))}
    </>
  );
}

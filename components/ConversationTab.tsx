'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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

interface ConversationTabProps {
  conversation: Conversation;
  userId?: string;
  userRole?: string;
  onClose: () => void;
  onMinimize: () => void;
  onActivate: () => void;
  onUpdatePosition: (position: { x: number; y: number }) => void;
  onClearUnread: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'model';
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

export default function ConversationTab({
  conversation,
  userId,
  userRole,
  onClose,
  onMinimize,
  onActivate,
  onUpdatePosition,
  onClearUnread
}: ConversationTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isOnline, setIsOnline] = useState(false);
  const [sending, setSending] = useState(false);
  
  const tabRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history
  useEffect(() => {
    if (conversation.isActive && !conversation.isMinimized) {
      loadConversationHistory();
      onClearUnread();
    }
  }, [conversation.isActive, conversation.isMinimized]);

  // Check if model is online (simplified - you can enhance this)
  useEffect(() => {
    const checkOnlineStatus = () => {
      // For now, we'll assume models are online
      // You can implement real online status checking here
      setIsOnline(true);
    };
    
    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [conversation.modelId]);

  const loadConversationHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .or(`sender_id.eq.${conversation.modelId},recipient_id.eq.${conversation.modelId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const conversationMessages: Message[] = (data || []).map(msg => ({
        id: msg.id,
        sender: msg.sender_id === userId ? 'user' : 'model',
        message: msg.message,
        timestamp: new Date(msg.created_at),
        isRead: msg.is_read
      }));

      setMessages(conversationMessages);
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Send message via API
      const response = await fetch('/api/chat/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          target: 'user',
          userId: conversation.modelId,
          text: inputMessage.trim(),
          isBroadcast: false
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to send message');

      // Add message to local state
      const newMessage: Message = {
        id: `temp-${Date.now()}`,
        sender: 'user',
        message: inputMessage.trim(),
        timestamp: new Date(),
        isRead: true
      };

      setMessages(prev => [...prev, newMessage]);
      setInputMessage('');

      // Update last message in parent
      if ((window as any).updateLastMessage) {
        (window as any).updateLastMessage(conversation.id, inputMessage.trim());
      }

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      const rect = tabRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      };
      onUpdatePosition(newPosition);
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (conversation.isMinimized) {
    return (
      <div
        ref={tabRef}
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg cursor-pointer hover:bg-gray-700 transition-colors z-50"
        style={{
          left: conversation.position.x,
          top: conversation.position.y,
          width: '200px'
        }}
        onClick={onActivate}
      >
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {getInitials(conversation.modelName)}
              </div>
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {conversation.modelName}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {conversation.lastMessage || 'Nueva conversación'}
              </p>
            </div>
          </div>
          {conversation.unreadCount > 0 && (
            <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {conversation.unreadCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={tabRef}
      className="fixed bg-gray-900 border border-gray-600 rounded-lg shadow-xl z-50 flex flex-col"
      style={{
        left: conversation.position.x,
        top: conversation.position.y,
        width: '350px',
        height: '500px'
      }}
    >
      {/* Header */}
      <div 
        className="bg-gray-800 border-b border-gray-600 rounded-t-lg p-3 cursor-move drag-handle"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {getInitials(conversation.modelName)}
              </div>
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full"></div>
              )}
            </div>
            <div>
              <h3 className="text-white font-medium">{conversation.modelName}</h3>
              <p className="text-xs text-gray-400">{conversation.modelEmail}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onMinimize}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>Inicia una conversación con {conversation.modelName}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <p className="text-sm">{message.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-600 p-3">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || sending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { SecurityFilter } from './SecurityFilter';

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'admin';
  message: string;
  timestamp: Date;
  isRead?: boolean;
}

interface ChatWidgetProps {
  userId: string;
  userRole: string;
}

export default function ChatWidget({ userId, userRole }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTicketConfirm, setShowTicketConfirm] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history when widget opens
  useEffect(() => {
    if (isOpen && sessionId) {
      loadChatHistory();
    }
  }, [isOpen, sessionId]);

  const loadChatHistory = async () => {
    if (!sessionId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: chatMessages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }

      const formattedMessages: Message[] = chatMessages.map(msg => ({
        id: msg.id,
        sender: msg.sender_type,
        message: msg.message,
        timestamp: new Date(msg.created_at),
        isRead: msg.is_read
      }));

      setMessages(formattedMessages);
      setMessageCount(formattedMessages.filter(m => m.sender === 'user').length);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || limitReached) return;

    // VERSIÓN ULTRA-SEGURA: Filtrar mensaje antes de enviar
    const originalMessage = inputMessage.trim();
    const sanitizedMessage = SecurityFilter.sanitizeMessage(originalMessage);
    
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately (mostrar mensaje filtrado)
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      message: sanitizedMessage, // Mostrar mensaje filtrado
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setMessageCount(prev => prev + 1);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: sanitizedMessage, // Enviar mensaje filtrado
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.limitReached) {
          setLimitReached(true);
          setError(data.error);
          return;
        }
        throw new Error(data.error || 'Error al enviar mensaje');
      }

      // Update session ID if it's new
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        message: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);

      // VERSIÓN ULTRA-SEGURA: No hay escalación automática
      // if (data.escalated) {
      //   setEscalated(true);
      //   const escalationMessage: Message = {
      //     id: (Date.now() + 2).toString(),
      //     sender: 'bot',
      //     message: "✅ Tu consulta ha sido escalada a un administrador. Te contactarán pronto.",
      //     timestamp: new Date()
      //   };
      //   setMessages(prev => [...prev, escalationMessage]);
      // }

      // VERSIÓN ULTRA-SEGURA: Mostrar indicador de seguridad
      if (data.securityLevel === 'ULTRA_SAFE') {
        console.log('Chat usando versión ultra-segura - datos protegidos');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Error al enviar mensaje. Por favor intenta de nuevo.');
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
      setMessageCount(prev => prev - 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Acciones rápidas (chips)
  const quickActions = (() => {
    const base = [
      { id: 'anticipos', label: 'Mis Anticipos', payload: 'mis anticipos' },
      { id: 'calculadora', label: 'Mi Calculadora', payload: 'totales de mi calculadora' }
    ];
    if (userRole === 'admin' || userRole === 'super_admin') {
      base.push({ id: 'resumen', label: 'Resumen Administrativo', payload: 'resumen de facturación' });
    }
    base.push({ id: 'ticket', label: 'Crear Ticket', payload: 'crear ticket' });
    return base;
  })();

  const handleQuickAction = async (actionId: string) => {
    if (actionId === 'ticket') {
      setShowTicketConfirm(true);
      return;
    }
    const qa = quickActions.find(a => a.id === actionId);
    if (!qa) return;
    setInputMessage(qa.payload);
    await sendMessage();
  };

  const createTicket = async () => {
    try {
      setCreatingTicket(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const description = inputMessage.trim() || 'Solicitud de soporte desde el ChatBot';
      const res = await fetch('/api/chat/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: 'Ticket de soporte', description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el ticket');

      setShowTicketConfirm(false);
      setInputMessage('');
      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        sender: 'bot',
        message: `Listo. He creado el ticket #${data?.ticket?.id || ''}. Un administrador te contactará pronto.`,
        timestamp: new Date()
      } as any;
      setMessages(prev => [...prev, botMessage]);
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getSenderName = (sender: string) => {
    switch (sender) {
      case 'user': return 'Tú';
      case 'bot': return 'AIM Assistant';
      case 'admin': return 'Administrador';
      default: return sender;
    }
  };

  const getSenderColor = (sender: string) => {
    switch (sender) {
      case 'user': return 'bg-gray-600';
      case 'bot': return 'bg-gray-700';
      case 'admin': return 'bg-gray-800';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      {/* Chat Button - Estilo AIM */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-10 h-10 hover:w-14 hover:h-14 bg-gray-900 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center group"
          aria-label="Abrir chat de soporte"
        >
          <span className="text-xs font-bold opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">AIM</span>
          <span className="absolute text-xs font-bold opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-75 transition-all duration-300">A</span>
        </button>
      )}

      {/* Chat Window - Estilo escala de grises */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-80 h-[400px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold">AIM</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm">AIM Assistant</h3>
                <p className="text-xs text-gray-300">Soporte y tips</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-300 text-sm py-6">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-white">AIM</span>
                </div>
                <p>¡Hola! Soy tu asistente virtual.</p>
                <p className="text-xs mt-1 text-gray-400">Puedo ayudarte con tips, soporte técnico y más.</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`flex items-end space-x-2 ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${getSenderColor(message.sender)}`}>
                      {message.sender === 'user' ? 'T' : message.sender === 'bot' ? 'A' : 'A'}
                    </div>
                    <div className={`rounded-2xl px-3 py-2 ${
                      message.sender === 'user' 
                        ? 'bg-gray-700 text-white' 
                        : 'bg-gray-800 text-gray-200'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender === 'user' ? 'text-gray-300' : 'text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs">
                    A
                  </div>
                  <div className="bg-gray-800 rounded-2xl px-3 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {limitReached && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-yellow-400 text-sm">
                <p className="font-medium">Límite alcanzado</p>
                <p className="text-xs mt-1 text-gray-300">Has alcanzado el límite de mensajes. Tu sesión se reiniciará en unos minutos.</p>
              </div>
            )}

            {escalated && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 text-green-400 text-sm">
                <p className="font-medium">✅ Escalado a administrador</p>
                <p className="text-xs mt-1 text-gray-300">Un administrador te contactará pronto para ayudarte.</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="border-t border-gray-800 bg-gray-900 px-3 py-2 flex flex-wrap gap-2">
            {quickActions.map(a => (
              <button key={a.id} onClick={() => handleQuickAction(a.id)} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors">
                {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-700 p-3 bg-gray-800">
            <div className="flex space-x-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                className="flex-1 resize-none border border-gray-600 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent placeholder-gray-400"
                rows={2}
                disabled={isLoading || limitReached}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading || limitReached}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Message counter */}
            <div className="text-xs text-gray-400 mt-2 text-center">
              {messageCount}/20 mensajes • Sesión activa
            </div>
          </div>
        </div>
      )}

      {/* Confirmación crear ticket */}
      {showTicketConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-[320px] p-4">
            <h4 className="text-sm font-semibold text-gray-900">Crear ticket de soporte</h4>
            <p className="text-xs text-gray-600 mt-1">¿Confirmas crear un ticket con tu descripción actual?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowTicketConfirm(false)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
              <button onClick={createTicket} disabled={creatingTicket} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
                {creatingTicket ? 'Creando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

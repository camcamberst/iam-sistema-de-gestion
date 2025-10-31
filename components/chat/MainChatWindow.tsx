'use client';

import React, { useEffect, useRef } from 'react';
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

  // Auto-scroll al final para continuidad de conversación
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    try {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    } catch {}
  };

  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom(false);
    }
  }, [view, selectedConversation]);

  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom(true);
    }
  }, [messages]);

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
        <div className="flex items-center space-x-3 min-w-0">
          {activeUser ? (
            <>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xs tracking-wider">
                  {getDisplayName?.(activeUser)?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
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
              <div className="w-8 h-8 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30">
                <span className="text-white dark:text-gray-900 font-bold text-xs tracking-wider">AIM</span>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">AIM Assistant</p>
                <p className="text-gray-400 text-xs">Soporte y tips</p>
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex mb-4 ${message.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      message.sender_id === userId
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs text-gray-300">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Doble check: solo mostrar en mensajes propios */}
                      {message.sender_id === userId && (
                        <span className={`text-xs ${message.is_read_by_other ? 'text-blue-300' : 'text-gray-400'}`}>
                          {message.is_read_by_other ? (
                            // Visto (doble check azul)
                            <span title="Visto">✓✓</span>
                          ) : (
                            // Entregado (doble check gris)
                            <span title="Entregado">✓✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensaje */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage?.(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
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

'use client';

import React from 'react';

interface MainChatWindowProps {
  onClose: () => void;
  userId?: string;
  userRole?: string;
  session?: any;
  windowIndex?: number;
  // Props para la funcionalidad del chat
  view?: string;
  setView?: (view: string) => void;
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
  getDisplayName = (user) => user.name || user.email
}) => {
  const windowWidth = 320; // w-80 = 320px
  const margin = 8; // Margen entre ventanas en la barra
  const rightOffset = 24; // right-6 = 24px (igual que la ventana principal)

  // Calcular posición desde la derecha (ventana principal siempre en la posición más a la derecha)
  const finalRight = rightOffset;

  return (
    <div
      className="w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-[9996] fixed"
      style={{
        right: `${finalRight}px`,
        bottom: '0px',
        cursor: 'default',
        maxHeight: 'calc(100vh - 20px)', // Altura máxima respetando márgenes
        height: '500px' // Altura fija
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 rounded-t-lg cursor-default">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30">
            <span className="text-white dark:text-gray-900 font-bold text-xs tracking-wider">
              AIM
            </span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">AIM Assistant</p>
            <p className="text-gray-400 text-xs">Soporte y tips</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Pestañas de navegación */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setView?.('users')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            view === 'users'
              ? 'text-white bg-gray-700 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          Usuarios disponibles
        </button>
        <button
          onClick={() => setView?.('conversations')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            view === 'conversations'
              ? 'text-white bg-gray-700 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          Conversaciones ({conversations.length})
        </button>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                            <p className="text-xs text-gray-400">{user.role}</p>
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
                            <p className="text-xs text-gray-400">{user.role}</p>
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
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-center">No hay conversaciones activas</p>
                    <p className="text-xs text-center mt-1">Los mensajes aparecerán aquí cuando inicies una conversación</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      setSelectedConversation?.(conversation.id);
                      setView?.('chat');
                    }}
                    className={`flex items-center w-full p-2 text-left rounded-lg transition-colors ${
                      selectedConversation === conversation.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white text-xs font-bold">
                        {getDisplayName(conversation.other_participant).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getDisplayName(conversation.other_participant)}</p>
                      <p className="text-xs text-gray-400 truncate">{conversation.last_message?.content || 'Sin mensajes'}</p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {conversation.unread_count}
                      </div>
                    )}
                  </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {view === 'chat' && selectedConversation && (
          <>
            {/* Mensajes */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar min-h-0">
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
                    <span className="text-xs text-gray-300 block text-right mt-1">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
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

        {/* Modal de confirmación para eliminar conversación */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-white text-lg font-semibold mb-4">Eliminar conversación</h3>
              <p className="text-gray-300 mb-6">
                ¿Estás seguro de que quieres eliminar esta conversación? Esta acción no se puede deshacer.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm?.(null)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteConversation?.(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainChatWindow;

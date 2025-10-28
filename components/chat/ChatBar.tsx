'use client';

import React from 'react';
import IndividualChatWindow from './IndividualChatWindow';
import MainChatWindow from './MainChatWindow';

interface ChatWindow {
  id: string;
  conversationId: string;
  otherUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface ChatBarProps {
  openChatWindows: ChatWindow[];
  onCloseWindow: (windowId: string) => void;
  userId?: string;
  userRole?: string;
  session?: any;
  isMainChatOpen?: boolean; // Nueva prop para la ventana principal
  onCloseMainChat?: () => void; // Nueva prop para cerrar la ventana principal
  // Props para la funcionalidad del chat principal
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

const ChatBar: React.FC<ChatBarProps> = ({
  openChatWindows,
  onCloseWindow,
  userId,
  userRole,
  session,
  isMainChatOpen = false,
  onCloseMainChat,
  view,
  setView,
  availableUsers = [],
  expandedSections = { online: true, offline: false },
  setExpandedSections,
  openChatWithUser,
  conversations,
  selectedConversation,
  setSelectedConversation,
  messages,
  newMessage,
  setNewMessage,
  sendMessage,
  handleKeyPress,
  showDeleteConfirm,
  setShowDeleteConfirm,
  deleteConversation,
  tempChatUser,
  getDisplayName
}) => {
  // Solo mostrar la barra si hay ventanas abiertas o la ventana principal está abierta
  if (openChatWindows.length === 0 && !isMainChatOpen) {
    return null;
  }

  return (
    <>
      {/* Ventana principal del AIM Assistant */}
      {isMainChatOpen && (
        <MainChatWindow
          onClose={onCloseMainChat!}
          userId={userId}
          userRole={userRole}
          session={session}
          windowIndex={-1} // Ventana principal siempre en la posición más a la derecha
          view={view}
          setView={setView}
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
      )}
      
      {/* Ventanas individuales de chat posicionadas absolutamente */}
      {openChatWindows.map((window, index) => (
        <IndividualChatWindow
          key={window.id}
          conversationId={window.conversationId}
          otherUser={window.otherUser}
          onClose={() => onCloseWindow(window.id)}
          userId={userId}
          userRole={userRole}
          session={session}
          windowIndex={index}
          isInChatBar={true}
        />
      ))}
    </>
  );
};

export default ChatBar;

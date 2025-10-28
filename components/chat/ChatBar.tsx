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
}

const ChatBar: React.FC<ChatBarProps> = ({
  openChatWindows,
  onCloseWindow,
  userId,
  userRole,
  session,
  isMainChatOpen = false,
  onCloseMainChat
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

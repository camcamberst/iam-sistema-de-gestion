'use client';

import React from 'react';
import IndividualChatWindow from './IndividualChatWindow';

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
}

const ChatBar: React.FC<ChatBarProps> = ({
  openChatWindows,
  onCloseWindow,
  userId,
  userRole,
  session
}) => {
  // Solo mostrar la barra si hay ventanas abiertas
  if (openChatWindows.length === 0) {
    return null;
  }

  return (
    <>
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

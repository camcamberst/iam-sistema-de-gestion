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
  userId: string;
  userRole: string;
  session: any;
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
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-[9997]">
      {/* Barra de chat */}
      <div className="flex items-center justify-start p-2 space-x-2 overflow-x-auto">
        {/* Ventanas individuales de chat */}
        {openChatWindows.map((window, index) => (
          <div key={window.id} className="flex-shrink-0">
            <IndividualChatWindow
              conversationId={window.conversationId}
              otherUser={window.otherUser}
              onClose={() => onCloseWindow(window.id)}
              userId={userId}
              userRole={userRole}
              session={session}
              windowIndex={index}
              isInChatBar={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatBar;

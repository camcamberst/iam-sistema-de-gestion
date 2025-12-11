'use client';

import React from 'react';

interface QuotedMessageProps {
  message: {
    id: string;
    content: string;
    sender?: {
      name?: string;
    };
  };
  isOwnMessage?: boolean;
}

const QuotedMessage: React.FC<QuotedMessageProps> = ({ message, isOwnMessage = false }) => {
  const senderName = message.sender?.name || 'Usuario';
  const previewContent = message.content.length > 100 
    ? message.content.substring(0, 100) + '...' 
    : message.content;

  return (
    <div className={`mt-1 mb-2 p-2 rounded border-l-4 ${
      isOwnMessage 
        ? 'bg-blue-500/20 border-blue-400' 
        : 'bg-gray-700/50 border-gray-500'
    }`}>
      <p className="text-xs font-medium mb-1 text-gray-400">{senderName}</p>
      <p className="text-xs text-gray-300 line-clamp-2">{previewContent}</p>
    </div>
  );
};

export default QuotedMessage;


'use client';

import React from 'react';

interface ReplyPreviewProps {
  message: {
    id: string;
    content: string;
    sender?: {
      name?: string;
    };
  };
  onCancel: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel }) => {
  const senderName = message.sender?.name || 'Usuario';
  const previewContent = message.content.length > 50 
    ? message.content.substring(0, 50) + '...' 
    : message.content;

  return (
    <div className="flex items-start gap-2 p-2 bg-gray-700/50 border-l-4 border-blue-500 rounded mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-blue-400 font-medium mb-1">{senderName}</p>
        <p className="text-sm text-gray-300 truncate">{previewContent}</p>
      </div>
      <button
        onClick={onCancel}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        aria-label="Cancelar respuesta"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default ReplyPreview;


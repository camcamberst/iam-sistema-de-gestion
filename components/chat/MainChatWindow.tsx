'use client';

import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface MainChatWindowProps {
  onClose: () => void;
  userId?: string;
  userRole?: string;
  session?: any;
  windowIndex?: number;
}

const MainChatWindow: React.FC<MainChatWindowProps> = ({
  onClose,
  userId,
  userRole,
  session,
  windowIndex = 0
}) => {
  const windowWidth = 320; // w-80 = 320px
  const margin = 8; // Margen entre ventanas en la barra
  const rightOffset = 24; // right-6 = 24px (igual que la ventana principal)

  // Calcular posición desde la derecha (ventana principal siempre en la posición más a la derecha)
  const finalRight = rightOffset;

  return (
    <div
      className="w-80 h-[500px] bg-gray-800 border border-gray-700 rounded-lg shadow-2xl flex flex-col z-[9996] fixed"
      style={{
        right: `${finalRight}px`,
        bottom: '0px',
        cursor: 'default'
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
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Content placeholder - aquí iría el contenido del chat principal */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <div className="text-center text-gray-400">
          <p>Contenido del AIM Assistant</p>
          <p className="text-xs mt-2">Esta es la ventana principal del chat</p>
        </div>
      </div>
    </div>
  );
};

export default MainChatWindow;

'use client';

import React, { useState } from 'react';
import QRCode from 'react-qr-code';

interface AuroraPinDisplayProps {
  pin: string | null;
  onAddContact?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

export default function AuroraPinDisplay({ pin, onAddContact, onExpandChange }: AuroraPinDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = (expanded: boolean) => {
    setIsExpanded(expanded);
    if (onExpandChange) onExpandChange(expanded);
  };

  if (!pin) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQRClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQR(!showQR);
  };

  return (
    <div className="relative flex items-center justify-end">
      {/* Botón contraído */}
      <button 
        onClick={() => toggleExpand(true)}
        className={`absolute right-0 w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center shadow-sm group transition-all duration-500 ${isExpanded ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
       
      >
        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
      </button>

      {/* Contenedor expandido */}
      <div className={`flex items-center justify-end transition-all duration-500 ease-out origin-right overflow-hidden ${isExpanded ? 'opacity-100 translate-x-0 max-w-[300px]' : 'opacity-0 translate-x-8 max-w-0 pointer-events-none'}`}>
        <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-1 px-2.5 backdrop-blur-sm relative shadow-sm flex-shrink-0">
          
          <div className="flex items-center relative z-10 gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); toggleExpand(false); setShowQR(false); }}
          className="p-1 -ml-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
         
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <span className="text-[13px] font-semibold text-gray-900 dark:text-white mx-1 leading-none pt-0.5">
          {pin}
        </span>
        <button 
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
         
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          )}
        </button>
        
        <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-0.5"></div>
        
        <button
          onClick={handleQRClick}
          className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
         
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
          </svg>
        </button>

        {onAddContact && (
          <>
            <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-0.5"></div>
            <button
              onClick={(e) => { e.stopPropagation(); onAddContact(); }}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
             
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            </button>
          </>
        )}
      </div>
        </div>
      </div>

      {showQR && (
        <div className="absolute top-12 right-0 flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-xl z-50">
          <QRCode value={pin} size={120} />
          <p className="text-xs text-gray-500 mt-2 text-center">Escanea para agregarme</p>
        </div>
      )}
    </div>
  );
}

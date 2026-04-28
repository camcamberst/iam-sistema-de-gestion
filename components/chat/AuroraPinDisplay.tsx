'use client';

import React, { useState } from 'react';
import QRCode from 'react-qr-code';

interface AuroraPinDisplayProps {
  pin: string | null;
}

export default function AuroraPinDisplay({ pin }: AuroraPinDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  if (!pin) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-1 px-2.5 backdrop-blur-sm relative overflow-hidden shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 pointer-events-none"></div>
      
      <div className="flex items-center relative z-10 gap-2">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider translate-y-[0.5px]">Aurora PIN</span>
        <span className="text-sm font-mono font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          {pin}
        </span>
        <button 
          onClick={handleCopy}
          className="text-gray-400 hover:text-indigo-500 transition-colors"
          title="Copiar PIN"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          )}
        </button>
        
        <div className="w-px h-3 bg-black/10 dark:bg-white/10 mx-0.5"></div>
        
        <button
          onClick={() => setShowQR(!showQR)}
          className="p-1 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors shadow-sm text-gray-600 dark:text-gray-300"
          title="Mostrar QR"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
          </svg>
        </button>
      </div>

      {showQR && (
        <div className="mt-4 flex flex-col items-center justify-center p-4 bg-white rounded-lg">
          <QRCode value={pin} size={120} />
          <p className="text-xs text-gray-500 mt-2 text-center">Escanea para agregarme</p>
        </div>
      )}
    </div>
  );
}

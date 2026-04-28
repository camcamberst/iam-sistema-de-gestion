'use client';

import React, { useState } from 'react';
import { renderElegantAvatar } from '@/lib/chat/user-avatar';

interface AddAuroraContactProps {
  onClose: () => void;
  session: any;
  onContactAdded: () => void;
}

export default function AddAuroraContact({ onClose, session, onContactAdded }: AddAuroraContactProps) {
  const [pin, setPin] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSearch = async () => {
    if (pin.length !== 8) {
      setError('El PIN debe tener exactamente 8 caracteres.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResult(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/chat/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'search', payload: { pin: pin.toUpperCase() } })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Usuario no encontrado.');
      } else {
        setSearchResult(data.user);
      }
    } catch (err) {
      setError('Error al buscar el PIN.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'request', payload: { contactId: searchResult.id } })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'No se pudo enviar la solicitud.');
      } else {
        setSuccess('Solicitud de contacto enviada exitosamente.');
        setSearchResult(null);
        setPin('');
        setTimeout(() => {
          onContactAdded();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError('Error al enviar la solicitud.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Agregar Contacto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Ingresa el Aurora PIN (8 caracteres) del usuario que deseas agregar a tus contactos.
          </p>

          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="Ej. A4F9B2C1"
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-center font-mono text-lg font-bold tracking-widest text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
              maxLength={8}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={pin.length !== 8 || isSearching}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors mb-4 flex justify-center items-center"
          >
            {isSearching ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Buscar PIN'}
          </button>

          {error && <p className="text-sm text-red-500 text-center mb-4">{error}</p>}
          {success && <p className="text-sm text-green-500 text-center mb-4">{success}</p>}

          {searchResult && (
            <div className="mt-4 p-4 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center space-x-3 mb-4">
                {renderElegantAvatar(searchResult, 'medium')}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate" title={searchResult.name}>{searchResult.name}</p>
                </div>
              </div>
              <button
                onClick={handleSendRequest}
                disabled={isSending}
                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors flex justify-center items-center"
              >
                {isSending ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

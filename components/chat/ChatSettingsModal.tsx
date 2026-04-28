'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';

interface ChatSettingsModalProps {
  onClose: () => void;
  currentTheme: string;
  onThemeSelect: (theme: string) => void;
}

const THEMES = [
  {
    id: 'default',
    name: 'Clásico (Glassmorphism)',
    description: 'El estilo translúcido adaptativo original.',
    previewColors: ['bg-white/80 dark:bg-gray-900/60', 'bg-blue-500'],
  },
  {
    id: 'boreal',
    name: 'Aurora Boreal',
    description: 'Tonos oscuros con vibras neón esmeralda.',
    previewColors: ['bg-emerald-950 border-emerald-500', 'bg-emerald-500'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Apple',
    description: 'Negro profundo y minimalista. Máximo contraste.',
    previewColors: ['bg-black border-gray-800', 'bg-indigo-600'],
  },
  {
    id: 'pastel',
    name: 'Pastel Sunrise',
    description: 'Cálido y suave. Tonos melocotón y rosados.',
    previewColors: ['bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-900', 'bg-rose-400'],
  }
];

export default function ChatSettingsModal({ onClose, currentTheme, onThemeSelect }: ChatSettingsModalProps) {
  const [selected, setSelected] = useState(currentTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error("No session token");

      const res = await fetch('/api/chat/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ theme: selected })
      });
      if (res.ok) {
        onThemeSelect(selected);
      }
    } catch (e) {
      /* log removed */
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 sm:p-6 transition-opacity">
      <div 
        className="w-full max-w-md bg-white/95 dark:bg-[#0a0f1a]/95 backdrop-blur-3xl border border-gray-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fondo para darle estética Aurora (solo visible en dark mode para no manchar el light mode) */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none rounded-3xl z-0 hidden dark:block">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500/10 blur-[80px] rounded-full"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-500/10 blur-[80px] rounded-full"></div>
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm">Ajustes de Tema</h2>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-medium">
            Personaliza la apariencia de tus chats. Se sincronizará en todos tus dispositivos.
          </p>

          <div className="space-y-3 mb-8">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelected(theme.id)}
                className={`w-full flex items-center p-4 rounded-2xl border transition-all duration-300 text-left group ${
                  selected === theme.id 
                    ? 'border-cyan-500/50 bg-cyan-50 dark:bg-cyan-900/20 shadow-[0_0_20px_rgba(34,211,238,0.15)] scale-[1.02]' 
                    : 'border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/10'
                }`}
              >
                {/* Círculos de preview */}
                <div className="flex-shrink-0 flex items-center space-x-1.5 mr-4">
                  <div className={`w-8 h-8 rounded-full border border-gray-300 dark:border-white/20 shadow-inner ${theme.previewColors[0].split(' ')[0]}`}></div>
                  <div className={`w-3 h-3 rounded-full ${theme.previewColors[1]} absolute translate-x-6 translate-y-2 border-2 border-white dark:border-[#0a0f1a]`}></div>
                </div>
                
                {/* Textos */}
                <div className="flex-1">
                  <h4 className={`font-bold text-[14px] ${selected === theme.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-900 dark:text-gray-200'}`}>
                    {theme.name}
                  </h4>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                    {theme.description}
                  </p>
                </div>

                {/* Checkmark animado */}
                {selected === theme.id && (
                  <div className="flex-shrink-0 text-cyan-600 dark:text-cyan-400 ml-3">
                    <svg className="w-6 h-6 animate-[icon-pop_0.3s_ease-out_forwards]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 mt-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-[13px] font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full sm:w-auto relative overflow-hidden px-8 py-3 sm:py-2.5 text-[13px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap flex items-center justify-center group bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] cursor-pointer ${
                isSaving ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              <span className="relative z-10 flex items-center tracking-widest uppercase">
                {isSaving ? 'GUARDANDO...' : 'APLICAR TEMA'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

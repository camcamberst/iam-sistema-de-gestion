'use client';

import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface PillTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  fullWidth?: boolean;
  compact?: boolean;
  variant?: 'default' | 'guardar';
}

/**
 * 🎛️ Pill Segmented Control — Apple Style 2
 * 
 * Componente reutilizable de tabs con estética pill glassmorphism.
 * Tab activo: gradiente vibrante blue→indigo→violet con glow.
 * Tab inactivo: texto gris con hover a blanco.
 * 
 * Uso:
 * ```tsx
 * <PillTabs
 *   tabs={[
 *     { id: 'platforms', label: 'Mis Plataformas' },
 *     { id: 'analytics', label: 'Análisis y Estadísticas' },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   compact={true} // Opcional: Para evitar que se expanda en móvil
 * />
 * ```
 */
export default function PillTabs({ tabs, activeTab, onTabChange, className = '', fullWidth = false, compact = false, variant = 'default' }: PillTabsProps) {
  const getActiveClasses = () => {
    // El botón activo siempre tiene el gradiente vibrante y resplandor de aura de nuestra biblia
    return 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:from-cyan-500 hover:to-fuchsia-500 border-none ring-0';
  };

  return (
    <div
      className={`${fullWidth ? 'w-full flex' : compact ? 'w-fit inline-flex' : 'max-sm:w-full max-sm:flex sm:w-fit sm:inline-flex'} flex-row items-center justify-center gap-2 p-1 bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl rounded-full border border-black/[0.05] dark:border-white/[0.05] ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative overflow-hidden ${fullWidth ? 'flex-1' : compact ? 'flex-none' : 'max-sm:flex-1'} px-6 sm:px-8 py-1.5 sm:py-1.5 text-xs sm:text-[13px] ${activeTab === tab.id ? 'font-bold' : 'font-medium'} rounded-full transition-all duration-300 ease-out active:scale-[0.97] touch-manipulation whitespace-nowrap flex items-center justify-center ${
            activeTab === tab.id
              ? getActiveClasses()
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 ring-1 ring-transparent'
          }`}
        >
          {tab.icon && <span className="mr-2 inline-flex items-center">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

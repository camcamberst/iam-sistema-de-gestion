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
 * />
 * ```
 */
export default function PillTabs({ tabs, activeTab, onTabChange, className = '', fullWidth = false }: PillTabsProps) {
  return (
    <div
      className={`${fullWidth ? 'w-full flex' : 'max-sm:w-full max-sm:flex sm:w-fit sm:inline-flex'} flex-row items-center justify-center p-1 bg-gray-200/60 dark:bg-gray-800/80 backdrop-blur-md rounded-full shadow-inner border border-white/20 dark:border-white/5 ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative ${fullWidth ? 'flex-1' : 'max-sm:flex-1'} max-sm:px-6 max-sm:py-2.5 sm:px-5 sm:py-2 text-sm font-semibold rounded-full transition-all duration-300 ease-out active:scale-[0.97] touch-manipulation whitespace-nowrap flex items-center justify-center ${
            activeTab === tab.id
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {tab.icon && <span className="mr-2 inline-flex items-center">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

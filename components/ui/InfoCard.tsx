/**
 * 🎨 COMPONENTE UNIFICADO PARA TARJETAS INFORMATIVAS
 * 
 * Estilo Apple refinado consistente con Mi Calculadora
 * Usado para: Tasas, Totales, Resúmenes de Productividad, etc.
 */

import React from 'react';

interface InfoCardProps {
  value: string | number;
  label: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
  onClick?: () => void;
  clickable?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorVariants = {
  blue: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-blue-400 dark:text-[#5caaf5] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(92,170,245,0.7)]',
    badge: 'text-blue-400 bg-blue-50 dark:text-[#5caaf5] dark:bg-blue-500/10 max-sm:dark:bg-blue-500/15',
    shadow: 'hover:shadow-blue-200 dark:hover:shadow-blue-900/30 dark:hover:border-blue-400/30'
  },
  green: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-emerald-600 dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.7)]',
    badge: 'text-emerald-600 bg-emerald-50 dark:text-[#2dd4bf] dark:bg-emerald-500/10 max-sm:dark:bg-emerald-500/15',
    shadow: 'hover:shadow-green-200 dark:hover:shadow-emerald-900/30 dark:hover:border-emerald-400/30'
  },
  purple: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-purple-400 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.7)]',
    badge: 'text-purple-400 bg-purple-50 dark:text-[#c488fc] dark:bg-purple-500/10 max-sm:dark:bg-purple-500/15',
    shadow: 'hover:shadow-purple-200 dark:hover:shadow-purple-900/30 dark:hover:border-purple-400/30'
  },
  orange: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-orange-500 dark:text-[#fb923c] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(251,146,60,0.7)]',
    badge: 'text-orange-500 bg-orange-50 dark:text-[#fb923c] dark:bg-orange-500/10 max-sm:dark:bg-orange-500/15',
    shadow: 'hover:shadow-orange-200 dark:hover:shadow-orange-900/30 dark:hover:border-orange-400/30'
  },
  red: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-red-500 dark:text-[#f87171] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]',
    badge: 'text-red-500 bg-red-50 dark:text-[#f87171] dark:bg-red-500/10 max-sm:dark:bg-red-500/15',
    shadow: 'hover:shadow-red-200 dark:hover:shadow-red-900/30 dark:hover:border-red-400/30'
  },
  yellow: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08] max-sm:border-none',
    text: 'text-yellow-500 dark:text-[#facc15] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]',
    badge: 'text-yellow-500 bg-yellow-50 dark:text-[#facc15] dark:bg-yellow-500/10 max-sm:dark:bg-yellow-500/15',
    shadow: 'hover:shadow-yellow-200 dark:hover:shadow-yellow-900/30 dark:hover:border-yellow-400/30'
  }
};

export default function InfoCard({ 
  value, 
  label, 
  color = 'blue', 
  onClick, 
  clickable = false,
  className = '',
  size = 'md'
}: InfoCardProps) {
  const colors = colorVariants[color];
  const paddingClass = size === 'sm' ? 'px-1.5 py-1.5 sm:px-2.5 sm:py-2 md:px-3 md:py-2 h-[64px] sm:h-[72px] md:h-[78px]' : (size === 'lg' ? 'px-6 py-5 sm:px-8 sm:py-6' : 'px-4 py-3 sm:px-6 sm:py-4');
  const valueTextClass = size === 'lg' ? 'text-2xl' : (size === 'sm' ? 'text-[15px] sm:text-[16px] max-sm:mb-1' : 'text-xl max-sm:mb-2');
  const labelTextClass = size === 'sm' ? 'text-[8.5px] sm:text-[9.5px] font-medium tracking-tight sm:tracking-wide' : 'text-xs font-medium tracking-wide';
  const badgeClass = size === 'sm' 
    ? 'px-1.5 sm:px-2 py-[2px] sm:py-[3px] rounded-md sm:rounded-lg w-auto inline-flex mx-auto min-h-[16px] sm:min-h-[18px]' 
    : 'px-2 sm:px-3 py-1 sm:py-1 rounded-lg sm:rounded-xl w-full flex min-h-[20px] sm:min-h-[24px]';
  
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      // Si es un número, formatearlo con separadores de miles
      return val.toLocaleString('es-CO', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
      });
    }
    return String(val);
  };

  return (
    <div 
      className={`
        w-full flex-1 w-full box-border
        text-center ${paddingClass} ${colors.gradient} rounded-xl sm:rounded-2xl border ${colors.border} 
        hover:shadow-lg ${colors.shadow} transition-all duration-200 transform hover:scale-105 flex flex-col justify-center items-center
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      title={clickable ? 'Hacer clic para interactuar' : undefined}
    >
      <div className={`${valueTextClass} font-bold ${colors.text} mb-1 sm:mb-1.5`}>
        {formatValue(value)}
      </div>
      <div className={`${labelTextClass} ${colors.badge} ${badgeClass} items-center justify-center leading-tight whitespace-nowrap`}>
        {label}
      </div>
    </div>
  );
}

/**
 * 🎨 VARIANTE PARA GRUPOS DE TARJETAS
 * 
 * Grid responsivo con espaciado consistente
 */
interface InfoCardGridProps {
  cards: Array<{
    value: string | number;
    label: React.ReactNode;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
    onClick?: () => void;
    clickable?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  }>;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function InfoCardGrid({ 
  cards, 
  columns = 3, 
  className = '' 
}: InfoCardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2 md:grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-2 sm:gap-4 ${className}`}>
      {cards.map((card, index) => {
        const combinedClass = `${card.className || ''}`.trim();

        return (
          <InfoCard
            key={index}
            value={card.value}
            label={card.label}
            color={card.color}
            onClick={card.onClick}
            clickable={card.clickable}
            size={card.size}
            className={combinedClass || undefined}
          />
        );
      })}
    </div>
  );
}


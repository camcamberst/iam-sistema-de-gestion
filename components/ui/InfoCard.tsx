/**
 * 🎨 COMPONENTE UNIFICADO PARA TARJETAS INFORMATIVAS - AURORA MASTER DESIGN SYSTEM
 * 
 * Estilo Apple refinado consistente con nuestra Biblia de Estilos (Apple Style 2)
 * Usado para: Tasas, Totales, Resúmenes de Productividad, etc.
 */

import React from 'react';

interface InfoCardProps {
  value: string | number;
  label: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'cyan';
  onClick?: () => void;
  clickable?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorVariants = {
  blue: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-blue-500 dark:text-[#5caaf5] drop-shadow-[0_0_8px_rgba(92,170,245,0.2)]',
    badge: 'text-blue-600 bg-blue-500/10 dark:text-[#5caaf5] dark:bg-blue-500/10 border border-blue-500/20',
    shadow: 'hover:shadow-lg hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 dark:hover:border-blue-400/30'
  },
  green: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-emerald-600 dark:text-[#2dd4bf] drop-shadow-[0_0_8px_rgba(45,212,191,0.2)]',
    badge: 'text-emerald-600 bg-emerald-500/10 dark:text-[#2dd4bf] dark:bg-emerald-500/10 border border-emerald-500/20',
    shadow: 'hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:shadow-emerald-500/10 dark:hover:border-emerald-400/30'
  },
  purple: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-purple-500 dark:text-[#c488fc] drop-shadow-[0_0_8px_rgba(196,136,252,0.2)]',
    badge: 'text-purple-600 bg-purple-500/10 dark:text-[#c488fc] dark:bg-purple-500/10 border border-purple-500/20',
    shadow: 'hover:shadow-lg hover:shadow-purple-500/5 dark:hover:shadow-purple-500/10 dark:hover:border-purple-400/30'
  },
  cyan: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-cyan-500 dark:text-[#22d3ee] drop-shadow-[0_0_8px_rgba(34,211,238,0.2)]',
    badge: 'text-cyan-600 bg-cyan-500/10 dark:text-[#22d3ee] dark:bg-cyan-500/10 border border-cyan-500/20',
    shadow: 'hover:shadow-lg hover:shadow-cyan-500/5 dark:hover:shadow-cyan-500/10 dark:hover:border-cyan-400/30'
  },
  orange: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-orange-500 dark:text-[#fb923c] drop-shadow-[0_0_8px_rgba(251,146,60,0.2)]',
    badge: 'text-orange-600 bg-orange-500/10 dark:text-[#fb923c] dark:bg-orange-500/10 border border-orange-500/20',
    shadow: 'hover:shadow-lg hover:shadow-orange-500/5 dark:hover:shadow-orange-500/10 dark:hover:border-orange-400/30'
  },
  red: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-red-500 dark:text-[#f87171] drop-shadow-[0_0_8px_rgba(248,113,113,0.2)]',
    badge: 'text-red-600 bg-red-500/10 dark:text-[#f87171] dark:bg-red-500/10 border border-red-500/20',
    shadow: 'hover:shadow-lg hover:shadow-red-500/5 dark:hover:shadow-red-500/10 dark:hover:border-red-400/30'
  },
  yellow: {
    gradient: 'bg-white/40 dark:bg-white/[0.03]',
    border: 'border-white/50 dark:border-white/[0.08]',
    text: 'text-yellow-500 dark:text-[#facc15] drop-shadow-[0_0_8px_rgba(250,204,21,0.2)]',
    badge: 'text-amber-600 bg-amber-500/10 dark:text-[#facc15] dark:bg-amber-500/10 border border-amber-500/20',
    shadow: 'hover:shadow-lg hover:shadow-amber-500/5 dark:hover:shadow-amber-500/10 dark:hover:border-yellow-400/30'
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
  
  // Padding constante e inmaculado - Regla 2 (Evitar px-0 interno y altura fija rígida)
  const paddingClass = size === 'sm' 
    ? 'p-3 sm:py-3.5 sm:px-4' 
    : (size === 'lg' ? 'px-6 py-5 sm:px-8 sm:py-6' : 'px-4 py-3 sm:px-6 sm:py-4');
    
  const valueTextClass = size === 'lg' 
    ? 'text-2xl sm:text-3xl font-bold tracking-tight' 
    : (size === 'sm' ? 'text-base sm:text-lg font-bold tracking-tight' : 'text-xl sm:text-2xl font-bold tracking-tight');
    
  const labelTextClass = size === 'sm' 
    ? 'text-[10px] sm:text-[11px] font-semibold leading-none' 
    : 'text-[11px] sm:text-xs font-semibold leading-none';
    
  // Insignia interna con altura de píldora táctil de precisión de la Biblia de Estilos
  const badgeClass = size === 'sm' 
    ? 'h-[22px] px-2.5 rounded-full inline-flex items-center justify-center select-none shadow-sm' 
    : 'h-6 px-3 rounded-full inline-flex items-center justify-center select-none shadow-sm';
  
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
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
        w-full flex-1 box-border
        text-center ${paddingClass} ${colors.gradient} rounded-2xl md:rounded-3xl border ${colors.border} 
        hover:shadow-lg ${colors.shadow} transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform hover:scale-[1.04] active:scale-[0.98] will-change-transform flex flex-col justify-center items-center gap-1.5
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      title={clickable ? 'Hacer clic para interactuar' : undefined}
    >
      <div className={`${valueTextClass} ${colors.text} leading-none`}>
        {formatValue(value)}
      </div>
      <div className={`${labelTextClass} ${colors.badge} ${badgeClass}`}>
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
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow' | 'cyan';
    onClick?: () => void;
    clickable?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
  }>;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  compactContainer?: boolean; // Prop opcional para activar la píldora unificada
}

export function InfoCardGrid({ 
  cards, 
  columns = 3, 
  className = '',
  compactContainer = false
}: InfoCardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2 md:grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
  };

  // Si se solicita el contenedor de píldora compacta unificada de Aurora
  if (compactContainer) {
    const marginClasses = className.match(/(m[tbxy]?-\d+|m-\d+|mb-\[.*?\]|my-\[.*?\])/g)?.join(' ') || '';
    const cleanClassName = className.replace(/(m[tbxy]?-\d+|m-\d+|mb-\[.*?\]|my-\[.*?\])/g, '').trim();

    return (
      <div className={`bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-[20px] md:rounded-[30px] p-1 sm:p-1.5 shadow-inner overflow-hidden w-full ${marginClasses}`}>
        <div className={`grid ${gridCols[columns]} gap-1 sm:gap-1.5 ${cleanClassName}`}>
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
      </div>
    );
  }

  // Comportamiento plano por defecto (sin cajas extras de cristal) para otras vistas del sistema
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

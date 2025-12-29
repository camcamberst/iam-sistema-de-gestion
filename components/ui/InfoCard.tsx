/**
 * 🎨 COMPONENTE UNIFICADO PARA TARJETAS INFORMATIVAS
 * 
 * Estilo Apple refinado consistente con Mi Calculadora
 * Usado para: Tasas, Totales, Resúmenes de Productividad, etc.
 */

import React from 'react';

interface InfoCardProps {
  value: string | number;
  label: string;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
  onClick?: () => void;
  clickable?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorVariants = {
  blue: {
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-50/90 dark:to-blue-100/95',
    border: 'border-blue-200 dark:border-blue-300/60',
    text: 'text-blue-700 dark:text-blue-600',
    badge: 'text-blue-600 bg-blue-200 dark:text-blue-700 dark:bg-blue-200/80',
    shadow: 'hover:shadow-blue-200 dark:hover:shadow-blue-300/40'
  },
  green: {
    gradient: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-50/90 dark:to-green-100/95',
    border: 'border-green-200 dark:border-green-300/60',
    text: 'text-green-700 dark:text-green-600',
    badge: 'text-green-600 bg-green-200 dark:text-green-700 dark:bg-green-200/80',
    shadow: 'hover:shadow-green-200 dark:hover:shadow-green-300/40'
  },
  purple: {
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-50/90 dark:to-purple-100/95',
    border: 'border-purple-200 dark:border-purple-300/60',
    text: 'text-purple-700 dark:text-purple-600',
    badge: 'text-purple-600 bg-purple-200 dark:text-purple-700 dark:bg-purple-200/80',
    shadow: 'hover:shadow-purple-200 dark:hover:shadow-purple-300/40'
  },
  orange: {
    gradient: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-50/90 dark:to-orange-100/95',
    border: 'border-orange-200 dark:border-orange-300/60',
    text: 'text-orange-700 dark:text-orange-600',
    badge: 'text-orange-600 bg-orange-200 dark:text-orange-700 dark:bg-orange-200/80',
    shadow: 'hover:shadow-orange-200 dark:hover:shadow-orange-300/40'
  },
  red: {
    gradient: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-50/90 dark:to-red-100/95',
    border: 'border-red-200 dark:border-red-300/60',
    text: 'text-red-700 dark:text-red-600',
    badge: 'text-red-600 bg-red-200 dark:text-red-700 dark:bg-red-200/80',
    shadow: 'hover:shadow-red-200 dark:hover:shadow-red-300/40'
  },
  yellow: {
    gradient: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-50/90 dark:to-yellow-100/95',
    border: 'border-yellow-200 dark:border-yellow-300/60',
    text: 'text-yellow-700 dark:text-yellow-600',
    badge: 'text-yellow-600 bg-yellow-200 dark:text-yellow-700 dark:bg-yellow-200/80',
    shadow: 'hover:shadow-yellow-200 dark:hover:shadow-yellow-300/40'
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
  const paddingClass = size === 'sm' ? 'p-2 sm:p-4' : (size === 'lg' ? 'p-6' : 'p-5');
  const valueTextClass = size === 'lg' ? 'text-2xl' : (size === 'sm' ? 'text-base sm:text-lg' : 'text-xl');
  const labelTextClass = size === 'sm' ? 'text-[10px] sm:text-[11px]' : 'text-xs';
  
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
        text-center ${paddingClass} ${colors.gradient} rounded-xl border ${colors.border} 
        hover:shadow-lg ${colors.shadow} dark:shadow-lg dark:ring-0.5 dark:ring-opacity-20 transition-all duration-200 transform hover:scale-105
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      title={clickable ? 'Hacer clic para interactuar' : undefined}
    >
      <div className={`${valueTextClass} font-bold ${colors.text} mb-1`}>
        {formatValue(value)}
      </div>
      <div className={`${labelTextClass} font-medium ${colors.badge} px-2 py-1 rounded-full inline-block`}>
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
    label: string;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
    onClick?: () => void;
    clickable?: boolean;
    size?: 'sm' | 'md' | 'lg';
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
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-2 sm:gap-4 ${className}`}>
      {cards.map((card, index) => (
        <InfoCard
          key={index}
          value={card.value}
          label={card.label}
          color={card.color}
          onClick={card.onClick}
          clickable={card.clickable}
          size={card.size}
        />
      ))}
    </div>
  );
}

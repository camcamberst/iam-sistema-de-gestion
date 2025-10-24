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
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/80 dark:to-blue-800/90',
    border: 'border-blue-200 dark:border-blue-600/50',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'text-blue-600 bg-blue-200 dark:text-white dark:bg-blue-800/60',
    shadow: 'hover:shadow-blue-200 dark:hover:shadow-blue-900/30'
  },
  green: {
    gradient: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/80 dark:to-green-800/90',
    border: 'border-green-200 dark:border-green-600/50',
    text: 'text-green-700 dark:text-green-400',
    badge: 'text-green-600 bg-green-200 dark:text-white dark:bg-green-800/60',
    shadow: 'hover:shadow-green-200 dark:hover:shadow-green-900/30'
  },
  purple: {
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/80 dark:to-purple-800/90',
    border: 'border-purple-200 dark:border-purple-600/50',
    text: 'text-purple-700 dark:text-purple-400',
    badge: 'text-purple-600 bg-purple-200 dark:text-white dark:bg-purple-800/60',
    shadow: 'hover:shadow-purple-200 dark:hover:shadow-purple-900/30'
  },
  orange: {
    gradient: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/80 dark:to-orange-800/90',
    border: 'border-orange-200 dark:border-orange-600/50',
    text: 'text-orange-700 dark:text-orange-400',
    badge: 'text-orange-600 bg-orange-200 dark:text-white dark:bg-orange-800/60',
    shadow: 'hover:shadow-orange-200 dark:hover:shadow-orange-900/30'
  },
  red: {
    gradient: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/80 dark:to-red-800/90',
    border: 'border-red-200 dark:border-red-600/50',
    text: 'text-red-700 dark:text-red-400',
    badge: 'text-red-600 bg-red-200 dark:text-white dark:bg-red-800/60',
    shadow: 'hover:shadow-red-200 dark:hover:shadow-red-900/30'
  },
  yellow: {
    gradient: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/80 dark:to-yellow-800/90',
    border: 'border-yellow-200 dark:border-yellow-600/50',
    text: 'text-yellow-700 dark:text-yellow-400',
    badge: 'text-yellow-600 bg-yellow-200 dark:text-white dark:bg-yellow-800/60',
    shadow: 'hover:shadow-yellow-200 dark:hover:shadow-yellow-900/30'
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
  const paddingClass = size === 'sm' ? 'p-4' : (size === 'lg' ? 'p-6' : 'p-5');
  const valueTextClass = size === 'lg' ? 'text-2xl' : (size === 'sm' ? 'text-lg' : 'text-xl');
  const labelTextClass = size === 'sm' ? 'text-[11px]' : 'text-xs';
  
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
        hover:shadow-lg ${colors.shadow} dark:shadow-lg dark:ring-1 dark:ring-opacity-30 transition-all duration-200 transform hover:scale-105
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
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
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

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
}

const colorVariants = {
  blue: {
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'text-blue-600 bg-blue-200',
    shadow: 'hover:shadow-blue-200'
  },
  green: {
    gradient: 'bg-gradient-to-br from-green-50 to-green-100',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'text-green-600 bg-green-200',
    shadow: 'hover:shadow-green-200'
  },
  purple: {
    gradient: 'bg-gradient-to-br from-purple-50 to-purple-100',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'text-purple-600 bg-purple-200',
    shadow: 'hover:shadow-purple-200'
  },
  orange: {
    gradient: 'bg-gradient-to-br from-orange-50 to-orange-100',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'text-orange-600 bg-orange-200',
    shadow: 'hover:shadow-orange-200'
  },
  red: {
    gradient: 'bg-gradient-to-br from-red-50 to-red-100',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'text-red-600 bg-red-200',
    shadow: 'hover:shadow-red-200'
  },
  yellow: {
    gradient: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'text-yellow-600 bg-yellow-200',
    shadow: 'hover:shadow-yellow-200'
  }
};

export default function InfoCard({ 
  value, 
  label, 
  color = 'blue', 
  onClick, 
  clickable = false,
  className = '' 
}: InfoCardProps) {
  const colors = colorVariants[color];
  
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
        text-center p-4 ${colors.gradient} rounded-xl border ${colors.border} 
        hover:shadow-lg ${colors.shadow} transition-all duration-200 transform hover:scale-105
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      title={clickable ? 'Hacer clic para interactuar' : undefined}
    >
      <div className={`text-xl font-bold ${colors.text} mb-1`}>
        {formatValue(value)}
      </div>
      <div className={`text-xs font-medium ${colors.badge} px-2 py-1 rounded-full inline-block`}>
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
    <div className={`grid ${gridCols[columns]} gap-3 ${className}`}>
      {cards.map((card, index) => (
        <InfoCard
          key={index}
          value={card.value}
          label={card.label}
          color={card.color}
          onClick={card.onClick}
          clickable={card.clickable}
        />
      ))}
    </div>
  );
}

'use client';

interface BadgeProps {
  count: number;
  variant?: 'blue' | 'red';
  size?: 'small' | 'medium';
  className?: string;
}

/**
 * Componente Badge reutilizable para mostrar contadores
 */
export default function Badge({ 
  count, 
  variant = 'blue', 
  size = 'small',
  className = '' 
}: BadgeProps) {
  // No mostrar badge si el conteo es 0
  if (count === 0) return null;
  
  const baseClasses = 'rounded-full text-white font-semibold flex items-center justify-center';
  const sizeClasses = size === 'small' 
    ? 'text-xs px-1.5 py-0.5 min-w-[18px] h-[18px]' 
    : 'text-sm px-2 py-1 min-w-[22px] h-[22px]';
  const colorClasses = variant === 'blue' 
    ? 'bg-blue-500' 
    : 'bg-red-500';
  
  // Formatear número: mostrar "99+" si es mayor a 99
  const displayCount = count > 99 ? '99+' : count.toString();
  
  return (
    <span 
      className={`${baseClasses} ${sizeClasses} ${colorClasses} ${className}`}
      aria-label={`${count} ${count === 1 ? 'mensaje' : 'mensajes'} no leídos`}
    >
      {displayCount}
    </span>
  );
}


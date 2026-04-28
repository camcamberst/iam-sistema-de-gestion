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
  
  const baseClasses = 'rounded-full text-white font-medium flex items-center justify-center shadow-sm';
  const sizeClasses = size === 'small' 
    ? 'text-[10px] px-1 py-0.5 min-w-[16px] h-[16px]' 
    : 'text-xs px-1.5 py-0.5 min-w-[18px] h-[18px]';
  const colorClasses = variant === 'blue' 
    ? 'bg-blue-500/90' 
    : 'bg-rose-600 shadow-rose-500/30 animate-pulse'; // Más visible, color rojo intenso y pulsando
  
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


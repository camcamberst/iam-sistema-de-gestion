import React from 'react';

/**
 * 🪟 GlassCard — Componente base glassmorphism del sistema AIM
 * 
 * Reemplaza los patrones repetidos de:
 * - bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl border...
 * - bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-lg...
 * 
 * Usa los design tokens definidos en globals.css
 */

type GlowVariant = 'model' | 'admin' | 'superadmin' | 'none';
type PaddingSize = 'none' | 'sm' | 'md' | 'lg';

interface GlassCardProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** 'card' para contenido, 'header' para headers de página */
  variant?: 'card' | 'header';
  /** Padding interno */
  padding?: PaddingSize;
  /** Efecto glow según rol del panel */
  glow?: GlowVariant;
  /** Clases CSS adicionales */
  className?: string;
  /** Elemento HTML a renderizar */
  as?: 'div' | 'section' | 'article' | 'aside' | 'button';
}

const paddingClasses: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const glowClasses: Record<GlowVariant, string> = {
  model: 'glow-model',
  admin: 'glow-admin',
  superadmin: 'glow-superadmin',
  none: '',
};

export default function GlassCard({
  children,
  variant = 'card',
  padding = 'md',
  glow = 'none',
  className = '',
  as: Component = 'div',
  ...props
}: GlassCardProps) {
  const baseClass = variant === 'header' ? 'glass-header' : 'glass-card';

  return (
    <Component
      className={`${baseClass} ${paddingClasses[padding]} ${glowClasses[glow]} ${className}`}
      {...props as any}
    >
      {children}
    </Component>
  );
}

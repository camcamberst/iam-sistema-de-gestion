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
  /** Boreal Aurora Effect */
  auroraEffect?: boolean;
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
  auroraEffect = false,
  ...props
}: GlassCardProps) {
  const baseClass = variant === 'header' ? 'glass-header' : 'glass-card';

  return (
    <Component
      className={`${baseClass} ${paddingClasses[padding]} ${glowClasses[glow]} ${className} ${auroraEffect ? 'relative overflow-hidden' : ''}`}
      {...props as any}
    >
      {auroraEffect && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/10 blur-[50px] rounded-full mix-blend-screen animate-aurora-1 opacity-70"></div>
          <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/10 blur-[60px] rounded-full mix-blend-screen animate-aurora-2 opacity-70"></div>
          <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/10 blur-[45px] rounded-full mix-blend-screen animate-aurora-3 opacity-70"></div>
        </div>
      )}
      {auroraEffect ? (
        <div className="relative z-10 h-full flex flex-col justify-stretch">
          {children}
        </div>
      ) : (
        children
      )}
    </Component>
  );
}

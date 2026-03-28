import React from 'react';
import GlassCard from './GlassCard';

/**
 * 📄 PageHeader — Header de página estándar para AIM Sistema de Gestión
 *
 * Combina GlassCard (variant="header") con un layout estandarizado:
 * - Icono con gradiente primario
 * - Título con gradiente de texto
 * - Subtítulo opcional
 * - Acciones opcionales (botones, badges)
 * - Glow por rol del panel
 * - Glow decorativo de fondo
 */

interface PageHeaderProps {
  /** Título principal de la página */
  title: string;
  /** Subtítulo descriptivo (visible solo en sm+) */
  subtitle?: string;
  /** Icono SVG como ReactNode */
  icon?: React.ReactNode;
  /** Acciones (botones) a la derecha en desktop */
  actions?: React.ReactNode;
  /** Contenido adicional debajo del header (alertas, info, etc.) */
  children?: React.ReactNode;
  /** Efecto glow según rol del panel */
  glow?: 'model' | 'admin' | 'superadmin' | 'none';
  /** Clases CSS adicionales */
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
  glow = 'none',
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-8 sm:mb-12 ${className}`}>
      <div className="relative">
        {/* Decoración de fondo con glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl" />

        <GlassCard variant="header" padding="none" glow={glow}>
          <div className="p-4 sm:p-6">
            {/* Layout: vertical en móvil, horizontal en desktop */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
              {/* Icono + Título */}
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {icon && (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-primary rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg md:text-2xl aim-title-gradient leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Acciones */}
              {actions && (
                <div className="flex flex-wrap gap-2">
                  {actions}
                </div>
              )}
            </div>

            {/* Contenido adicional (alertas internas, pills, etc.) */}
            {children && (
              <div className="mt-4">
                {children}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

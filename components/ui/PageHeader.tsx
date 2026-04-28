"use client";

import React, { useState } from 'react';
import GlassCard from './GlassCard';

/**
 * PageHeader - Header de pagina estandar
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  glow?: 'model' | 'admin' | 'superadmin' | 'none';
  className?: string;
  actionClassName?: string;
}

export default function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  actionClassName = '',
}: PageHeaderProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className={`max-sm:mb-12 sm:mb-4 relative group ${className}`}>
      <div className="relative bg-black/[0.08] dark:bg-white/[0.08] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] rounded-xl sm:rounded-2xl md:rounded-3xl p-3 sm:p-4 shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-5 md:gap-4">
          
          <div className="flex items-center space-x-4 sm:space-x-5 min-w-0 flex-1">
            {icon && (
              <div className="self-center flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-[0.85rem] sm:rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-xl shadow-[inset_0_0_10px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.1)] border border-gray-200/60 dark:border-white/20 flex-shrink-0 animate-fade-in-smooth transform transition-all duration-300 hover:-translate-y-0.5 hover:scale-105">
                <div className="flex items-center justify-center [&>svg]:!w-5 [&>svg]:!h-5 sm:[&>svg]:!w-6 sm:[&>svg]:!h-6 [&>svg]:!text-gray-700 dark:[&>svg]:!text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  {icon}
                </div>
              </div>
            )}
            
            <div className="self-center min-w-0 flex-1 flex flex-row items-center gap-2 translate-y-[1px] sm:translate-y-[1px]">
                <h1 className="self-center text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white leading-none drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  {title}
                </h1>
                {subtitle && (
                  <button 
                    onClick={() => setShowInfo(!showInfo)}
                    className="self-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-full text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors focus:outline-none translate-y-[1px] sm:translate-y-[2px]"
                    title="Mas informacion"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                  </button>
                )}
            </div>
          </div>

          {actions && (
            <div className={`flex flex-wrap gap-2 md:pl-4 transition-all ${actionClassName}`}>
              {actions}
            </div>
          )}
        </div>

        {subtitle && (
          <div className={`transition-all duration-500 ease-in-out overflow-hidden mt-3 ${showInfo ? 'max-h-40 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0 mt-0 max-sm:hidden'}`}>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {subtitle.split('\u00B7').map((part, i) => {
                const text = part.trim();
                if (!text) return null;
                
                if (i === 0) {
                  return (
                    <span key={i} className="text-sm font-medium text-gray-600 dark:text-gray-300 mr-1">
                      {text}
                    </span>
                  );
                }
                
                return (
                  <span 
                    key={i} 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 text-xs font-semibold text-violet-700 dark:text-violet-300"
                  >
                    {text}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {children && (
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';

interface ModelAuroraBackgroundProps {
  forceMode?: 'light' | 'dark' | null;
  className?: string;
}

export default function ModelAuroraBackground({ forceMode = null, className }: ModelAuroraBackgroundProps) {
  // SVG Noise Texture Premium (Elimina el color banding y otorga calidad Mate/OLED)
  const noiseLvl = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

  // Controlamos la opacidad manualmente si existe un forceMode ('light' o 'dark') que anule Tailwind dark:
  const lightModeOpacity = forceMode === 'dark' ? 'opacity-0' : (forceMode === 'light' ? 'opacity-100' : 'dark:opacity-0');
  const darkModeOpacity = forceMode === 'dark' ? 'opacity-100' : (forceMode === 'light' ? 'opacity-0' : 'opacity-0 dark:opacity-100');

  // Si nos pasan un className (como absolute inset-0), la sustituye, sino el comportamiento global (fixed inset-0)
  const containerClass = className || "fixed inset-0";

  return (
    <>
      <div className={`${containerClass} z-0 pointer-events-none transition-colors duration-1000 ease-in-out overflow-hidden bg-transparent`}>
        {/* LIGHT MODE: Pastel Aurora */}
        <div className={`absolute inset-0 bg-[#fbf9fa] ${lightModeOpacity} transition-opacity duration-1000 overflow-hidden`}>
          {/* Dynamism Layers */}
          <div className="absolute top-[5%] left-[15%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-fuchsia-300/40 rounded-full filter blur-[100px] sm:blur-[140px] transform-gpu will-change-transform anim-float-1"></div>
          <div className="absolute bottom-[10%] right-[15%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] bg-sky-300/40 rounded-full filter blur-[100px] sm:blur-[140px] transform-gpu will-change-transform anim-float-2"></div>
          <div className="absolute top-[20%] left-[25%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-rose-200/50 rounded-full filter blur-[100px] sm:blur-[140px] transform-gpu will-change-transform anim-float-3"></div>
          
          {/* Noise Level */}
          <div className="absolute inset-0 opacity-[0.03] transform-gpu" style={{ backgroundImage: noiseLvl }}></div>
        </div>

        {/* DARK MODE: Neon Midnight */}
        <div className={`absolute inset-0 bg-[#08040a] ${darkModeOpacity} transition-opacity duration-1000 overflow-hidden transform-gpu`}>
           {/* Dynamism Layers */}
           <div className="absolute top-[5%] left-[5%] sm:left-[20%] w-[70vw] sm:w-[50vw] h-[70vw] sm:h-[50vw] max-w-[700px] max-h-[700px] bg-fuchsia-600/20 sm:bg-fuchsia-600/20 rounded-full filter blur-[100px] sm:blur-[140px] transform-gpu will-change-transform anim-float-1"></div>
           <div className="absolute bottom-[10%] right-[5%] sm:right-[20%] w-[70vw] sm:w-[50vw] h-[70vw] sm:h-[50vw] max-w-[700px] max-h-[700px] bg-violet-600/20 sm:bg-violet-600/20 rounded-full filter blur-[100px] sm:blur-[140px] transform-gpu will-change-transform anim-float-2"></div>
           <div className="absolute top-[20%] left-[10%] sm:left-[25%] w-[80vw] sm:w-[60vw] h-[80vw] sm:h-[60vw] max-w-[900px] max-h-[900px] bg-cyan-700/20 sm:bg-cyan-700/20 rounded-full filter blur-[100px] sm:blur-[160px] transform-gpu will-change-transform anim-float-3"></div>
           
           {/* Noise Level */}
           <div className="absolute inset-0 opacity-[0.04] transform-gpu" style={{ backgroundImage: noiseLvl }}></div>
        </div>
      </div>
    </>
  );
}

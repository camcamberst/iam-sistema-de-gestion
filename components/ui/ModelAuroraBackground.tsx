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
        {/* LIGHT MODE: Aurora Pastel Fluida */}
        <div className={`absolute inset-0 bg-[#fbf9fa] ${lightModeOpacity} transition-opacity duration-1000 overflow-hidden`}>
          {/* Blob 1: Violet — ruta diagonal */}
          <div className="absolute w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] bg-violet-200/70 rounded-full filter blur-[100px] sm:blur-[150px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-1 25s ease-in-out infinite alternate' }}></div>
          
          {/* Blob 2: Fuchsia — ruta opuesta */}
          <div className="absolute w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-fuchsia-200/55 rounded-full filter blur-[100px] sm:blur-[145px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-2 30s ease-in-out infinite alternate' }}></div>
          
          {/* Blob 3: Sky — ruta horizontal */}
          <div className="absolute w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-sky-200/65 rounded-full filter blur-[110px] sm:blur-[170px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-3 35s ease-in-out infinite alternate' }}></div>
          
          {/* Blob 4: Rose — ruta circular */}
          <div className="absolute w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] bg-rose-200/50 rounded-full filter blur-[90px] sm:blur-[140px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-4 22s ease-in-out infinite alternate' }}></div>
          
          {/* Blob 5: Indigo — ruta vertical */}
          <div className="absolute w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-indigo-200/45 rounded-full filter blur-[100px] sm:blur-[150px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-5 28s ease-in-out infinite alternate' }}></div>
          
          {/* Blob 6: Cyan — ruta diagonal inversa */}
          <div className="absolute w-[48vw] h-[48vw] max-w-[600px] max-h-[600px] bg-cyan-200/50 rounded-full filter blur-[95px] sm:blur-[145px] transform-gpu will-change-transform" style={{ animation: 'aurora-light-6 32s ease-in-out infinite alternate' }}></div>
          
          {/* Keyframes light mode */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes aurora-light-1 {
              0%   { top: -10%; left: -10%; transform: scale(1) rotate(0deg); }
              25%  { top: 30%; left: 60%; transform: scale(1.15) rotate(45deg); }
              50%  { top: 60%; left: 30%; transform: scale(0.9) rotate(90deg); }
              75%  { top: 20%; left: 70%; transform: scale(1.1) rotate(135deg); }
              100% { top: 50%; left: -5%; transform: scale(1) rotate(180deg); }
            }
            @keyframes aurora-light-2 {
              0%   { bottom: -15%; right: -10%; transform: scale(1.1) rotate(0deg); }
              25%  { bottom: 40%; right: 50%; transform: scale(0.85) rotate(-60deg); }
              50%  { bottom: 10%; right: 20%; transform: scale(1.2) rotate(-120deg); }
              75%  { bottom: 50%; right: 70%; transform: scale(0.9) rotate(-180deg); }
              100% { bottom: -5%; right: 40%; transform: scale(1.1) rotate(-240deg); }
            }
            @keyframes aurora-light-3 {
              0%   { top: 20%; left: -20%; transform: scale(1) rotate(0deg); }
              20%  { top: 10%; left: 40%; transform: scale(1.1) rotate(30deg); }
              40%  { top: 50%; left: 70%; transform: scale(0.85) rotate(60deg); }
              60%  { top: 70%; left: 30%; transform: scale(1.15) rotate(90deg); }
              80%  { top: 30%; left: 80%; transform: scale(0.9) rotate(120deg); }
              100% { top: 5%; left: 10%; transform: scale(1) rotate(150deg); }
            }
            @keyframes aurora-light-4 {
              0%   { top: 60%; left: 70%; transform: scale(0.9) rotate(0deg); }
              33%  { top: 10%; left: 20%; transform: scale(1.15) rotate(120deg); }
              66%  { top: 40%; left: 80%; transform: scale(0.85) rotate(240deg); }
              100% { top: 70%; left: 10%; transform: scale(1.1) rotate(360deg); }
            }
            @keyframes aurora-light-5 {
              0%   { top: -10%; left: 50%; transform: scale(1) rotate(0deg); }
              25%  { top: 40%; left: 10%; transform: scale(1.1) rotate(-45deg); }
              50%  { top: 80%; left: 50%; transform: scale(0.9) rotate(-90deg); }
              75%  { top: 30%; left: 80%; transform: scale(1.15) rotate(-135deg); }
              100% { top: 60%; left: 40%; transform: scale(1) rotate(-180deg); }
            }
            @keyframes aurora-light-6 {
              0%   { top: 70%; left: -10%; transform: scale(1) rotate(0deg); }
              20%  { top: 50%; left: 30%; transform: scale(1.1) rotate(40deg); }
              40%  { top: 15%; left: 60%; transform: scale(0.9) rotate(80deg); }
              60%  { top: 40%; left: 90%; transform: scale(1.1) rotate(120deg); }
              80%  { top: 65%; left: 50%; transform: scale(0.85) rotate(160deg); }
              100% { top: 20%; left: 5%; transform: scale(1.05) rotate(200deg); }
            }
          ` }} />
          
          {/* Noise Level */}
          <div className="absolute inset-0 opacity-[0.03] transform-gpu mix-blend-overlay" style={{ backgroundImage: noiseLvl }}></div>
        </div>

        {/* DARK MODE: Cielo Nocturno Profundo — blobs matemáticos sin canal Alpha y sin SVG Noise */}
        <div className={`absolute inset-0 bg-[#000000] ${darkModeOpacity} transition-opacity duration-1000 overflow-hidden transform-gpu`}>
           {/* Blob 1: Deep Space Indigo */}
           <div className="absolute w-[90vw] h-[90vw] max-w-[1200px] max-h-[1200px] transform-gpu will-change-transform mix-blend-screen" style={{ background: 'radial-gradient(circle closest-side, #020412 0%, #000000 100%)', animation: 'aurora-drift-1 40s ease-in-out infinite alternate' }}></div>
           
           {/* Blob 2: Deep Oceanic Space */}
           <div className="absolute w-[85vw] h-[85vw] max-w-[1100px] max-h-[1100px] transform-gpu will-change-transform mix-blend-screen" style={{ background: 'radial-gradient(circle closest-side, #010609 0%, #000000 100%)', animation: 'aurora-drift-2 45s ease-in-out infinite alternate' }}></div>
           
           {/* Blob 3: Subtle Aurora Teal Reflection */}
           <div className="absolute w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] transform-gpu will-change-transform mix-blend-screen" style={{ background: 'radial-gradient(circle closest-side, #010806 0%, #000000 100%)', animation: 'aurora-drift-3 50s ease-in-out infinite alternate' }}></div>
           
           {/* Keyframes de órbitas muy lentas y fluidas, sin modificaciones de opacity */}
           <style dangerouslySetInnerHTML={{ __html: `
             @keyframes aurora-drift-1 {
               0%   { top: -10%; left: -10%; transform: scale(1) rotate(0deg); }
               50%  { top: 20%; left: 30%; transform: scale(1.1) rotate(90deg); }
               100% { top: -5%; left: 50%; transform: scale(1) rotate(180deg); }
             }
             @keyframes aurora-drift-2 {
               0%   { bottom: -15%; right: -10%; transform: scale(1.1) rotate(0deg); }
               50%  { bottom: 10%; right: 20%; transform: scale(0.9) rotate(-90deg); }
               100% { bottom: -5%; right: 40%; transform: scale(1.1) rotate(-180deg); }
             }
             @keyframes aurora-drift-3 {
               0%   { top: 20%; left: -20%; transform: scale(1) rotate(0deg); }
               50%  { top: 40%; left: 60%; transform: scale(1.15) rotate(90deg); }
               100% { top: 15%; left: 10%; transform: scale(1) rotate(180deg); }
             }
           ` }} />
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useState, useEffect } from 'react';

import { getColombiaDate } from '@/utils/calculator-dates';

interface ObjectiveBorealCardProps {
  totalUsdBruto: number;
  cuotaMinima: number;
  periodGoal: { goalUsd: number; periodBilledUsd: number } | null;
  netoDisponibleCop?: number;
  anticipoMaxCop?: number;
}

export default function ObjectiveBorealCard({
  totalUsdBruto,
  cuotaMinima,
  periodGoal,
  netoDisponibleCop,
  anticipoMaxCop
}: ObjectiveBorealCardProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  const porcentajeAlcanzado = cuotaMinima > 0 ? (totalUsdBruto / cuotaMinima) * 100 : 0;
  const estaPorDebajo = totalUsdBruto < cuotaMinima;

  const roundedProgress = Math.max(0, Math.min(100, Math.round(porcentajeAlcanzado)));
  const remainingPct = Math.max(0, 100 - roundedProgress);
  
  // Cálculo de promedio diario faltante
  const colDate = getColombiaDate();
  const [y, m, d] = colDate.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const nextClosure = d <= 15 ? 15 : lastDay;
  const daysLeft = Math.max(0, nextClosure - d);
  const remaining = periodGoal ? Math.max(0, periodGoal.goalUsd - periodGoal.periodBilledUsd) : 0;
  const dailyAvg = daysLeft > 0 ? remaining / daysLeft : 0;
  
  const isPeriodo = estaPorDebajo; 

  const messages = [];
  if (netoDisponibleCop !== undefined) {
    messages.push({
      text: `Dinero disponible en tienda: $${Math.max(0, Math.round(netoDisponibleCop)).toLocaleString('es-CO')} COP`,
      color: "text-fuchsia-400",
      bgClass: "bg-fuchsia-500",
      shadow: "drop-shadow-[0_0_8px_rgba(232,121,249,0.5)]"
    });
  }
  if (anticipoMaxCop !== undefined) {
    messages.push({
      text: `Disponible para anticipo (90%): $${Math.max(0, Math.round(anticipoMaxCop)).toLocaleString('es-CO')} COP`,
      color: "text-violet-400",
      bgClass: "bg-violet-500",
      shadow: "drop-shadow-[0_0_8px_rgba(167,139,250,0.5)]"
    });
  }
  if (estaPorDebajo && dailyAvg > 0) {
    messages.push({
      text: `Objetivo hoy: $${Math.round(dailyAvg).toLocaleString('es-CO')} prom/día`,
      color: "text-blue-400",
      bgClass: "bg-blue-500",
      shadow: "drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
    });
  }
  if (estaPorDebajo) {
    messages.push({
      text: `Estás a: $${Math.ceil(cuotaMinima - totalUsdBruto)} USD (${remainingPct}%)`,
      color: "text-cyan-400",
      bgClass: "bg-cyan-500",
      shadow: "drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
    });
  } else {
    messages.push({
      text: `¡Logrado! +${Math.max(0, roundedProgress - 100)}%`,
      color: "text-emerald-400",
      bgClass: "bg-emerald-500",
      shadow: "drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
    });
  }

  // Animadores motivacionales
  if (estaPorDebajo) {
    let motivationalTitle = "¡Aquí comenzamos el camino!";
    if (roundedProgress >= 75) motivationalTitle = "¡Ya casi lo logramos!";
    else if (roundedProgress >= 50) motivationalTitle = "¡Vamos a mitad de camino!";
    else if (roundedProgress >= 25) motivationalTitle = "¡Logramos el primer cuarto!";
    
    messages.push({
      text: motivationalTitle,
      color: "text-emerald-300",
      bgClass: "bg-emerald-400",
      shadow: "drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
    });
  }

  if (messages.length === 0) {
    messages.push({
      text: "Calculando métricas...",
      color: "text-gray-400",
      bgClass: "bg-gray-500",
      shadow: "drop-shadow-[0_0_0_rgba(0,0,0,0)]"
    });
  }

  // Intervalo de cambio de texto (6 segundos)
  useEffect(() => {
    const t = setInterval(() => setMsgIndex((prev) => prev + 1), 6000);
    return () => clearInterval(t);
  }, [messages.length]);

  const currentMessage = messages[msgIndex % messages.length];

  return (
    <div
      className={`relative overflow-hidden rounded-[1.25rem] sm:rounded-2xl bg-white/40 dark:bg-[#0a0a0ade] max-sm:dark:bg-[#0a0a0a] backdrop-blur-xl border border-white/50 dark:border-white/[0.05] max-sm:dark:border-white/10 transition-all duration-700 shadow-sm dark:shadow-none`}
    >
      {/* Efecto Aurora de Fondo Dinámico */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/15 blur-[50px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-1"></div>
        <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/15 blur-[60px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-2"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/15 blur-[45px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-3"></div>
      </div>

      <div className="relative p-3 sm:p-4 z-10">
        <div className="flex items-start sm:items-center space-x-3">
          
          {/* Contenido principal */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="flex items-center flex-1 min-w-0">
                {/* Objetivo - Texto limpio */}
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100 shrink-0 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  Objetivo
                </div>
                
                {/* Barra Vertical Separadora Dinámica */}
                <div className={`transition-all duration-500 ease-in-out w-[2.5px] h-3.5 sm:h-4 ml-1 mr-2 sm:mr-2.5 shrink-0 rounded-full ${currentMessage.bgClass} shadow-[0_0_6px_currentColor]`}></div>
                
                {/* Métrica Dinámica Marquee (Saliendo de la barra) */}
                <div
                  className={`text-xs sm:text-[13px] font-bold tracking-tight flex items-center h-5 flex-1 relative overflow-hidden`}
                >
                  <div 
                    key={msgIndex % messages.length}
                    className={`absolute left-0 whitespace-nowrap animate-slide-bar min-w-0 truncate ${currentMessage.color} ${currentMessage.shadow}`}
                  >
                    {currentMessage.text}
                  </div>
                </div>
              </div>
            </div>

            {/* Barra Neón Boreal */}
            <div className="mt-2.5 sm:mt-3 flex items-center gap-2 sm:gap-3">
              <div className="relative flex-1 bg-gray-900/80 rounded-full h-1.5 ring-1 ring-white/5">
                <div 
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_current] flex items-center justify-end"
                  style={{ 
                    width: `${Math.min(porcentajeAlcanzado, 100)}%`,
                    background: estaPorDebajo 
                      ? 'linear-gradient(90deg, #c026d3, #06b6d4, #10b981)' 
                      : 'linear-gradient(90deg, #10b981, #34d399)'
                  }}
                >
                  {/* Esfera Brillante (Reactor Core) */}
                  {Math.min(porcentajeAlcanzado, 100) > 0 && (
                    <div className="absolute -right-1.5 w-3 h-3 bg-white rounded-full 
                                    shadow-[0_0_10px_3px_rgba(255,255,255,0.8),0_0_20px_6px_rgba(6,182,212,0.6)] 
                                    border border-white/50 z-10 transition-transform duration-1000">
                    </div>
                  )}
                </div>
              </div>
              
              {/* Píldora Porcentaje Avanzado */}
              <div className="px-2 py-[3px] rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[9.5px] sm:text-[10px] font-extrabold text-[#e2e8f0] shadow-sm flex items-center justify-center shrink-0 min-w-[38px] tracking-wider text-center">
                {roundedProgress}%
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .milestones-overlay { z-index: 10; pointer-events: none; }
        /* Borde temporal de diagnóstico: comentar cuando confirmemos */
        /* .milestones-overlay { outline: 1px dashed rgba(255,255,255,0.5); } */
        #objective-basic-card.in-view[data-milestone="0"] .milestone-shine { animation: none; }
        #objective-basic-card.in-view[data-milestone="25"] .milestone-shine {
          animation: shine-sweep 1.3s cubic-bezier(0.22, 1, 0.36, 1) 1;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          position: absolute; top: 0; left: -35%; width: 45%; height: 100%;
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-wave {
          animation: wave-run 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1;
          position: absolute; inset: 0; opacity: 0.22;
          background: radial-gradient(120% 60% at 0% 50%, rgba(255,255,255,0.75), transparent 60%);
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-particles {
          position: absolute; inset: 0; pointer-events: none;
          animation: particles-pop 1s cubic-bezier(0.16, 1, 0.3, 1) 1;
          background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.6) 0 2px, transparent 3px),
                      radial-gradient(circle at 50% 30%, rgba(255,255,255,0.6) 0 2px, transparent 3px),
                      radial-gradient(circle at 70% 60%, rgba(255,255,255,0.6) 0 2px, transparent 3px);
          background-repeat: no-repeat;
        }
          /* 75%: sparkle trail y pulso de barra */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-sparkle {
            position: absolute; inset: 0; pointer-events: none; opacity: 0.25;
            animation: sparkle-run 1.2s ease-out 1;
            background: radial-gradient(circle at 30% 60%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 60% 40%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 80% 55%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px);
            background-repeat: no-repeat;
          }
          /* Ripple en el 50%-100% al pasar umbral 75% */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-ripple {
            position: absolute; inset: 0; pointer-events: none;
            animation: ripple-pop 900ms ease-out 1;
            background: radial-gradient(circle at 15% 50%, rgba(255,255,255,0.35) 0 30px, transparent 31px),
                        radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0 24px, transparent 25px),
                        radial-gradient(circle at 85% 50%, rgba(255,255,255,0.35) 0 30px, transparent 31px);
            background-repeat: no-repeat;
          }
          /* Efecto de Luces Boreal (Aurora) */
          @keyframes aurora-1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
            33% { transform: translate(30%, 15%) scale(1.1); opacity: 1; }
            66% { transform: translate(15%, 35%) scale(0.9); opacity: 0.7; }
          }
          @keyframes aurora-2 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
            33% { transform: translate(-30%, 20%) scale(0.9); opacity: 0.9; }
            66% { transform: translate(-15%, -15%) scale(1.1); opacity: 0.6; }
          }
          @keyframes aurora-3 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
            50% { transform: translate(35%, -30%) scale(1.2); opacity: 0.6; }
          }
          .animate-aurora-1 { animation: aurora-1 12s ease-in-out infinite alternate; }
          .animate-aurora-2 { animation: aurora-2 15s ease-in-out infinite alternate; }
          .animate-aurora-3 { animation: aurora-3 18s ease-in-out infinite alternate; }

          /* Animación Marquee - Sale y Entra desde la barra lateral */
          @keyframes slide-bar {
            0% { transform: translateX(-100%); opacity: 0; filter: blur(2px); }
            8% { transform: translateX(0); opacity: 1; filter: blur(0); }
            92% { transform: translateX(0); opacity: 1; filter: blur(0); }
            100% { transform: translateX(-100%); opacity: 0; filter: blur(2px); }
          }
          .animate-slide-bar {
            animation: slide-bar 6000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          @keyframes ripple-pop {
            0% { transform: scale(0.9); opacity: 0; }
            50% { opacity: 0.35; }
            100% { transform: scale(1.05); opacity: 0; }
          }

          /* Confetti suave al 100% adicional */
          #objective-basic-card.in-view[data-milestone="100"] .milestone-confetti {
            position: absolute; inset: 0; pointer-events: none;
            animation: confetti-fall 900ms ease-out 1;
            background: radial-gradient(circle at 25% 20%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 65% 10%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 80% 30%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px);
            background-repeat: no-repeat;
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-10px); opacity: 0; }
            60% { opacity: 1; }
            100% { transform: translateY(10px); opacity: 0; }
          }

          /* Pulso de la barra en 75% */
          #objective-basic-card.in-view[data-milestone="75"] .progress-inner { animation: bar-pulse 800ms ease-out 1; }
          @keyframes bar-pulse {
            0% { filter: brightness(1); }
            40% { filter: brightness(1.25); }
            100% { filter: brightness(1); }
          }

        @keyframes shine-sweep {
          0% { transform: translateX(0) skewX(-10deg); }
          100% { transform: translateX(280%) skewX(-10deg); }
        }
        @keyframes wave-run {
          0% { background-position: -220% 0; }
          100% { background-position: 220% 0; }
        }
        @keyframes particles-pop {
          0% { opacity: 0; transform: scale(0.9); filter: blur(1px); }
          25% { opacity: 1; transform: scale(1.06); filter: blur(0); }
          100% { opacity: 0; transform: scale(1); }
        }
          @keyframes sparkle-run {
            0% { transform: translateX(-10%); opacity: 0; }
            40% { opacity: 0.25; }
            100% { transform: translateX(30%); opacity: 0; }
          }

          /* Refuerzo visual en barra al 75% */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-title { animation: title-glow 1000ms ease-out 1; }

          /* Refuerzos por hito */
          #objective-basic-card.in-view[data-milestone="25"] .milestone-icon { animation: icon-tilt 600ms ease-out 1; }
          @keyframes icon-tilt {
            0% { transform: rotate(0deg); }
            40% { transform: rotate(-8deg); }
            100% { transform: rotate(0deg); }
          }
          #objective-basic-card.in-view[data-milestone="50"] .milestone-title { animation: title-glow 900ms ease-out 1; }
          @keyframes title-glow {
            0% { text-shadow: 0 0 0 rgba(255,255,255,0); }
            40% { text-shadow: 0 2px 10px rgba(255,255,255,0.45); }
            100% { text-shadow: 0 0 0 rgba(255,255,255,0); }
          }
          #objective-basic-card.in-view[data-milestone="100"] .milestone-icon { animation: icon-pop 700ms ease-out 1; }
          @keyframes icon-pop {
            0% { transform: scale(1); }
            40% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }

        @media (prefers-reduced-motion: reduce) {
          #objective-basic-card .milestone-shine,
          #objective-basic-card .milestone-wave,
          #objective-basic-card .milestone-particles { animation: none !important; }
        }

        /* ================= EFECTOS VISUALES PROGRESIVOS POR HITO ================ */
        
        /* 0% - Efecto sutil de enfoque */
        #objective-basic-card.in-view[data-milestone="0"] { 
          animation: focus-in 600ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes focus-in { 
          0% { filter: blur(1px); box-shadow: 0 0 0 rgba(0,0,0,0); } 
          100% { filter: blur(0); box-shadow: 0 8px 18px rgba(0,0,0,0.06); 
        } }

        /* 25% - Efecto de sello con brillo suave */
        #objective-basic-card.in-view[data-milestone="25"] .milestone-stamp {
          position: absolute; top: -18%; left: 18%; width: 110px; height: 66px; opacity: 0.9;
          background: radial-gradient(closest-side, rgba(255,255,255,0.85), transparent 70%);
          transform: rotate(-8deg);
          animation: stamp-drop 800ms cubic-bezier(0.22,1,0.36,1) 1;
        }
        @keyframes stamp-drop { 
          0% { transform: translateY(-24px) rotate(-8deg); opacity: 0; } 
          60% { transform: translateY(0) rotate(-8deg); opacity: 0.95; } 
          100% { opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="25"] .milestone-ticks {
          position: absolute; inset: 0; 
          background: repeating-linear-gradient(90deg, rgba(255,255,255,0.9) 0 5px, transparent 5px 12px);
          -webkit-mask-image: linear-gradient(90deg, black 0% 35%, transparent 36%);
          mask-image: linear-gradient(90deg, black 0% 35%, transparent 36%);
          animation: ticks-burst 520ms steps(6) 1;
        }
        @keyframes ticks-burst { 
          0% { opacity: 0; } 
          100% { opacity: 1; } 
        }

        /* 50% - Efecto de rotación 3D y partículas */
        #objective-basic-card.in-view[data-milestone="50"] .milestone-title { 
          animation: title-pivot 700ms cubic-bezier(0.22,1,0.36,1) 1; 
          transform-origin: left center; 
        }
        @keyframes title-pivot { 
          0% { transform: perspective(500px) rotateY(0deg); } 
          50% { transform: perspective(500px) rotateY(8deg); } 
          100% { transform: perspective(500px) rotateY(0deg); } 
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-skipper { 
          position: absolute; top: 42%; left: 0; width: 10px; height: 10px; 
          border-radius: 999px; background: rgba(255,255,255,0.95); 
          animation: skipper-run 700ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes skipper-run { 
          0% { transform: translateX(0) translateY(0); filter: blur(0); } 
          50% { transform: translateX(45%) translateY(-4px); filter: blur(1px); } 
          100% { transform: translateX(60%) translateY(0); opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-sweep { 
          position: absolute; inset: 0; 
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%); 
          animation: sweep-run 900ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes sweep-run { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }

        /* 75% - Efecto de cometa con elevación y pulso de barra */
        #objective-basic-card.in-view[data-milestone="75"] { 
          animation: elevate-75 600ms cubic-bezier(0.16,1,0.3,1) 1; 
        }
        @keyframes elevate-75 { 
          0% { box-shadow: 0 6px 10px rgba(0,0,0,0.04); } 
          50% { box-shadow: 0 14px 24px rgba(0,0,0,0.08); } 
          100% { box-shadow: 0 10px 16px rgba(0,0,0,0.06); } 
        }
        #objective-basic-card.in-view[data-milestone="75"] .milestone-comet { 
          position: absolute; top: 44%; left: -5%; width: 120px; height: 3px; 
          background: linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.95)); 
          filter: blur(0.6px); 
          animation: comet-run 900ms cubic-bezier(0.16,1,0.3,1) 1; 
        }
        @keyframes comet-run { 
          0% { transform: translateX(0); opacity: 0; } 
          20% { opacity: 1; } 
          100% { transform: translateX(110%); opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="75"] .progress-inner { 
          animation: bar-pulse-strong 820ms ease-out 1; 
        }
        @keyframes bar-pulse-strong { 
          0% { filter: brightness(1); } 
          40% { filter: brightness(1.3); } 
          100% { filter: brightness(1); } 
        }

        /* 100% - Efecto espectacular de celebración */
        #objective-basic-card.in-view[data-milestone="100"] .milestone-ribbon { 
          position: absolute; right: -2%; top: 36%; height: 10px; width: 0; 
          background: rgba(255,255,255,0.95); border-radius: 6px; 
          animation: ribbon-open 1000ms cubic-bezier(0.22,1,0.36,1) 1 forwards; 
        }
        @keyframes ribbon-open { 
          0% { width: 0; } 
          60% { width: 38%; } 
          100% { width: 34%; } 
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-icon { 
          animation: trophy-pop 700ms ease-out 1; 
        }
        @keyframes trophy-pop { 
          0% { transform: scale(1) rotate(0); } 
          40% { transform: scale(1.18) rotate(-6deg); } 
          100% { transform: scale(1) rotate(0); } 
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-confetti { 
          position: absolute; inset: 0; 
          background: repeating-linear-gradient(180deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 6px); 
          -webkit-mask-image: linear-gradient(180deg, black 0 60%, transparent 60%); 
          mask-image: linear-gradient(180deg, black 0 60%, transparent 60%); 
          animation: confetti-lines 820ms ease-out 1; 
        }
        @keyframes confetti-lines { 
          0% { transform: translateY(-12px); opacity: 0; } 
          40% { opacity: 1; } 
          100% { transform: translateY(8px); opacity: 0; } 
        }
      `}</style>
    </div>
  );
}

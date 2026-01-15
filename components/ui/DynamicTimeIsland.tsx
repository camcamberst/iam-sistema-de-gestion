'use client';

import React, { useState, useEffect } from 'react';
import { getEuropeanCentralMidnightInColombia, getColombiaDate } from '@/utils/period-closure-dates';

interface DynamicTimeIslandProps {
  className?: string;
}

export default function DynamicTimeIsland({ className = '' }: DynamicTimeIslandProps) {
  const [times, setTimes] = useState({
    europe: '',
    japan: '',
    uk: '',
    colombia: ''
  });
  
  const [countdown, setCountdown] = useState<{
    early: { label: string; time: string; active: boolean };
    full: { label: string; time: string; active: boolean };
  }>({
    early: { label: 'Cierre Plataformas Europeas', time: '', active: false },
    full: { label: 'Cierre de Período', time: '', active: false }
  });

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      
      const formatTime = (tz: string) => {
        return new Intl.DateTimeFormat('es-CO', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(now);
      };

      setTimes({
        europe: formatTime('Europe/Berlin'),
        japan: formatTime('Asia/Tokyo'),
        uk: formatTime('Europe/London'),
        colombia: formatTime('America/Bogota')
      });

      // Calcular countdowns
      const colDate = getColombiaDate();
      const [year, month, day] = colDate.split('-').map(Number);
      
      // Día de cierre relevante (15 o último día)
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const isClosureDay = day === 15 || day === lastDayOfMonth;
      
      if (isClosureDay) {
        // 1. Countdown Early Freeze (Medianoche Europa Central en hora Colombia)
        const europeMidnight = getEuropeanCentralMidnightInColombia(now);
        const earlyTarget = europeMidnight.colombiaDateTime;
        
        const diffEarly = earlyTarget.getTime() - now.getTime();
        
        // 2. Countdown Full Closure (00:00 Colombia del día siguiente)
        const fullTarget = new Date(now);
        fullTarget.setHours(24, 0, 0, 0); // Inicio del próximo día (00:00)
        
        const diffFull = fullTarget.getTime() - now.getTime();

        const formatDiff = (diff: number) => {
          if (diff <= 0) return 'Cerrado';
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          return `${h}h ${m}m ${s}s`;
        };

        setCountdown({
          early: { 
            label: 'Cierre Plataformas Europeas', 
            time: formatDiff(diffEarly), 
            active: diffEarly > 0 
          },
          full: { 
            label: 'Cierre de Período Total', 
            time: formatDiff(diffFull), 
            active: diffFull > 0 
          }
        });
      } else {
        // No es día de cierre, mostrar días restantes hasta el próximo cierre
        const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
        const daysLeft = nextClosureDay - day;
        
        setCountdown({
          early: { label: '', time: '', active: false },
          full: { 
            label: 'Días para el cierre', 
            time: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`, 
            active: true 
          }
        });
      }
    };

    updateTimes();
    const timer = setInterval(updateTimes, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`w-full max-w-4xl mx-auto mb-6 px-2 ${className}`}>
      <div className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-lg p-1 sm:p-1.5 flex flex-col md:flex-row items-center gap-2 md:gap-4 ring-1 ring-black/5 dark:ring-white/10">
        {/* Relojes Mundo */}
        <div className="flex items-center gap-3 px-4 py-2 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 w-full md:w-auto justify-center">
          <ClockItem label="EUR" time={times.europe} icon="🇪🇺" color="blue" />
          <ClockItem label="UK" time={times.uk} icon="🇬🇧" color="purple" />
          <ClockItem label="JPN" time={times.japan} icon="🇯🇵" color="red" />
        </div>

        {/* Info de Cierre / Countdown */}
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 px-4 py-2 w-full justify-center sm:justify-start">
          {countdown.early.active && (
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 leading-none mb-1">
                  {countdown.early.label}
                </span>
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {countdown.early.time}
                </span>
              </div>
            </div>
          )}
          
          {countdown.full.active && (
            <div className="flex items-center gap-2">
              <span className={`flex h-2 w-2 rounded-full ${countdown.full.label.includes('Días') ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 leading-none mb-1">
                  {countdown.full.label}
                </span>
                <span className={`text-sm font-mono font-bold leading-none ${countdown.full.label.includes('Días') ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                  {countdown.full.time}
                </span>
              </div>
            </div>
          )}

          {!countdown.early.active && !countdown.full.active && (
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Cargando información del período...
            </span>
          )}
        </div>

        {/* Hora Local (Colombia) */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gray-100/50 dark:bg-gray-700/50 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">COL</span>
          <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">{times.colombia}</span>
        </div>
      </div>
    </div>
  );
}

function ClockItem({ label, time, icon, color }: { label: string; time: string; icon: string; color: 'blue' | 'purple' | 'red' }) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600 dark:text-red-400'
  };

  return (
    <div className="flex flex-col items-center min-w-[60px]">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">{label}</span>
      </div>
      <span className={`text-xs font-mono font-bold ${colorMap[color]}`}>{time || '--:--:--'}</span>
    </div>
  );
}

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
    early: { label: string; time: string; targetTime: string; active: boolean };
    full: { label: string; time: string; targetTime: string; active: boolean };
  }>({
    early: { label: 'Cierre Especial (EUR)', time: '', targetTime: '', active: false },
    full: { label: 'Cierre de Período', time: '', targetTime: '', active: false }
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
          hour12: true
        }).format(now).toUpperCase();
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

        const formatTarget = (date: Date) => {
          return new Intl.DateTimeFormat('es-CO', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }).format(date).toUpperCase();
        };

        setCountdown({
          early: { 
            label: 'Cierre Especial (EUR)', 
            time: formatDiff(diffEarly), 
            targetTime: formatTarget(earlyTarget),
            active: diffEarly > 0 
          },
          full: { 
            label: 'Cierre Total (COL)', 
            time: formatDiff(diffFull), 
            targetTime: '12:00 AM', // Siempre medianoche Colombia
            active: diffFull > 0 
          }
        });
      } else {
        // No es día de cierre, mostrar días restantes hasta el próximo cierre
        const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
        const daysLeft = nextClosureDay - day;
        
        setCountdown({
          early: { label: '', time: '', targetTime: '', active: false },
          full: { 
            label: 'Días para el cierre', 
            time: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`, 
            targetTime: 'Próx. Quincena',
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
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-8 px-4 py-2 w-full justify-center sm:justify-start">
          {countdown.early.active && (
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-black text-gray-500 dark:text-gray-400 leading-none">
                    {countdown.early.label}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                    {countdown.early.targetTime}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {countdown.early.time}
                </span>
              </div>
            </div>
          )}
          
          {countdown.full.active && (
            <div className="flex items-center gap-3">
              <span className={`flex h-2 w-2 rounded-full ${countdown.full.label.includes('Días') ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} />
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-black text-gray-500 dark:text-gray-400 leading-none">
                    {countdown.full.label}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${countdown.full.label.includes('Días') ? 'text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-900/30' : 'text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30'}`}>
                    {countdown.full.targetTime}
                  </span>
                </div>
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

  // Separar la hora del AM/PM para un estilo diferente si se desea, 
  // o simplemente mostrar todo junto
  const timeParts = time.split(' ');
  const displayTime = timeParts[0];
  const ampm = timeParts[1] || '';

  return (
    <div className="flex flex-col items-center min-w-[75px]">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-xs font-mono font-bold ${colorMap[color]}`}>{displayTime || '--:--:--'}</span>
        <span className={`text-[8px] font-black ${colorMap[color]} opacity-70`}>{ampm}</span>
      </div>
    </div>
  );
}

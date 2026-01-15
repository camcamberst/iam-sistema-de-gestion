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
  
  const [tickerIndex, setTickerIndex] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      
      const formatTime = (tz: string) => {
        return new Intl.DateTimeFormat('es-CO', {
          timeZone: tz,
          hour: 'numeric',
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

      // Lógica de mensajes para el ticker
      const colDate = getColombiaDate();
      const [year, month, day] = colDate.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      
      const isClosureDay = day === 15 || day === lastDayOfMonth;
      
      const newMessages: string[] = [];

      const formatDiff = (diff: number) => {
        if (diff <= 0) return 'CERRADO';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
      };

      // DÍAS DE CIERRE (15 y fin de mes): Mostrar los 3 contadores
      if (isClosureDay) {
        // 1. DXLive (10:00 AM Colombia) - NO calcular para mañana si ya pasó
        const dxTarget = new Date(now);
        dxTarget.setHours(10, 0, 0, 0);
        const diffDx = dxTarget.getTime() - now.getTime();
        const dxStatus = formatDiff(diffDx);
        newMessages.push(`${dxStatus} para cierre de periodo dxlive`);

        // 2. Páginas Eur (Medianoche Europa Central ~ 6:00 PM COL)
        const europeMidnight = getEuropeanCentralMidnightInColombia(now);
        const eurTarget = europeMidnight.colombiaDateTime;
        const diffEur = eurTarget.getTime() - now.getTime();
        const eurStatus = formatDiff(diffEur);
        newMessages.push(`${eurStatus} para cierre de periodo páginas Eur`);

        // 3. Cierre Total (Medianoche Colombia del día siguiente)
        const totalTarget = new Date(now);
        totalTarget.setHours(24, 0, 0, 0); // 00:00 del próximo día
        const diffTotal = totalTarget.getTime() - now.getTime();
        const totalStatus = formatDiff(diffTotal);
        newMessages.push(`${totalStatus} para cierre total de periodo`);
      } else {
        // DÍAS NORMALES: Mostrar cuántos días faltan
        const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
        const daysLeft = nextClosureDay - day;
        newMessages.push(`${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para el próximo cierre de periodo`);
      }

      setMessages(newMessages);
    };

    updateTimes();
    const timer = setInterval(updateTimes, 1000);
    return () => clearInterval(timer);
  }, []);

  // Efecto para rotar el ticker cada 4 segundos
  useEffect(() => {
    if (messages.length <= 1) return;
    const tickerTimer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(tickerTimer);
  }, [messages.length]);

  return (
    <div className={`w-full max-w-full mx-auto mb-4 px-2 ${className}`}>
      <div className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-xl border border-white/20 dark:border-gray-700/30 shadow-sm py-1 px-4 flex flex-row items-center justify-between gap-4 ring-1 ring-black/5 dark:ring-white/10 h-10 sm:h-12">
        
        {/* Sección Relojes: Muy compacta y horizontal */}
        <div className="flex items-center gap-4 sm:gap-6 border-r border-gray-200 dark:border-gray-700 pr-4 h-full">
          <ClockItem label="EUR" time={times.europe} color="blue" />
          <ClockItem label="UK" time={times.uk} color="purple" />
          <ClockItem label="JPN" time={times.japan} color="red" />
          <div className="hidden lg:flex items-center gap-1.5 opacity-60">
            <span className="text-[9px] font-black text-gray-400 uppercase">COL</span>
            <span className="text-[10px] font-mono font-bold text-gray-600 dark:text-gray-300">{times.colombia}</span>
          </div>
        </div>

        {/* Sección Ticker: Dinámica y fluida */}
        <div className="flex-1 flex items-center overflow-hidden h-full relative">
          {messages.length > 0 && (
            <div 
              key={tickerIndex}
              className="flex items-center gap-2 animate-fade-in-right whitespace-nowrap"
            >
              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
              <p className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight">
                {messages[tickerIndex]}
              </p>
            </div>
          )}
        </div>

        {/* Estilo para la animación */}
        <style jsx global>{`
          @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(10px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-fade-in-right {
            animation: fadeInRight 0.5s ease-out forwards;
          }
        `}</style>
      </div>
    </div>
  );
}

function ClockItem({ label, time, color }: { label: string; time: string; color: 'blue' | 'purple' | 'red' }) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600 dark:text-red-400'
  };

  // Extraer hora y AM/PM del string formateado
  const parts = time.split('\u00A0'); // Espacio de no ruptura que suele usar Intl.DateTimeFormat
  const mainTime = parts[0] || time.split(' ')[0];
  const ampm = parts[1] || time.split(' ')[1] || '';

  return (
    <div className="flex flex-row items-baseline gap-1.5">
      <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-[11px] sm:text-xs font-mono font-bold ${colorMap[color]}`}>{mainTime}</span>
        <span className={`text-[8px] font-black ${colorMap[color]} opacity-70`}>{ampm}</span>
      </div>
    </div>
  );
}

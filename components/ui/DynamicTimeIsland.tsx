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
  const [messages, setMessages] = useState<Array<{ text: string; urgent: boolean; closed: boolean }>>([]);

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
      
      const newMessages: Array<{ text: string; urgent: boolean; closed: boolean }> = [];

      const formatDiff = (diff: number) => {
        if (diff <= 0) return 'Periodo cerrado';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
      };

      // 30 minutos en milisegundos
      const THIRTY_MINUTES = 30 * 60 * 1000;

      // DÍAS DE CIERRE (15 y fin de mes): Mostrar los 3 contadores
      if (isClosureDay) {
        // 1. DXLive (10:00 AM Colombia del DÍA ACTUAL de cierre)
        const dxTarget = new Date(now);
        dxTarget.setHours(10, 0, 0, 0);
        const diffDx = dxTarget.getTime() - now.getTime();
        const dxStatus = formatDiff(diffDx);
        const dxUrgent = diffDx > 0 && diffDx <= THIRTY_MINUTES;
        const dxClosed = diffDx <= 0;
        newMessages.push({ 
          text: dxClosed ? 'Periodo cerrado para dxlive' : `${dxStatus} para cierre de periodo dxlive`, 
          urgent: dxUrgent,
          closed: dxClosed
        });

        // 2. Páginas Eur (Medianoche Europa Central del DÍA ACTUAL de cierre)
        const europeMidnight = getEuropeanCentralMidnightInColombia(now);
        let eurTarget = europeMidnight.colombiaDateTime;
        
        // Obtener fecha en Colombia del eurTarget
        const eurTargetColDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(eurTarget);
        
        // Si el target es de ayer, recalcular para hoy
        if (eurTargetColDate < colDate) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowMidnight = getEuropeanCentralMidnightInColombia(tomorrow);
          eurTarget = tomorrowMidnight.colombiaDateTime;
        }
        
        const diffEur = eurTarget.getTime() - now.getTime();
        const eurStatus = formatDiff(diffEur);
        const eurUrgent = diffEur > 0 && diffEur <= THIRTY_MINUTES;
        const eurClosed = diffEur <= 0;
        newMessages.push({ 
          text: eurClosed ? 'Periodo cerrado para páginas Eur' : `${eurStatus} para cierre de periodo páginas Eur`, 
          urgent: eurUrgent,
          closed: eurClosed
        });

        // 3. Cierre Total (Medianoche Colombia del día siguiente)
        const totalTarget = new Date(now);
        totalTarget.setHours(24, 0, 0, 0);
        const diffTotal = totalTarget.getTime() - now.getTime();
        const totalStatus = formatDiff(diffTotal);
        const totalUrgent = diffTotal > 0 && diffTotal <= THIRTY_MINUTES;
        const totalClosed = diffTotal <= 0;
        newMessages.push({ 
          text: totalClosed ? 'Periodo cerrado (total)' : `${totalStatus} para cierre total de periodo`, 
          urgent: totalUrgent,
          closed: totalClosed
        });
      } else {
        // DÍAS NORMALES: Mostrar cuántos días faltan
        const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
        const daysLeft = nextClosureDay - day;
        newMessages.push({ 
          text: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para el próximo cierre de periodo`, 
          urgent: false,
          closed: false
        });
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

  const currentMessage = messages[tickerIndex];

  return (
    <div className={`w-full max-w-full mx-auto mb-6 px-2 ${className}`}>
      {/* Efecto de fondo glassmorphism */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
        
        <div className="relative overflow-hidden bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-xl border border-white/30 dark:border-gray-700/40 shadow-lg py-1.5 px-6 flex flex-row items-center justify-between gap-6 ring-1 ring-blue-500/10 dark:ring-blue-400/10 h-11">
          
          {/* Sección Relojes: Compacta y horizontal */}
          <div className="flex items-center gap-5 sm:gap-8 border-r border-gray-300/50 dark:border-gray-600/50 pr-6 h-full">
            <ClockItem label="EUR" time={times.europe} icon="🇪🇺" color="blue" />
            <ClockItem label="UK" time={times.uk} icon="🇬🇧" color="purple" />
            <ClockItem label="JPN" time={times.japan} icon="🇯🇵" color="red" />
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700/50 dark:to-gray-700/50 rounded-lg border border-blue-200/50 dark:border-gray-600/50">
              <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">COL</span>
              <span className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200">{times.colombia}</span>
            </div>
          </div>

          {/* Sección Ticker: Dinámica y fluida */}
          <div className="flex-1 flex items-center overflow-hidden h-full relative">
            {currentMessage && (
              <div 
                key={tickerIndex}
                className="flex items-center gap-3 animate-fade-in-smooth whitespace-nowrap"
              >
                <span className={`flex h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  currentMessage.closed
                    ? 'bg-purple-500 dark:bg-purple-400'
                    : currentMessage.urgent 
                    ? 'bg-orange-500 animate-pulse-fast' 
                    : 'bg-blue-500 animate-pulse-slow'
                }`} />
                <p className={`text-xs sm:text-sm font-medium uppercase tracking-wide ${
                  currentMessage.closed
                    ? 'text-purple-600 dark:text-purple-400'
                    : currentMessage.urgent 
                    ? 'text-orange-600 dark:text-orange-400 animate-blink' 
                    : 'text-gray-700 dark:text-gray-200'
                }`}>
                  {currentMessage.text}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Estilos para animaciones */}
      <style jsx global>{`
        @keyframes fadeInSmooth {
          from { opacity: 0; transform: translateX(15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-smooth {
          animation: fadeInSmooth 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }
        
        @keyframes pulseSlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        .animate-pulse-slow {
          animation: pulseSlow 2s ease-in-out infinite;
        }
        
        @keyframes pulseFast {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.9); }
        }
        .animate-pulse-fast {
          animation: pulseFast 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function ClockItem({ label, time, icon, color }: { label: string; time: string; icon: string; color: 'blue' | 'purple' | 'red' }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500',
    purple: 'from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500',
    red: 'from-red-500 to-red-600 dark:from-red-400 dark:to-red-500'
  };

  // Extraer hora y AM/PM del string formateado
  const parts = time.split('\u00A0');
  const mainTime = parts[0] || time.split(' ')[0];
  const ampm = parts[1] || time.split(' ')[1] || '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">{icon}</span>
      <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-sm font-mono font-semibold bg-gradient-to-br ${colorMap[color]} bg-clip-text text-transparent`}>
          {mainTime}
        </span>
        <span className={`text-[8px] font-medium bg-gradient-to-br ${colorMap[color]} bg-clip-text text-transparent opacity-70`}>
          {ampm}
        </span>
      </div>
    </div>
  );
}

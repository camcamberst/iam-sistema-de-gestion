'use client';

import React, { useState, useEffect } from 'react';
import { getEuropeanCentralMidnightInColombia, getColombiaDate } from '@/utils/period-closure-dates';

interface DynamicTimeIslandProps {
  className?: string;
  /** Objetivo básico en USD (cuota mínima de la modelo). Si se pasa junto con facturadoPeriodoUsd, se muestran mensajes de promedio diario. */
  objetivoUsd?: number;
  /** Total facturado en el periodo actual en USD modelo. */
  facturadoPeriodoUsd?: number;
}

export default function DynamicTimeIsland({ className = '', objetivoUsd, facturadoPeriodoUsd }: DynamicTimeIslandProps) {
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
      const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
      const daysLeft = Math.max(0, nextClosureDay - day);
      
      const newMessages: Array<{ text: string; urgent: boolean; closed: boolean }> = [];

      const formatDiff = (diff: number) => {
        if (diff <= 0) return 'Periodo cerrado';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
      };

      const THIRTY_MINUTES = 30 * 60 * 1000;

      if (isClosureDay) {
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

        const europeMidnight = getEuropeanCentralMidnightInColombia(now);
        let eurTarget = europeMidnight.colombiaDateTime;
        const eurTargetColDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(eurTarget);
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
        newMessages.push({ 
          text: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para el próximo cierre de periodo`, 
          urgent: false,
          closed: false
        });
      }

      // Mensajes de objetivo (solo si hay datos y quedan días): rotan en el mismo espacio
      const goal = typeof objetivoUsd === 'number' && objetivoUsd > 0;
      const billed = typeof facturadoPeriodoUsd === 'number';
      if (goal && billed && !isClosureDay && daysLeft > 0) {
        const remaining = Math.max(0, objetivoUsd - facturadoPeriodoUsd);
        const dailyAvg = remaining / daysLeft;
        const formatUsd = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        newMessages.push({ 
          text: `Facturado este periodo: $${formatUsd(facturadoPeriodoUsd)} USD`, 
          urgent: false, 
          closed: false 
        });
        newMessages.push({ 
          text: `Para alcanzar tu objetivo: ~$${formatUsd(dailyAvg)}/día en promedio`, 
          urgent: remaining > 0, 
          closed: false 
        });
      }

      setMessages(newMessages);
    };

    updateTimes();
    const timer = setInterval(updateTimes, 1000);
    return () => clearInterval(timer);
  }, [objetivoUsd, facturadoPeriodoUsd]);

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
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-violet-500/15 rounded-2xl blur-xl" />
        <div className="relative overflow-hidden bg-gradient-to-r from-white/90 to-white/75 dark:from-gray-800/90 dark:to-gray-800/75 backdrop-blur-xl rounded-xl border border-white/40 dark:border-gray-600/50 shadow-lg shadow-blue-500/5 dark:shadow-black/20 py-1.5 px-6 flex flex-row items-center justify-between gap-6 ring-1 ring-inset ring-white/50 dark:ring-gray-500/20 h-11">
          {/* Relojes */}
          <div className="flex items-center gap-5 sm:gap-8 border-r border-gray-200/80 dark:border-gray-600/50 pr-6 h-full">
            <ClockItem label="EUR" time={times.europe} flagCode="eu" color="blue" />
            <ClockItem label="UK" time={times.uk} flagCode="gb" color="purple" />
            <ClockItem label="JPN" time={times.japan} flagCode="jp" color="red" />
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 dark:from-gray-700/60 dark:to-gray-700/60 rounded-lg border border-emerald-200/60 dark:border-gray-600/50">
              <img src="https://flagcdn.com/w20/co.png" alt="" className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" width={20} height={14} />
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">COL</span>
              <span className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200">{times.colombia}</span>
            </div>
          </div>

          {/* Ticker: mismo espacio, mensajes rotativos */}
          <div className="flex-1 flex items-center overflow-hidden h-full relative min-w-0">
            {currentMessage && (
              <div 
                key={tickerIndex}
                className="flex items-center gap-3 animate-fade-in-smooth whitespace-nowrap min-w-0"
              >
                <span className={`flex h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  currentMessage.closed
                    ? 'bg-purple-500 dark:bg-purple-400'
                    : currentMessage.urgent 
                    ? 'bg-amber-500 dark:bg-amber-400 animate-pulse-fast' 
                    : 'bg-emerald-500 dark:bg-emerald-400 animate-pulse-slow'
                }`} />
                <p className={`text-xs sm:text-sm font-medium tracking-wide truncate ${
                  currentMessage.closed
                    ? 'text-purple-600 dark:text-purple-400'
                    : currentMessage.urgent 
                    ? 'text-amber-600 dark:text-amber-400 animate-blink' 
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

function ClockItem({ label, time, flagCode, color }: { label: string; time: string; flagCode: string; color: 'blue' | 'purple' | 'red' }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500',
    purple: 'from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500',
    red: 'from-red-500 to-red-600 dark:from-red-400 dark:to-red-500'
  };

  const parts = time.split('\u00A0');
  const mainTime = parts[0] || time.split(' ')[0];
  let ampm = parts[1] || time.split(' ')[1] || '';
  ampm = ampm.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {/* Imagen de bandera (se ve en todos los sistemas; los emojis en Windows muestran EU/GB/JP) */}
      <img
        src={`https://flagcdn.com/w20/${flagCode}.png`}
        alt=""
        className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0"
        width={20}
        height={14}
      />
      <span className="text-[10px] font-semibold text-gray-800 dark:text-white uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-sm font-mono font-semibold bg-gradient-to-br ${colorMap[color]} bg-clip-text text-transparent`}>
          {mainTime}
        </span>
        <span className="text-[9px] font-semibold text-gray-500 dark:text-white/60">
          {ampm}
        </span>
      </div>
    </div>
  );
}
